// Read-only: build real balance sheet, run buildNeracaRows, print grouped output
// + dump generated PDF html for visual inspection.
import { writeFileSync } from "fs";
import { buildBalanceSheet } from "../src/lib/services/neraca";
import { buildNeracaRows } from "../src/lib/neraca-format";
import { buildNeracaHtml } from "../src/lib/export-utils";

async function main() {
  const data = await buildBalanceSheet();
  writeFileSync(".tmp-neraca-preview.html", buildNeracaHtml(data));
  console.log("HTML preview written: .tmp-neraca-preview.html");
  const fmt = buildNeracaRows(data);
  console.log(`Neraca per ${fmt.asOf} | balanced=${fmt.isBalanced} selisih=${fmt.selisih}`);
  for (const [name, side] of [["AKTIVA", fmt.aktiva], ["PASIVA", fmt.pasiva]] as const) {
    console.log(`\n=== ${name} ===`);
    for (const r of side.rows) {
      const amt = r.amount === null ? "" : r.amount.toLocaleString("id-ID");
      const mark = r.kind === "group" ? "■" : r.kind === "subtotal" ? "  →" : r.kind === "total" ? "████" : "  ·";
      console.log(`${mark} ${r.label}${amt ? ` : ${amt}` : ""}`);
    }
  }
  console.log(`\nTotal AKTIVA=${fmt.aktiva.total.toLocaleString("id-ID")} PASIVA=${fmt.pasiva.total.toLocaleString("id-ID")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
