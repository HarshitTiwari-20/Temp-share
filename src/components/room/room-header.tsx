"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Copy,
  Check,
  Users,
  Wifi,
  WifiOff,
  QrCode,
  Share2,
  Home,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatCountdown, formatCountdownShort, cn } from "@/lib/utils";
import { useRoomStore } from "@/stores/room-store";

export function RoomHeader() {
  const room = useRoomStore((s) => s.room);
  const users = useRoomStore((s) => s.users);
  const remainingMs = useRoomStore((s) => s.remainingMs);
  const setRemainingMs = useRoomStore((s) => s.setRemainingMs);
  const connected = useRoomStore((s) => s.connected);
  const reconnecting = useRoomStore((s) => s.reconnecting);
  const self = useRoomStore((s) => s.self);

  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [tick, setTick] = useState(remainingMs);

  useEffect(() => {
    setTick(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    if (!room) return;
    const expires = new Date(room.expiresAt).getTime();
    const id = setInterval(() => {
      const left = Math.max(0, expires - Date.now());
      setTick(left);
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [room, setRemainingMs]);

  if (!room) return null;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${room.roomCode}`
      : `/join?code=${room.roomCode}`;

  const copyCode = async () => {
    await navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    toast.success("Room code copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied");
  };

  const urgent = tick < 5 * 60 * 1000;
  const critical = tick < 60 * 1000;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link href="/">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Room
              </span>
              <button
                onClick={copyCode}
                className="group flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 font-mono text-lg font-semibold tracking-[0.2em] transition-colors hover:bg-muted"
              >
                {room.roomCode}
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums",
                    critical
                      ? "border-red-500/40 bg-red-500/10 text-red-400 animate-pulse"
                      : urgent
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                        : "border-border bg-muted/40 text-foreground"
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Expires in </span>
                  {formatCountdown(tick)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {formatCountdownShort(tick)} remaining
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{users.length}</span>
              <span className="hidden text-muted-foreground sm:inline">
                online
              </span>
            </div>

            <Badge
              variant={connected ? "success" : "warning"}
              className="gap-1"
            >
              {connected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {reconnecting
                ? "Reconnecting…"
                : connected
                  ? "Live"
                  : "Offline"}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setQrOpen(true)}
            >
              <QrCode className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={copyLink}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Presence strip */}
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 pb-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: u.cursorColor }}
              />
              <span
                className={cn(
                  self?.id === u.id && "font-semibold text-foreground"
                )}
              >
                {u.anonymousName}
                {self?.id === u.id ? " (you)" : ""}
              </span>
            </div>
          ))}
        </div>
      </header>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan to join</DialogTitle>
            <DialogDescription>
              Room code <span className="font-mono font-semibold">{room.roomCode}</span>{" "}
              is still required after opening the link.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={shareUrl} size={180} level="M" />
            </div>
            <p className="text-center text-xs text-muted-foreground break-all">
              {shareUrl}
            </p>
            <Button variant="outline" onClick={copyLink} className="w-full">
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
