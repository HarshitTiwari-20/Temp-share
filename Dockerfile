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
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Public env can be baked at build time; runtime overrides still work for server
ARG NEXT_PUBLIC_APP_URL=
ARG NEXT_PUBLIC_WS_URL=same
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN npx prisma generate && npm run build

# ── Production runtime (all-in-one) ──────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# same-origin WebSocket (combined server)
ENV NEXT_PUBLIC_WS_URL=same

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# App source needed for Next custom server + tsx + prisma
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

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
