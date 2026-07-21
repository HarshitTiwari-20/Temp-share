import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { generateRoomCode } from "./utils";
import { deleteObjects } from "./storage";
import type { RoomType } from "@prisma/client";

const ROOM_CODE_LENGTH = 6;
const MAX_CREATE_ATTEMPTS = 8;

export function generateRoomToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create room in a single INSERT (retry only on rare roomCode collision).
 * Avoids the old generateUniqueRoomCode SELECT-before-INSERT round-trip.
 */
export async function createRoom(input: {
  type: RoomType;
  expirationMinutes: number;
  language?: string;
}) {
  const token = generateRoomToken();
  const expiresAt = new Date(Date.now() + input.expirationMinutes * 60 * 1000);
  const wantsCode = input.type === "CODE" || input.type === "MIXED";
  const wantsText = input.type === "TEXT" || input.type === "MIXED";

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const roomCode = generateRoomCode(
      attempt < MAX_CREATE_ATTEMPTS - 2 ? ROOM_CODE_LENGTH : 8
    );

    try {
      // Minimal create — no empty includes (files/activeUsers) to save query time
      const room = await prisma.room.create({
        data: {
          roomCode,
          type: input.type,
          token,
          expiresAt,
          ...(wantsCode
            ? {
                code: {
                  create: {
                    language: input.language || "javascript",
                    content: "",
                  },
                },
              }
            : {}),
          ...(wantsText
            ? {
                text: {
                  create: {
                    markdown: "",
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
          roomCode: true,
          type: true,
          token: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          code: { select: { language: true, content: true } },
          text: { select: { markdown: true } },
        },
      });

      // Shape matches serializeRoom expectations
      return {
        ...room,
        files: [] as never[],
        activeUsers: [] as never[],
      };
    } catch (err) {
      lastError = err;
      // Unique constraint on roomCode — try another code
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to generate unique room code");
}

export async function getRoomByCode(roomCode: string) {
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

  const keys = room.files.map((f) => f.storageKey);
  try {
    await deleteObjects(keys);
  } catch (err) {
    console.error("[room-service] storage cleanup error:", err);
  }

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

export function serializeRoom(
  room: NonNullable<Awaited<ReturnType<typeof getRoomByCode>>> | {
    id: string;
    roomCode: string;
    type: RoomType;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    code: { language: string; content: string } | null;
    text: { markdown: string } | null;
    files: {
      id: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      storageUrl: string;
      uploadedAt: Date;
    }[];
    activeUsers: {
      id: string;
      socketId: string;
      anonymousName: string;
      cursorColor: string;
      connectedAt: Date;
    }[];
  }
) {
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
    files: (room.files ?? []).map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      storageUrl: f.storageUrl,
      uploadedAt: f.uploadedAt.toISOString(),
    })),
    activeUsers: (room.activeUsers ?? []).map((u) => ({
      id: u.id,
      socketId: u.socketId,
      anonymousName: u.anonymousName,
      cursorColor: u.cursorColor,
      connectedAt: u.connectedAt.toISOString(),
    })),
    token: room.token,
  };
}
