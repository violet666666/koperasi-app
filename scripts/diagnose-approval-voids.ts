// Read-only: audit void yang "hilang" dari inbox approval admin unit.
// Tampilkan ApprovalRequest void 14 hari terakhir: status, siapa memproses kapan,
// plus kondisi UnitTransaction/StoreSale terkait (status diubah tanpa approval?).
import { prisma } from "../src/lib/prisma";

async function main() {
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  const reqs = await prisma.approvalRequest.findMany({
    where: { type: { in: ["unit_void", "void_store_sale"] }, requestedAt: { gte: since } },
    include: {
      requestedBy: { select: { id: true, name: true, role: true } },
      approvedBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: { requestedAt: "desc" },
  });
  console.log(`=== ApprovalRequest void (14 hari terakhir): n=${reqs.length} ===`);
  for (const r of reqs) {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    console.log(`\n#${r.id} ${r.requestNo} type=${r.type} status=${r.status}`);
    console.log(`  desc=${r.description}`);
    console.log(`  unitType=${String(meta.unitType)} ref=${r.referenceType}#${r.referenceId} amount=${Number(r.amount ?? 0)}`);
    console.log(`  requested ${r.requestedAt.toISOString()} oleh ${r.requestedBy.name} (${r.requestedBy.role})`);
    if (r.status !== "pending") {
      const by = r.approvedBy; // rejectedBy tidak punya relasi di schema — resolve via rejectedById bila perlu
      const at = r.approvedAt ?? r.rejectedAt;
      console.log(`  → diproses ${at?.toISOString()} oleh ${by?.name ?? `userId:${r.rejectedById ?? "?"}`} (${by?.role ?? "?"}) alasan=${r.rejectionReason ?? "-"}`);
    }
    console.log(`  updatedAt=${r.updatedAt.toISOString()}`);
  }

  // Cross-check: UnitTransaction pending_void TANPA ApprovalRequest pending (yatim)
  const pendingVoid = await prisma.unitTransaction.findMany({
    where: { status: "pending_void" },
    select: { id: true, transactionNo: true, unitType: true, voidRequestedAt: true },
    orderBy: { voidRequestedAt: "desc" },
  });
  console.log(`\n=== UnitTransaction status=pending_void: n=${pendingVoid.length} ===`);
  for (const t of pendingVoid) {
    const ar = await prisma.approvalRequest.findFirst({
      where: { referenceId: t.id, referenceType: "unit_transaction", status: "pending" },
      select: { id: true, requestNo: true },
    });
    console.log(`  tx=${t.transactionNo} unit=${t.unitType} reqAt=${t.voidRequestedAt?.toISOString() ?? "-"} approvalPending=${ar ? ar.requestNo : "TIDAK ADA (yatim!)"}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
