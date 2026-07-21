import type { Server, Socket } from "socket.io";
import { prisma } from "../src/lib/prisma";
import {
  getRoomByCode,
  serializeRoom,
  destroyRoom,
} from "../src/lib/room-service";
import { generateAnonymousName, pickCursorColor } from "../src/lib/utils";
import { logger } from "../src/lib/logger";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PresenceUser,
} from "../src/lib/types";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: {
    roomId?: string;
    roomCode?: string;
    userId?: string;
    anonymousName?: string;
    cursorColor?: string;
  };
};

// Debounce maps for code/text persistence
const codeSaveTimers = new Map<string, NodeJS.Timeout>();
const textSaveTimers = new Map<string, NodeJS.Timeout>();
const SAVE_DEBOUNCE_MS = 400;

export function setupSocketHandlers(io: AppServer) {
  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AppSocket;
    logger.debug("Socket connected", { id: socket.id });

    socket.on("room:join", async ({ roomCode, token }) => {
      try {
        if (!roomCode || !token) {
          socket.emit("room:error", {
            message: "Room code and token required",
            code: "INVALID",
          });
          return;
        }

        if (!/^\d{6,8}$/.test(roomCode)) {
          socket.emit("room:error", {
            message: "Invalid room code",
            code: "INVALID_CODE",
          });
          return;
        }

        const room = await getRoomByCode(roomCode);
        if (!room) {
          socket.emit("room:error", {
            message: "Room not found",
            code: "NOT_FOUND",
          });
          return;
        }

        if (room.token !== token) {
          socket.emit("room:error", {
            message: "Invalid room token",
            code: "UNAUTHORIZED",
          });
          return;
        }

        // Leave previous room if any
        if (socket.data.roomId) {
          await leaveRoom(io, socket);
        }

        const existingCount = await prisma.activeUser.count({
          where: { roomId: room.id },
        });
        const anonymousName = generateAnonymousName();
        const cursorColor = pickCursorColor(existingCount);

        const user = await prisma.activeUser.create({
          data: {
            roomId: room.id,
            socketId: socket.id,
            anonymousName,
            cursorColor,
          },
        });

        socket.data.roomId = room.id;
        socket.data.roomCode = room.roomCode;
        socket.data.userId = user.id;
        socket.data.anonymousName = anonymousName;
        socket.data.cursorColor = cursorColor;

        await socket.join(`room:${room.id}`);

        const refreshed = await getRoomByCode(roomCode);
        if (!refreshed) {
          socket.emit("room:error", {
            message: "Room not found",
            code: "NOT_FOUND",
          });
          return;
        }

        const serialized = serializeRoom(refreshed);
        const self: PresenceUser = {
          id: user.id,
          socketId: user.socketId,
          anonymousName: user.anonymousName,
          cursorColor: user.cursorColor,
          connectedAt: user.connectedAt.toISOString(),
        };

        socket.emit("room:joined", {
          room: serialized,
          self,
        });

        socket.to(`room:${room.id}`).emit("user:connected", self);
        socket.to(`room:${room.id}`).emit("presence:update", {
          users: serialized.activeUsers,
        });

        logger.info("User joined room", {
          roomCode,
          user: anonymousName,
          socketId: socket.id,
        });
      } catch (err) {
        logger.error("room:join failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        socket.emit("room:error", {
          message: "Failed to join room",
          code: "INTERNAL",
        });
      }
    });

    socket.on("room:leave", async () => {
      await leaveRoom(io, socket);
    });

    socket.on("code:update", async ({ content, language }) => {
      const roomId = socket.data.roomId;
      if (!roomId || typeof content !== "string") return;
      if (content.length > 2_000_000) return;

      // Broadcast immediately (optimistic)
      socket.to(`room:${roomId}`).emit("code:update", {
        content,
        language,
        from: socket.id,
      });

      // Debounced persist
      const existing = codeSaveTimers.get(roomId);
      if (existing) clearTimeout(existing);
      codeSaveTimers.set(
        roomId,
        setTimeout(async () => {
          try {
            await prisma.codeContent.upsert({
              where: { roomId },
              create: {
                roomId,
                content,
                language: language || "javascript",
              },
              update: {
                content,
                ...(language ? { language } : {}),
              },
            });
          } catch (err) {
            logger.error("code save failed", {
              error: err instanceof Error ? err.message : String(err),
            });
          }
          codeSaveTimers.delete(roomId);
        }, SAVE_DEBOUNCE_MS)
      );
    });

    socket.on("code:language", async ({ language }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !language || language.length > 32) return;

      socket.to(`room:${roomId}`).emit("code:language", {
        language,
        from: socket.id,
      });

      try {
        await prisma.codeContent.upsert({
          where: { roomId },
          create: { roomId, language, content: "" },
          update: { language },
        });
      } catch (err) {
        logger.error("language update failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    socket.on("code:cursor", (cursor) => {
      const roomId = socket.data.roomId;
      if (!roomId || !socket.data.userId) return;

      socket.to(`room:${roomId}`).emit("code:cursor", {
        userId: socket.data.userId,
        name: socket.data.anonymousName || "Anonymous",
        color: socket.data.cursorColor || "#888",
        line: cursor.line,
        column: cursor.column,
        selection: cursor.selection,
      });
    });

    socket.on("text:update", async ({ markdown }) => {
      const roomId = socket.data.roomId;
      if (!roomId || typeof markdown !== "string") return;
      if (markdown.length > 2_000_000) return;

      socket.to(`room:${roomId}`).emit("text:update", {
        markdown,
        from: socket.id,
      });

      const existing = textSaveTimers.get(roomId);
      if (existing) clearTimeout(existing);
      textSaveTimers.set(
        roomId,
        setTimeout(async () => {
          try {
            await prisma.textContent.upsert({
              where: { roomId },
              create: { roomId, markdown },
              update: { markdown },
            });
          } catch (err) {
            logger.error("text save failed", {
              error: err instanceof Error ? err.message : String(err),
            });
          }
          textSaveTimers.delete(roomId);
        }, SAVE_DEBOUNCE_MS)
      );
    });

    socket.on("file:upload", (file) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.to(`room:${roomId}`).emit("file:upload", file);
    });

    socket.on("file:delete", async ({ fileId }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !fileId) return;
      socket.to(`room:${roomId}`).emit("file:delete", { fileId });
    });

    socket.on("typing:update", ({ area, isTyping }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !socket.data.userId) return;
      socket.to(`room:${roomId}`).emit("typing:update", {
        userId: socket.data.userId,
        name: socket.data.anonymousName || "Anonymous",
        area,
        isTyping,
      });
    });

    socket.on("presence:ping", () => {
      // keepalive — presence is tracked via socket lifecycle
    });

    socket.on("disconnect", async () => {
      await leaveRoom(io, socket);
      logger.debug("Socket disconnected", { id: socket.id });
    });
  });
}

async function leaveRoom(io: AppServer, socket: AppSocket) {
  const roomId = socket.data.roomId;
  const userId = socket.data.userId;
  if (!roomId) return;

  try {
    await prisma.activeUser.deleteMany({
      where: { socketId: socket.id },
    });
  } catch {
    // ignore
  }

  socket.to(`room:${roomId}`).emit("user:disconnected", {
    socketId: socket.id,
    userId: userId || "",
  });

  const remaining = await prisma.activeUser.findMany({
    where: { roomId },
    orderBy: { connectedAt: "asc" },
  });

  socket.to(`room:${roomId}`).emit("presence:update", {
    users: remaining.map((u) => ({
      id: u.id,
      socketId: u.socketId,
      anonymousName: u.anonymousName,
      cursorColor: u.cursorColor,
      connectedAt: u.connectedAt.toISOString(),
    })),
  });

  await socket.leave(`room:${roomId}`);

  socket.data.roomId = undefined;
  socket.data.roomCode = undefined;
  socket.data.userId = undefined;
  socket.data.anonymousName = undefined;
  socket.data.cursorColor = undefined;
}

export async function broadcastRoomExpired(
  io: AppServer,
  roomId: string,
  roomCode: string
) {
  io.to(`room:${roomId}`).emit("room:expired", {
    roomCode,
    message: "Room expired.",
  });
  const sockets = await io.in(`room:${roomId}`).fetchSockets();
  for (const s of sockets) {
    s.leave(`room:${roomId}`);
    s.disconnect(true);
  }
}

export { destroyRoom };
