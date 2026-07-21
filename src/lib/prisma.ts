import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
    // Faster fail on dead connections (Render + remote Postgres)
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: withPoolParams(process.env.DATABASE_URL),
          },
        }
      : undefined,
  });
}

/** Keep connection pool small and timeouts short for serverless-ish hosts */
function withPoolParams(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", "5");
    }
    if (!u.searchParams.has("pool_timeout")) {
      u.searchParams.set("pool_timeout", "10");
    }
    if (!u.searchParams.has("connect_timeout")) {
      u.searchParams.set("connect_timeout", "10");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export const prisma = globalForPrisma.prisma ?? createClient();

// Reuse the client across hot reloads AND production (Render keeps the process warm)
globalForPrisma.prisma = prisma;

export default prisma;
