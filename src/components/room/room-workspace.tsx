"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Code2, FileText, FolderUp, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoomHeader } from "./room-header";
import { CodeEditor } from "./code-editor";
import { TextEditor } from "./text-editor";
import { FileShare } from "./file-share";
import { useSocket } from "@/hooks/use-socket";
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
  const connected = useRoomStore((s) => s.connected);

  useSocket(roomCode, token);

  // Keyboard shortcuts
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
    () => (room ? tabsForType(room.type) : (["code", "text", "files"] as TabId[])),
    [room]
  );

  if (!room || !connected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
          <Loader2 className="relative h-10 w-10 animate-spin text-violet-500" />
        </div>
        <div className="text-center">
          <p className="font-medium">Connecting to room {roomCode}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Establishing real-time session…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <RoomHeader />
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
