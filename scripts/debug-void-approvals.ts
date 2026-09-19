// Read-only diagnostic: approval requests + orphan voidPending states.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1. Recent approval requests (last 40) with metadata inspection
  const reqs = await prisma.approvalRequest.findMany({
    orderBy: { requestedAt: "desc" },
    take: 40,
    include: { requestedBy: { select: { id: true, name: true } } },
  });
  console.log(`Recent approval requests: ${reqs.length}\n`);
  for (const r of reqs) {
    const meta: any = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata || {};
    console.log(
      `#${r.id} ${r.requestNo} type=${r.type} status=${r.status} unitType=${meta.unitType ?? "❌ MISSING"} ` +
      `requestedBy=${r.requestedBy?.name} at=${r.requestedAt.toISOString()}`
    );
  }

  // 2. Pending count by metadata unitType presence
  const pending = await prisma.approvalRequest.findMany({ where: { status: "pending" } });
  const noUnit = pending.filter((r: any) => {
    const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata || {};
    return !meta.unitType;
  });
  console.log(`\nPending total: ${pending.length}, pending WITHOUT metadata.unitType: ${noUnit.length}`);
  for (const r of pending) {
    const meta: any = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata || {};
    console.log(`  ⏳ #${r.id} ${r.requestNo} type=${r.type} unitType=${meta.unitType ?? "MISSING"} at=${r.requestedAt.toISOString()}`);
  }
  for (const r of noUnit) console.log(`  ❌ #${r.id} ${r.requestNo} type=${r.type} at=${r.requestedAt.toISOString()}`);

  // 3. Orphan voidPending StoreSales (flag set but no ApprovalRequest)
  const voidPendingSales = await prisma.storeSale.findMany({
    where: { metadata: { path: ["voidPending"], equals: true } },
    select: { id: true, saleNo: true, createdAt: true },
    take: 200,
  });
  console.log(`\nStoreSales with voidPending=true: ${voidPendingSales.length}`);
  for (const s of voidPendingSales.slice(0, 30)) {
    const req = await prisma.approvalRequest.findUnique({ where: { requestNo: `VOID-${s.saleNo}` } });
    console.log(`  sale ${s.saleNo} (${s.createdAt.toISOString().slice(0, 10)}) -> ApprovalRequest: ${req ? req.status : "❌ ORPHAN"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
