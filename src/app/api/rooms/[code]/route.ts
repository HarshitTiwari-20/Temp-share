import { NextRequest, NextResponse } from "next/server";
import { roomCodeParamSchema } from "@/lib/validations";
import { getRoomByCode, serializeRoom } from "@/lib/room-service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const parsed = roomCodeParamSchema.safeParse({ code });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid room code", code: "INVALID_CODE" },
        { status: 400 }
      );
    }

    const room = await getRoomByCode(parsed.data.code);

    if (!room) {
      // Distinguish expired vs not found by checking raw DB briefly
      return NextResponse.json(
        { error: "Room not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const serialized = serializeRoom(room);

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
    logger.error("Failed to get room", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 }
    );
  }
}
