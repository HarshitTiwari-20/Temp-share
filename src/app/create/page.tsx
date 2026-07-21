"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  FileText,
  FolderUp,
  Layers,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  EXPIRATION_OPTIONS,
  ROOM_TYPES,
  SUPPORTED_LANGUAGES,
  cn,
} from "@/lib/utils";
import type { RoomTypeId } from "@/lib/utils";

const icons = {
  Code2,
  FileText,
  FolderUp,
  Layers,
};

export default function CreateRoomPage() {
  const router = useRouter();
  const [type, setType] = useState<RoomTypeId>("MIXED");
  const [expiration, setExpiration] = useState("50");
  const [customMinutes, setCustomMinutes] = useState("45");
  const [language, setLanguage] = useState("javascript");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      let minutes = Number(expiration);
      if (expiration === "custom") {
        minutes = Number(customMinutes);
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
          toast.error("Custom expiration must be 1–1440 minutes");
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          expirationMinutes: minutes,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create room");
      }

      toast.success(`Room ${data.room.roomCode} created`);
      // Store token for WS auth
      sessionStorage.setItem(
        `room-token:${data.room.roomCode}`,
        data.token
      );
      router.push(`/room/${data.room.roomCode}?token=${data.token}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 hero-mesh opacity-60" />

      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Create Room</h1>
              <p className="text-sm text-muted-foreground">
                Configure your temporary share space
              </p>
            </div>
          </div>

          <Card className="border-border/60 bg-card/80 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg">Share type</CardTitle>
              <CardDescription>
                Choose what this room is for. Mixed enables all tabs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid gap-3 sm:grid-cols-2">
                {ROOM_TYPES.map((rt) => {
                  const Icon = icons[rt.icon as keyof typeof icons];
                  const selected = type === rt.id;
                  return (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => setType(rt.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                        selected
                          ? "border-violet-500/50 bg-violet-500/10 shadow-sm shadow-violet-500/10"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/40"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          selected
                            ? "bg-violet-500/20 text-violet-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{rt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {rt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Expiration</Label>
                  <Select value={expiration} onValueChange={setExpiration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRATION_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.label}
                          value={
                            opt.minutes === -1
                              ? "custom"
                              : String(opt.minutes)
                          }
                        >
                          {opt.label}
                          {"default" in opt && opt.default ? " (default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {expiration === "custom" && (
                    <div className="pt-2">
                      <Label htmlFor="custom-min" className="text-xs">
                        Custom minutes (1–1440)
                      </Label>
                      <Input
                        id="custom-min"
                        type="number"
                        min={1}
                        max={1440}
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                {(type === "CODE" || type === "MIXED") && (
                  <div className="space-y-2">
                    <Label>Default language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    Generate Room
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
