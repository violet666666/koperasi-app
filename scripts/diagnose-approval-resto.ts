// Read-only diagnostic: why does admin resto_cafe see no approval inbox items?
// Compares ApprovalRequest.metadata.unitType vs the admin user's unitType, using
// BOTH strict === (current /api/approvals behavior) and isSameUnit (alias-aware).
//
// Usage: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-approval-resto.ts
import prisma from "@/lib/prisma";
import { isSameUnit, unitAliasGroup } from "@/lib/unit-aliases";

async function main() {
  // 1. The two unit-admin accounts
  const admins = await prisma.user.findMany({
    where: {
      role: { name: "admin" },
      unitType: { in: ["resto_cafe", "resto", "cafe_lsp", "coffe_latar"] },
    },
    select: { id: true, name: true, email: true, unitType: true },
  });
  console.log("\n=== UNIT ADMIN USERS (resto/cafe family) ===");
  console.table(admins.map(a => ({ id: a.id, email: a.email, unitType: a.unitType })));

  // 2. All ApprovalRequest void rows
  const rows = await prisma.approvalRequest.findMany({
    where: { type: { in: ["unit_void", "void_store_sale", "laporan_unit"] } },
    select: { id: true, requestNo: true, type: true, status: true, metadata: true, requestedAt: true },
    orderBy: { requestedAt: "desc" },
    take: 500,
  });
  console.log(`\n=== VOID APPROVAL REQUESTS: ${rows.length} total ===`);

  const byMetaUnit: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const parsed = rows.map(r => {
    const m: any = typeof r.metadata === "string" ? JSON.parse(r.metadata || "{}") : (r.metadata || {});
    const u = m.unitType ?? "(NULL)";
    byMetaUnit[u] = (byMetaUnit[u] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    return { requestNo: r.requestNo, type: r.type, status: r.status, metaUnitType: u, saleNo: m.saleNo || m.transactionNo || "" };
  });
  console.log("\nBY metadata.unitType:", JSON.stringify(byMetaUnit, null, 2));
  console.log("BY status:", JSON.stringify(byStatus));

  // 3. PENDING only — what each admin would see
  const pending = parsed.filter(r => r.status === "pending");
  console.log(`\n=== PENDING VOID REQUESTS: ${pending.length} ===`);
  for (const a of admins) {
    const strict = pending.filter(r => r.metaUnitType === a.unitType);
    const alias = pending.filter(r => r.metaUnitType !== "(NULL)" && isSameUnit(r.metaUnitType, a.unitType));
    console.log(`\nAdmin ${a.email} (unitType=${a.unitType}):`);
    console.log(`  strict === match: ${strict.length}   ← pre-fix /api/approvals behavior`);
    console.log(`  isSameUnit match: ${alias.length}   ← post-fix behavior (what this fix delivers)`);
    if (alias.length > strict.length) {
      console.log(`  ⚠ GAP: ${alias.length - strict.length} hidden by strict match — THE BUG`);
      const hidden = alias.filter(r => !strict.includes(r));
      hidden.slice(0, 8).forEach(r => console.log(`     - ${r.requestNo} | meta.unitType=${r.metaUnitType} | ${r.saleNo}`));
    }
  }

  // 3b. HISTORY (approved/rejected) — the live smoking gun for the resto admin
  const history = parsed.filter(r => r.status === "approved" || r.status === "rejected");
  console.log(`\n=== HISTORY VOID REQUESTS (approved/rejected): ${history.length} ===`);
  for (const a of admins) {
    const strict = history.filter(r => r.metaUnitType === a.unitType);
    const alias = history.filter(r => r.metaUnitType !== "(NULL)" && isSameUnit(r.metaUnitType, a.unitType));
    if (alias.length !== strict.length) {
      console.log(`\nAdmin ${a.email} (unitType=${a.unitType}):`);
      console.log(`  strict === : ${strict.length}   |   post-fix isSameUnit : ${alias.length}`);
      const hidden = alias.filter(r => !strict.includes(r));
      hidden.forEach(r => console.log(`     - ${r.requestNo} | ${r.status} | meta.unitType=${r.metaUnitType} | ${r.saleNo}`));
    }
  }

  // 4. Sample of recent pending rows
  console.log("\n=== SAMPLE pending (first 10) ===");
  pending.slice(0, 10).forEach(r =>
    console.log(`  ${r.requestNo} | type=${r.type} | meta.unitType=${r.metaUnitType} | ${r.saleNo}`),
  );

  // 5. Alias group sanity (the helper the fix relies on)
  console.log("\n=== unitAliasGroup sanity ===");
  console.log("resto_cafe →", JSON.stringify(unitAliasGroup("resto_cafe")));
  console.log("cafe_lsp   →", JSON.stringify(unitAliasGroup("cafe_lsp")));
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
