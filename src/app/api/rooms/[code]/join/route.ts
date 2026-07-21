import { NextRequest, NextResponse } from "next/server";
import { roomCodeParamSchema } from "@/lib/validations";
import { getRoomByCode, serializeRoom } from "@/lib/room-service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const parsed = roomCodeParamSchema.safeParse({ code });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid room code", code: "INVALID_CODE" },
        { status: 400 }
      );
    }

    // Check raw first for expired messaging
    const raw = await prisma.room.findUnique({
      where: { roomCode: parsed.data.code },
      select: { expiresAt: true },
    });

    if (!raw) {
      return NextResponse.json(
        { error: "Room not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (raw.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Room expired", code: "EXPIRED" },
        { status: 410 }
      );
    }

    const room = await getRoomByCode(parsed.data.code);
    if (!room) {
      return NextResponse.json(
        { error: "Room not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const serialized = serializeRoom(room);

    logger.info("Room join", { roomCode: room.roomCode });

    return NextResponse.json({
      room: {
        id: serialized.id,
        roomCode: serialized.roomCode,
        type: serialized.type,
        expiresAt: serialized.expiresAt,
        createdAt: serialized.createdAt,
        updatedAt: serialized.updatedAt,
        code: serialized.code,
        text: serialized.text,
        files: serialized.files,
        activeUsers: serialized.activeUsers,
      },
      token: serialized.token,
    });
  } catch (err) {
    logger.error("Failed to join room", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to join room" },
      { status: 500 }
    );
  }
}
