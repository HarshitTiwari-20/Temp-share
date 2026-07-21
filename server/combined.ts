/**
 * Single-process production server: Next.js + Socket.IO + cleanup worker.
 * One PORT for everything — ideal for Render / Railway / single Docker deploy.
 *
 * Usage:  npx tsx server/combined.ts
 * Docker: CMD uses this entrypoint
 */
import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import path from "path";
import next from "next";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./socket";
import { startCleanupWorker } from "./worker";
import { ensureBucket } from "../src/lib/storage";
import { logger } from "../src/lib/logger";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/lib/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const appDir = path.join(__dirname, "..");

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${port}`;

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
  list.push(/^https:\/\/[\w-]+\.onrender\.com$/);
  return list;
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedOrigins().some((a) =>
    typeof a === "string" ? a === origin : a.test(origin)
  );
}

async function main() {
  const nextApp = next({
    dev,
    hostname,
    port,
    dir: appDir,
  });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const httpServer = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url || "/", true);
      handle(req, res, parsedUrl);
    } catch (err) {
      logger.error("Next request error", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin(origin, cb) {
        if (isOriginAllowed(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked: ${origin}`), false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io/",
    transports: ["polling", "websocket"],
    allowUpgrades: true,
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
  });

  try {
    await ensureBucket();
  } catch (err) {
    logger.warn("Storage bucket init failed (file uploads may not work)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  setupSocketHandlers(io);
  const cleanup = startCleanupWorker(io);

  httpServer.listen(port, hostname, () => {
    logger.info("TempShare combined server ready", {
      url: `http://${hostname}:${port}`,
      mode: dev ? "development" : "production",
      appUrl: APP_URL,
    });
  });

  const shutdown = () => {
    logger.info("Shutting down combined server...");
    cleanup.stop();
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal combined server error:", err);
  process.exit(1);
});
