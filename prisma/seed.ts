/**
 * Seed script — optional demo room for local development.
 * Run: npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  // Clean existing demo room if present
  await prisma.room.deleteMany({ where: { roomCode: "100000" } });

  const expiresAt = new Date(Date.now() + 50 * 60 * 1000);
  const token = randomBytes(32).toString("hex");

  const room = await prisma.room.create({
    data: {
      roomCode: "100000",
      type: "MIXED",
      token,
      expiresAt,
      code: {
        create: {
          language: "typescript",
          content: `// Welcome to TempShare demo room
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("world"));
`,
        },
      },
      text: {
        create: {
          markdown: `# Demo notes

This is a **temporary** share room.

- Real-time collaboration
- Auto expiration
- No accounts

| Feature | Status |
| --- | --- |
| Code | Live |
| Text | Live |
| Files | Ready |
`,
        },
      },
    },
  });

  console.log("Seeded demo room:");
  console.log("  Code:", room.roomCode);
  console.log("  Token:", token);
  console.log("  Expires:", expiresAt.toISOString());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
