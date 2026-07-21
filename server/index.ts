import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./socket";
import { startCleanupWorker } from "./worker";
import { ensureBucket } from "../src/lib/storage";
import { logger } from "../src/lib/logger";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/lib/types";

const WS_PORT = Number(process.env.WS_PORT || 3001);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function main() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(
    cors({
      origin: [APP_URL, "http://localhost:3000"],
      credentials: true,
    })
  );

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "ws",
      timestamp: new Date().toISOString(),
    });
  });

  const httpServer = http.createServer(app);

  // Single-node Socket.IO (no Redis adapter — Postgres holds durable state)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: [APP_URL, "http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 10000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
  });

  try {
    await ensureBucket();
  } catch (err) {
    logger.warn("Storage bucket init failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  setupSocketHandlers(io);
  const cleanup = startCleanupWorker(io);

  httpServer.listen(WS_PORT, () => {
    logger.info(`WebSocket server listening on :${WS_PORT}`);
  });

  const shutdown = () => {
    logger.info("Shutting down WS server...");
    cleanup.stop();
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal WS server error:", err);
  process.exit(1);
});
