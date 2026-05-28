import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  checkOperatorAuth,
  validateAndGetPeriod,
} from "../../interest/_lib/report-helpers";

export { checkOperatorAuth, validateAndGetPeriod };

export interface DanaResikoMonthly {
  month: string;
  monthLabel: string;
  loanCount: number;
  totalPokok: number;
  totalDanaResiko: number;
}

export interface DanaResikoSummary {
  grandTotalLoanCount: number;
  grandTotalPokok: number;
  grandTotalDanaResiko: number;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Queries active loans disbursed within the period and aggregates
 * adminFee (dana resiko) by disbursement month.
 */
export async function queryMonthlyDanaResiko(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);

  const dateFrom = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
  const dateTo = new Date(Date.UTC(toYear, toMonth, 0));

  const loans = await prisma.loan.findMany({
    where: {
      status: "active",
      disbursementDate: { gte: dateFrom, lte: dateTo },
    },
    select: {
      disbursementDate: true,
      principalAmount: true,
      adminFee: true,
    },
    orderBy: { disbursementDate: "asc" },
  });

  const monthMap = new Map<
    string,
    { loanCount: number; totalPokok: number; totalDanaResiko: number }
  >();

  for (const loan of loans) {
    const d = loan.disbursementDate;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, { loanCount: 0, totalPokok: 0, totalDanaResiko: 0 });
    }
    const entry = monthMap.get(key)!;
    entry.loanCount += 1;
    entry.totalPokok += Number(loan.principalAmount);
    entry.totalDanaResiko += Number(loan.adminFee);
  }

  const data: DanaResikoMonthly[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => {
      const [y, m] = month.split("-").map(Number);
      return {
        month,
        monthLabel: `${MONTH_NAMES[m - 1]} ${y}`,
        ...totals,
      };
    });

  const summary: DanaResikoSummary = {
    grandTotalLoanCount: data.reduce((s, d) => s + d.loanCount, 0),
    grandTotalPokok: data.reduce((s, d) => s + d.totalPokok, 0),
    grandTotalDanaResiko: data.reduce((s, d) => s + d.totalDanaResiko, 0),
  };

  return { data, summary };
}
