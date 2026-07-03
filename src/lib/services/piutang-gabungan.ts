// Pure aggregation for Piutang Gabungan (mobile + future web reuse).
// Single source of truth for the per-member math. No Prisma here.

export const TOKO_UNIT_TYPES = ["toko", "playstation", "cafe_lsp", "resto_cafe", "coffe_latar"];

export interface PiutangItem {
  id: number;
  seq: number;
  nama: string;
  nrp: string;
  pangkat: string;
  kesatuan: string;
  piutangToko: number;
  piutangUnit: number;
  piutangSPPokok: number;
  piutangSPJasa: number;
  totalPiutang: number;
  angsuranKe: string;
  loanCount: number;
}

export interface PiutangAggregation {
  piutangList: PiutangItem[];
  totalAnggota: number;
  totalPiutangToko: number;
  totalPiutangUnit: number;
  totalPiutangSPPokok: number;
  totalPiutangSPJasa: number;
  grandTotal: number;
}

export interface HelperMember {
  id: number; name: string; nrp: string | null; memberNo: string | null;
  pangkat: string | null; category: string | null; kesatuan: string | null;
}
export interface HelperUnitAgg {
  memberId: number | null; unitType: string | null;
  _sum: { amount: unknown }; // Prisma.Decimal | number | string | null at runtime
}
export interface HelperLoan {
  memberId: number; loanNo: string;
  principalOutstanding: unknown; interestOutstanding: unknown;
  tenorMonths: number; disbursementDate: Date | null;
  schedules: { installmentNo: number }[];
}

const num = (v: unknown): number => Number(v ?? 0) || 0;

export function aggregatePiutangGabungan(args: {
  members: HelperMember[];
  unitTxAgg: HelperUnitAgg[];
  activeLoans: HelperLoan[];
}): PiutangAggregation {
  const tokoMap = new Map<number, number>();
  const unitMap = new Map<number, number>();
  const spMap = new Map<number, { pokok: number; jasa: number; angsuranKe: string; loanCount: number }>();

  for (const row of args.unitTxAgg) {
    if (row.memberId == null) continue;
    const amount = num(row._sum?.amount);
    const map = TOKO_UNIT_TYPES.includes(row.unitType || "") ? tokoMap : unitMap;
    map.set(row.memberId, (map.get(row.memberId) || 0) + amount);
  }

  for (const loan of args.activeLoans) {
    const pokok = num(loan.principalOutstanding);
    const jasa = num(loan.interestOutstanding);
    if (pokok <= 0 && jasa <= 0) continue;
    const existing = spMap.get(loan.memberId);
    if (existing) {
      existing.pokok += pokok;
      existing.jasa += jasa;
      existing.loanCount++;
    } else {
      const next = loan.schedules[0]?.installmentNo;
      spMap.set(loan.memberId, {
        pokok, jasa, loanCount: 1,
        angsuranKe: next ? `${next}/${loan.tenorMonths}` : "-",
      });
    }
  }

  const piutangList: PiutangItem[] = [];
  let seq = 0;
  for (const member of args.members) {
    const piutangToko = tokoMap.get(member.id) || 0;
    const piutangUnit = unitMap.get(member.id) || 0;
    const sp = spMap.get(member.id);
    if (piutangToko <= 0 && piutangUnit <= 0 && !sp) continue;
    seq++;
    const piutangSPPokok = sp?.pokok || 0;
    const piutangSPJasa = sp?.jasa || 0;
    piutangList.push({
      id: member.id,
      seq,
      nama: member.name,
      nrp: member.nrp || member.memberNo || "-",
      pangkat: member.pangkat || member.category || "-",
      kesatuan: member.kesatuan || "-",
      piutangToko, piutangUnit, piutangSPPokok, piutangSPJasa,
      totalPiutang: piutangToko + piutangUnit + piutangSPPokok + piutangSPJasa,
      angsuranKe: sp?.angsuranKe || "-",
      loanCount: sp?.loanCount || 0,
    });
  }

  const reduce = (sel: (p: PiutangItem) => number) => piutangList.reduce((s, p) => s + sel(p), 0);
  return {
    piutangList,
    totalAnggota: piutangList.length,
    totalPiutangToko: reduce((p) => p.piutangToko),
    totalPiutangUnit: reduce((p) => p.piutangUnit),
    totalPiutangSPPokok: reduce((p) => p.piutangSPPokok),
    totalPiutangSPJasa: reduce((p) => p.piutangSPJasa),
    grandTotal: reduce((p) => p.totalPiutang),
  };
}

// CSV builder for Piutang Gabungan export. Sanitizes formula injection.
const CSV_HEADERS = ["No", "NRP", "Pangkat", "Kesatuan", "Nama", "Piutang Toko", "Piutang Unit", "Pokok Pinjaman", "Jasa Pinjaman", "Total Piutang"];

const cell = (v: string | number): string => {
  const s = String(v ?? "");
  // Formula-injection sanitize: prefix a single quote if the cell starts with = + @ - or a tab/CR
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  // Quote if it contains comma, quote, or newline
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function buildPiutangCSV(items: PiutangItem[], totals: PiutangAggregation): string {
  const rows: string[] = [CSV_HEADERS.join(",")];
  for (const it of items) {
    rows.push([
      cell(it.seq), cell(it.nrp), cell(it.pangkat), cell(it.kesatuan), cell(it.nama),
      cell(it.piutangToko), cell(it.piutangUnit), cell(it.piutangSPPokok), cell(it.piutangSPJasa), cell(it.totalPiutang),
    ].join(","));
  }
  rows.push(["TOTAL", "", "", "", "", totals.totalPiutangToko, totals.totalPiutangUnit, totals.totalPiutangSPPokok, totals.totalPiutangSPJasa, totals.grandTotal].join(","));
  return rows.join("\n");
}
