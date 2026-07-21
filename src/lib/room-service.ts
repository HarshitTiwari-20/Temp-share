import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { generateRoomCode } from "./utils";
import { deleteObjects } from "./storage";
import { ensureRedis, roomCacheKey, roomTokenKey } from "./redis";
import type { RoomType } from "@prisma/client";

const ROOM_CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 20;

export function generateRoomToken(): string {
  return randomBytes(32).toString("hex");
}

export async function generateUniqueRoomCode(): Promise<string> {
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const code = generateRoomCode(ROOM_CODE_LENGTH);
    const existing = await prisma.room.findUnique({
      where: { roomCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // Fallback to 8 digits if collisions
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const code = generateRoomCode(8);
    const existing = await prisma.room.findUnique({
      where: { roomCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique room code");
}

export async function createRoom(input: {
  type: RoomType;
  expirationMinutes: number;
  language?: string;
}) {
  const roomCode = await generateUniqueRoomCode();
  const token = generateRoomToken();
  const expiresAt = new Date(Date.now() + input.expirationMinutes * 60 * 1000);

  const room = await prisma.room.create({
    data: {
      roomCode,
      type: input.type,
      token,
      expiresAt,
      ...(input.type === "CODE" || input.type === "MIXED"
        ? {
            code: {
              create: {
                language: input.language || "javascript",
                content: "",
              },
            },
          }
        : {}),
      ...(input.type === "TEXT" || input.type === "MIXED"
        ? {
            text: {
              create: {
                markdown: "",
              },
            },
          }
        : {}),
    },
    include: {
      code: true,
      text: true,
      files: true,
      activeUsers: true,
    },
  });

  try {
    const redis = await ensureRedis();
    const ttl = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - Date.now()) / 1000)
    );
    await redis.setex(
      roomCacheKey(roomCode),
      ttl,
      JSON.stringify({
        id: room.id,
        roomCode: room.roomCode,
        type: room.type,
        expiresAt: room.expiresAt.toISOString(),
        token: room.token,
      })
    );
    await redis.setex(roomTokenKey(token), ttl, room.id);
  } catch (err) {
    console.warn("[room-service] redis cache failed:", err);
  }

  return room;
}

export async function getRoomByCode(roomCode: string) {
  // Try cache first
  try {
    const redis = await ensureRedis();
    const cached = await redis.get(roomCacheKey(roomCode));
    if (cached) {
      const meta = JSON.parse(cached) as { expiresAt: string; id: string };
      if (new Date(meta.expiresAt).getTime() <= Date.now()) {
        return null;
      }
    }
  } catch {
    // ignore cache misses
  }

  const room = await prisma.room.findUnique({
    where: { roomCode },
    include: {
      code: true,
      text: true,
      files: { orderBy: { uploadedAt: "desc" } },
      activeUsers: { orderBy: { connectedAt: "asc" } },
    },
  });

  if (!room) return null;
  if (room.expiresAt.getTime() <= Date.now()) {
    await destroyRoom(room.id);
    return null;
  }

  return room;
}

export async function getRoomById(id: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      code: true,
      text: true,
      files: { orderBy: { uploadedAt: "desc" } },
      activeUsers: { orderBy: { connectedAt: "asc" } },
    },
  });

  if (!room) return null;
  if (room.expiresAt.getTime() <= Date.now()) {
    await destroyRoom(room.id);
    return null;
  }

  return room;
}

export async function validateRoomToken(
  roomCode: string,
  token: string
): Promise<{ valid: boolean; roomId?: string; reason?: string }> {
  const room = await prisma.room.findUnique({
    where: { roomCode },
    select: { id: true, token: true, expiresAt: true },
  });

  if (!room) return { valid: false, reason: "Room not found" };
  if (room.expiresAt.getTime() <= Date.now()) {
    return { valid: false, reason: "Room expired" };
  }
  if (room.token !== token) {
    return { valid: false, reason: "Invalid room token" };
  }

  return { valid: true, roomId: room.id };
}

export async function destroyRoom(roomId: string): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { files: { select: { storageKey: true } } },
  });

  if (!room) return;

  // Delete files from storage
  const keys = room.files.map((f) => f.storageKey);
  try {
    await deleteObjects(keys);
  } catch (err) {
    console.error("[room-service] storage cleanup error:", err);
  }

  // Clear redis
  try {
    const redis = await ensureRedis();
    await redis.del(roomCacheKey(room.roomCode));
    await redis.del(roomTokenKey(room.token));
  } catch (err) {
    console.warn("[room-service] redis cleanup error:", err);
  }

  // Cascade deletes related rows
  await prisma.room.delete({ where: { id: roomId } }).catch(() => {
    // already deleted
  });
}

export async function destroyExpiredRooms(): Promise<number> {
  const expired = await prisma.room.findMany({
    where: { expiresAt: { lte: new Date() } },
    select: { id: true },
  });

  for (const room of expired) {
    await destroyRoom(room.id);
  }

  return expired.length;
}

export function serializeRoom(room: NonNullable<Awaited<ReturnType<typeof getRoomByCode>>>) {
  return {
    id: room.id,
    roomCode: room.roomCode,
    type: room.type,
    expiresAt: room.expiresAt.toISOString(),
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
    code: room.code
      ? { language: room.code.language, content: room.code.content }
      : null,
    text: room.text ? { markdown: room.text.markdown } : null,
    files: room.files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      storageUrl: f.storageUrl,
      uploadedAt: f.uploadedAt.toISOString(),
    })),
    activeUsers: room.activeUsers.map((u) => ({
      id: u.id,
      socketId: u.socketId,
      anonymousName: u.anonymousName,
      cursorColor: u.cursorColor,
      connectedAt: u.connectedAt.toISOString(),
    })),
    token: room.token,
  };
}
