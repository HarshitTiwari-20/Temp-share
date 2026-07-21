export type RoomType = "CODE" | "TEXT" | "FILES" | "MIXED";

export interface Room {
  id: string;
  roomCode: string;
  type: RoomType;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomDetails extends Room {
  code?: {
    language: string;
    content: string;
  } | null;
  text?: {
    markdown: string;
  } | null;
  files: FileMeta[];
  activeUsers: PresenceUser[];
  token: string;
}

export interface FileMeta {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  uploadedAt: string;
}

export interface PresenceUser {
  id: string;
  socketId: string;
  anonymousName: string;
  cursorColor: string;
  connectedAt: string;
}

export interface CursorState {
  userId: string;
  name: string;
  color: string;
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface CreateRoomInput {
  type: RoomType;
  expirationMinutes: number;
  language?: string;
}

export interface CreateRoomResponse {
  room: Room;
  token: string;
}

export interface JoinRoomResponse {
  room: RoomDetails;
  token: string;
}

export interface ServerToClientEvents {
  "room:joined": (payload: {
    room: RoomDetails;
    self: PresenceUser;
  }) => void;
  "room:expired": (payload: { roomCode: string; message: string }) => void;
  "room:error": (payload: { message: string; code?: string }) => void;
  "user:connected": (payload: PresenceUser) => void;
  "user:disconnected": (payload: { socketId: string; userId: string }) => void;
  "presence:update": (payload: { users: PresenceUser[] }) => void;
  "code:update": (payload: {
    content: string;
    language?: string;
    from: string;
    version?: number;
  }) => void;
  "code:cursor": (payload: CursorState) => void;
  "code:language": (payload: { language: string; from: string }) => void;
  "text:update": (payload: {
    markdown: string;
    from: string;
    version?: number;
  }) => void;
  "file:upload": (payload: FileMeta) => void;
  "file:delete": (payload: { fileId: string }) => void;
  "timer:update": (payload: { expiresAt: string; remainingMs: number }) => void;
  "typing:update": (payload: {
    userId: string;
    name: string;
    area: "code" | "text";
    isTyping: boolean;
  }) => void;
}

export interface ClientToServerEvents {
  "room:join": (payload: {
    roomCode: string;
    token: string;
  }) => void;
  "room:leave": () => void;
  "code:update": (payload: {
    content: string;
    language?: string;
  }) => void;
  "code:cursor": (payload: Omit<CursorState, "userId" | "name" | "color">) => void;
  "code:language": (payload: { language: string }) => void;
  "text:update": (payload: { markdown: string }) => void;
  "file:upload": (payload: FileMeta) => void;
  "file:delete": (payload: { fileId: string }) => void;
  "typing:update": (payload: {
    area: "code" | "text";
    isTyping: boolean;
  }) => void;
  "presence:ping": () => void;
}
