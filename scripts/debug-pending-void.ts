// Read-only: find UnitTransactions stuck in pending_void and check approval visibility per admin unit.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Mirrors unitAliasGroup from src/lib/unit-aliases (read below to confirm)
import { isSameUnit } from "../src/lib/unit-aliases";

async function main() {
  // 1. All unit admins (role=admin, unitType set)
  const admins = await prisma.user.findMany({
    where: { role: { name: "admin" } },
    select: { id: true, name: true, email: true, unitType: true, isActive: true },
  });
  console.log("=== Unit admins ===");
  for (const a of admins) {
    console.log(`${a.isActive ? "" : "(inactive) "}${a.name} <${a.email}> unitType=${a.unitType}`);
  }

  // 2. Stuck transactions: status pending_void
  const stuck = await prisma.unitTransaction.findMany({
    where: { status: "pending_void" },
    include: { member: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { voidRequestedAt: "desc" },
  });
  console.log(`\n=== UnitTransactions with status=pending_void: ${stuck.length} ===`);
  for (const t of stuck) {
    const req = await prisma.approvalRequest.findUnique({ where: { requestNo: `VOID-${t.transactionNo}` } });
    const meta: any = req ? (typeof req.metadata === "string" ? JSON.parse(req.metadata) : req.metadata || {}) : {};
    const reqUnit = meta.unitType ?? "(none)";
    // Which admins can see it?
    const visibleTo = admins.filter((a) => a.unitType && isSameUnit(reqUnit, a.unitType) && a.isActive);
    console.log(
      `${t.transactionNo} unit=${t.unitType} amount=${Number(t.amount)} at=${t.voidRequestedAt?.toISOString().slice(0, 16)} ` +
      `requestedBy=${t.createdBy?.name} | ApprovalRequest: ${req ? req.status : "❌ MISSING"} (meta.unitType=${reqUnit}) ` +
      `| visible to: ${visibleTo.length ? visibleTo.map((a) => a.name).join(", ") : "❌ NO ADMIN"}`
    );
  }

  // 3. Pending approval requests whose unitType matches NO active admin
  const pendingReqs = await prisma.approvalRequest.findMany({
    where: { status: "pending", type: { in: ["unit_void", "void_store_sale", "laporan_unit"] } },
  });
  console.log(`\n=== Pending void requests invisible to every active admin ===`);
  for (const r of pendingReqs) {
    const meta: any = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata || {};
    const reqUnit = meta.unitType ?? "(none)";
    const visible = admins.filter((a) => a.isActive && a.unitType && isSameUnit(reqUnit, a.unitType));
    if (visible.length === 0) {
      console.log(`#${r.id} ${r.requestNo} meta.unitType=${reqUnit} type=${r.type} at=${r.requestedAt.toISOString().slice(0, 16)} → ❌ INVISIBLE`);
    }
  }
  console.log("(end)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
