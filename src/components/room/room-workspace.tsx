"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Code2, FileText, FolderUp, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RoomHeader } from "./room-header";
import { CodeEditor } from "./code-editor";
import { TextEditor } from "./text-editor";
import { FileShare } from "./file-share";
import { useSocket, getSocket, getWsUrl } from "@/hooks/use-socket";
import { useRoomStore } from "@/stores/room-store";
import type { RoomType } from "@/lib/types";

interface RoomWorkspaceProps {
  roomCode: string;
  initialToken: string;
}

type TabId = "code" | "text" | "files";

function tabsForType(type: RoomType): TabId[] {
  switch (type) {
    case "CODE":
      return ["code"];
    case "TEXT":
      return ["text"];
    case "FILES":
      return ["files"];
    default:
      return ["code", "text", "files"];
  }
}

export function RoomWorkspace({ roomCode, initialToken }: RoomWorkspaceProps) {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  const token = tokenFromUrl || initialToken;

  const room = useRoomStore((s) => s.room);
  const activeTab = useRoomStore((s) => s.activeTab);
  const setActiveTab = useRoomStore((s) => s.setActiveTab);
  const setRoom = useRoomStore((s) => s.setRoom);
  const connected = useRoomStore((s) => s.connected);
  const reconnecting = useRoomStore((s) => s.reconnecting);

  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [wsWaitMs, setWsWaitMs] = useState(0);

  // 1) Load room over HTTP first — do NOT block UI on WebSocket
  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      setBooting(true);
      setBootError(null);
      try {
        const res = await fetch(`/api/rooms/${roomCode}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Room not found");
        }
        if (!cancelled) {
          // Prefer token from URL / session; fall back to API token
          setRoom(data.room, token || data.token);
          setBooting(false);
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(
            err instanceof Error ? err.message : "Failed to load room"
          );
          setBooting(false);
        }
      }
    }

    loadRoom();
    return () => {
      cancelled = true;
    };
  }, [roomCode, token, setRoom]);

  // 2) Realtime session (optional for viewing; required for live collab)
  useSocket(room ? roomCode : null, room ? token : null);

  // Track how long we've been waiting on WS (for UX message)
  useEffect(() => {
    if (connected || !room) {
      setWsWaitMs(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setWsWaitMs(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, [connected, room]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        setActiveTab("code");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "2") {
        e.preventDefault();
        setActiveTab("text");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "3") {
        e.preventDefault();
        setActiveTab("files");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActiveTab]);

  const availableTabs = useMemo(
    () =>
      room
        ? tabsForType(room.type)
        : (["code", "text", "files"] as TabId[]),
    [room]
  );

  const retryWs = () => {
    const s = getSocket();
    s.disconnect();
    s.connect();
  };

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
        <div className="text-center">
          <p className="font-medium">Loading room {roomCode}</p>
          <p className="text-sm text-muted-foreground mt-1">Fetching room data…</p>
        </div>
      </div>
    );
  }

  if (bootError || !room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-lg font-medium text-destructive">
          {bootError || "Room not found"}
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <RoomHeader />

      {/* Realtime status banner when WS is down */}
      {!connected && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 text-amber-200">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>
                {reconnecting || wsWaitMs > 0
                  ? `Connecting realtime… (${Math.floor(wsWaitMs / 1000)}s). Free-tier WS may be waking up.`
                  : "Realtime offline — you can still edit; sync starts when connected."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline font-mono">
                {getWsUrl()}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={retryWs}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4">
        <Tabs
          value={
            availableTabs.includes(activeTab) ? activeTab : availableTabs[0]
          }
          onValueChange={(v) => setActiveTab(v as TabId)}
          className="flex flex-1 flex-col"
        >
          {availableTabs.length > 1 && (
            <TabsList className="mb-4 w-full sm:w-auto justify-start">
              {availableTabs.includes("code") && (
                <TabsTrigger value="code" className="gap-1.5">
                  <Code2 className="h-3.5 w-3.5" />
                  Code
                </TabsTrigger>
              )}
              {availableTabs.includes("text") && (
                <TabsTrigger value="text" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Text
                </TabsTrigger>
              )}
              {availableTabs.includes("files") && (
                <TabsTrigger value="files" className="gap-1.5">
                  <FolderUp className="h-3.5 w-3.5" />
                  Files
                </TabsTrigger>
              )}
            </TabsList>
          )}

          {availableTabs.includes("code") && (
            <TabsContent
              value="code"
              className="flex-1 mt-0 focus-visible:outline-none"
            >
              <CodeEditor />
            </TabsContent>
          )}
          {availableTabs.includes("text") && (
            <TabsContent
              value="text"
              className="flex-1 mt-0 focus-visible:outline-none"
            >
              <TextEditor />
            </TabsContent>
          )}
          {availableTabs.includes("files") && (
            <TabsContent
              value="files"
              className="flex-1 mt-0 focus-visible:outline-none"
            >
              <FileShare />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
