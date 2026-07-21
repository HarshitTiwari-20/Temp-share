import { ensureRedis } from "./redis";

/**
 * Sliding-window rate limiter backed by Redis.
 * Falls back to in-memory Map when Redis is unavailable.
 */
const memory = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(options: {
  key: string;
  limit?: number;
  windowMs?: number;
}): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const limit = options.limit ?? Number(process.env.RATE_LIMIT_MAX || 100);
  const windowMs =
    options.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
  const now = Date.now();
  const redisKey = `rl:${options.key}`;

  try {
    const redis = await ensureRedis();
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    const ttl = await redis.pttl(redisKey);
    const resetAt = now + (ttl > 0 ? ttl : windowMs);
    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch {
    // In-memory fallback
    const entry = memory.get(options.key);
    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs;
      memory.set(options.key, { count: 1, resetAt });
      return { success: true, remaining: limit - 1, resetAt };
    }
    entry.count += 1;
    return {
      success: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    };
  }
}
