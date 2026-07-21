# ─────────────────────────────────────────────────────────────
# TempShare — single image (Next.js + Socket.IO + cleanup)
# One container, one PORT. Deploy this whole repo once on Render.
#
# Build:  docker build -t tempshare .
# Run:    docker run -p 3000:3000 --env-file .env tempshare
# ─────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl curl

# ── Install dependencies ─────────────────────────────────────
FROM base AS deps
# package manifests + prisma schema (needed for postinstall / prisma generate)
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Install deps; generate client after so schema is present
RUN npm ci --ignore-scripts && npx prisma generate

# ── Build ────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_APP_URL=
ARG NEXT_PUBLIC_WS_URL=same
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
# Re-generate in case schema changed; then build Next
RUN npx prisma generate && npm run build

# ── Production runtime (all-in-one) ──────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_WS_URL=same

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/docker/entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
