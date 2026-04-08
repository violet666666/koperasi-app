/**
 * ============================================================
 * SEED — Produk Pinjaman Reguler & Khusus
 * ============================================================
 * Membuat / memperbarui 2 produk pinjaman sesuai ketentuan:
 *   1. Pinjaman Reguler  → Min 0, Maks 20 Jt, Tenor 1–36 Bln, Bunga 1% Flat/Bln, Resiko 2%
 *   2. Pinjaman Khusus   → Min 30 Jt, No Max, Tenor 1–60 Bln, Bunga 1% Flat/Bln, Resiko 2%
 *
 * Jalankan: npx tsx prisma/seed-loan-products.ts
 * (Set DATABASE_URL ke staging sebelum jalankan untuk UAT)
 * ============================================================
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Seed Produk Pinjaman...\n");

  // ── Pastikan tidak ada produk lama yang konflik ──────────────
  // Nonaktifkan/hapus produk placeholder yang dibuat auto-seeder sebelumnya
  await prisma.loanProduct.updateMany({
    where: {
      isCurrent: true,
      isActive: true,
      code: { notIn: ["PR", "PK"] },
    },
    data: { isCurrent: false, isActive: false },
  });
  console.log("  ↩ Menonaktifkan produk lama (jika ada)...");

  // ── 1. Pinjaman Reguler ──────────────────────────────────────
  const reguler = await prisma.loanProduct.upsert({
    where: { code_version: { code: "PR", version: 1 } },
    update: {
      name: "Pinjaman Reguler",
      interestMethod: "flat",
      interestRate: 1.00,
      interestCalculation: "monthly",
      minTenorMonths: 1,
      maxTenorMonths: 36,
      minAmount: 0,
      maxAmount: 20_000_000,
      adminFeeType: "percent",
      adminFeeValue: 2.00,
      gracePeriodDays: 0,
      requiresCollateral: false,
      isCurrent: true,
      isActive: true,
    },
    create: {
      code: "PR",
      version: 1,
      name: "Pinjaman Reguler",
      interestMethod: "flat",
      interestRate: 1.00,          // 1% flat per bulan
      interestCalculation: "monthly",
      minTenorMonths: 1,
      maxTenorMonths: 36,          // Maks 36 bulan (3 tahun)
      minAmount: 0,              // Tidak ada batas minimal
      maxAmount: 20_000_000,       // Maks 20 Juta
      adminFeeType: "percent",
      adminFeeValue: 2.00,         // Biaya resiko 2% dipotong di muka
      gracePeriodDays: 0,
      requiresCollateral: false,
      effectiveDate: new Date("2024-01-01"),
      isCurrent: true,
      isActive: true,
    },
  });
  console.log(`  ✓ Pinjaman Reguler [ID: ${reguler.id}]`);
  console.log(`     Limit: Rp0 – Rp20jt | Tenor: 1–36 bln | Bunga: 1%/bln Flat | Resiko: 2%`);

  // ── 2. Pinjaman Khusus ───────────────────────────────────────
  const khusus = await prisma.loanProduct.upsert({
    where: { code_version: { code: "PK", version: 1 } },
    update: {
      name: "Pinjaman Khusus",
      interestMethod: "flat",
      interestRate: 1.00,
      interestCalculation: "monthly",
      minTenorMonths: 1,
      maxTenorMonths: 60,
      minAmount: 30_000_000,
      maxAmount: null,             // No Limit
      adminFeeType: "percent",
      adminFeeValue: 2.00,
      gracePeriodDays: 0,
      requiresCollateral: true,   // Pinjaman besar umumnya butuh jaminan
      isCurrent: true,
      isActive: true,
    },
    create: {
      code: "PK",
      version: 1,
      name: "Pinjaman Khusus",
      interestMethod: "flat",
      interestRate: 1.00,          // 1% flat per bulan
      interestCalculation: "monthly",
      minTenorMonths: 1,
      maxTenorMonths: 60,          // Maks 60 bulan (5 tahun)
      minAmount: 30_000_000,       // Min 30 Juta
      maxAmount: null,             // Tidak ada batas maksimal
      adminFeeType: "percent",
      adminFeeValue: 2.00,         // Biaya resiko 2% dipotong di muka
      gracePeriodDays: 0,
      requiresCollateral: true,
      effectiveDate: new Date("2024-01-01"),
      isCurrent: true,
      isActive: true,
    },
  });
  console.log(`  ✓ Pinjaman Khusus [ID: ${khusus.id}]`);
  console.log(`     Limit: Rp30jt – Tak Terbatas | Tenor: 1–60 bln | Bunga: 1%/bln Flat | Resiko: 2%`);

  // ── Ringkasan Produk Aktif ───────────────────────────────────
  const allActive = await prisma.loanProduct.findMany({
    where: { isActive: true, isCurrent: true },
    orderBy: { minAmount: "asc" },
  });

  console.log("\n📋 Semua Produk Pinjaman Aktif:");
  for (const p of allActive) {
    const maxLabel = p.maxAmount ? `Rp${Number(p.maxAmount).toLocaleString("id-ID")}` : "Tidak Terbatas";
    const minLabel = p.minAmount ? `Rp${Number(p.minAmount).toLocaleString("id-ID")}` : "–";
    console.log(`  [${p.id}] ${p.code} — ${p.name}`);
    console.log(`       Limit: ${minLabel} s/d ${maxLabel} | Tenor: ${p.minTenorMonths}–${p.maxTenorMonths} bln`);
  }

  console.log("\n✅ Seed Produk Pinjaman selesai!");
}

main()
  .catch((e) => { console.error("❌ Seed error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
