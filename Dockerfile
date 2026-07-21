# ── Base ──────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ── Dependencies ──────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Prisma generate ───────────────────────────────────
FROM deps AS prisma
COPY prisma ./prisma
RUN npx prisma generate

# ── Build Next.js ─────────────────────────────────────
FROM prisma AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ── Web (Next.js) ─────────────────────────────────────
FROM base AS web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY docker/entrypoint-web.sh ./entrypoint-web.sh
RUN chmod +x ./entrypoint-web.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./entrypoint-web.sh"]

# ── WebSocket + worker ────────────────────────────────
FROM base AS ws
ENV NODE_ENV=production
ENV WS_PORT=3001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma ./node_modules/@prisma
COPY package.json ./
COPY prisma ./prisma
COPY server ./server
COPY src/lib ./src/lib
COPY tsconfig.json ./

EXPOSE 3001
CMD ["npx", "tsx", "server/index.ts"]
