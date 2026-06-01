import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { auth } from "@/lib/auth";

function toNum(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === "number" ? d : Number(d);
}

// Re-use same blacklist constants as shu-calculator.ts
const NON_EXPENSE_CATEGORIES = [
  "pencairan_pinjaman", "transfer", "savings", "simpanan_pokok",
  "simpanan_wajib", "simpanan_sukarela", "angsuran_pokok",
  "void_penjualan_toko", "void_unit_transaction", "pendapatan_unit",
  "jasa_pinjaman", "penalti_pelunasan", "dana_resiko",
];

const NON_INCOME_CATEGORIES = [
  "savings", "simpanan_pokok", "simpanan_wajib", "simpanan_sukarela",
  "setoran_simpanan", "transfer", "pencairan_pinjaman", "angsuran_pokok", "loan",
  // These categories are queried directly from their source tables to avoid double counting:
  "jasa_pinjaman",    // → LoanPayment.interestPortion (direct query)
  "dana_resiko",      // → Loan.adminFee (direct query)
  "pendapatan_unit",  // → UnitTransaction (direct query)
  "pendapatan_toko",  // → StoreSale (direct query)
];

const CB_INCOME_LABELS: Record<string, string> = {
  jasa_pinjaman: "Jasa Pinjaman (Bunga)",
  dana_resiko: "Dana Resiko (Admin Fee)",
  pendapatan_unit: "Pendapatan Unit Layanan",
  pendapatan_toko: "Pendapatan Toko",
  operational: "Pemasukan Operasional",
  lainnya: "Pendapatan Lainnya",
  biaya_operasional: "Pendapatan Operasional Lain",
  penalti_pelunasan: "Penalti Pelunasan Dipercepat",
};

const CB_EXPENSE_LABELS: Record<string, string> = {
  biaya_operasional: "Biaya Operasional Umum",
  beban_unit: "Beban Operasional Unit Usaha",
  hpp_toko: "HPP / Pembelian Barang (Restocking)",
  hutang_mitra: "Kewajiban Bagi Hasil Mitra",
  operational: "Biaya Operasional (Legacy)",
  lainnya: "Pengeluaran Lainnya",
};

const INCOME_GROUP_MAP: Record<string, "unit" | "sp" | "lainnya"> = {
  pendapatan_unit: "unit",
  pendapatan_toko: "unit",
  operational: "unit",
  jasa_pinjaman: "sp",
  dana_resiko: "sp",
  penalti_pelunasan: "sp",
  biaya_operasional: "lainnya",
  lainnya: "lainnya",
};

// Categories per income group for filtering
const GROUP_CATEGORIES: Record<string, string[]> = {
  unit: ["pendapatan_unit", "pendapatan_toko", "operational"],
  sp: ["jasa_pinjaman", "dana_resiko", "penalti_pelunasan"],
  lainnya: ["biaya_operasional", "lainnya"],
};

interface FlatTx {
  id: string;
  date: string;
  description: string;
  category: string;
  categoryLabel: string;
  type: "income" | "expense";
  amount: number;
  paymentMethod: string | null;
  source: "cash_bank" | "unit_transaction" | "store_sale" | "loan_payment" | "loan_admin_fee";
  referenceNo: string | null;
  unitType: string | null;
  rawDate: Date;
}

export async function GET(request: NextRequest) {
  // Auth check — financial data requires authentication
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") || "0");
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;
  const source = searchParams.get("source") as "income" | "expense";
  const category = searchParams.get("category") || null;
  const incomeGroup = searchParams.get("incomeGroup") as "unit" | "sp" | "lainnya" | null;
  const paymentMethod = searchParams.get("paymentMethod") || null;
  const search = searchParams.get("search") || null;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25")));

  if (!year || !source) {
    return NextResponse.json({ error: "year and source are required" }, { status: 400 });
  }

  // Build date range
  let startDate: Date;
  let endDate: Date;
  if (month) {
    startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  } else {
    startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  }

  const allTransactions: FlatTx[] = [];

  if (source === "income") {
    // 1. CashBankTransaction type=in, journalId=NULL (non-income categories filtered)
    const cbCategoryFilter = incomeGroup
      ? { in: GROUP_CATEGORIES[incomeGroup] }
      : category
      ? category
      : { notIn: NON_INCOME_CATEGORIES };

    // NOTE: CashBankTransaction does NOT have paymentMethod or referenceNo fields.
    // Use transactionNo as the reference identifier. paymentMethod is always null for CB.
    const cbIncome = await prisma.cashBankTransaction.findMany({
      where: {
        transactionDate: { gte: startDate, lte: endDate },
        type: "in",
        journalId: null,
        category: cbCategoryFilter as any,
        ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        transactionNo: true,
        transactionDate: true,
        description: true,
        category: true,
        amount: true,
        unitType: true,
      },
    });

    cbIncome.forEach(tx => {
      const cat = tx.category || "lainnya";
      // Category filter if specific category requested
      if (category && cat !== category) return;
      allTransactions.push({
        id: tx.id,
        date: tx.transactionDate.toISOString(),
        description: tx.description || "-",
        category: cat,
        categoryLabel: CB_INCOME_LABELS[cat] || `Pendapatan: ${cat.replace(/_/g, " ")}`,
        type: "income",
        amount: toNum(tx.amount),
        paymentMethod: null, // CB transactions don't have payment method
        source: "cash_bank",
        referenceNo: tx.transactionNo,
        unitType: tx.unitType,
        rawDate: tx.transactionDate,
      });
    });

    // 2. LoanPayment interestPortion (only if no specific category filter or SP group)
    if (!category || incomeGroup === "sp") {
      const loanPayments = await prisma.loanPayment.findMany({
        where: {
          paymentDate: { gte: startDate, lte: endDate },
          status: { not: "voided" },
          interestPortion: { gt: 0 },
        },
        select: {
          id: true,
          paymentDate: true,
          interestPortion: true,
          loan: { select: { member: { select: { name: true } } } },
        },
      });

      loanPayments.forEach(lp => {
        const interest = toNum(lp.interestPortion);
        if (interest <= 0) return;
        allTransactions.push({
          id: `lp-${lp.id}`,
          date: lp.paymentDate.toISOString(),
          description: `Jasa Pinjaman — ${lp.loan?.member?.name || "Anggota"}`,
          category: "jasa_pinjaman",
          categoryLabel: "Jasa Pinjaman (Bunga)",
          type: "income",
          amount: interest,
          paymentMethod: null,
          source: "loan_payment",
          referenceNo: lp.id,
          unitType: null,
          rawDate: lp.paymentDate,
        });
      });
    }

    // 3. Loan.adminFee (Dana Resiko) — only if no category filter or SP group
    if (!category || incomeGroup === "sp") {
      const danaResikoLoans = await prisma.loan.findMany({
        where: {
          disbursementDate: { gte: startDate, lte: endDate },
          status: { in: ["active", "paid_off"] },
          adminFee: { gt: 0 },
        },
        select: {
          id: true,
          disbursementDate: true,
          adminFee: true,
          member: { select: { name: true } },
        },
      });

      danaResikoLoans.forEach(loan => {
        const fee = toNum(loan.adminFee);
        if (fee <= 0) return;
        allTransactions.push({
          id: `dr-${loan.id}`,
          date: loan.disbursementDate.toISOString(),
          description: `Dana Resiko (Admin Fee) — ${loan.member?.name || "Anggota"}`,
          category: "dana_resiko",
          categoryLabel: "Dana Resiko (Admin Fee)",
          type: "income",
          amount: fee,
          paymentMethod: null,
          source: "loan_admin_fee",
          referenceNo: loan.id,
          unitType: null,
          rawDate: loan.disbursementDate,
        });
      });
    }

    // 4. UnitTransaction (completed, isPaid) — only if unit group or no filter
    if (!category && !incomeGroup || incomeGroup === "unit") {
      const unitTx = await prisma.unitTransaction.findMany({
        where: {
          transactionDate: { gte: startDate, lte: endDate },
          isPaid: true,
          status: "completed",
          ...(paymentMethod ? { paymentMethod } : {}),
        },
        select: {
          id: true,
          transactionNo: true,
          transactionDate: true,
          description: true,
          amount: true,
          paymentMethod: true,
          unitType: true,
        },
      });

      unitTx.forEach(tx => {
        allTransactions.push({
          id: `ut-${tx.id}`,
          date: tx.transactionDate.toISOString(),
          description: tx.description || `Pendapatan Unit ${tx.unitType}`,
          category: "pendapatan_unit",
          categoryLabel: "Pendapatan Unit Layanan",
          type: "income",
          amount: toNum(tx.amount),
          paymentMethod: tx.paymentMethod,
          source: "unit_transaction",
          referenceNo: tx.transactionNo,
          unitType: tx.unitType,
          rawDate: tx.transactionDate,
        });
      });
    }

    // 5. StoreSale (non-voided) — only if unit group or no filter
    if (!category && !incomeGroup || incomeGroup === "unit") {
      const storeSales = await prisma.storeSale.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          NOT: { metadata: { path: ["isVoided"], equals: true } } as any,
          ...(paymentMethod ? { paymentMethod } : {}),
        },
        select: {
          id: true,
          saleNo: true,
          createdAt: true,
          totalAmount: true,
          paymentMethod: true,
          unitType: true,
        },
      });

      storeSales.forEach(sale => {
        allTransactions.push({
          id: `ss-${sale.id}`,
          date: sale.createdAt.toISOString(),
          description: `Penjualan Toko${sale.unitType ? ` (${sale.unitType})` : ""}`,
          category: "pendapatan_toko",
          categoryLabel: "Pendapatan Toko",
          type: "income",
          amount: toNum(sale.totalAmount),
          paymentMethod: sale.paymentMethod,
          source: "store_sale",
          referenceNo: sale.saleNo,
          unitType: sale.unitType,
          rawDate: sale.createdAt,
        });
      });
    }
  } else {
    // source === "expense"
    // 1. CashBankTransaction type=out, journalId=NULL
    const cbCategoryFilter = category
      ? category
      : { notIn: NON_EXPENSE_CATEGORIES };

    // NOTE: CashBankTransaction does NOT have paymentMethod or referenceNo fields.
    const cbExpense = await prisma.cashBankTransaction.findMany({
      where: {
        transactionDate: { gte: startDate, lte: endDate },
        type: "out",
        journalId: null,
        category: cbCategoryFilter as any,
        ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        transactionNo: true,
        transactionDate: true,
        description: true,
        category: true,
        amount: true,
        unitType: true,
      },
    });

    cbExpense.forEach(tx => {
      const cat = tx.category || "lainnya";
      if (category && cat !== category) return;
      allTransactions.push({
        id: tx.id,
        date: tx.transactionDate.toISOString(),
        description: tx.description || "-",
        category: cat,
        categoryLabel: CB_EXPENSE_LABELS[cat] || `Pengeluaran: ${cat.replace(/_/g, " ")}`,
        type: "expense",
        amount: toNum(tx.amount),
        paymentMethod: null, // CB transactions don't have payment method
        source: "cash_bank",
        referenceNo: tx.transactionNo,
        unitType: tx.unitType,
        rawDate: tx.transactionDate,
      });
    });

    // 2. StoreSaleItem COGS
    if (!category) {
      const soldItems = await prisma.storeSaleItem.findMany({
        where: {
          sale: {
            createdAt: { gte: startDate, lte: endDate },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as any,
          },
        },
        include: {
          product: { select: { name: true, costPrice: true } },
          sale: { select: { id: true, createdAt: true, unitType: true } },
        },
      });

      // Group COGS by sale to avoid too many rows
      const cogsBySale = new Map<string, { amount: number; date: Date; unitType: string | null; items: string[] }>();
      soldItems.forEach(item => {
        const cp = toNum(item.costPrice) || toNum(item.product?.costPrice) || 0;
        const itemCost = item.quantity * cp;
        if (itemCost <= 0) return;
        const saleId = item.sale.id;
        if (!cogsBySale.has(saleId)) {
          cogsBySale.set(saleId, { amount: 0, date: item.sale.createdAt, unitType: item.sale.unitType, items: [] });
        }
        const entry = cogsBySale.get(saleId)!;
        entry.amount += itemCost;
        if (item.product?.name) entry.items.push(item.product.name);
      });

      cogsBySale.forEach((entry, saleId) => {
        allTransactions.push({
          id: `cogs-${saleId}`,
          date: entry.date.toISOString(),
          description: `HPP Barang: ${entry.items.slice(0, 3).join(", ")}${entry.items.length > 3 ? ` (+${entry.items.length - 3})` : ""}`,
          category: "hpp_toko",
          categoryLabel: "HPP / Modal Barang",
          type: "expense",
          amount: entry.amount,
          paymentMethod: null,
          source: "store_sale",
          referenceNo: saleId,
          unitType: entry.unitType,
          rawDate: entry.date,
        });
      });
    }
  }

  // Sort by date descending
  allTransactions.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  // Build byCategory summary (before pagination)
  const byCategoryMap = new Map<string, { label: string; count: number; amount: number }>();
  allTransactions.forEach(tx => {
    if (!byCategoryMap.has(tx.category)) {
      byCategoryMap.set(tx.category, { label: tx.categoryLabel, count: 0, amount: 0 });
    }
    const entry = byCategoryMap.get(tx.category)!;
    entry.count++;
    entry.amount += tx.amount;
  });
  const byCategory = Array.from(byCategoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.amount - a.amount);

  // Paginate
  const totalItems = allTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const startIdx = (page - 1) * perPage;
  const paginated = allTransactions.slice(startIdx, startIdx + perPage);

  // Format dates for display
  const formatted = paginated.map(tx => ({
    ...tx,
    date: new Date(tx.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
    rawDate: undefined,
  }));

  return NextResponse.json({
    data: {
      transactions: formatted,
      summary: {
        totalAmount: allTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        totalItems,
        byCategory,
      },
      pagination: { page, perPage, totalItems, totalPages },
    },
  });

  } catch (error) {
    console.error("GET /api/reports/shu/detail-transactions error:", error);
    return NextResponse.json(
      { message: "Failed to load detail transactions" },
      { status: 500 }
    );
  }
}
