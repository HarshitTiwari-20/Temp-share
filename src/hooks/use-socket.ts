"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { useRoomStore } from "@/stores/room-store";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/types";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

let sharedSocket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!sharedSocket) {
    sharedSocket = io(WS_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
  }
  return sharedSocket;
}

export function useSocket(roomCode: string | null, token: string | null) {
  const socketRef = useRef<AppSocket | null>(null);
  const store = useRoomStore;

  const connect = useCallback(() => {
    if (!roomCode || !token) return;
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      store.getState().setConnected(true);
      store.getState().setReconnecting(false);
      socket.emit("room:join", { roomCode, token });
    };

    const onDisconnect = () => {
      store.getState().setConnected(false);
    };

    const onReconnectAttempt = () => {
      store.getState().setReconnecting(true);
    };

    const onJoined: ServerToClientEvents["room:joined"] = ({ room, self }) => {
      const prev = store.getState();
      // First join (or different room): load full snapshot.
      // Re-join of same room: keep local code/text so we don't wipe in-progress typing
      // (server may still have empty content if debounced save hasn't flushed).
      if (!prev.room || prev.room.id !== room.id) {
        store.getState().setRoom(room, token);
      } else {
        // Soft refresh: metadata, files, users — not editor buffers
        store.setState({
          room: {
            ...room,
            // preserve local-facing content on the room object
            code: prev.room.code
              ? {
                  language: prev.language || room.code?.language || "javascript",
                  content: prev.code,
                }
              : room.code,
            text: prev.room.text
              ? { markdown: prev.markdown }
              : room.text,
          },
          token,
          files: room.files,
          remainingMs: Math.max(
            0,
            new Date(room.expiresAt).getTime() - Date.now()
          ),
        });
        store.getState().setUsers(room.activeUsers);
      }
      store.getState().setSelf(self);
      store.getState().setUsers(room.activeUsers);
    };

    const onError: ServerToClientEvents["room:error"] = ({ message }) => {
      toast.error(message);
    };

    const onExpired: ServerToClientEvents["room:expired"] = ({ message }) => {
      toast.error(message || "Room expired.");
      store.getState().reset();
      window.location.href = "/?expired=1";
    };

    const onUserConnected: ServerToClientEvents["user:connected"] = (user) => {
      store.getState().addUser(user);
      toast(`${user.anonymousName} joined`, { duration: 2000 });
    };

    const onUserDisconnected: ServerToClientEvents["user:disconnected"] = ({
      socketId,
    }) => {
      store.getState().removeUser(socketId);
    };

    const onPresence: ServerToClientEvents["presence:update"] = ({ users }) => {
      store.getState().setUsers(users);
    };

    const onCodeUpdate: ServerToClientEvents["code:update"] = ({
      content,
      language,
      from,
    }) => {
      if (from === socket.id) return;
      store.getState().setCode(content);
      if (language) store.getState().setLanguage(language);
    };

    const onCodeLanguage: ServerToClientEvents["code:language"] = ({
      language,
      from,
    }) => {
      if (from === socket.id) return;
      store.getState().setLanguage(language);
    };

    const onCodeCursor: ServerToClientEvents["code:cursor"] = (cursor) => {
      store.getState().setCursor(cursor);
    };

    const onTextUpdate: ServerToClientEvents["text:update"] = ({
      markdown,
      from,
    }) => {
      if (from === socket.id) return;
      store.getState().setMarkdown(markdown);
    };

    const onFileUpload: ServerToClientEvents["file:upload"] = (file) => {
      store.getState().addFile(file);
    };

    const onFileDelete: ServerToClientEvents["file:delete"] = ({ fileId }) => {
      store.getState().removeFile(fileId);
    };

    const onTimer: ServerToClientEvents["timer:update"] = ({ remainingMs }) => {
      store.getState().setRemainingMs(remainingMs);
    };

    const onTyping: ServerToClientEvents["typing:update"] = ({
      userId,
      name,
      area,
      isTyping,
    }) => {
      store.getState().setTyping(userId, name, area, isTyping);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.on("room:joined", onJoined);
    socket.on("room:error", onError);
    socket.on("room:expired", onExpired);
    socket.on("user:connected", onUserConnected);
    socket.on("user:disconnected", onUserDisconnected);
    socket.on("presence:update", onPresence);
    socket.on("code:update", onCodeUpdate);
    socket.on("code:language", onCodeLanguage);
    socket.on("code:cursor", onCodeCursor);
    socket.on("text:update", onTextUpdate);
    socket.on("file:upload", onFileUpload);
    socket.on("file:delete", onFileDelete);
    socket.on("timer:update", onTimer);
    socket.on("typing:update", onTyping);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.off("room:joined", onJoined);
      socket.off("room:error", onError);
      socket.off("room:expired", onExpired);
      socket.off("user:connected", onUserConnected);
      socket.off("user:disconnected", onUserDisconnected);
      socket.off("presence:update", onPresence);
      socket.off("code:update", onCodeUpdate);
      socket.off("code:language", onCodeLanguage);
      socket.off("code:cursor", onCodeCursor);
      socket.off("text:update", onTextUpdate);
      socket.off("file:upload", onFileUpload);
      socket.off("file:delete", onFileDelete);
      socket.off("timer:update", onTimer);
      socket.off("typing:update", onTyping);
      socket.emit("room:leave");
    };
  }, [roomCode, token, store]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
    };
  }, [connect]);

  return socketRef;
}

export function emitCodeUpdate(content: string, language?: string) {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("code:update", { content, language });
  }
}

export function emitCodeLanguage(language: string) {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("code:language", { language });
  }
}

export function emitCodeCursor(payload: {
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}) {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("code:cursor", payload);
  }
}

export function emitTextUpdate(markdown: string) {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("text:update", { markdown });
  }
}

export function emitFileUpload(file: Parameters<ClientToServerEvents["file:upload"]>[0]) {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("file:upload", file);
  }
}

export function emitFileDelete(fileId: string) {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("file:delete", { fileId });
  }
}

export function emitTyping(area: "code" | "text", isTyping: boolean) {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("typing:update", { area, isTyping });
  }
}
