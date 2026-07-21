import { NextRequest, NextResponse } from "next/server";
import { createRoomSchema } from "@/lib/validations";
import { createRoom, serializeRoom } from "@/lib/room-service";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rl = await rateLimit({ key: `create:${ip}`, limit: 20, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many rooms created. Try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await req.json();
    const parsed = createRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const room = await createRoom({
      type: parsed.data.type,
      expirationMinutes: parsed.data.expirationMinutes,
      language: parsed.data.language,
    });

    const serialized = serializeRoom(room);

    logger.info("Room created", {
      roomCode: room.roomCode,
      type: room.type,
      expiresAt: room.expiresAt.toISOString(),
    });

    return NextResponse.json(
      {
        room: {
          id: serialized.id,
          roomCode: serialized.roomCode,
          type: serialized.type,
          expiresAt: serialized.expiresAt,
          createdAt: serialized.createdAt,
          updatedAt: serialized.updatedAt,
        },
        token: serialized.token,
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("Failed to create room", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
