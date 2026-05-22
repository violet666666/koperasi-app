/**
 * Script: Add cafe_lsp to existing CMR CashBankAccounts in production.
 *
 * The CMR group (KAS-JATIM-CMR + BNK-JATIM-CMR) currently covers
 * ["cuci_mobil", "resto"]. This script adds "cafe_lsp" to both accounts.
 *
 * Run: node scripts/add-cafe-lsp-accounts.js
 * Requires: DATABASE_URL env var (uses NeonDB connection string)
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const accounts = ["KAS-JATIM-CMR", "BNK-JATIM-CMR"];

  for (const code of accounts) {
    const account = await prisma.cashBankAccount.findUnique({ where: { code } });
    if (!account) {
      console.log(`SKIP: Account ${code} not found`);
      continue;
    }

    const currentTypes = account.unitTypes || [];
    if (currentTypes.includes("cafe_lsp")) {
      console.log(`OK: ${code} already includes cafe_lsp`);
      continue;
    }

    const newTypes = [...currentTypes, "cafe_lsp"];
    await prisma.cashBankAccount.update({
      where: { id: account.id },
      data: {
        unitTypes: newTypes,
        name: account.name.replace("& Resto", ", Resto & Cafe LSP"),
      },
    });
    console.log(`UPDATED: ${code} unitTypes ${JSON.stringify(currentTypes)} → ${JSON.stringify(newTypes)}`);
  }

  // Also update FTC group to include barbershop, play_station, laundry, fotocopy
  const ftcAccounts = ["KAS-JATIM-FTC", "BNK-JATIM-FTC"];
  const additionalUnits = ["barbershop", "play_station", "laundry", "fotocopy"];

  for (const code of ftcAccounts) {
    const account = await prisma.cashBankAccount.findUnique({ where: { code } });
    if (!account) {
      console.log(`SKIP: Account ${code} not found`);
      continue;
    }

    const currentTypes = account.unitTypes || [];
    const missingUnits = additionalUnits.filter(u => !currentTypes.includes(u));
    if (missingUnits.length === 0) {
      console.log(`OK: ${code} already includes all units`);
      continue;
    }

    const newTypes = [...currentTypes, ...missingUnits];
    await prisma.cashBankAccount.update({
      where: { id: account.id },
      data: { unitTypes: newTypes },
    });
    console.log(`UPDATED: ${code} added ${missingUnits.join(", ")}`);
  }

  console.log("\nDone! All units now covered by CashBankAccounts.");
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
