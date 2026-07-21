import { NextRequest, NextResponse } from "next/server";
import { roomCodeParamSchema, isAllowedMimeType } from "@/lib/validations";
import { getRoomByCode } from "@/lib/room-service";
import { prisma } from "@/lib/prisma";
import {
  buildStorageKey,
  uploadObject,
  getMaxFileSizeBytes,
  getMaxFilesPerRoom,
  deleteObject,
} from "@/lib/storage";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const parsed = roomCodeParamSchema.safeParse({ code });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
    }

    const token = req.headers.get("x-room-token");
    if (!token) {
      return NextResponse.json({ error: "Missing room token" }, { status: 401 });
    }

    const room = await getRoomByCode(parsed.data.code);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (room.token !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }
    if (room.type === "CODE" || room.type === "TEXT") {
      return NextResponse.json(
        { error: "This room does not support file uploads" },
        { status: 400 }
      );
    }

    const fileCount = await prisma.fileObject.count({
      where: { roomId: room.id },
    });
    if (fileCount >= getMaxFilesPerRoom()) {
      return NextResponse.json(
        { error: `Maximum ${getMaxFilesPerRoom()} files per room` },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const maxSize = getMaxFileSizeBytes();
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: `File too large. Max size is ${Math.floor(maxSize / 1024 / 1024)}MB`,
        },
        { status: 400 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Virus scan hook (pluggable — no-op by default)
    // await virusScanHook(buffer)

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = buildStorageKey(room.id, file.name);
    const storageUrl = await uploadObject(storageKey, buffer, mimeType);

    const record = await prisma.fileObject.create({
      data: {
        roomId: room.id,
        fileName: file.name.slice(0, 255),
        fileSize: file.size,
        mimeType,
        storageKey,
        storageUrl,
      },
    });

    logger.info("File uploaded", {
      roomCode: room.roomCode,
      fileName: record.fileName,
      size: record.fileSize,
    });

    return NextResponse.json(
      {
        file: {
          id: record.id,
          fileName: record.fileName,
          fileSize: record.fileSize,
          mimeType: record.mimeType,
          storageUrl: record.storageUrl,
          uploadedAt: record.uploadedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("File upload failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const parsed = roomCodeParamSchema.safeParse({ code });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
    }

    const token = req.headers.get("x-room-token");
    if (!token) {
      return NextResponse.json({ error: "Missing room token" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    if (!fileId) {
      return NextResponse.json({ error: "fileId required" }, { status: 400 });
    }

    const room = await getRoomByCode(parsed.data.code);
    if (!room || room.token !== token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const file = await prisma.fileObject.findFirst({
      where: { id: fileId, roomId: room.id },
    });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    try {
      await deleteObject(file.storageKey);
    } catch (err) {
      logger.warn("Storage delete failed", { error: String(err) });
    }

    await prisma.fileObject.delete({ where: { id: file.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("File delete failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
