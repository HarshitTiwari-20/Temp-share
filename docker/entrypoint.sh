#!/bin/sh
set -e

echo "[tempshare] Running Prisma migrations / schema push..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate || {
  echo "[tempshare] Warning: schema sync failed — continuing anyway"
}

echo "[tempshare] Starting combined server (Next.js + Socket.IO) on PORT=${PORT:-3000}..."
exec npx tsx server/combined.ts
