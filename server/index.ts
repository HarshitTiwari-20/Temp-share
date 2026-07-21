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

// Render injects PORT; fall back to WS_PORT / 3001 for local dev
const WS_PORT = Number(process.env.PORT || process.env.WS_PORT || 3001);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Build allowed CORS origins (web URL + localhost + optional extras) */
function allowedOrigins(): (string | RegExp)[] {
  const list: (string | RegExp)[] = [
    APP_URL,
    APP_URL.replace(/\/$/, ""),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
  const extra = process.env.CORS_ORIGINS;
  if (extra) {
    for (const o of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
      list.push(o);
    }
  }
  // Any *.onrender.com frontend (preview / renamed services)
  list.push(/^https:\/\/[\w-]+\.onrender\.com$/);
  return list;
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser / same-origin tooling
  const allowed = allowedOrigins();
  return allowed.some((a) =>
    typeof a === "string" ? a === origin : a.test(origin)
  );
}

async function main() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(
    cors({
      origin(origin, cb) {
        if (isOriginAllowed(origin)) return cb(null, true);
        logger.warn("CORS blocked origin", { origin });
        return cb(null, false);
      },
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

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin(origin, cb) {
        if (isOriginAllowed(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked: ${origin}`), false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Polling first is more reliable on free-tier proxies; upgrade to websocket
    transports: ["polling", "websocket"],
    allowUpgrades: true,
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
    // Helpful behind Render reverse proxy
    path: "/socket.io/",
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

  httpServer.listen(WS_PORT, "0.0.0.0", () => {
    logger.info(`WebSocket server listening on 0.0.0.0:${WS_PORT}`, {
      appUrl: APP_URL,
    });
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
