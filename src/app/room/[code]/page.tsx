"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RoomWorkspace } from "@/components/room/room-workspace";

function RoomLoader() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = String(params.code || "");
  const tokenParam = searchParams.get("token");

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!/^\d{6,8}$/.test(code)) {
        setError("Invalid room code");
        return;
      }

      let t =
        tokenParam ||
        (typeof window !== "undefined"
          ? sessionStorage.getItem(`room-token:${code}`)
          : null);

      if (!t) {
        // Fetch join endpoint to obtain token
        try {
          const res = await fetch(`/api/rooms/${code}/join`, {
            method: "POST",
          });
          const data = await res.json();
          if (!res.ok) {
            if (data.code === "EXPIRED") {
              setError("Room expired");
              toast.error("Room expired");
              setTimeout(() => router.push("/"), 2000);
            } else {
              setError(data.error || "Room not found");
            }
            return;
          }
          t = data.token as string;
          sessionStorage.setItem(`room-token:${code}`, t);
        } catch {
          setError("Failed to connect");
          return;
        }
      }

      if (!cancelled && t) {
        setToken(t);
        setReady(true);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [code, tokenParam, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-lg font-medium text-destructive">{error}</p>
        <Link href="/" className="text-sm text-muted-foreground underline">
          Back home
        </Link>
      </div>
    );
  }

  if (!ready || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return <RoomWorkspace roomCode={code} initialToken={token} />;
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      }
    >
      <RoomLoader />
    </Suspense>
  );
}
