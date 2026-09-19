// Pure helpers: turunkan struktur neraca format resmi (Kas/Piutang/Harta vs
// Hutang/Simpanan/Modal, subtotal per kelompok) dari BalanceSheetResult.
// Dipakai oleh export PDF + halaman UI + unit test.
import type { BalanceSheetItem, BalanceSheetResult } from "@/lib/services/neraca";

export interface NeracaRow {
  label: string;
  amount: number | null; // null = header kelompok (tanpa angka)
  kind: "group" | "item" | "subtotal" | "total";
}

export interface NeracaSide {
  rows: NeracaRow[];
  total: number;
}

export interface NeracaFormatResult {
  asOf: string;
  aktiva: NeracaSide;
  pasiva: NeracaSide;
  isBalanced: boolean;
  selisih: number;
}

// Label bilingual mengikuti format resmi (gambar WhatsApp "format neraca").
const LABEL_OVERRIDES: Record<string, string> = {
  "1201": "Piutang Pinjaman Anggota (Member Loan Receivable)",
  "1202": "Piutang Bunga Pinjaman (Interest Receivable)",
  "1299": "Piutang Dihapusbukukan (Written-off)",
  "1301": "Persediaan Barang Dagangan (Inventory)",
  "1400": "Aset Tetap (Fixed Assets — harga perolehan)",
  "2101": "Simpanan Pokok (Members Equity)",
  "2102": "Simpanan Wajib (Compulsory Saving)",
  "2103": "Simpanan Sukarela (Voluntary Saving)",
  "3101": "Modal Penyerta (Paid-in Capital)",
  "3102": "Cadangan Umum (General Reserve)",
  "3103": "SHU Tahun Berjalan (Net Income)",
  "31XX": "Selisih Penyesuaian (Adjustment)",
};

const label = (i: BalanceSheetItem) => LABEL_OVERRIDES[i.code] ?? i.name;

const subtotal = (rows: NeracaRow[], items: BalanceSheetItem[]): number => {
  const sum = items.reduce((s, i) => s + i.amount, 0);
  rows.push({ label: "Jumlah", amount: sum, kind: "subtotal" });
  return sum;
};

// Klasifikasi baris aktiva lancar: 11xx/B-*/KAS-* → kas; 12xx → piutang; 13xx → harta lainnya.
const isKas = (i: BalanceSheetItem) => /^11/.test(i.code) || !/^1\d/.test(i.code);
const isPiutang = (i: BalanceSheetItem) => /^12/.test(i.code);

export function buildNeracaRows(data: BalanceSheetResult): NeracaFormatResult {
  // ── AKTIVA ──────────────────────────────────────────────────────────────
  const kas = data.assets.current.filter(isKas);
  const piutang = data.assets.current.filter(isPiutang);
  const persediaan = data.assets.current.filter((i) => /^13/.test(i.code));
  const hartaLain: BalanceSheetItem[] = [...persediaan, ...data.assets.fixedGross];

  const aktivaRows: NeracaRow[] = [];
  aktivaRows.push({ label: "KAS", amount: null, kind: "group" });
  for (const i of kas) aktivaRows.push({ label: label(i), amount: i.amount, kind: "item" });
  subtotal(aktivaRows, kas);

  aktivaRows.push({ label: "PIUTANG", amount: null, kind: "group" });
  for (const i of piutang) aktivaRows.push({ label: label(i), amount: i.amount, kind: "item" });
  subtotal(aktivaRows, piutang);

  aktivaRows.push({ label: "HARTA LAINNYA", amount: null, kind: "group" });
  for (const i of hartaLain) aktivaRows.push({ label: label(i), amount: i.amount, kind: "item" });
  if (data.assets.accumulatedDepreciation !== 0) {
    aktivaRows.push({ label: "(–) Akumulasi Penyusutan (Accum. Depreciation)", amount: -data.assets.accumulatedDepreciation, kind: "item" });
    hartaLain.push({ code: "1403", name: "Penyusutan", amount: -data.assets.accumulatedDepreciation });
  }
  subtotal(aktivaRows, hartaLain);
  aktivaRows.push({ label: "JUMLAH AKTIVA", amount: data.assets.totalAssets, kind: "total" });

  // ── PASIVA ──────────────────────────────────────────────────────────────
  const hutang = data.liabilities.other;
  const simpanan = data.liabilities.savings;
  const modal = data.equity.items;

  const pasivaRows: NeracaRow[] = [];
  pasivaRows.push({ label: "HUTANG (KEWAJIBAN)", amount: null, kind: "group" });
  for (const i of hutang) pasivaRows.push({ label: label(i), amount: i.amount, kind: "item" });
  subtotal(pasivaRows, hutang);

  pasivaRows.push({ label: "SIMPANAN ANGGOTA", amount: null, kind: "group" });
  for (const i of simpanan) pasivaRows.push({ label: label(i), amount: i.amount, kind: "item" });
  subtotal(pasivaRows, simpanan);

  pasivaRows.push({ label: "MODAL", amount: null, kind: "group" });
  for (const i of modal) pasivaRows.push({ label: label(i), amount: i.amount, kind: "item" });
  subtotal(pasivaRows, modal);
  const totalPasiva = data.liabilities.totalLiabilities + data.equity.totalEquity;
  pasivaRows.push({ label: "JUMLAH PASIVA", amount: totalPasiva, kind: "total" });

  return {
    asOf: data.asOf,
    aktiva: { rows: aktivaRows, total: data.assets.totalAssets },
    pasiva: { rows: pasivaRows, total: totalPasiva },
    isBalanced: data.isBalanced,
    selisih: data.equity.selisih,
  };
}
