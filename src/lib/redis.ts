import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedis(): Redis {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("[redis] error:", err.message);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export async function ensureRedis(): Promise<Redis> {
  if (redis.status === "wait" || redis.status === "end") {
    await redis.connect();
  }
  return redis;
}

export const roomCacheKey = (roomCode: string) => `room:${roomCode}`;
export const roomUsersKey = (roomId: string) => `room:${roomId}:users`;
export const roomTokenKey = (token: string) => `token:${token}`;

export default redis;
