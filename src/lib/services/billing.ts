export interface BillingPeriodCalc {
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

export interface BillingItemData {
  id: number;
  memberId: number;
  amount: number;
  isMarkedPaid: boolean;
}

export interface MemberBillingSummary {
  memberId: number;
  memberName: string;
  totalAmount: number;
  markedPaidAmount: number;
  items: BillingItemData[];
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function calculateBillingPeriod(referenceDate: Date): BillingPeriodCalc {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  let startMonth: number;
  let startYear: number;

  if (referenceDate.getDate() >= 16) {
    startMonth = month;
    startYear = year;
  } else {
    startMonth = month - 1;
    startYear = year;
    if (startMonth < 0) {
      startMonth = 11;
      startYear--;
    }
  }

  const periodStart = new Date(startYear, startMonth, 16);

  let endMonth = startMonth + 1;
  let endYear = startYear;
  if (endMonth > 11) {
    endMonth = 0;
    endYear++;
  }
  const periodEnd = new Date(endYear, endMonth, 15);

  const periodLabel = `${MONTHS[startMonth]}-${MONTHS[endMonth]} ${endYear}`;

  return { periodStart, periodEnd, periodLabel };
}

export function computeMemberSummary(
  memberName: string,
  items: BillingItemData[]
): MemberBillingSummary {
  return {
    memberId: items[0]?.memberId ?? 0,
    memberName,
    totalAmount: items.reduce((sum, i) => sum + i.amount, 0),
    markedPaidAmount: items.filter((i) => i.isMarkedPaid).reduce((sum, i) => sum + i.amount, 0),
    items,
  };
}

export function toggleMemberItems(
  items: BillingItemData[],
  markedPaid: boolean
): BillingItemData[] {
  return items.map((item) => ({ ...item, isMarkedPaid: markedPaid }));
}

// ── Billing capture: pure, DB-free logic (unit-tested) ──────────────
// SaleNo prefixes used across POS routes. POS-M- = mobile toko (was missing → double-count bug).
export const SALE_NO_RE =
  /(TK-\d{8}-\d{4}|POS-M-\d{8}-\d{4}|MB-\d{8}-\d{4}|RS-\d{8}-\d{4}|PS-\d{8}-\d{4}|CF-\d{8}-\d{4}|CL-\d{8}-\d{4}|RC-\d{8}-\d{4})/;

/** Extract a StoreSale saleNo from a UnitTransaction description, or null. */
export function extractSaleNo(
  description: string | null | undefined
): string | null {
  if (!description) return null;
  const m = description.match(SALE_NO_RE);
  return m ? m[1] : null;
}

// ── buildBillingItems: capture + dedup, pure transform (no DB) ──────
export interface BillingCaptureUT {
  id: number;
  memberId: number;
  unitType: string | null;
  description: string | null;
  amount: number;
  isPaid: boolean;
  status: string;
  member?: { name: string | null; nrp: string | null } | null;
}
export interface BillingCaptureSS {
  id: number;
  saleNo: string;
  memberId: number;
  unitType: string | null;
  totalAmount: number;
  metadata: unknown;
  member?: { name: string | null; nrp: string | null } | null;
}
export interface BillingCaptureInput {
  unitTransactions: BillingCaptureUT[];
  storeSales: BillingCaptureSS[];
  excludedTxIds: Set<number>;
  excludedSaleIds: Set<number>;
}
export interface BillingItemDraft {
  memberId: number;
  memberName: string;
  memberNrp: string | null;
  unitType: string | null;
  transactionId: number;
  // string (not a narrow union) so haji/umrah "savings_account" items can be pushed
  // into the same array by the route without a TS error.
  transactionSource: string;
  description: string;
  amount: number;
}

const CAPTURE_UNIT_LABELS: Record<string, string> = {
  toko: "Toko", resto: "Resto", resto_cafe: "Resto & Cafe",
  cafe_lsp: "Cafe LSP", coffe_latar: "Coffee Latar",
  playstation: "PlayStation", play_station: "PlayStation",
  cuci_mobil: "Cuci Mobil", carwash: "Cuci Mobil",
  barbershop: "Barbershop", fitness: "Fitness", laundry: "Laundry",
  fotocopy: "Fotocopy", simpan_pinjam: "Simpan Pinjam", aset: "Aset",
};

/**
 * Build billing items from fetched UnitTransactions + StoreSales.
 * Pure: deterministic, no side effects, no DB. Callers fetch rows + excluded sets.
 * Invariants enforced: I1 completeness, I2 settled excluded, I3 no double-count,
 * I4 voided excluded. See spec §3.
 */
export function buildBillingItems(input: BillingCaptureInput): BillingItemDraft[] {
  const items: BillingItemDraft[] = [];
  const coveredSaleNos = new Set<string>();

  // Source 1: UnitTransactions
  for (const ut of input.unitTransactions) {
    if (ut.isPaid) continue;                       // I2 settled excluded (defense-in-depth)
    if (ut.status !== "completed") continue;       // I1 only completed receivables
    if (input.excludedTxIds.has(ut.id)) continue;  // I3 cross-period dedup
    const saleNo = extractSaleNo(ut.description);
    if (saleNo) coveredSaleNos.add(saleNo);
    items.push({
      memberId: ut.memberId,
      memberName: ut.member?.name ?? "Unknown",
      memberNrp: ut.member?.nrp ?? null,
      unitType: ut.unitType,
      transactionId: ut.id,
      transactionSource: "unit_transaction",
      description: ut.description ?? "",
      amount: ut.amount,
    });
  }

  // Source 2: StoreSale gap (not voided, not settled, not covered, not excluded)
  for (const ss of input.storeSales) {
    if (input.excludedSaleIds.has(ss.id)) continue; // I3 cross-period dedup
    const meta = ss.metadata as Record<string, unknown> | null;
    if (meta?.isVoided) continue;                   // I4 voided excluded
    if (meta?.isSettled) continue;                  // I2 settled excluded (defense)
    if (coveredSaleNos.has(ss.saleNo)) continue;    // I3 dedup vs UnitTransaction
    const label = CAPTURE_UNIT_LABELS[ss.unitType ?? ""] ?? ss.unitType ?? "Unit";
    items.push({
      memberId: ss.memberId,
      memberName: ss.member?.name ?? "Unknown",
      memberNrp: ss.member?.nrp ?? null,
      unitType: ss.unitType,
      transactionId: ss.id,
      transactionSource: "store_sale",
      description: `Piutang ${label} (Potongan Gaji) - ${ss.saleNo}`,
      amount: ss.totalAmount,
    });
  }

  return items;
}
