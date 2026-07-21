import type { Server } from "socket.io";
import { prisma } from "../src/lib/prisma";
import { destroyRoom } from "../src/lib/room-service";
import { broadcastRoomExpired } from "./socket";
import { logger } from "../src/lib/logger";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/lib/types";

const CLEANUP_INTERVAL_MS = Number(process.env.CLEANUP_INTERVAL_MS || 60000);

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Postgres-only cleanup (replaces BullMQ + Redis).
 * Polls for expired rooms and destroys them on a timer.
 */
export function startCleanupWorker(io: AppServer) {
  let running = false;

  async function cleanupExpired() {
    if (running) return;
    running = true;
    try {
      const expired = await prisma.room.findMany({
        where: { expiresAt: { lte: new Date() } },
        select: { id: true, roomCode: true },
      });

      if (expired.length === 0) return;

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

      logger.info("Cleanup job completed", { deleted: expired.length });
    } catch (err) {
      logger.error("Cleanup job failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = false;
    }
  }

  // Main cleanup every minute (or CLEANUP_INTERVAL_MS)
  const cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
  // Run once on boot
  void cleanupExpired();

  // Near-expiry timer ticks for connected rooms
  const nearExpiryTimer = setInterval(async () => {
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

  // Also purge old rate-limit rows periodically
  const rateLimitTimer = setInterval(async () => {
    try {
      await prisma.rateLimitBucket.deleteMany({
        where: { resetAt: { lte: new Date() } },
      });
    } catch {
      // ignore
    }
  }, CLEANUP_INTERVAL_MS * 5);

  logger.info("Postgres cleanup worker scheduled", {
    intervalMs: CLEANUP_INTERVAL_MS,
  });

  return {
    stop() {
      clearInterval(cleanupTimer);
      clearInterval(nearExpiryTimer);
      clearInterval(rateLimitTimer);
    },
  };
}
