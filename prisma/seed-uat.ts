/**
 * ============================================================
 * SEED UAT — PRIMKOPPOL Koperasi UAT Environment
 * ============================================================
 * Membuat data uji (test fixtures) yang diperlukan untuk UAT:
 *   - User: Kasir & Admin tiap unit usaha
 *   - Anggota dummy (tag "[UAT]") dengan plafon piutang yang cukup
 *   - Produk Toko sample (untuk POS Toko)
 *   - Paket Layanan Jasa (untuk POS per Unit)
 *
 * Jalankan: npx tsx prisma/seed-uat.ts
 * Cleanup : npx tsx prisma/cleanup-uat.ts
 * ============================================================
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Konstanta UAT ─────────────────────────────────────────────
const UAT_TAG = "[UAT]";
const UAT_PASSWORD = "uat123456"; // Password semua akun UAT
const BRANCH_ID = 10; // Sesuaikan dengan branchId production Anda

// Unit usaha yang akan diuji
const UNIT_TYPES = [
  { slug: "toko",         label: "Toko PRIMKOPPOL", isToko: true  },
  { slug: "cuci_mobil",   label: "Cuci Mobil",      isToko: false },
  { slug: "barbershop",   label: "Barbershop",       isToko: false },
  { slug: "play_station", label: "PlayStation",      isToko: false },
  { slug: "fitness",      label: "Fitness",          isToko: false },
  { slug: "resto",        label: "Resto",            isToko: true  },
];

async function main() {
  console.log("🚀 Memulai UAT Seed...\n");

  // ── 1. Ambil Role ID dari database ────────────────────────────
  const kasirRole  = await prisma.role.findFirstOrThrow({ where: { name: "kasir"  } });
  const adminRole  = await prisma.role.findFirstOrThrow({ where: { name: "admin"  } });
  const hashedPwd  = await bcrypt.hash(UAT_PASSWORD, 10);

  // ── 2. Buat User Kasir & Admin untuk setiap unit ───────────────
  console.log("👥 Membuat akun UAT per unit...");
  const createdUsers: number[] = [];

  for (const unit of UNIT_TYPES) {
    // Kasir
    const kasir = await prisma.user.upsert({
      where:  { email: `kasir.uat.${unit.slug}@primkoppol.test` },
      update: {},
      create: {
        name:     `${UAT_TAG} Kasir ${unit.label}`,
        email:    `kasir.uat.${unit.slug}@primkoppol.test`,
        password: hashedPwd,
        roleId:   kasirRole.id,
        branchId: BRANCH_ID,
        unitType: unit.slug,
        isActive: true,
      },
    });
    createdUsers.push(kasir.id);
    console.log(`  ✓ Kasir ${unit.label}: ${kasir.email}`);

    // Admin
    const admin = await prisma.user.upsert({
      where:  { email: `admin.uat.${unit.slug}@primkoppol.test` },
      update: {},
      create: {
        name:     `${UAT_TAG} Admin ${unit.label}`,
        email:    `admin.uat.${unit.slug}@primkoppol.test`,
        password: hashedPwd,
        roleId:   adminRole.id,
        branchId: BRANCH_ID,
        unitType: unit.slug,
        isActive: true,
      },
    });
    createdUsers.push(admin.id);
    console.log(`  ✓ Admin ${unit.label}: ${admin.email}`);
  }

  // ── 3. Buat Anggota UAT ────────────────────────────────────────
  console.log("\n👤 Membuat anggota UAT dummy...");
  const uatMember = await prisma.member.upsert({
    where:  { memberNo: "UAT-0001" },
    update: {},
    create: {
      memberNo:      "UAT-0001",
      nrp:           "UAT99001",
      branchId:      BRANCH_ID,
      name:          `${UAT_TAG} Anggota Test Utama`,
      joinDate:      new Date("2024-01-01"),
      status:        "active",
      salary:        6000000,
      plafonPiutang: 5000000, // Limit piutang Rp5 Juta untuk test Potong Gaji
    },
  });
  console.log(`  ✓ Anggota: ${uatMember.name} (NRP: ${uatMember.nrp})`);

  // Anggota kedua dengan plafon habis (untuk test blokir)
  const uatMemberBlocked = await prisma.member.upsert({
    where:  { memberNo: "UAT-0002" },
    update: {},
    create: {
      memberNo:      "UAT-0002",
      nrp:           "UAT99002",
      branchId:      BRANCH_ID,
      name:          `${UAT_TAG} Anggota Over Limit`,
      joinDate:      new Date("2024-01-01"),
      status:        "active",
      salary:        4000000,
      plafonPiutang: 0, // Plafon nol → akan diblokir saat Potong Gaji
    },
  });
  console.log(`  ✓ Anggota Over-Limit: ${uatMemberBlocked.name}`);

  // ── 4. Buat Produk Toko Sample ─────────────────────────────────
  console.log("\n📦 Membuat produk toko UAT...");
  const tokoProducts = [
    { sku: "UAT-P001", name: `${UAT_TAG} Mie Instan Goreng`, sellPrice: 4500,  stock: 100, category: "Makanan" },
    { sku: "UAT-P002", name: `${UAT_TAG} Air Mineral 600ml`, sellPrice: 3000,  stock: 150, category: "Minuman" },
    { sku: "UAT-P003", name: `${UAT_TAG} Sabun Mandi`,       sellPrice: 8500,  stock: 80,  category: "Toiletries" },
    { sku: "UAT-P004", name: `${UAT_TAG} Deterjen 500g`,     sellPrice: 12500, stock: 60,  category: "Peralatan Rumah" },
    { sku: "UAT-P005", name: `${UAT_TAG} Gula Putih 1kg`,    sellPrice: 16000, stock: 40,  category: "Sembako" },
  ];

  for (const p of tokoProducts) {
    await prisma.storeProduct.upsert({
      where:  { sku: p.sku },
      update: {},
      create: { ...p, sellPrice: p.sellPrice, costPrice: p.sellPrice * 0.8, stockToko: p.stock, stockGdg: 0 },
    });
    console.log(`  ✓ Produk: ${p.name} @ Rp${p.sellPrice.toLocaleString("id-ID")}`);
  }

  // ── 5. Buat Paket Layanan Unit Jasa ────────────────────────────
  // (hanya jika model UnitServicePackage ada)
  console.log("\n⚡ Membuat paket layanan unit jasa UAT...");
  const jasaPackages: { unitType: string; name: string; price: number }[] = [
    // Cuci Mobil
    { unitType: "cuci_mobil", name: `${UAT_TAG} Motor`,              price: 15000 },
    { unitType: "cuci_mobil", name: `${UAT_TAG} Mobil Kecil`,        price: 35000 },
    { unitType: "cuci_mobil", name: `${UAT_TAG} Mobil Sedang`,       price: 40000 },
    // Barbershop
    { unitType: "barbershop", name: `${UAT_TAG} Potong Rambut Pria`, price: 20000 },
    { unitType: "barbershop", name: `${UAT_TAG} Cukur + Creambath`,  price: 45000 },
    // PlayStation
    { unitType: "play_station", name: `${UAT_TAG} Main 1 Jam`,       price: 10000 },
    { unitType: "play_station", name: `${UAT_TAG} Paket 3 Jam`,      price: 25000 },
    // Fitness
    { unitType: "fitness",    name: `${UAT_TAG} Member Harian`,      price: 15000 },
    { unitType: "fitness",    name: `${UAT_TAG} Member Bulanan`,      price: 150000 },
  ];

  const kasirUserForSeed = await prisma.user.findFirst({
    where: { email: `kasir.uat.cuci_mobil@primkoppol.test` },
  });

  if (kasirUserForSeed) {
    for (const pkg of jasaPackages) {
      const existing = await prisma.unitServicePackage.findFirst({
        where: { unitType: pkg.unitType, name: pkg.name },
      });
      if (!existing) {
        await prisma.unitServicePackage.create({
          data: {
            unitType: pkg.unitType,
            name:     pkg.name,
            price:    pkg.price,
            isActive: true,
            createdById: kasirUserForSeed.id,
          },
        });
      }
      console.log(`  ✓ [${pkg.unitType}] ${pkg.name} @ Rp${pkg.price.toLocaleString("id-ID")}`);
    }
  }

  // ── Ringkasan ──────────────────────────────────────────────────
  console.log("\n✅ UAT Seed selesai!");
  console.log("─".repeat(50));
  console.log("📋 AKUN UAT (password: uat123456):");
  console.log("─".repeat(50));
  for (const unit of UNIT_TYPES) {
    console.log(`  [KASIR] kasir.uat.${unit.slug}@primkoppol.test`);
    console.log(`  [ADMIN] admin.uat.${unit.slug}@primkoppol.test`);
  }
  console.log("─".repeat(50));
  console.log("👥 ANGGOTA TEST:");
  console.log("  UAT-0001 / NRP: UAT99001 → Plafon Rp5 Juta (untuk test Potong Gaji OK)");
  console.log("  UAT-0002 / NRP: UAT99002 → Plafon Rp0    (untuk test Potong Gaji BLOKIR)");
  console.log("─".repeat(50));
  console.log("🗑️  Hapus semua data ini: npx tsx prisma/cleanup-uat.ts");
}

main()
  .catch((e) => { console.error("❌ Seed error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
