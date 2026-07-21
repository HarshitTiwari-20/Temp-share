"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, LogIn } from "lucide-react";
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
import { ThemeToggle } from "@/components/theme-toggle";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preset = searchParams.get("code") || "";

  const [code, setCode] = useState(preset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preset) setCode(preset.replace(/\D/g, "").slice(0, 8));
  }, [preset]);

  const handleJoin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    const cleaned = code.replace(/\D/g, "");
    if (!/^\d{6,8}$/.test(cleaned)) {
      setError("Enter a 6–8 digit room code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${cleaned}/join`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "EXPIRED") {
          setError("Room expired");
        } else if (data.code === "NOT_FOUND") {
          setError("Room not found");
        } else {
          setError(data.error || "Unable to join room");
        }
        return;
      }

      sessionStorage.setItem(`room-token:${cleaned}`, data.token);
      toast.success(`Joined room ${cleaned}`);
      router.push(`/room/${cleaned}?token=${data.token}`);
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-lg">Enter room code</CardTitle>
        <CardDescription>
          Numeric codes only — example: 483920
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleJoin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="room-code">Room Code</Label>
            <Input
              id="room-code"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="483920"
              value={code}
              onChange={(e) => {
                setError(null);
                setCode(e.target.value.replace(/\D/g, "").slice(0, 8));
              }}
              className="h-14 text-center font-mono text-2xl tracking-[0.35em] placeholder:tracking-[0.35em] placeholder:text-muted-foreground/40"
              maxLength={8}
            />
            {error && (
              <p className="text-sm text-destructive font-medium" role="alert">
                {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={loading || code.length < 6}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Joining…
              </>
            ) : (
              <>
                Join Room
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function JoinRoomPage() {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 hero-mesh opacity-60" />

      <header className="relative z-10 mx-auto flex max-w-md items-center justify-between px-4 py-5">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto max-w-md px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
              <LogIn className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Join Room</h1>
              <p className="text-sm text-muted-foreground">
                Instant access with a room code
              </p>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <JoinForm />
          </Suspense>
        </motion.div>
      </main>
    </div>
  );
}
