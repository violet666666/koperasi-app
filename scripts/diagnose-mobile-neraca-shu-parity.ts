// scripts/diagnose-mobile-neraca-shu-parity.ts
// Read-only diagnostic vs prod Neon. Proves the Fase-1 mobile refresh pipeline
// end-to-end BEFORE deploy: ledger neraca (simpanan != 0) + Laba Kotor rows.
//
// Jalankan: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-neraca-shu-parity.ts
import prisma from "../src/lib/prisma";
import { buildBalanceSheet } from "../src/lib/services/neraca";
import { toMobileNeracaShape } from "../src/lib/services/mobile-neraca-shape";
import { computeUnitGrossProfit } from "../src/lib/services/shu-gross-profit";

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

async function main() {
  const bs = await buildBalanceSheet();
  const m = toMobileNeracaShape(bs);

  console.log("=== NERACA (ledger → mobile shape) ===");
  console.log("totalAssets           :", rp(m.assets.totalAssets));
  console.log("totalCurrentAssets    :", rp(m.assets.totalCurrentAssets));
  console.log("totalFixedAssets (net):", rp(m.assets.totalFixedAssets));
  console.log("totalLiabilities      :", rp(m.liabilities.totalLiabilities));
  const savings = m.liabilities.shortTerm.filter((i) =>
    ["2101", "2102", "2103", "21XX"].includes(i.code),
  );
  console.log(
    "  savings rows        :",
    savings.map((i) => `${i.name}=${rp(i.amount)}`).join(" | ") || "(none)",
  );
  console.log("totalEquity           :", rp(m.equity.totalEquity));
  console.log("totalLiab+Equity      :", rp(m.totalLiabilitiesAndEquity));
  console.log(
    "isBalanced (bs)       :",
    bs.isBalanced,
    "| selisih:",
    rp(bs.equity.selisih),
  );
  console.log(
    "consistency (assets = curr+fixed):",
    Math.abs(m.assets.totalAssets - (m.assets.totalCurrentAssets + m.assets.totalFixedAssets)) < 1,
  );
  console.log(
    "balance check (assets = liab+equity):",
    Math.abs(m.assets.totalAssets - m.totalLiabilitiesAndEquity) < 1,
  );

  const year = new Date().getFullYear();
  const gp = await computeUnitGrossProfit(year);
  console.log(`\n=== LABA KOTOR per UNIT (${year}) ===`);
  if (gp.length === 0) {
    console.log("(no rows — computeUnitGrossProfit returned [])");
  }
  for (const r of gp) {
    console.log(
      `${r.label.padEnd(20)} omzet=${rp(r.omzet).padStart(20)}  hpp=${rp(r.hpp).padStart(18)}  laba=${rp(r.labaKotor).padStart(18)}  margin=${r.margin}%  items=${r.itemCount}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
