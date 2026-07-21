#!/bin/sh
set -e

echo "[web] Running Prisma migrations..."
npx prisma migrate deploy || npx prisma db push --skip-generate || true

echo "[web] Starting Next.js..."
exec node server.js
