import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, string> = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
    checks.status = "degraded";
  }

  const status = checks.status === "ok" ? 200 : 503;
  return NextResponse.json(checks, { status });
}
