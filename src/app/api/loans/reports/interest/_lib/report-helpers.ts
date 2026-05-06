import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export interface MonthlyData {
  month: string;
  monthLabel: string;
  totalJasa: number;
  totalPokok: number;
  totalTransactions: number;
}

export interface ReportSummary {
  grandTotalJasa: number;
  grandTotalPokok: number;
  grandTotalTransactions: number;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const YYYY_MM_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/**
 * Validates monthFrom/monthTo query params and returns the resolved period,
 * or an error NextResponse if validation fails.
 */
export function validateAndGetPeriod(
  monthFrom: string | null,
  monthTo: string | null,
): { from: string; to: string } | { error: NextResponse } {
  // Determine current month in WIB for default values
  const now = new Date();
  const WIB_OFFSET = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(now.getTime() + WIB_OFFSET);
  const currentYM = `${nowWIB.getUTCFullYear()}-${String(nowWIB.getUTCMonth() + 1).padStart(2, "0")}`;

  if ((monthFrom && !YYYY_MM_REGEX.test(monthFrom)) || (monthTo && !YYYY_MM_REGEX.test(monthTo))) {
    return {
      error: NextResponse.json(
        { message: "Format bulan tidak valid. Gunakan YYYY-MM." },
        { status: 400 },
      ),
    };
  }

  const from = monthFrom || currentYM;
  const to = monthTo || currentYM;

  if (from > to) {
    return {
      error: NextResponse.json(
        { message: "Bulan awal tidak boleh lebih besar dari bulan akhir." },
        { status: 400 },
      ),
    };
  }

  return { from, to };
}

/**
 * Checks that the session belongs to an operator user.
 * Returns a NextResponse error if unauthorized, or null if OK.
 */
export function checkOperatorAuth(session: unknown): NextResponse | null {
  const s = session as { user?: { role?: string } } | null;
  if (!s?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const roleName = s.user.role;
  if (!["operator", "admin_sp"].includes(roleName as string)) {
    return NextResponse.json(
      { message: "Akses ditolak. Hanya operator/admin SP." },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Queries loan payments for the given period and aggregates by month.
 *
 * Note: lateFeePortion and earlySettlementFee are intentionally excluded.
 * This report focuses on regular interest (jasa) and principal (pokok) income only.
 */
export async function queryMonthlyPayments(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);

  // paymentDate is @db.Date (no time component), so simple UTC dates are sufficient
  const dateFrom = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
  const dateTo = new Date(Date.UTC(toYear, toMonth, 0)); // last day of month, midnight UTC

  const payments = await prisma.loanPayment.findMany({
    where: { paymentDate: { gte: dateFrom, lte: dateTo } },
    select: {
      paymentDate: true,
      interestPortion: true,
      principalPortion: true,
    },
    orderBy: { paymentDate: "asc" },
  });

  const monthMap = new Map<
    string,
    { totalJasa: number; totalPokok: number; totalTransactions: number }
  >();

  for (const p of payments) {
    // @db.Date already returns UTC midnight — no WIB offset needed
    const d = p.paymentDate;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, { totalJasa: 0, totalPokok: 0, totalTransactions: 0 });
    }
    const entry = monthMap.get(key)!;
    entry.totalJasa += Number(p.interestPortion);
    entry.totalPokok += Number(p.principalPortion);
    entry.totalTransactions += 1;
  }

  const data: MonthlyData[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => {
      const [y, m] = month.split("-").map(Number);
      return {
        month,
        monthLabel: `${MONTH_NAMES[m - 1]} ${y}`,
        totalJasa: totals.totalJasa,
        totalPokok: totals.totalPokok,
        totalTransactions: totals.totalTransactions,
      };
    });

  const summary: ReportSummary = {
    grandTotalJasa: data.reduce((sum, d) => sum + d.totalJasa, 0),
    grandTotalPokok: data.reduce((sum, d) => sum + d.totalPokok, 0),
    grandTotalTransactions: data.reduce((sum, d) => sum + d.totalTransactions, 0),
  };

  return { data, payments, summary };
}
