import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/transactions — Riwayat transaksi simpanan anggota
export async function GET(request: Request) {
    const mobileUser = getMobileUser(request);
    if (!mobileUser) return unauthorizedResponse();

    try {
        const user = await prisma.user.findUnique({
            where: { id: Number(mobileUser.id) },
            include: { member: true },
        });

        if (!user?.memberId) {
            return NextResponse.json({ message: "Data anggota tidak ditemukan" }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const type = searchParams.get("type"); // "savings", "unit", "loan"

        const memberId = user.memberId;

        // Savings transactions
        if (!type || type === "savings") {
            const [transactions, total] = await Promise.all([
                prisma.savingsTransaction.findMany({
                    where: { memberId, status: "completed" },
                    include: {
                        account: { include: { product: { select: { name: true, type: true } } } },
                    },
                    orderBy: { transactionDate: "desc" },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.savingsTransaction.count({ where: { memberId, status: "completed" } }),
            ]);

            return NextResponse.json({
                data: transactions.map((t) => ({
                    id: t.id,
                    type: t.type,
                    amount: Number(t.amount),
                    balanceBefore: Number(t.balanceBefore),
                    balanceAfter: Number(t.balanceAfter),
                    transactionDate: t.transactionDate,
                    description: t.notes || t.account?.product?.name || "",
                    productName: t.account?.product?.name,
                })),
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }

        // Unit transactions (Kredit Toko/Jasa)
        if (type === "unit") {
            const [transactions, total] = await Promise.all([
                prisma.unitTransaction.findMany({
                    where: { memberId },
                    orderBy: { transactionDate: "desc" },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.unitTransaction.count({ where: { memberId } }),
            ]);

            return NextResponse.json({
                data: transactions.map((t) => ({
                    id: t.id,
                    type: t.unitType,
                    amount: Number(t.amount),
                    description: t.description,
                    transactionDate: t.transactionDate,
                    isPaid: t.isPaid,
                })),
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }

        // Loan payments
        if (type === "loan") {
            const [payments, total] = await Promise.all([
                prisma.loanPayment.findMany({
                    where: { memberId },
                    include: { loan: { select: { loanNo: true } } },
                    orderBy: { paymentDate: "desc" },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.loanPayment.count({ where: { memberId } }),
            ]);

            return NextResponse.json({
                data: payments.map((p) => ({
                    id: p.id,
                    type: "payment",
                    amount: Number(p.amount),
                    principalPortion: Number(p.principalPortion),
                    interestPortion: Number(p.interestPortion),
                    transactionDate: p.paymentDate,
                    description: `Angsuran ${p.loan?.loanNo || ""}`,
                })),
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }

        return NextResponse.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 } });
    } catch (error) {
        console.error("GET /api/mobile/transactions error:", error);
        return NextResponse.json({ message: "Gagal memuat transaksi" }, { status: 500 });
    }
}
