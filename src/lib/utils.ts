import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatCountdownShort(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const CURSOR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F8B500",
  "#00CED1",
] as const;

export const ADJECTIVES = [
  "Swift",
  "Silent",
  "Bright",
  "Cosmic",
  "Neon",
  "Quantum",
  "Pixel",
  "Cyber",
  "Lunar",
  "Solar",
  "Rapid",
  "Crystal",
  "Shadow",
  "Azure",
  "Crimson",
  "Ember",
  "Frost",
  "Nova",
  "Pulse",
  "Zen",
];

export const NOUNS = [
  "Fox",
  "Wolf",
  "Hawk",
  "Panda",
  "Tiger",
  "Eagle",
  "Otter",
  "Raven",
  "Lynx",
  "Bear",
  "Phoenix",
  "Dragon",
  "Falcon",
  "Cobra",
  "Viper",
  "Storm",
  "Wave",
  "Spark",
  "Blaze",
  "Comet",
];

export function generateAnonymousName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj} ${noun} ${num}`;
}

export function pickCursorColor(index: number): string {
  return CURSOR_COLORS[index % CURSOR_COLORS.length];
}

export function generateRoomCode(length = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

export const SUPPORTED_LANGUAGES = [
  { id: "javascript", label: "JavaScript", ext: "js" },
  { id: "typescript", label: "TypeScript", ext: "ts" },
  { id: "python", label: "Python", ext: "py" },
  { id: "c", label: "C", ext: "c" },
  { id: "cpp", label: "C++", ext: "cpp" },
  { id: "java", label: "Java", ext: "java" },
  { id: "go", label: "Go", ext: "go" },
  { id: "rust", label: "Rust", ext: "rs" },
  { id: "php", label: "PHP", ext: "php" },
  { id: "html", label: "HTML", ext: "html" },
  { id: "css", label: "CSS", ext: "css" },
  { id: "json", label: "JSON", ext: "json" },
  { id: "markdown", label: "Markdown", ext: "md" },
] as const;

export type LanguageId = (typeof SUPPORTED_LANGUAGES)[number]["id"];

export const EXPIRATION_OPTIONS = [
  { label: "10 minutes", minutes: 10 },
  { label: "30 minutes", minutes: 30 },
  { label: "50 minutes", minutes: 50, default: true },
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "12 hours", minutes: 720 },
  { label: "24 hours", minutes: 1440 },
  { label: "Custom", minutes: -1 },
] as const;

export const ROOM_TYPES = [
  {
    id: "CODE" as const,
    label: "Code",
    description: "Collaborative code editor",
    icon: "Code2",
  },
  {
    id: "TEXT" as const,
    label: "Text",
    description: "Rich markdown notes",
    icon: "FileText",
  },
  {
    id: "FILES" as const,
    label: "Files",
    description: "Upload & share files",
    icon: "FolderUp",
  },
  {
    id: "MIXED" as const,
    label: "Mixed",
    description: "Code, text & files together",
    icon: "Layers",
  },
] as const;

export type RoomTypeId = (typeof ROOM_TYPES)[number]["id"];
