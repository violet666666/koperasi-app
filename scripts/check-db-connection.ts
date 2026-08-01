// Read-only DB connection check vs production Neon.
// Usage: NODE_ENV=production npx tsx --env-file=.env scripts/check-db-connection.ts
import prisma from "@/lib/prisma";

async function main() {
  const start = Date.now();
  const ok = await prisma.$queryRaw<[{ ok: number }]>`SELECT 1 AS ok`;
  const elapsedMs = Date.now() - start;
  const memberCount = await prisma.member.count({ where: { deletedAt: null } });
  console.log(JSON.stringify({
    connected: true,
    pingSeconds: +(elapsedMs / 1000).toFixed(2),
    activeMembers: memberCount,
    rawOk: ok[0]?.ok,
    databaseUrlHost: process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@").split("@")[1]?.split("?")[0],
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ connected: false, error: String(e?.message || e) }, null, 2));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
