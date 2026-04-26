import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

function toNum(d: Decimal | number | null | undefined): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(d);
}

interface CashFlowItem {
    description: string;
    amount: number;
}

// GET /api/reports/arus-kas?month=4&year=2026
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

        if (month < 1 || month > 12 || year < 2020 || year > 2100) {
            return NextResponse.json({ message: "Parameter bulan/tahun tidak valid" }, { status: 400 });
        }

        const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
        const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        // ── 1. Opening Balance: sum of all CashBankTransaction net before period start ──
        const prePeriodTxs = await prisma.cashBankTransaction.findMany({
            where: {
                transactionDate: { lt: periodStart },
                account: { isActive: true },
            },
            select: { type: true, amount: true },
        });

        let openingBalance = 0;
        for (const tx of prePeriodTxs) {
            if (tx.type === "in") {
                openingBalance += toNum(tx.amount);
            } else {
                openingBalance -= toNum(tx.amount);
            }
        }

        // ── 2. Period transactions grouped by category + type ──
        const periodTxs = await prisma.cashBankTransaction.findMany({
            where: {
                transactionDate: { gte: periodStart, lte: periodEnd },
                account: { isActive: true },
                category: { not: "transfer" }, // Exclude internal transfers
            },
            select: {
                type: true,
                category: true,
                amount: true,
                description: true,
            },
        });

        // Aggregate into operating, investing, financing
        const opIn: Record<string, number> = {};
        const opOut: Record<string, number> = {};
        const finIn: Record<string, number> = {};
        const finOut: Record<string, number> = {};
        const invIn: Record<string, number> = {};
        const invOut: Record<string, number> = {};

        const categoryLabels: Record<string, { inflow: string; outflow: string }> = {
            simpanan_pokok: { inflow: "Setoran Simpanan Pokok", outflow: "Penarikan Simpanan Pokok" },
            simpanan_wajib: { inflow: "Setoran Simpanan Wajib", outflow: "Penarikan Simpanan Wajib" },
            simpanan_sukarela: { inflow: "Setoran Simpanan Sukarela", outflow: "Penarikan Simpanan Sukarela" },
            angsuran_pokok: { inflow: "Penerimaan Angsuran Pokok", outflow: "Pengembalian Angsuran" },
            jasa_pinjaman: { inflow: "Penerimaan Jasa Pinjaman", outflow: "Pengembalian Jasa Pinjaman" },
            penalti_pelunasan: { inflow: "Penerimaan Penalti Pelunasan", outflow: "" },
            pendapatan_unit: { inflow: "Pendapatan Usaha Unit", outflow: "" },
            pencairan_pinjaman: { inflow: "", outflow: "Pencairan Pinjaman Anggota" },
            biaya_operasional: { inflow: "", outflow: "Biaya Operasional" },
            beban_unit: { inflow: "", outflow: "Beban Unit Usaha" },
            hpp_toko: { inflow: "", outflow: "HPP Toko (Modal Barang)" },
            hutang_mitra: { inflow: "Penerimaan dari Mitra", outflow: "Pembayaran ke Mitra" },
            lainnya: { inflow: "Pendapatan Lain-lain", outflow: "Pengeluaran Lain-lain" },
        };

        for (const tx of periodTxs) {
            const cat = tx.category || "lainnya";
            const amount = toNum(tx.amount);
            const labels = categoryLabels[cat] || { inflow: `Penerimaan (${cat})`, outflow: `Pengeluaran (${cat})` };

            if (cat === "pencairan_pinjaman") {
                // Financing: loan disbursements
                if (tx.type === "out") {
                    finOut[labels.outflow] = (finOut[labels.outflow] || 0) + amount;
                }
            } else {
                // Operating: everything else
                if (tx.type === "in") {
                    opIn[labels.inflow] = (opIn[labels.inflow] || 0) + amount;
                } else {
                    opOut[labels.outflow] = (opOut[labels.outflow] || 0) + amount;
                }
            }
        }

        // Also check for investing via journal lines hitting fixed_asset accounts
        const investLines = await prisma.journalLine.findMany({
            where: {
                journal: {
                    transactionDate: { gte: periodStart, lte: periodEnd },
                    isPosted: true,
                },
                account: {
                    type: "asset",
                    category: "fixed_asset",
                },
            },
            include: {
                account: { select: { name: true } },
            },
        });

        for (const line of investLines) {
            const credit = toNum(line.credit);
            const debit = toNum(line.debit);
            if (credit > 0) {
                // Asset decreasing = cash inflow from sale
                invIn[`Penjualan ${line.account.name}`] = (invIn[`Penjualan ${line.account.name}`] || 0) + credit;
            }
            if (debit > 0) {
                // Asset increasing = cash outflow for purchase
                invOut[`Pembelian ${line.account.name}`] = (invOut[`Pembelian ${line.account.name}`] || 0) + debit;
            }
        }

        // Build items
        const toItems = (obj: Record<string, number>): CashFlowItem[] =>
            Object.entries(obj)
                .filter(([, amount]) => amount > 0)
                .map(([description, amount]) => ({ description, amount }));

        const opInflowItems = toItems(opIn);
        const opOutflowItems = toItems(opOut);
        const netOp = opInflowItems.reduce((s, i) => s + i.amount, 0) - opOutflowItems.reduce((s, i) => s + i.amount, 0);

        const invInflowItems = toItems(invIn);
        const invOutflowItems = toItems(invOut);
        const netInv = invInflowItems.reduce((s, i) => s + i.amount, 0) - invOutflowItems.reduce((s, i) => s + i.amount, 0);

        const finInflowItems = toItems(finIn);
        const finOutflowItems = toItems(finOut);
        const netFin = finInflowItems.reduce((s, i) => s + i.amount, 0) - finOutflowItems.reduce((s, i) => s + i.amount, 0);

        const netChange = netOp + netInv + netFin;
        const closingBalance = openingBalance + netChange;

        const result = {
            openingBalance,
            closingBalance,
            operating: {
                inflows: opInflowItems,
                outflows: opOutflowItems.map(i => ({ ...i, amount: -i.amount })),
                net: netOp,
            },
            investing: {
                inflows: invInflowItems,
                outflows: invOutflowItems.map(i => ({ ...i, amount: -i.amount })),
                net: netInv,
            },
            financing: {
                inflows: finInflowItems,
                outflows: finOutflowItems.map(i => ({ ...i, amount: -i.amount })),
                net: netFin,
            },
            netChange,
        };

        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("GET /api/reports/arus-kas error:", error);
        return NextResponse.json(
            { message: "Failed to generate cash flow report" },
            { status: 500 }
        );
    }
}
