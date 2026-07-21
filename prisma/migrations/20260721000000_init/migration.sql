warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('CODE', 'TEXT', 'FILES', 'MIXED');

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "roomCode" VARCHAR(8) NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'MIXED',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_contents" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "language" VARCHAR(32) NOT NULL DEFAULT 'javascript',
    "content" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_contents" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "markdown" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "text_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_objects" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "storageUrl" VARCHAR(1024) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_users" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "socketId" TEXT NOT NULL,
    "anonymousName" VARCHAR(64) NOT NULL,
    "cursorColor" VARCHAR(16) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_roomCode_key" ON "rooms"("roomCode");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_token_key" ON "rooms"("token");

-- CreateIndex
CREATE INDEX "rooms_expiresAt_idx" ON "rooms"("expiresAt");

-- CreateIndex
CREATE INDEX "rooms_roomCode_idx" ON "rooms"("roomCode");

-- CreateIndex
CREATE UNIQUE INDEX "code_contents_roomId_key" ON "code_contents"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "text_contents_roomId_key" ON "text_contents"("roomId");

-- CreateIndex
CREATE INDEX "file_objects_roomId_idx" ON "file_objects"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "active_users_socketId_key" ON "active_users"("socketId");

-- CreateIndex
CREATE INDEX "active_users_roomId_idx" ON "active_users"("roomId");

-- AddForeignKey
ALTER TABLE "code_contents" ADD CONSTRAINT "code_contents_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "text_contents" ADD CONSTRAINT "text_contents_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_users" ADD CONSTRAINT "active_users_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

