import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import type { Server } from "socket.io";
import { prisma } from "../src/lib/prisma";
import { destroyRoom } from "../src/lib/room-service";
import { broadcastRoomExpired } from "./socket";
import { logger } from "../src/lib/logger";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/lib/types";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CLEANUP_INTERVAL_MS = Number(process.env.CLEANUP_INTERVAL_MS || 60000);

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function startCleanupWorker(io: AppServer) {
  const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

  const queue = new Queue("room-cleanup", { connection });

  const worker = new Worker(
    "room-cleanup",
    async () => {
      const expired = await prisma.room.findMany({
        where: { expiresAt: { lte: new Date() } },
        select: { id: true, roomCode: true },
      });

      if (expired.length === 0) {
        return { deleted: 0 };
      }

      for (const room of expired) {
        try {
          await broadcastRoomExpired(io, room.id, room.roomCode);
          await destroyRoom(room.id);
          logger.info("Expired room destroyed", { roomCode: room.roomCode });
        } catch (err) {
          logger.error("Failed to destroy expired room", {
            roomCode: room.roomCode,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { deleted: expired.length };
    },
    { connection: connection.duplicate(), concurrency: 1 }
  );

  worker.on("completed", (job, result) => {
    if (result && (result as { deleted: number }).deleted > 0) {
      logger.info("Cleanup job completed", result);
    }
  });

  worker.on("failed", (job, err) => {
    logger.error("Cleanup job failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  // Schedule repeating job every minute
  queue
    .add(
      "cleanup-expired",
      {},
      {
        repeat: { every: CLEANUP_INTERVAL_MS },
        removeOnComplete: 10,
        removeOnFail: 20,
      }
    )
    .then(() => {
      logger.info("Cleanup worker scheduled", {
        intervalMs: CLEANUP_INTERVAL_MS,
      });
    })
    .catch((err) => {
      logger.error("Failed to schedule cleanup", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

  // Also run an immediate lightweight timer for sub-minute precision on timer UI
  setInterval(async () => {
    try {
      const soon = await prisma.room.findMany({
        where: {
          expiresAt: {
            lte: new Date(Date.now() + 5000),
            gt: new Date(Date.now() - 5000),
          },
        },
        select: { id: true, roomCode: true, expiresAt: true },
      });

      for (const room of soon) {
        const remaining = room.expiresAt.getTime() - Date.now();
        io.to(`room:${room.id}`).emit("timer:update", {
          expiresAt: room.expiresAt.toISOString(),
          remainingMs: Math.max(0, remaining),
        });
        if (remaining <= 0) {
          await broadcastRoomExpired(io, room.id, room.roomCode);
          await destroyRoom(room.id);
        }
      }
    } catch {
      // non-critical
    }
  }, 5000);

  return { queue, worker };
}
