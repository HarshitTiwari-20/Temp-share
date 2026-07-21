import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
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
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

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
    res.json({ status: "ok", service: "ws", timestamp: new Date().toISOString() });
  });

  const httpServer = http.createServer(app);

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

  // Redis adapter for horizontal scaling
  try {
    const pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    const subClient = pubClient.duplicate();
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        pubClient.once("ready", () => resolve());
        pubClient.once("error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        subClient.once("ready", () => resolve());
        subClient.once("error", reject);
      }),
    ]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.IO Redis adapter connected");
  } catch (err) {
    logger.warn("Redis adapter unavailable, running single-node", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await ensureBucket();
  } catch (err) {
    logger.warn("Storage bucket init failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  setupSocketHandlers(io);
  startCleanupWorker(io);

  httpServer.listen(WS_PORT, () => {
    logger.info(`WebSocket server listening on :${WS_PORT}`);
  });

  const shutdown = () => {
    logger.info("Shutting down WS server...");
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
