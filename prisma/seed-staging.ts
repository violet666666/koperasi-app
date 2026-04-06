/**
 * ============================================================
 * SEED STAGING — Bootstrap minimum untuk UAT di Supabase
 * ============================================================
 * Hanya membuat data dasar yang dibutuhkan:
 *   - Permissions + Roles (operator, admin, kasir, anggota)
 *   - Branch (Primkoppol Lumajang)
 *   - Fiscal Period (bulan berjalan)
 *   - CashBankAccount (kas pusat untuk FK reference)
 *   - Semua akun UAT (kasir + admin tiap unit)
 *   - Anggota dummy UAT
 *   - Produk Toko UAT
 *   - Paket Layanan Jasa UAT
 *
 * Jalankan: npx tsx prisma/seed-staging.ts
 * ============================================================
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const UAT_PASSWORD = "uat123456";

// ─── Roles & Permissions ────────────────────────────────────
const PERMISSIONS = [
  { name: "manage_all", displayName: "Akses Penuh", module: "system" },
  { name: "user_management", displayName: "Kelola Pengguna", module: "users" },
  { name: "master_data", displayName: "Master Data", module: "master" },
  { name: "manage_anggota", displayName: "Kelola Anggota", module: "members" },
  { name: "view_anggota", displayName: "Lihat Anggota", module: "members" },
  { name: "manage_simpanan", displayName: "Kelola Simpanan", module: "savings" },
  { name: "view_simpanan", displayName: "Lihat Simpanan", module: "savings" },
  { name: "manage_pinjaman", displayName: "Kelola Pinjaman", module: "loans" },
  { name: "view_pinjaman", displayName: "Lihat Pinjaman", module: "loans" },
  { name: "approve_pinjaman", displayName: "Approve Pinjaman", module: "loans" },
  { name: "manage_kas_bank", displayName: "Kelola Kas & Bank", module: "cash_bank" },
  { name: "view_jurnal", displayName: "Lihat Jurnal", module: "accounting" },
  { name: "view_laporan", displayName: "Lihat Laporan", module: "reports" },
  { name: "tutup_buku", displayName: "Tutup Buku", module: "period" },
  { name: "alokasi_shu", displayName: "Alokasi SHU", module: "shu" },
  { name: "approve_transactions", displayName: "Approve Transaksi", module: "approval" },
  { name: "view_audit_log", displayName: "Lihat Audit Log", module: "audit" },
  { name: "manage_toko", displayName: "Kelola Toko", module: "shop" },
  { name: "manage_pengumuman", displayName: "Kelola Pengumuman", module: "communication" },
  { name: "edit_profil", displayName: "Edit Profil Koperasi", module: "settings" },
  { name: "manage_aset", displayName: "Kelola Aset", module: "assets" },
  { name: "manage_unit_transactions", displayName: "Kelola Transaksi Unit", module: "unit_transactions" },
  { name: "view_own_data", displayName: "Lihat Data Sendiri", module: "portal" },
];

const ROLES = [
  { name: "operator", displayName: "Operator", description: "Super Admin", isSystem: true, permissions: ["manage_all"] },
  { name: "admin", displayName: "Admin", description: "Admin per unit", isSystem: true, permissions: ["manage_anggota","view_anggota","manage_simpanan","view_simpanan","manage_pinjaman","view_pinjaman","approve_pinjaman","manage_kas_bank","view_jurnal","view_laporan","approve_transactions","manage_toko","manage_unit_transactions","manage_pengumuman"] },
  { name: "kasir", displayName: "Kasir", description: "Cashier per unit", isSystem: true, permissions: ["view_anggota","manage_toko","manage_unit_transactions"] },
  { name: "anggota", displayName: "Anggota", description: "Member", isSystem: true, permissions: ["view_own_data"] },
];

// Unit usaha untuk UAT
const UNIT_TYPES = [
  { slug: "toko",         label: "Toko PRIMKOPPOL" },
  { slug: "cuci_mobil",   label: "Cuci Mobil" },
  { slug: "barbershop",   label: "Barbershop" },
  { slug: "play_station", label: "PlayStation" },
  { slug: "fitness",      label: "Fitness" },
  { slug: "resto",        label: "Resto" },
];

async function main() {
  console.log("🌱 Staging Bootstrap Seed — PRIMKOPPOL UAT\n");

  const hashedPwd = await bcrypt.hash(UAT_PASSWORD, 10);
  const operatorPwd = await bcrypt.hash("password123", 10);

  // ── 1. Permissions ─────────────────────────────────────────────
  console.log("🔑 Membuat permissions...");
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({ where: { name: perm.name }, update: {}, create: perm });
  }

  // ── 2. Roles ────────────────────────────────────────────────────
  console.log("🎭 Membuat roles...");
  const roleMap: Record<string, number> = {};
  for (const role of ROLES) {
    const { permissions, ...roleData } = role;
    const created = await prisma.role.upsert({ where: { name: roleData.name }, update: {}, create: roleData });
    roleMap[role.name] = created.id;
    // Assign permissions
    for (const permName of permissions) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: created.id, permissionId: perm.id } },
          update: {},
          create: { roleId: created.id, permissionId: perm.id },
        });
      }
    }
    console.log(`  ✓ Role: ${role.displayName}`);
  }

  // ── 3. Branch ───────────────────────────────────────────────────
  console.log("\n🏢 Membuat branch...");
  const branch = await prisma.branch.upsert({
    where: { code: "LMJ-UAT" },
    update: {},
    create: {
      code: "LMJ-UAT", name: "Primkoppol Lumajang (Staging)",
      address: "Jl. Alun-Alun Barat No. 10, Lumajang",
      isHeadOffice: true, isActive: true,
    },
  });
  const branchId = branch.id;
  console.log(`  ✓ Branch ID: ${branchId}`);

  // ── 4. Fiscal Period (bulan ini) ────────────────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  await prisma.fiscalPeriod.upsert({
    where: { year_month: { year, month } },
    update: {},
    create: { name: `Periode UAT ${month}/${year}`, year, month, startDate, endDate, status: "open" },
  });
  console.log(`\n📅 Fiscal Period: ${month}/${year} dibuat`);

  // ── 5. CashBankAccount minimum (untuk FK) ────────────────────────
  console.log("\n💰 Membuat akun kas staging...");
  await prisma.cashBankAccount.upsert({
    where: { code: "KAS-UAT" },
    update: {},
    create: { code: "KAS-UAT", name: "Kas Staging UAT", type: "cash", branchId, currentBalance: 100000000, isActive: true },
  });
  console.log("  ✓ Kas Staging UAT");

  // ── 6. Operator (Admin Pusat) ────────────────────────────────────
  console.log("\n👨‍💼 Membuat akun operator...");
  await prisma.user.upsert({
    where: { email: "operator@koperasi.com" },
    update: {},
    create: {
      name: "Operator (Super Admin)", email: "operator@koperasi.com",
      password: operatorPwd, roleId: roleMap["operator"], branchId, isActive: true,
    },
  });
  console.log("  ✓ operator@koperasi.com | password: password123");

  // ── 7. Kasir & Admin tiap unit ───────────────────────────────────
  console.log("\n👥 Membuat akun UAT per unit...");
  for (const unit of UNIT_TYPES) {
    await prisma.user.upsert({
      where: { email: `kasir.uat.${unit.slug}@primkoppol.test` },
      update: {},
      create: {
        name: `[UAT] Kasir ${unit.label}`, email: `kasir.uat.${unit.slug}@primkoppol.test`,
        password: hashedPwd, roleId: roleMap["kasir"], branchId, unitType: unit.slug, isActive: true,
      },
    });
    await prisma.user.upsert({
      where: { email: `admin.uat.${unit.slug}@primkoppol.test` },
      update: {},
      create: {
        name: `[UAT] Admin ${unit.label}`, email: `admin.uat.${unit.slug}@primkoppol.test`,
        password: hashedPwd, roleId: roleMap["admin"], branchId, unitType: unit.slug, isActive: true,
      },
    });
    console.log(`  ✓ kasir + admin: ${unit.label}`);
  }

  // ── 8. Anggota UAT ───────────────────────────────────────────────
  console.log("\n🧑 Membuat anggota UAT...");
  const mem1 = await prisma.member.upsert({
    where: { memberNo: "UAT-0001" },
    update: {},
    create: {
      memberNo: "UAT-0001", nrp: "UAT99001", branchId,
      name: "[UAT] Anggota Test Utama", joinDate: new Date("2024-01-01"),
      status: "active", salary: 6000000, plafonPiutang: 5000000,
    },
  });
  await prisma.user.upsert({
    where: { email: "uat99001@primkoppol.test" },
    update: {},
    create: {
      name: mem1.name, email: "uat99001@primkoppol.test",
      password: hashedPwd, roleId: roleMap["anggota"], branchId, memberId: mem1.id, isActive: true,
    }
  });
  const mem2 = await prisma.member.upsert({
    where: { memberNo: "UAT-0002" },
    update: {},
    create: {
      memberNo: "UAT-0002", nrp: "UAT99002", branchId,
      name: "[UAT] Anggota Over Limit", joinDate: new Date("2024-01-01"),
      status: "active", salary: 4000000, plafonPiutang: 0,
    },
  });
  await prisma.user.upsert({
    where: { email: "uat99002@primkoppol.test" },
    update: {},
    create: {
      name: mem2.name, email: "uat99002@primkoppol.test",
      password: hashedPwd, roleId: roleMap["anggota"], branchId, memberId: mem2.id, isActive: true,
    }
  });
  console.log("  ✓ UAT-0001 (Plafon Rp5 Juta) + UAT-0002 (Plafon Rp0)");

  // ── 9. Produk Toko UAT ───────────────────────────────────────────
  console.log("\n📦 Membuat produk toko UAT...");
  const tokoProds = [
    { sku: "UAT-P001", name: "[UAT] Mie Instan Goreng", sellPrice: 4500,  stock: 100, costPrice: 3600 },
    { sku: "UAT-P002", name: "[UAT] Air Mineral 600ml", sellPrice: 3000,  stock: 150, costPrice: 2000 },
    { sku: "UAT-P003", name: "[UAT] Sabun Mandi",       sellPrice: 8500,  stock: 80,  costPrice: 6000 },
    { sku: "UAT-P004", name: "[UAT] Deterjen 500g",     sellPrice: 12500, stock: 60,  costPrice: 9000 },
    { sku: "UAT-P005", name: "[UAT] Gula Putih 1kg",    sellPrice: 16000, stock: 40,  costPrice: 13000 },
  ];
  for (const p of tokoProds) {
    await prisma.storeProduct.upsert({
      where: { sku: p.sku }, update: {}, create: { ...p, stockToko: p.stock, stockGdg: 0, unit: "pcs" },
    });
    console.log(`  ✓ ${p.name}`);
  }

  // ── 10. Paket Layanan Unit Jasa ──────────────────────────────────
  console.log("\n⚡ Membuat paket layanan jasa UAT...");
  const kasirRef = await prisma.user.findFirst({ where: { email: `kasir.uat.cuci_mobil@primkoppol.test` } });
  if (kasirRef) {
    const jasPkgs = [
      { unitType: "cuci_mobil",   name: "[UAT] Motor",              price: 15000 },
      { unitType: "cuci_mobil",   name: "[UAT] Mobil Kecil",        price: 35000 },
      { unitType: "cuci_mobil",   name: "[UAT] Mobil Sedang",       price: 40000 },
      { unitType: "barbershop",   name: "[UAT] Potong Rambut Pria", price: 20000 },
      { unitType: "barbershop",   name: "[UAT] Cukur Jenggot",      price: 15000 },
      { unitType: "play_station", name: "[UAT] Main 1 Jam",         price: 10000 },
      { unitType: "play_station", name: "[UAT] Paket 3 Jam",        price: 25000 },
      { unitType: "fitness",      name: "[UAT] Member Harian",      price: 15000 },
      { unitType: "fitness",      name: "[UAT] Member Bulanan",     price: 150000 },
    ];
    for (const pkg of jasPkgs) {
      const exists = await prisma.unitServicePackage.findFirst({ where: { unitType: pkg.unitType, name: pkg.name } });
      if (!exists) {
        await prisma.unitServicePackage.create({ data: { ...pkg, isActive: true, createdById: kasirRef.id } });
      }
      console.log(`  ✓ [${pkg.unitType}] ${pkg.name}`);
    }
  }

  // ── 11. Produk Pinjaman ──────────────────────────────────────────
  console.log("\n💳 Membuat produk pinjaman UAT...");
  const loanProds = [
    {
      code: "PINJ-UAT-01", name: "[UAT] Pinjaman Reguler", version: 1,
      interestMethod: "flat", interestRate: 1.5, interestCalculation: "monthly",
      minTenorMonths: 3, maxTenorMonths: 24, minAmount: 1000000, maxAmount: 10000000,
      adminFeeType: "percent", adminFeeValue: 1.0, lateFeeType: "percent", lateFeeValue: 2.0,
      requiresCollateral: false, effectiveDate: new Date("2024-01-01"), isCurrent: true, isActive: true
    }
  ];
  for (const lp of loanProds) {
    await prisma.loanProduct.upsert({
      where: { code_version: { code: lp.code, version: lp.version } },
      update: {},
      create: lp,
    });
    console.log(`  ✓ ${lp.name}`);
  }

  // ── Ringkasan ────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(58));
  console.log("✅ STAGING SEED SELESAI!");
  console.log("=".repeat(58));
  console.log("🔑 Akun UAT (password: uat123456):");
  for (const unit of UNIT_TYPES) {
    console.log(`  kasir.uat.${unit.slug}@primkoppol.test`);
    console.log(`  admin.uat.${unit.slug}@primkoppol.test`);
  }
  console.log("\n🔑 Operator: operator@koperasi.com | password123");
  console.log("👥 Anggota: NRP UAT99001 (Plafon 5 Juta) | UAT99002 (Blokir)");
  console.log("=".repeat(58));
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
