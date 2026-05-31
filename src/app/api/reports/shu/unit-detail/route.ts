import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

function toNum(d: Decimal | number | null | undefined): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(d);
}

// GET /api/reports/shu/unit-detail
// Detailed transaction list per unit for manual audit
// Params: year, month (optional), unitType, type (income|expense|all),
//         paymentMethod (cash|qris|salary_cut|all), page, perPage
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const monthParam = searchParams.get("month");
        const isAllMonths = !monthParam || monthParam === "all";
        const month = isAllMonths ? null : parseInt(monthParam);

        const unitType = searchParams.get("unitType") || "toko";
        const typeFilter = searchParams.get("type") || "all"; // income | expense | all
        const methodFilter = searchParams.get("paymentMethod") || "all";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25")));

        let startDate: Date;
        let endDate: Date;
        if (!isAllMonths && month !== null) {
            startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
            endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        } else {
            startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
            endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
        }

        type TxRow = {
            date: string;
            description: string;
            category: string;
            type: "income" | "expense";
            amount: number;
            paymentMethod: string | null;
            source: string;
            referenceNo: string | null;
        };

        const allRows: TxRow[] = [];
        const METHOD_LABELS: Record<string, string> = {
            cash: "Tunai",
            qris: "QRIS",
            salary_cut: "Potong Gaji",
            bank_transfer: "Transfer Bank",
            credit: "Potong Gaji",
        };

        // === INCOME sources ===
        if (typeFilter === "all" || typeFilter === "income") {
            // 1. StoreSale (for toko and store-type units)
            const storeMethodFilter = methodFilter === "all" ? undefined : methodFilter;
            const storeSales = await prisma.storeSale.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                    unitType: unitType,
                    ...(storeMethodFilter ? { paymentMethod: storeMethodFilter } : {}),
                    NOT: { metadata: { path: ["isVoided"], equals: true } } as any,
                },
                select: {
                    saleNo: true,
                    createdAt: true,
                    totalAmount: true,
                    paymentMethod: true,
                    customerName: true,
                },
                orderBy: { createdAt: "desc" },
            });
            for (const s of storeSales) {
                allRows.push({
                    date: s.createdAt.toISOString().slice(0, 10),
                    description: s.customerName
                        ? `Penjualan Toko ${s.saleNo} — ${s.customerName}`
                        : `Penjualan Toko ${s.saleNo}`,
                    category: "pendapatan_toko",
                    type: "income",
                    amount: toNum(s.totalAmount),
                    paymentMethod: METHOD_LABELS[s.paymentMethod] || s.paymentMethod,
                    source: "StoreSale",
                    referenceNo: s.saleNo,
                });
            }

            // 2. UnitTransaction (for service-type units)
            const unitTxMethodFilter = methodFilter === "all" ? undefined : methodFilter;
            const unitTxs = await prisma.unitTransaction.findMany({
                where: {
                    transactionDate: { gte: startDate, lte: endDate },
                    unitType: unitType,
                    isPaid: true,
                    status: "completed",
                    ...(unitTxMethodFilter ? { paymentMethod: unitTxMethodFilter } : {}),
                },
                select: {
                    transactionNo: true,
                    transactionDate: true,
                    amount: true,
                    paymentMethod: true,
                    description: true,
                },
                orderBy: { transactionDate: "desc" },
            });
            for (const u of unitTxs) {
                allRows.push({
                    date: u.transactionDate.toISOString().slice(0, 10),
                    description: u.description || `Transaksi Unit ${u.transactionNo}`,
                    category: "pendapatan_unit",
                    type: "income",
                    amount: toNum(u.amount),
                    paymentMethod: METHOD_LABELS[u.paymentMethod] || u.paymentMethod,
                    source: "UnitTransaction",
                    referenceNo: u.transactionNo,
                });
            }

            // 3. CashBankTransaction income (non-journaled, non-savings)
            const NON_INCOME_CATEGORIES = [
                "savings", "simpanan_pokok", "simpanan_wajib", "simpanan_sukarela",
                "setoran_simpanan", "transfer", "pencairan_pinjaman", "angsuran_pokok", "loan",
            ];
            const cbIncomes = await prisma.cashBankTransaction.findMany({
                where: {
                    transactionDate: { gte: startDate, lte: endDate },
                    type: "in",
                    journalId: null,
                    unitType: unitType,
                    category: { notIn: NON_INCOME_CATEGORIES },
                },
                select: {
                    transactionNo: true,
                    transactionDate: true,
                    amount: true,
                    category: true,
                    description: true,
                },
                orderBy: { transactionDate: "desc" },
            });
            for (const cb of cbIncomes) {
                allRows.push({
                    date: cb.transactionDate.toISOString().slice(0, 10),
                    description: cb.description || `Kas Masuk ${cb.transactionNo}`,
                    category: cb.category || "lainnya",
                    type: "income",
                    amount: toNum(cb.amount),
                    paymentMethod: null, // CB doesn't have paymentMethod
                    source: "CashBank",
                    referenceNo: cb.transactionNo,
                });
            }
        }

        // === EXPENSE sources ===
        if (typeFilter === "all" || typeFilter === "expense") {
            const NON_EXPENSE_CATEGORIES = [
                "pencairan_pinjaman", "transfer", "savings", "simpanan_pokok",
                "simpanan_wajib", "simpanan_sukarela", "angsuran_pokok",
                "void_penjualan_toko", "void_unit_transaction", "pendapatan_unit",
                "jasa_pinjaman", "penalti_pelunasan", "dana_resiko",
            ];

            // CB expense for this unit
            const cbExpenses = await prisma.cashBankTransaction.findMany({
                where: {
                    transactionDate: { gte: startDate, lte: endDate },
                    type: "out",
                    unitType: unitType,
                    category: { notIn: NON_EXPENSE_CATEGORIES },
                },
                select: {
                    transactionNo: true,
                    transactionDate: true,
                    amount: true,
                    category: true,
                    description: true,
                },
                orderBy: { transactionDate: "desc" },
            });
            for (const cb of cbExpenses) {
                allRows.push({
                    date: cb.transactionDate.toISOString().slice(0, 10),
                    description: cb.description || `Kas Keluar ${cb.transactionNo}`,
                    category: cb.category || "lainnya",
                    type: "expense",
                    amount: toNum(cb.amount),
                    paymentMethod: null,
                    source: "CashBank",
                    referenceNo: cb.transactionNo,
                });
            }

            // Unallocated expenses (unitType=NULL) if looking at general view
            if (unitType === "_umum" || unitType === "simpan_pinjam") {
                const unallocExpenses = await prisma.cashBankTransaction.findMany({
                    where: {
                        transactionDate: { gte: startDate, lte: endDate },
                        type: "out",
                        OR: [
                            { unitType: null },
                            { unitType: "none" },
                            { unitType: "simpan_pinjam" },
                        ],
                        category: { notIn: NON_EXPENSE_CATEGORIES },
                    },
                    select: {
                        transactionNo: true,
                        transactionDate: true,
                        amount: true,
                        category: true,
                        description: true,
                    },
                    orderBy: { transactionDate: "desc" },
                });
                for (const cb of unallocExpenses) {
                    allRows.push({
                        date: cb.transactionDate.toISOString().slice(0, 10),
                        description: cb.description || `Kas Keluar ${cb.transactionNo}`,
                        category: cb.category || "lainnya",
                        type: "expense",
                        amount: toNum(cb.amount),
                        paymentMethod: null,
                        source: "CashBank",
                        referenceNo: cb.transactionNo,
                    });
                }
            }
        }

        // Sort all rows by date descending
        allRows.sort((a, b) => b.date.localeCompare(a.date));

        // Pagination
        const totalItems = allRows.length;
        const totalPages = Math.ceil(totalItems / perPage);
        const paginatedRows = allRows.slice((page - 1) * perPage, page * perPage);

        // Summary
        const totalIncome = allRows.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0);
        const totalExpense = allRows.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);

        return NextResponse.json({
            data: {
                unitType,
                year,
                month: month ?? 0,
                transactions: paginatedRows,
                summary: {
                    totalIncome,
                    totalExpense,
                    netAmount: totalIncome - totalExpense,
                    totalItems,
                },
                pagination: {
                    page,
                    perPage,
                    totalItems,
                    totalPages,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/reports/shu/unit-detail error:", error);
        return NextResponse.json(
            { message: "Failed to load unit detail" },
            { status: 500 }
        );
    }
}
