// Cleanup stale void records — PRODUCTION SAFE:
// 1. Backs up every affected row to backup JSON BEFORE touching anything
// 2. Mirrors the app's normal reject paths exactly (no new semantics, no deletes)
// 3. Single atomic transaction; aborts without changes if anything unexpected
//
// Targets:
//   A. 7 pending void requests from May 2026 (VOID-TK-*, kasir toko) → rejected,
//      StoreSale metadata.voidPending=false (mirrors void-approve reject path)
//   B. CM250420260017 stuck pending_void (approval already approved April, execution
//      failed) → transaction restored to completed (mirrors reject-restore), approval
//      left approved + metadata note documenting cleanup (no history rewrite)
//
// Usage: npx tsx --env-file=.env scripts/cleanup-stale-voids.ts [--apply]
//        (without --apply: dry-run, backup + report only, no writes)
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const OPERATOR_ID = 727; // operator@koperasi.com — super admin, for audit trail
const CLEANUP_NOTE = "Cleanup otomatis 2026-09-19: request void basi (Mei 2026) tidak pernah diproses; transaksi tetap valid. Jika masih perlu void, ajukan ulang.";

async function main() {
  const now = new Date();

  // ── Gather targets ──────────────────────────────────────────────
  const staleReqs = await prisma.approvalRequest.findMany({
    where: {
      status: "pending",
      type: "void_store_sale",
      requestedAt: { lt: new Date("2026-06-01") },
    },
    include: { requestedBy: { select: { id: true, name: true } } },
  });
  console.log(`Target A: ${staleReqs.length} stale pending void_store_sale requests (before Jun 2026)`);

  const stuckTx = await prisma.unitTransaction.findUnique({
    where: { transactionNo: "CM250420260017" },
  });
  if (stuckTx?.status !== "pending_void") {
    console.log(`Target B: CM250420260017 status=${stuckTx?.status ?? "not found"} — ${stuckTx?.status === "completed" ? "already clean" : "UNEXPECTED, aborting"}`);
    if (stuckTx?.status !== "completed") process.exit(1);
  } else {
    console.log("Target B: CM250420260017 stuck pending_void");
  }
  const stuckApproval = await prisma.approvalRequest.findUnique({
    where: { requestNo: "VOID-CM250420260017" },
  });

  // ── Backup before any write ─────────────────────────────────────
  const sales = await prisma.storeSale.findMany({
    where: { saleNo: { in: staleReqs.map((r) => (r.metadata as any)?.saleNo ?? "").filter(Boolean) } },
  });
  const backup = {
    createdAt: now.toISOString(),
    description: "Pre-cleanup snapshot — restore these to undo cleanup-stale-voids",
    approvalRequests: staleReqs,
    storeSales: sales,
    unitTransaction: stuckTx,
    stuckApproval,
  };
  const backupPath = `backups/void-cleanup-${now.toISOString().slice(0, 10)}.json`;
  mkdirSync("backups", { recursive: true });
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupPath} (${staleReqs.length} requests, ${sales.length} sales, 1 transaction)`);

  if (!APPLY) {
    console.log("\nDRY RUN — no writes. Re-run with --apply to execute.");
    return;
  }

  // ── Apply: one atomic transaction ───────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    // A1. Reject stale requests (atomic claim, mirrors void-approve reject)
    for (const req of staleReqs) {
      const claim = await tx.approvalRequest.updateMany({
        where: { id: req.id, status: "pending" },
        data: { status: "rejected" },
      });
      if (claim.count === 0) throw new Error(`ALREADY_PROCESSED: #${req.id}`);
      await tx.approvalRequest.update({
        where: { id: req.id },
        data: {
          rejectedById: OPERATOR_ID,
          rejectedAt: now,
          rejectionReason: CLEANUP_NOTE,
        },
      });
    }

    // A2. Clear voidPending on their StoreSales (mirrors void-approve reject path)
    for (const sale of sales) {
      const meta: any = typeof sale.metadata === "string" ? JSON.parse(sale.metadata) : sale.metadata ?? {};
      if (!meta.voidPending) continue;
      meta.voidPending = false;
      await tx.storeSale.update({ where: { id: sale.id }, data: { metadata: meta } });
    }

    // B. Restore stuck transaction to completed (mirrors reject-restore);
    //    approval stays approved — append cleanup note to its metadata
    if (stuckTx?.status === "pending_void") {
      await tx.unitTransaction.update({
        where: { id: stuckTx.id },
        data: {
          status: "completed",
          voidReason: null,
          voidRequestedById: null,
          voidRequestedAt: null,
        },
      });
      if (stuckApproval) {
        const aMeta: any = typeof stuckApproval.metadata === "string" ? JSON.parse(stuckApproval.metadata) : stuckApproval.metadata ?? {};
        aMeta.cleanupNote = "Eksekusi void gagal April 2026 (bug lama, sudah diperbaiki). Transaksi dikembalikan ke completed oleh cleanup 2026-09-19. Void dapat diajukan ulang jika diperlukan.";
        await tx.approvalRequest.update({ where: { id: stuckApproval.id }, data: { metadata: aMeta } });
      }
    }

    return { rejected: staleReqs.length, salesCleared: sales.length };
  }, { timeout: 60_000 });

  console.log(`\nApplied: ${result.rejected} requests rejected, ${result.salesCleared} sales cleaned, transaction restored.`);

  // ── Verify after state ──────────────────────────────────────────
  const pendingAfter = await prisma.approvalRequest.count({ where: { status: "pending", type: { in: ["unit_void", "void_store_sale", "laporan_unit"] } } });
  const txAfter = await prisma.unitTransaction.findUnique({ where: { transactionNo: "CM250420260017" }, select: { status: true } });
  const voidPendingAfter = await prisma.storeSale.count({ where: { metadata: { path: ["voidPending"], equals: true } } });
  console.log(`\nVerify: pending void requests now=${pendingAfter}, CM250420260017=${txAfter?.status}, voidPending sales now=${voidPendingAfter}`);
}

main().catch((e) => { console.error("ABORTED (no partial writes — single transaction):", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
