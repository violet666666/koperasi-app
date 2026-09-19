import { describe, expect, it } from "vitest";
import { buildNeracaRows } from "../lib/neraca-format";
import type { BalanceSheetResult } from "../lib/services/neraca";

const fixture: BalanceSheetResult = {
  asOf: "2026-09-19",
  assets: {
    current: [
      { code: "1101", name: "Kas Besar", amount: 100, source: "ledger" },
      { code: "B-001", name: "Bank BRI (operasional)", amount: 50, source: "ledger" }, // tanpa GL → Kas
      { code: "1201", name: "Piutang Pinjaman Anggota", amount: 40, source: "ledger" },
      { code: "1202", name: "Piutang Bunga Pinjaman", amount: 10, source: "ledger" },
      { code: "1301", name: "Persediaan Barang Dagangan", amount: 30, source: "ledger" },
    ],
    fixedGross: [{ code: "1400", name: "Aset Tetap (harga perolehan)", amount: 20, source: "ledger" }],
    accumulatedDepreciation: 5,
    totalAssets: 245,
  },
  liabilities: {
    savings: [{ code: "2101", name: "Simpanan Pokok", amount: 100, source: "ledger" }],
    other: [{ code: "2201", name: "Hutang Usaha", amount: 20, source: "journal" }],
    totalLiabilities: 120,
  },
  equity: {
    items: [
      { code: "3101", name: "Modal Disetor", amount: 50, source: "journal" },
      { code: "3103", name: "SHU Tahun Berjalan", amount: 75, source: "computed" },
    ],
    shuBerjalan: 75,
    selisih: 0,
    totalEquity: 125,
  },
  isBalanced: true,
  meta: { generatedAt: "2026-09-19", note: "test" },
};

describe("buildNeracaRows", () => {
  const fmt = buildNeracaRows(fixture);

  it("mengelompokkan aktiva: KAS → PIUTANG → HARTA LAINNYA dengan subtotal", () => {
    const groups = fmt.aktiva.rows.filter((r) => r.kind === "group").map((r) => r.label);
    expect(groups).toEqual(["KAS", "PIUTANG", "HARTA LAINNYA"]);
    const subs = fmt.aktiva.rows.filter((r) => r.kind === "subtotal").map((r) => r.amount);
    expect(subs).toEqual([150, 50, 45]); // kas 100+50, piutang 40+10, harta 30+20-5
  });

  it("akun bank tanpa GL (B-001) masuk grup KAS", () => {
    const kasRows = fmt.aktiva.rows.slice(1, 3);
    expect(kasRows.every((r) => r.kind === "item")).toBe(true);
    expect(fmt.aktiva.rows.some((r) => r.label.includes("Bank BRI"))).toBe(true);
  });

  it("penyusutan muncul negatif di harta lainnya", () => {
    const depr = fmt.aktiva.rows.find((r) => r.label.includes("Penyusutan"));
    expect(depr?.amount).toBe(-5);
  });

  it("total aktiva = total pasiva", () => {
    expect(fmt.aktiva.total).toBe(245);
    expect(fmt.pasiva.total).toBe(245);
  });

  it("pasiva: HUTANG → SIMPANAN → MODAL dengan subtotal", () => {
    const groups = fmt.pasiva.rows.filter((r) => r.kind === "group").map((r) => r.label);
    expect(groups).toEqual(["HUTANG (KEWAJIBAN)", "SIMPANAN ANGGOTA", "MODAL"]);
    const subs = fmt.pasiva.rows.filter((r) => r.kind === "subtotal").map((r) => r.amount);
    expect(subs).toEqual([20, 100, 125]);
  });

  it("label bilingual untuk akun baku", () => {
    expect(fmt.aktiva.rows.some((r) => r.label.includes("Member Loan Receivable"))).toBe(true);
    expect(fmt.pasiva.rows.some((r) => r.label.includes("Members Equity"))).toBe(true);
  });
});
