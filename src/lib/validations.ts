import { z } from "zod";

export const roomTypeSchema = z.enum(["CODE", "TEXT", "FILES", "MIXED"]);

export const createRoomSchema = z.object({
  type: roomTypeSchema.default("MIXED"),
  expirationMinutes: z
    .number()
    .int()
    .min(1, "Minimum expiration is 1 minute")
    .max(1440, "Maximum expiration is 24 hours")
    .default(50),
  language: z.string().max(32).optional().default("javascript"),
});

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .regex(/^\d{6,8}$/, "Room code must be 6–8 digits"),
});

export const roomCodeParamSchema = z.object({
  code: z.string().regex(/^\d{6,8}$/, "Invalid room code"),
});

export const codeUpdateSchema = z.object({
  content: z.string().max(2_000_000, "Content too large"),
  language: z.string().max(32).optional(),
});

export const textUpdateSchema = z.object({
  markdown: z.string().max(2_000_000, "Content too large"),
});

export const languageSchema = z.object({
  language: z.string().min(1).max(32),
});

export const fileDeleteSchema = z.object({
  fileId: z.string().uuid(),
});

export const ALLOWED_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "text/",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/msword",
  "application/vnd.openxmlformats",
  "application/vnd.ms-",
  "application/octet-stream",
] as const;

export function isAllowedMimeType(mime: string): boolean {
  const lower = mime.toLowerCase();
  return ALLOWED_MIME_PREFIXES.some(
    (p) => lower === p || lower.startsWith(p)
  );
}

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
