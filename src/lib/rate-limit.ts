/**
 * Fast in-memory fixed-window rate limiter.
 * Avoids 2–3 Postgres round-trips on every request (was the main create-room lag).
 * Works well on a single Render instance; multi-instance would need shared storage.
 */

const memory = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup so the map doesn't grow forever
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of memory) {
    if (v.resetAt <= now) memory.delete(k);
  }
}

export async function rateLimit(options: {
  key: string;
  limit?: number;
  windowMs?: number;
}): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const limit = options.limit ?? Number(process.env.RATE_LIMIT_MAX || 100);
  const windowMs =
    options.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
  const now = Date.now();
  sweep(now);

  const key = options.key.slice(0, 191);
  const entry = memory.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    memory.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  entry.count += 1;
  return {
    success: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}
