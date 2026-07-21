# TempShare

**Share Code. Text. Files. Instantly. Securely. Temporarily.**

A production-ready real-time temporary sharing platform — Pastebin + VS Code Live Share + WeTransfer — with no accounts required.

![Stack](https://img.shields.io/badge/Next.js-15-black) ![React](https://img.shields.io/badge/React-19-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791) ![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101)

## Features

- **6–8 digit numeric room codes** (no letters/symbols)
- **Share types**: Code · Text · Files · Mixed
- **Monaco** collaborative code editor (13 languages, cursors, themes)
- **Markdown** text editor with live preview
- **Drag & drop** multi-file uploads with progress & previews
- **Live presence** with anonymous names, colors, typing indicators
- **Auto-expiration** with Postgres-backed cleanup (DB, files, sockets)
- **Dark / light / system** themes
- **QR code** + share links (join still requires the room code)
- **No authentication** — temporary room tokens for WebSocket auth

## Deploy on Render

Blueprint file: [`render.yaml`](./render.yaml)

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect the GitHub repo `Temp-share`
3. Create the stack (`tempshare-web` + `tempshare-ws`)
4. Set env vars marked `sync: false` on **both** services:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Your Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | `https://tempshare-web.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `https://tempshare-ws.onrender.com` |
| `ROOM_TOKEN_SECRET` | Same long secret on web + ws |
| `S3_*` | Your MinIO / S3 / R2 credentials |

5. Redeploy after setting public URLs so the client picks up `NEXT_PUBLIC_*`.

Free tier services sleep when idle — use a paid plan for always-on WebSockets.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up -d --build
```

| Service   | URL                        |
|-----------|----------------------------|
| App       | http://localhost:3000      |
| WebSocket | http://localhost:3001      |
| Nginx     | http://localhost           |
| MinIO UI  | http://localhost:9001      |
| Postgres  | localhost:5433 (host) → 5432 (container) |

## Local development

### Prerequisites

- Node.js 22+
- Docker (for MinIO; Postgres via `DATABASE_URL`)

### Setup

```bash
# Start infrastructure only
docker compose up -d postgres minio minio-init

# Install & migrate
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts   # optional demo room 100000

# Run web + websocket (two terminals or concurrent)
npm run dev:all
```

| Script            | Description                          |
|-------------------|--------------------------------------|
| `npm run dev`     | Next.js (port 3000)                  |
| `npm run dev:ws`  | Socket.IO + cleanup worker (3001)    |
| `npm run dev:all` | Both via concurrently                |
| `npm run build`   | Production Next.js build             |
| `npm run start`   | Start production Next.js             |
| `npm test`        | Unit tests (node:test)               |
| `npm run lint`    | ESLint                               |
| `npm run db:push` | Prisma schema push                   |
| `npm run db:seed` | Seed demo room                       |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js    │────▶│  PostgreSQL  │     │   MinIO/S3  │
│  App + API  │     │   (Prisma)   │     │   files     │
└──────┬──────┘     │  rooms, RL,  │     └──────▲──────┘
       │            │  presence    │            │
       │ WS         └──────▲───────┘            │
       ▼                   │                    │
┌─────────────┐            │                    │
│  WS Server  │────────────┴────────────────────┘
│  + cleanup  │
└─────────────┘
```

No Redis — Postgres is the single durable store (rooms, rate limits, presence, cleanup).

### Folder structure

```
├── src/
│   ├── app/                 # App Router pages + API routes
│   ├── components/          # UI + room features
│   ├── hooks/               # useSocket, etc.
│   ├── lib/                 # prisma, storage, services
│   └── stores/              # Zustand room store
├── server/                  # Socket.IO server + cleanup worker
├── prisma/                  # Schema, seed
├── docker/                  # Nginx, Postgres init, entrypoints
└── .github/workflows/       # CI
```

## WebSocket events

| Event              | Direction | Purpose                |
|--------------------|-----------|------------------------|
| `room:join`        | C→S       | Join with code + token |
| `room:leave`       | C→S       | Leave room             |
| `room:joined`      | S→C       | Full room snapshot     |
| `room:expired`     | S→C       | Room destroyed         |
| `code:update`      | bi        | Editor content sync    |
| `code:cursor`      | bi        | Remote cursors         |
| `code:language`    | bi        | Language change        |
| `text:update`      | bi        | Markdown sync          |
| `file:upload`      | bi        | New file notification  |
| `file:delete`      | bi        | File removed           |
| `presence:update`  | S→C       | Online users           |
| `timer:update`     | S→C       | Expiration countdown   |
| `typing:update`    | bi        | Typing indicators      |

## Security

- Numeric room codes only; internal UUIDs
- Temporary room tokens for WS & file APIs
- Zod validation on all inputs
- File type + size limits
- CSP, security headers, rate-limit hooks
- Virus-scan hook point on upload (pluggable no-op)
- Cascade delete + storage cleanup on expiry

## Environment

See [`.env.example`](./.env.example) for the full list.

Critical variables:

- `DATABASE_URL` — PostgreSQL (required; also used for rate limits + cleanup)
- `S3_*` — MinIO / AWS S3 / Cloudflare R2
- `ROOM_TOKEN_SECRET` — change in production
- `NEXT_PUBLIC_WS_URL` — browser WebSocket URL

## License

MIT
