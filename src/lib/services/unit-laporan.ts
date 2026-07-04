/**
 * Helpers for the unit laporan report (web `/api/unit/[slug]/laporan` +
 * mobile generic per-unit laporan). Fase 7b extracts the route's data logic
 * into this shared module so web + mobile call the same code.
 *
 * T1: `computePeriodRange` — the pure period-range computation, faithfully
 * ported from `src/app/api/unit/[slug]/laporan/route.ts` lines 56-96 (date
 * boundaries) + lines 114-123 (periodLabel). Refactored to take `now` as a
 * param instead of reading the system clock, so it is deterministic and
 * unit-testable. NO Prisma, NO I/O, NO `new Date()` internally.
 *
 * T2: `getUnitLaporanData` — the data-logic MOVE (Prisma queries +
 * aggregation + pagination + response build). Behavior-preserving.
 */

/** WIB offset in milliseconds (+7h). */
const WIB_OFFSET = 7 * 60 * 60 * 1000;

export interface PeriodRange {
  start: Date;
  end: Date;
  periodLabel: string;
  dateFromIso: string;
  dateToIso: string;
}

/**
 * Compute the [start, end] date range + human-readable label for a laporan
 * period. Behavior-preserving port of the web route's WIB (+7) period math
 * (lines 56-96 + periodLabel lines 114-123).
 *
 * @param period    "today" | "week" | "month" | "year" | "custom" (anything
 *                  not matched falls back to "month", matching the web's
 *                  `default` case).
 * @param now       The reference instant. The web route uses `new Date()`;
 *                  here it is injected so the fn is deterministic/testable.
 * @param dateFrom  YYYY-MM-DD string (required for "custom").
 * @param dateTo    YYYY-MM-DD string (required for "custom").
 */
export function computePeriodRange(
  period: string,
  now: Date,
  dateFrom?: string,
  dateTo?: string,
): PeriodRange {
  // --- WIB (+7) timezone math — faithful copy of route lines 56-62 ---
  const nowWIB = new Date(now.getTime() + WIB_OFFSET);
  // Use UTC methods to get WIB-correct date components
  const wibYear = nowWIB.getUTCFullYear();
  const wibMonth = nowWIB.getUTCMonth();
  const wibDay = nowWIB.getUTCDate();

  let dateFromComputed: Date;
  // 23:59:59 WIB = 16:59:59 UTC (route line 65)
  let dateToComputed: Date = new Date(
    Date.UTC(wibYear, wibMonth, wibDay, 23 - 7, 59, 59, 999),
  );

  switch (period) {
    case "today":
      // 00:00 WIB = 17:00 UTC hari sebelumnya (route lines 68-72)
      dateFromComputed = new Date(
        Date.UTC(wibYear, wibMonth, wibDay) - WIB_OFFSET,
      );
      dateToComputed = new Date(dateFromComputed.getTime() + 86400000 - 1);
      break;
    case "week": {
      // Senin WIB minggu ini (route lines 73-80)
      const dayOfWeek = nowWIB.getUTCDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mondayWIB = new Date(Date.UTC(wibYear, wibMonth, wibDay + diff));
      dateFromComputed = new Date(mondayWIB.getTime() - WIB_OFFSET); // 00:00 WIB Senin
      break;
    }
    case "year":
      dateFromComputed = new Date(Date.UTC(wibYear, 0, 1) - WIB_OFFSET); // 1 Jan 00:00 WIB
      dateToComputed = new Date(Date.UTC(wibYear, 11, 31, 23 - 7, 59, 59, 999)); // 31 Des 23:59 WIB
      break;
    case "custom":
      // NOTE: the web route returns HTTP 400 if dateFrom/dateTo are missing.
      // This pure helper, having no Response object, falls back to treating
      // the (possibly undefined) input the same way the web would if it had
      // received the strings — i.e. it builds the Date from the literal.
      // Callers (route + mobile) are responsible for validating presence
      // before calling, exactly as the web route's `if (!dateFromParam)`
      // guard does. Building `new Date(undefined + ...)` yields Invalid Date;
      // that is the faithful non-fatal counterpart here and callers must
      // guard. (Web route lines 85-92.)
      dateFromComputed = new Date((dateFrom ?? "") + "T00:00:00+07:00");
      dateToComputed = new Date((dateTo ?? "") + "T23:59:59+07:00");
      break;
    default: // "month" (route lines 93-95)
      dateFromComputed = new Date(
        Date.UTC(wibYear, wibMonth, 1) - WIB_OFFSET,
      ); // 1 bulan ini 00:00 WIB
      break;
  }

  // --- periodLabel — faithful copy of route lines 114-123 ---
  // NOTE: the web route formats via `now.toLocaleDateString` / `now.getFullYear`
  // (the raw `now`, not `nowWIB`), so the label is host-tz dependent. We
  // preserve that exact behavior here; do not "fix" it to use WIB.
  const periodLabel =
    period === "today"
      ? `${now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
      : period === "week"
        ? `Minggu Ini (${dateFromComputed.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${dateToComputed.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})`
        : period === "year"
          ? `Tahun ${now.getFullYear()}`
          : period === "custom"
            ? `${new Date(dateFrom ?? "").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(dateTo ?? "").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
            : `${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`;

  return {
    start: dateFromComputed,
    end: dateToComputed,
    periodLabel,
    dateFromIso: dateFromComputed.toISOString(),
    dateToIso: dateToComputed.toISOString(),
  };
}

// ============================================================================
// T2: getUnitLaporanData — faithful MOVE of the web route's data logic.
// All behavior (queries, fallbacks, aggregation, pagination, response shape)
// is preserved byte-for-byte from `src/app/api/unit/[slug]/laporan/route.ts`
// lines 55-442 (pre-refactor).
// ============================================================================

import prisma, { prismaRead } from "@/lib/prisma";
import { storeSaleUnitTypeFilter, unitTypeFilter } from "@/lib/constants/units";
import { isSameUnit } from "@/lib/unit-aliases";
import { isAutoGeneratedPiutang } from "@/lib/laporan-helpers";

/** Input to `getUnitLaporanData` — matches the route's parsed query params. */
export interface UnitLaporanParams {
  /** snake_case unit type (e.g. "cuci_mobil", "resto_cafe"). */
  unitType: string;
  /** Original slug (kebab-case) — returned verbatim as `unitSlug`. */
  slug: string;
  period: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  perPage: number;
  isExport: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

/**
 * Thrown when input is invalid in a way the route maps to HTTP 400
 * (specifically: custom period missing dateFrom/dateTo). The route catches
 * this and returns a 400 — preserving the pre-refactor validation.
 */
export class UnitLaporanValidationError extends Error {
  constructor(public statusMessage: string) {
    super(statusMessage);
    this.name = "UnitLaporanValidationError";
  }
}

export interface UnitLaporanSummary {
  totalPendapatan: number;
  totalTransaksi: number;
  tunai: number;
  qris: number;
  potongGaji: number;
  dineIn: number;
  takeaway: number;
  counter: number;
  dineInCount: number;
  takeawayCount: number;
  counterCount: number;
  takeawaySurchargeTotal: number;
  totalPengeluaran: number;
  totalPemasukan: number;
  potonganSHUMember: number;
  jumlahCuciAnggota: number;
  shuPerCuci: number;
  laba: number;
  totalHPP: number;
  totalWriteOff: number;
  netProfit: number;
}

export interface UnitLaporanTransaction {
  id: string;
  date: Date | string;
  no: string;
  description: string;
  memberName: string | null;
  memberNrp: string | null;
  paymentMethod: string | null;
  amount: number;
  status: string;
  type: "unit_transaction" | "store_sale";
  vehiclePlate: string | null;
}

export interface UnitLaporanPagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface UnitLaporanOpsEntry {
  id: number;
  date: Date;
  transactionNo: string;
  description: string;
  amount: number;
  receiptImagePath: string | null;
  paymentMethod: string | null;
}

export interface UnitLaporanResult {
  unitType: string;
  unitSlug: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  summary: UnitLaporanSummary;
  transactions: UnitLaporanTransaction[];
  pagination: UnitLaporanPagination;
  operationalExpenses: UnitLaporanOpsEntry[];
  operationalIncomes: UnitLaporanOpsEntry[];
}

/**
 * Build the laporan response data object. Behavior-preserving MOVE of the
 * web route's data block. Returns the same shape the route previously inlined
 * as `data: {...}` inside `NextResponse.json({ data })`.
 *
 * The custom-period 400 validation is enforced HERE (in the helper) via
 * `UnitLaporanValidationError`; callers should catch it and map to HTTP 400.
 */
export async function getUnitLaporanData(
  p: UnitLaporanParams,
): Promise<UnitLaporanResult> {
  const { unitType, slug, period, sortBy, sortOrder } = p;
  const dateFromParam = p.dateFrom;
  const dateToParam = p.dateTo;
  const page = p.page;
  const perPage = p.perPage;
  const isExport = p.isExport;

  // --- Custom-period 400 validation (was inline in the route, line 86-88) ---
  if (period === "custom" && (!dateFromParam || !dateToParam)) {
    throw new UnitLaporanValidationError(
      "dateFrom dan dateTo wajib diisi untuk period=custom",
    );
  }

  // --- Compute date range via T1's pure helper ---
  // The route previously read the system clock via `new Date()`; pass it here.
  const range = computePeriodRange(period, new Date(), dateFromParam, dateToParam);
  const dateFrom = range.start;
  const dateTo = range.end;
  const periodLabel = range.periodLabel;

  // Units that use store_sales (via /api/toko/sales) instead of just unit_transactions
  const usesStoreSales = !["cuci_mobil", "simpan_pinjam", "investasi_modal_jp"].includes(unitType);
  const isCuciMobil = unitType === "cuci_mobil";
  const SHU_PER_CUCI_ANGGOTA = 2000; // Rp 2.000 per transaksi anggota

  // --- Fixing @db.Date vs Timestamptz boundaries ---
  const fromWib = new Date(dateFrom.getTime() + WIB_OFFSET);
  const toWib = new Date(dateTo.getTime() + WIB_OFFSET);
  const dateFromDbDate = new Date(Date.UTC(fromWib.getUTCFullYear(), fromWib.getUTCMonth(), fromWib.getUTCDate()));
  const dateToDbDate = new Date(Date.UTC(toWib.getUTCFullYear(), toWib.getUTCMonth(), toWib.getUTCDate(), 23, 59, 59, 999));

  // ── Fetch Unit Transactions ────────────────────────────────────────────
  let unitTransactions: any[] = [];
  const unitTxWhere: any = {
    unitType: unitTypeFilter(unitType),
    transactionDate: { gte: dateFromDbDate, lte: dateToDbDate },
    status: { notIn: ["voided"] },
  };

  try {
    unitTransactions = await prismaRead.unitTransaction.findMany({
      where: unitTxWhere,
      include: {
        member: { select: { id: true, name: true, nrp: true, memberNo: true } },
      },
      orderBy: { [sortBy]: sortOrder },
    });
  } catch (readError) {
    console.warn("[Laporan API] prismaRead failed for unitTx, falling back to TCP:", readError instanceof Error ? readError.message : readError);
    unitTransactions = await prisma.unitTransaction.findMany({
      where: unitTxWhere,
      include: {
        member: { select: { id: true, name: true, nrp: true, memberNo: true } },
      },
      orderBy: { [sortBy]: sortOrder },
    });
  }

  // Exclude auto-generated piutang UnitTransaction (duplicate of StoreSale).
  if (usesStoreSales) {
    unitTransactions = unitTransactions.filter((tx) => !isAutoGeneratedPiutang(tx.notes));
  }

  // ── Fetch StoreSale (all units using store_sales) ──────────────────────
  let storeSales: any[] = [];
  if (usesStoreSales) {
    const storeSaleQuery = {
      where: {
        unitType: storeSaleUnitTypeFilter(unitType),
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      include: {
        member: { select: { id: true, name: true, nrp: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { [sortBy === "transactionDate" ? "createdAt" : sortBy]: sortOrder },
    };
    let rawStoreSales: any[];
    try {
      rawStoreSales = await prismaRead.storeSale.findMany(storeSaleQuery);
    } catch (readError) {
      console.warn("[Laporan API] prismaRead failed for storeSales, falling back to TCP:", readError instanceof Error ? readError.message : readError);
      rawStoreSales = await prisma.storeSale.findMany(storeSaleQuery);
    }
    storeSales = rawStoreSales.filter((sale) => {
      try {
        const meta = typeof sale.metadata === "string" ? JSON.parse(sale.metadata) : sale.metadata || {};
        return !meta.isVoided;
      } catch {
        return true;
      }
    });
  }

  // ── Fetch Operational Expenses (CashBankTransaction) ───────────────────
  const opsUnitTypeFilter = storeSaleUnitTypeFilter(unitType);
  const operationalExpenses = await prisma.cashBankTransaction.findMany({
    where: {
      type: "out",
      category: "operational",
      unitType: opsUnitTypeFilter,
      transactionDate: { gte: dateFromDbDate, lte: dateToDbDate },
    },
    orderBy: { transactionDate: "desc" },
  });

  // ── Fetch Operational Income (CashBankTransaction type="in") ───────────
  const operationalIncomes = await prisma.cashBankTransaction.findMany({
    where: {
      type: "in",
      category: "operational",
      unitType: opsUnitTypeFilter,
      transactionDate: { gte: dateFromDbDate, lte: dateToDbDate },
    },
    orderBy: { transactionDate: "desc" },
  });

  // ── Aggregate Transactions ─────────────────────────────────────────────
  const aggregateUnitTx = (txs: typeof unitTransactions) => {
    return txs.reduce(
      (acc, tx) => {
        const amount = Number(tx.amount);
        acc.total += amount;
        acc.count += 1;
        if (tx.paymentMethod === "cash") acc.tunai += amount;
        else if (tx.paymentMethod === "qris") acc.qris += amount;
        else if (tx.paymentMethod === "salary_cut") acc.potongGaji += amount;
        return acc;
      },
      { total: 0, count: 0, tunai: 0, qris: 0, potongGaji: 0 },
    );
  };

  const aggregateStoreSales = (sales: typeof storeSales) => {
    return sales.reduce(
      (acc, sale) => {
        const amount = Number(sale.totalAmount);
        acc.total += amount;
        acc.count += 1;
        if (sale.paymentMethod === "cash") acc.tunai += amount;
        else if (sale.paymentMethod === "qris") acc.qris += amount;
        else if (sale.paymentMethod === "salary_cut") acc.potongGaji += amount;
        const meta = typeof sale.metadata === "string" ? JSON.parse(sale.metadata) : sale.metadata || {};
        const orderType = ((meta as Record<string, unknown>).orderType as string) || "dine_in";
        if (orderType === "takeaway") {
          acc.takeaway += amount;
          acc.takeawayCount += 1;
        } else if (orderType === "counter") {
          acc.counter += amount;
          acc.counterCount += 1;
        } else {
          acc.dineIn += amount;
          acc.dineInCount += 1;
        }
        const surcharge = (meta as Record<string, unknown>).takeawaySurcharge as number | null;
        if (surcharge) acc.takeawaySurchargeTotal += surcharge;
        return acc;
      },
      {
        total: 0,
        count: 0,
        tunai: 0,
        qris: 0,
        potongGaji: 0,
        dineIn: 0,
        takeaway: 0,
        counter: 0,
        dineInCount: 0,
        takeawayCount: 0,
        counterCount: 0,
        takeawaySurchargeTotal: 0,
      },
    );
  };

  const unitTxAgg = aggregateUnitTx(unitTransactions);
  const storeSaleAgg = aggregateStoreSales(storeSales);
  const totalExpenses = operationalExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalOpIncome = operationalIncomes.reduce((s, e) => s + Number(e.amount), 0);

  // ── Hitung Potongan SHU Langsung (khusus Cuci Mobil) ───────────────────
  let potonganSHUMember = 0;
  let jumlahCuciAnggota = 0;
  if (isCuciMobil) {
    const txAnggotaValid = unitTransactions.filter(
      (tx: any) => tx.memberId != null && tx.status !== "voided",
    );
    jumlahCuciAnggota = txAnggotaValid.length;
    potonganSHUMember = jumlahCuciAnggota * SHU_PER_CUCI_ANGGOTA;
  }

  // ── Build unified transaction list ─────────────────────────────────────
  const unitTxRows = unitTransactions.map((tx) => {
    const vehiclePlateMatch = tx.notes?.match(/\[PLAT:(.*?)\]/);
    const vehiclePlate = vehiclePlateMatch ? vehiclePlateMatch[1].trim() : null;
    return {
      id: tx.transactionNo,
      date: (tx as any).createdAt || tx.transactionDate,
      no: tx.transactionNo,
      description: tx.description,
      memberName: tx.member?.name || null,
      memberNrp: tx.member?.nrp || null,
      paymentMethod: tx.paymentMethod,
      amount: Number(tx.amount),
      status: tx.status,
      type: "unit_transaction" as const,
      vehiclePlate,
    };
  });

  const storeSaleRows = storeSales.map((sale) => ({
    id: sale.saleNo,
    date: sale.createdAt,
    no: sale.saleNo,
    description:
      sale.items.map((i: any) => i.product?.name || "[Produk Dihapus]").join(", ") ||
      sale.customerName ||
      "Penjualan Toko",
    memberName: sale.member?.name || sale.customerName || null,
    memberNrp: sale.member?.nrp || null,
    paymentMethod: sale.paymentMethod,
    amount: Number(sale.totalAmount),
    status: "completed",
    type: "store_sale" as const,
    vehiclePlate: null,
  }));

  const getSortValue = (item: (typeof unitTxRows)[number] | (typeof storeSaleRows)[number], field: string): string | number => {
    switch (field) {
      case "transactionDate":
        return new Date(item.date).getTime();
      case "transactionNo":
        return item.no;
      case "amount":
        return item.amount;
      default:
        return new Date(item.date).getTime();
    }
  };
  const allTransactions = [...(usesStoreSales ? storeSaleRows : []), ...unitTxRows].sort((a, b) => {
    const va = getSortValue(a, sortBy);
    const vb = getSortValue(b, sortBy);
    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb));
    return sortOrder === "asc" ? cmp : -cmp;
  });

  const totalTransactions = allTransactions.length;
  const totalPages = Math.ceil(totalTransactions / perPage);
  const paginatedTransactions = isExport
    ? allTransactions
    : allTransactions.slice((page - 1) * perPage, page * perPage);

  const totalPendapatan = (usesStoreSales ? storeSaleAgg.total : 0) + unitTxAgg.total + totalOpIncome;

  // ── HPP & Write-off calculation ──
  let totalHPP = 0;
  let totalWriteOff = 0;
  if (usesStoreSales) {
    totalHPP = storeSales.reduce((acc, sale) => {
      return (
        acc +
        (sale.items || []).reduce((itemAcc: number, item: any) => {
          return itemAcc + (Number(item.costPrice) || 0) * item.quantity;
        }, 0)
      );
    }, 0);

    const writeoffMovements = await prisma.storeStockMovement.findMany({
      where: {
        reason: { in: ["damaged", "expired", "internal_use", "other"] },
        costAtTime: { not: null },
        createdAt: { gte: dateFrom, lte: dateTo },
        status: "active",
      },
      include: { product: { select: { unitType: true } } },
    });
    totalWriteOff = writeoffMovements
      .filter((m) => isSameUnit(m.product?.unitType, unitType))
      .reduce((acc, m) => acc + (Number(m.costAtTime) || 0) * m.quantity, 0);
  }

  return {
    unitType,
    unitSlug: slug,
    periodLabel,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    summary: {
      totalPendapatan,
      totalTransaksi: (usesStoreSales ? storeSaleAgg.count : 0) + unitTxAgg.count,
      tunai: (usesStoreSales ? storeSaleAgg.tunai : 0) + unitTxAgg.tunai,
      qris: (usesStoreSales ? storeSaleAgg.qris : 0) + unitTxAgg.qris,
      potongGaji: (usesStoreSales ? storeSaleAgg.potongGaji : 0) + unitTxAgg.potongGaji,
      dineIn: usesStoreSales ? storeSaleAgg.dineIn : 0,
      takeaway: usesStoreSales ? storeSaleAgg.takeaway : 0,
      counter: usesStoreSales ? storeSaleAgg.counter : 0,
      dineInCount: usesStoreSales ? storeSaleAgg.dineInCount : 0,
      takeawayCount: usesStoreSales ? storeSaleAgg.takeawayCount : 0,
      counterCount: usesStoreSales ? storeSaleAgg.counterCount : 0,
      takeawaySurchargeTotal: usesStoreSales ? storeSaleAgg.takeawaySurchargeTotal : 0,
      totalPengeluaran: totalExpenses,
      totalPemasukan: totalOpIncome,
      potonganSHUMember: isCuciMobil ? potonganSHUMember : 0,
      jumlahCuciAnggota: isCuciMobil ? jumlahCuciAnggota : 0,
      shuPerCuci: isCuciMobil ? SHU_PER_CUCI_ANGGOTA : 0,
      laba: totalPendapatan - totalExpenses - (isCuciMobil ? potonganSHUMember : 0),
      totalHPP,
      totalWriteOff,
      netProfit:
        totalPendapatan - totalHPP - totalWriteOff - totalExpenses - (isCuciMobil ? potonganSHUMember : 0),
    },
    transactions: paginatedTransactions,
    pagination: {
      page: isExport ? 1 : page,
      perPage: isExport ? totalTransactions : perPage,
      total: totalTransactions,
      totalPages: isExport ? 1 : totalPages,
    },
    operationalExpenses: operationalExpenses.map((e) => {
      const rawDesc = e.description || "";
      const parts = rawDesc.split("||RECEIPT:");
      const description = parts[0].replace(/^\[[A-Z_]+\]\s*Pengeluaran Operasional:\s*/, "");
      const receiptImagePath = parts[1] || null;
      return {
        id: e.id,
        date: e.transactionDate,
        transactionNo: e.transactionNo,
        description,
        amount: Number(e.amount),
        receiptImagePath,
        paymentMethod: e.paymentMethod || null,
      };
    }),
    operationalIncomes: operationalIncomes.map((e) => {
      const rawDesc = e.description || "";
      const parts = rawDesc.split("||RECEIPT:");
      const description = parts[0].replace(/^\[[A-Z_]+\]\s*Pemasukan Operasional:\s*/, "");
      const receiptImagePath = parts[1] || null;
      return {
        id: e.id,
        date: e.transactionDate,
        transactionNo: e.transactionNo,
        description,
        amount: Number(e.amount),
        receiptImagePath,
        paymentMethod: e.paymentMethod || null,
      };
    }),
  };
}
