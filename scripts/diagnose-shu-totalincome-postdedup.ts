/**
 * DIAGNOSTIC (read-only): Verifikasi post-fix double-count — panggil
 * calculateSystemSHU(2026) ASLI dan pastikan totalIncome turun ~Rp604jt
 * (CB yang ref-nya ada di journal income kini di-skip) TANPA menghilangkan
 * CB-only (221jt+) / journal-only (161jt) / dana resiko.
 *
 * Usage: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-totalincome-postdedup.ts
 */
import { calculateSystemSHU } from "../src/lib/services/shu-calculator";

async function main() {
    const r = await calculateSystemSHU(2026);
    const rp = (n: any) => "Rp " + Math.round(Number(n ?? 0)).toLocaleString("id-ID");
    console.log("totalIncome :", rp(r.totalIncome), "(pre-fix ≈ Rp 2,22 M; ekspektasi ≈ Rp 1,62 M, turun ~Rp604jt)");
    console.log("totalExpense:", rp(r.totalExpense));
    console.log("netSurplus  :", rp(r.netSurplus));
    const inc = (r as any).incomeAccounts || {};
    console.log("\nKomponen income utama:");
    for (const [code, v] of Object.entries(inc) as [string, any][]) {
        if (Math.abs(v.amount) > 50_000_000) console.log(`  ${code} ${v.name}: ${rp(v.amount)}`);
    }
}
main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => process.exit(0));
