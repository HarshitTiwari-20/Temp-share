"use client";

import { create } from "zustand";
import type {
  CursorState,
  FileMeta,
  PresenceUser,
  RoomDetails,
  RoomType,
} from "@/lib/types";

interface RoomState {
  room: RoomDetails | null;
  token: string | null;
  self: PresenceUser | null;
  users: PresenceUser[];
  cursors: Record<string, CursorState>;
  code: string;
  language: string;
  markdown: string;
  files: FileMeta[];
  remainingMs: number;
  connected: boolean;
  reconnecting: boolean;
  typing: { userId: string; name: string; area: "code" | "text" }[];
  activeTab: "code" | "text" | "files";
  isFullscreen: boolean;

  setRoom: (room: RoomDetails, token: string) => void;
  setSelf: (self: PresenceUser) => void;
  setUsers: (users: PresenceUser[]) => void;
  addUser: (user: PresenceUser) => void;
  removeUser: (socketId: string) => void;
  setCursor: (cursor: CursorState) => void;
  setCode: (code: string) => void;
  setLanguage: (language: string) => void;
  setMarkdown: (markdown: string) => void;
  addFile: (file: FileMeta) => void;
  removeFile: (fileId: string) => void;
  setFiles: (files: FileMeta[]) => void;
  setRemainingMs: (ms: number) => void;
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setTyping: (
    userId: string,
    name: string,
    area: "code" | "text",
    isTyping: boolean
  ) => void;
  setActiveTab: (tab: "code" | "text" | "files") => void;
  setFullscreen: (v: boolean) => void;
  reset: () => void;
}

const initial = {
  room: null as RoomDetails | null,
  token: null as string | null,
  self: null as PresenceUser | null,
  users: [] as PresenceUser[],
  cursors: {} as Record<string, CursorState>,
  code: "",
  language: "javascript",
  markdown: "",
  files: [] as FileMeta[],
  remainingMs: 0,
  connected: false,
  reconnecting: false,
  typing: [] as { userId: string; name: string; area: "code" | "text" }[],
  activeTab: "code" as "code" | "text" | "files",
  isFullscreen: false,
};

function defaultTab(type: RoomType): "code" | "text" | "files" {
  if (type === "TEXT") return "text";
  if (type === "FILES") return "files";
  return "code";
}

export const useRoomStore = create<RoomState>((set) => ({
  ...initial,

  setRoom: (room, token) =>
    set({
      room,
      token,
      code: room.code?.content ?? "",
      language: room.code?.language ?? "javascript",
      markdown: room.text?.markdown ?? "",
      files: room.files ?? [],
      users: room.activeUsers ?? [],
      remainingMs: Math.max(0, new Date(room.expiresAt).getTime() - Date.now()),
      activeTab: defaultTab(room.type),
    }),

  setSelf: (self) => set({ self }),

  setUsers: (users) => set({ users }),

  addUser: (user) =>
    set((s) => ({
      users: s.users.some((u) => u.socketId === user.socketId)
        ? s.users
        : [...s.users, user],
    })),

  removeUser: (socketId) =>
    set((s) => ({
      users: s.users.filter((u) => u.socketId !== socketId),
      cursors: Object.fromEntries(
        Object.entries(s.cursors).filter(([, c]) => {
          const user = s.users.find((u) => u.socketId === socketId);
          return !user || c.userId !== user.id;
        })
      ),
    })),

  setCursor: (cursor) =>
    set((s) => ({
      cursors: { ...s.cursors, [cursor.userId]: cursor },
    })),

  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setMarkdown: (markdown) => set({ markdown }),

  addFile: (file) =>
    set((s) => ({
      files: s.files.some((f) => f.id === file.id)
        ? s.files
        : [file, ...s.files],
    })),

  removeFile: (fileId) =>
    set((s) => ({ files: s.files.filter((f) => f.id !== fileId) })),

  setFiles: (files) => set({ files }),
  setRemainingMs: (remainingMs) => set({ remainingMs }),
  setConnected: (connected) => set({ connected }),
  setReconnecting: (reconnecting) => set({ reconnecting }),

  setTyping: (userId, name, area, isTyping) =>
    set((s) => {
      const filtered = s.typing.filter(
        (t) => !(t.userId === userId && t.area === area)
      );
      if (!isTyping) return { typing: filtered };
      return { typing: [...filtered, { userId, name, area }] };
    }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),

  reset: () => set({ ...initial, cursors: {}, typing: [], files: [], users: [] }),
}));
