/**
 * ============================================================
 * CLEANUP UAT — Hapus semua data yang dibuat oleh seed-uat.ts
 * ============================================================
 * Jalankan: npx tsx prisma/cleanup-uat.ts
 * ============================================================
 * ⚠️  Hanya menghapus data dengan tag "[UAT]" atau email
 *     @primkoppol.test — AMAN untuk production!
 * ============================================================
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Memulai Cleanup UAT...\n");

  // ── 1. Hapus transaksi UAT (dari anggota UAT) ──────────────────
  const uatMembers = await prisma.member.findMany({
    where: { memberNo: { startsWith: "UAT-" } },
    select: { id: true },
  });
  const uatMemberIds = uatMembers.map((m: { id: number }) => m.id);

  if (uatMemberIds.length > 0) {
    const delSales = await prisma.storeSale.deleteMany({
      where: { memberId: { in: uatMemberIds } },
    });
    console.log(`  ✓ StoreSale UAT dihapus: ${delSales.count} record`);

    const delUnitTx = await prisma.unitTransaction.deleteMany({
      where: { memberId: { in: uatMemberIds } },
    });
    console.log(`  ✓ UnitTransaction UAT dihapus: ${delUnitTx.count} record`);

    const delApprovals = await prisma.approvalRequest.deleteMany({
      where: { description: { contains: "[UAT]" } },
    });
    console.log(`  ✓ ApprovalRequest UAT dihapus: ${delApprovals.count} record`);
  }

  // ── 2. Hapus produk toko UAT ───────────────────────────────────
  const delProducts = await prisma.storeProduct.deleteMany({
    where: { sku: { startsWith: "UAT-" } },
  });
  console.log(`  ✓ Produk Toko UAT dihapus: ${delProducts.count} produk`);

  // ── 3. Hapus paket layanan UAT ─────────────────────────────────
  const delPackages = await prisma.unitServicePackage.deleteMany({
    where: { name: { contains: "[UAT]" } },
  });
  console.log(`  ✓ Paket Layanan UAT dihapus: ${delPackages.count} paket`);

  // ── 4. Hapus anggota UAT ───────────────────────────────────────
  if (uatMemberIds.length > 0) {
    const delMembers = await prisma.member.deleteMany({
      where: { memberNo: { startsWith: "UAT-" } },
    });
    console.log(`  ✓ Anggota UAT dihapus: ${delMembers.count} anggota`);
  }

  // ── 5. Hapus user UAT (kasir & admin) ─────────────────────────
  const delUsers = await prisma.user.deleteMany({
    where: { email: { endsWith: "@primkoppol.test" } },
  });
  console.log(`  ✓ User UAT dihapus: ${delUsers.count} user`);

  console.log("\n✅ Cleanup selesai! Database bersih kembali.");
}

main()
  .catch((e) => { console.error("❌ Cleanup error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
