/**
 * SEED: Akun Kas Tunai & Bank JATIM PRIMKOPPOL
 * Jalankan: npx tsx prisma/seed-kas-bank-jatim.ts
 *
 * 10 akun yang dibuat:
 * - 6 akun Dana Alokasi SHU (kas + bank untuk Pegawai, Cadang, Sosial)
 * - 4 akun Operasional Multi-Unit (kas + bank untuk 2 kelompok unit)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🏦 Memulai seed Akun Kas & Bank JATIM PRIMKOPPOL...\n");

  // Cari Head Office branch
  const headOffice = await prisma.branch.findFirst({
    where: { isHeadOffice: true },
  });

  if (!headOffice) {
    throw new Error("❌ Head Office (cabang utama) tidak ditemukan. Pastikan branch sudah ada.");
  }

  console.log(`✅ Head Office: ${headOffice.name} (ID: ${headOffice.id})`);

  // Cari COA untuk Kas (1101) dan Bank (1102) jika ada
  const kasAccount = await prisma.account.findFirst({ where: { code: "1101" } });
  const bankAccount = await prisma.account.findFirst({ where: { code: "1102" } });
  console.log(`ℹ️  COA Kas: ${kasAccount ? kasAccount.name : "Tidak ditemukan (opsional)"}`);
  console.log(`ℹ️  COA Bank: ${bankAccount ? bankAccount.name : "Tidak ditemukan (opsional)"}\n`);

  // ================================================================
  // DEFINISI AKUN
  // ================================================================
  const accounts = [
    // ---- KATEGORI A: Dana Alokasi SHU ----
    {
      code: "KAS-JATIM-PGWI",
      name: "Kas Tunai JATIM – Dana Pegawai",
      type: "cash" as const,
      bankName: null,
      accountNumber: null,
      unitType: null,
      unitTypes: null,
      purpose: "shu_pegawai",
      glAccountId: kasAccount?.id || null,
    },
    {
      code: "BNK-JATIM-PGWI",
      name: "Bank JATIM – Dana Pegawai",
      type: "bank" as const,
      bankName: "Bank JATIM",
      accountNumber: "1234560001",
      unitType: null,
      unitTypes: null,
      purpose: "shu_pegawai",
      glAccountId: bankAccount?.id || null,
    },
    {
      code: "KAS-JATIM-CDG",
      name: "Kas Tunai JATIM – Dana Cadangan",
      type: "cash" as const,
      bankName: null,
      accountNumber: null,
      unitType: null,
      unitTypes: null,
      purpose: "shu_cadangan",
      glAccountId: kasAccount?.id || null,
    },
    {
      code: "BNK-JATIM-CDG",
      name: "Bank JATIM – Dana Cadangan",
      type: "bank" as const,
      bankName: "Bank JATIM",
      accountNumber: "1234560002",
      unitType: null,
      unitTypes: null,
      purpose: "shu_cadangan",
      glAccountId: bankAccount?.id || null,
    },
    {
      code: "KAS-JATIM-SOS",
      name: "Kas Tunai JATIM – Dana Sosial",
      type: "cash" as const,
      bankName: null,
      accountNumber: null,
      unitType: null,
      unitTypes: null,
      purpose: "shu_sosial",
      glAccountId: kasAccount?.id || null,
    },
    {
      code: "BNK-JATIM-SOS",
      name: "Bank JATIM – Dana Sosial",
      type: "bank" as const,
      bankName: "Bank JATIM",
      accountNumber: "1234560003",
      unitType: null,
      unitTypes: null,
      purpose: "shu_sosial",
      glAccountId: bankAccount?.id || null,
    },

    // ---- KATEGORI B: Kas Operasional Multi-Unit ----
    {
      code: "KAS-JATIM-CMR",
      name: "Kas Tunai JATIM – Cuci Mobil & Resto",
      type: "cash" as const,
      bankName: null,
      accountNumber: null,
      unitType: "cuci_mobil",       // primary unit (backward compat)
      unitTypes: ["cuci_mobil", "resto"],
      purpose: "operasional",
      glAccountId: kasAccount?.id || null,
    },
    {
      code: "BNK-JATIM-CMR",
      name: "Bank JATIM – Cuci Mobil & Resto",
      type: "bank" as const,
      bankName: "Bank JATIM",
      accountNumber: "1234560004",
      unitType: "cuci_mobil",
      unitTypes: ["cuci_mobil", "resto"],
      purpose: "operasional",
      glAccountId: bankAccount?.id || null,
    },
    {
      code: "KAS-JATIM-FTC",
      name: "Kas Tunai JATIM – Fitness, Toko & Coffee Latar",
      type: "cash" as const,
      bankName: null,
      accountNumber: null,
      unitType: "fitness",          // primary unit (backward compat)
      unitTypes: ["fitness", "toko", "coffe_latar"],
      purpose: "operasional",
      glAccountId: kasAccount?.id || null,
    },
    {
      code: "BNK-JATIM-FTC",
      name: "Bank JATIM – Fitness, Toko & Coffee Latar",
      type: "bank" as const,
      bankName: "Bank JATIM",
      accountNumber: "1234560005",
      unitType: "fitness",
      unitTypes: ["fitness", "toko", "coffe_latar"],
      purpose: "operasional",
      glAccountId: bankAccount?.id || null,
    },
  ];

  // ================================================================
  // UPSERT SEMUA AKUN
  // ================================================================
  let created = 0;
  let updated = 0;

  for (const acc of accounts) {
    const existing = await prisma.cashBankAccount.findUnique({
      where: { code: acc.code },
    });

    if (existing) {
      await prisma.cashBankAccount.update({
        where: { code: acc.code },
        data: {
          name: acc.name,
          type: acc.type,
          bankName: acc.bankName,
          accountNumber: acc.accountNumber,
          unitType: acc.unitType,
          unitTypes: acc.unitTypes ? acc.unitTypes : undefined,
          purpose: acc.purpose,
          glAccountId: acc.glAccountId,
          isActive: true,
        },
      });
      console.log(`🔄 UPDATED : ${acc.code} — ${acc.name}`);
      updated++;
    } else {
      await prisma.cashBankAccount.create({
        data: {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          bankName: acc.bankName,
          accountNumber: acc.accountNumber,
          branchId: headOffice.id,
          unitType: acc.unitType,
          unitTypes: acc.unitTypes ? acc.unitTypes : undefined,
          purpose: acc.purpose,
          glAccountId: acc.glAccountId,
          currentBalance: 0,
          isActive: true,
        },
      });
      console.log(`✅ CREATED : ${acc.code} — ${acc.name}`);
      created++;
    }
  }

  console.log(`\n🎉 Selesai! ${created} akun baru dibuat, ${updated} akun diperbarui.`);
  console.log("\n📋 Ringkasan Akun Kas & Bank JATIM:");
  console.log("─────────────────────────────────────────────────────");
  const allAccounts = await prisma.cashBankAccount.findMany({
    where: { code: { startsWith: "KAS-JATIM" } || { startsWith: "BNK-JATIM" } as any },
    orderBy: { code: "asc" },
  });
  for (const a of allAccounts) {
    const unitInfo = (a.unitTypes as string[] | null)?.join(", ") || a.unitType || "—";
    console.log(`  ${a.code.padEnd(20)} [${a.type.toUpperCase()}] ${a.purpose?.padEnd(14)} units: ${unitInfo}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
