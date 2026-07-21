import { prisma } from "./prisma";

/**
 * Sliding/fixed-window rate limiter backed by PostgreSQL
 * (replaces Redis INCR + PEXPIRE).
 */
export async function rateLimit(options: {
  key: string;
  limit?: number;
  windowMs?: number;
}): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const limit = options.limit ?? Number(process.env.RATE_LIMIT_MAX || 100);
  const windowMs =
    options.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
  const now = new Date();
  const key = options.key.slice(0, 191);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimitBucket.findUnique({ where: { key } });

      if (!existing || existing.resetAt.getTime() <= now.getTime()) {
        const resetAt = new Date(now.getTime() + windowMs);
        await tx.rateLimitBucket.upsert({
          where: { key },
          create: { key, count: 1, resetAt },
          update: { count: 1, resetAt },
        });
        return {
          success: true,
          remaining: limit - 1,
          resetAt: resetAt.getTime(),
        };
      }

      const updated = await tx.rateLimitBucket.update({
        where: { key },
        data: { count: { increment: 1 } },
      });

      return {
        success: updated.count <= limit,
        remaining: Math.max(0, limit - updated.count),
        resetAt: existing.resetAt.getTime(),
      };
    });

    // Opportunistic cleanup of expired buckets (best-effort)
    if (Math.random() < 0.02) {
      void prisma.rateLimitBucket
        .deleteMany({ where: { resetAt: { lte: now } } })
        .catch(() => undefined);
    }

    return result;
  } catch (err) {
    // Fail open so a DB blip does not block the product
    console.warn("[rate-limit] postgres failed, allowing request:", err);
    return {
      success: true,
      remaining: limit,
      resetAt: Date.now() + windowMs,
    };
  }
}
