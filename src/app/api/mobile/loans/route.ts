import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/loans — Daftar pinjaman anggota
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

        const loans = await prisma.loan.findMany({
            where: { memberId: user.memberId },
            include: {
                payments: {
                    orderBy: { paymentDate: "desc" },
                    take: 5,
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
            data: loans.map((loan) => ({
                id: loan.id,
                loanNumber: loan.loanNo,
                principalAmount: Number(loan.principalAmount),
                principalOutstanding: Number(loan.principalOutstanding),
                interestOutstanding: Number(loan.interestOutstanding),
                interestRate: Number(loan.interestRate),
                monthlyInstallment: Number(loan.monthlyInstallment),
                tenor: loan.tenor,
                status: loan.status,
                disbursedAt: loan.disbursementDate,
                lastDueDate: loan.lastDueDate,
                recentPayments: loan.payments.map((p) => ({
                    id: p.id,
                    amount: Number(p.amount),
                    paymentDate: p.paymentDate,
                })),
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/loans error:", error);
        return NextResponse.json({ message: "Gagal memuat data pinjaman" }, { status: 500 });
    }
}
