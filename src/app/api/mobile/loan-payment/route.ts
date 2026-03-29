import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

// GET /api/mobile/loan-payment?memberId=xxx — Get member's active loans
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
        return NextResponse.json({ message: "memberId wajib diisi" }, { status: 400 });
    }

    try {
        const loans = await prisma.loan.findMany({
            where: { memberId: Number(memberId), status: { in: ["active", "overdue"] } },
            select: {
                id: true,
                loanNo: true,
                principalAmount: true,
                principalOutstanding: true,
                interestOutstanding: true,
                monthlyInstallment: true,
                tenorMonths: true,
                status: true,
                memberId: true,
                application: { select: { product: { select: { name: true } } } },
            },
        });

        return NextResponse.json({
            data: loans.map((l) => ({
                id: l.id,
                loanNo: l.loanNo,
                productName: l.application.product.name,
                principalAmount: Number(l.principalAmount),
                principalOutstanding: Number(l.principalOutstanding),
                interestOutstanding: Number(l.interestOutstanding),
                monthlyInstallment: Number(l.monthlyInstallment),
                tenor: l.tenorMonths,
                status: l.status,
                memberId: l.memberId,
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/loan-payment error:", error);
        return NextResponse.json({ message: "Gagal memuat data pinjaman" }, { status: 500 });
    }
}

// POST /api/mobile/loan-payment — Record a loan installment payment
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { loanId, amount, notes } = body;

        if (!loanId || !amount) {
            return NextResponse.json({ message: "loanId dan amount wajib diisi" }, { status: 400 });
        }

        const numAmount = Number(amount);
        if (numAmount <= 0) {
            return NextResponse.json({ message: "Jumlah harus lebih dari 0" }, { status: 400 });
        }

        const loan = await prisma.loan.findUnique({
            where: { id: Number(loanId) },
            include: { member: { select: { name: true } }, application: { select: { product: { select: { name: true } } } } },
        });

        if (!loan || !["active", "overdue"].includes(loan.status)) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan atau sudah lunas" }, { status: 404 });
        }

        const principalOut = Number(loan.principalOutstanding);
        const interestOut = Number(loan.interestOutstanding);
        const interestPortion = Math.min(numAmount, interestOut);
        const principalPortion = Math.min(numAmount - interestPortion, principalOut);
        const newPrincipalOut = principalOut - principalPortion;
        const newInterestOut = interestOut - interestPortion;
        const newStatus = (newPrincipalOut <= 0 && newInterestOut <= 0) ? "paid" : loan.status;

        const paymentNo = `PAY-M-${Date.now()}`;

        await prisma.$transaction([
            prisma.loanPayment.create({
                data: {
                    paymentNo,
                    loanId: Number(loanId),
                    memberId: loan.memberId,
                    branchId: 1, // Fallback for DB constraints
                    amount: numAmount,
                    principalPortion,
                    interestPortion,
                    paymentDate: new Date(),
                    notes: notes || "Angsuran via mobile",
                    createdById: Number(user.id),
                },
            }),
            prisma.loan.update({
                where: { id: Number(loanId) },
                data: {
                    principalOutstanding: newPrincipalOut,
                    interestOutstanding: newInterestOut,
                    principalPaid: { increment: principalPortion },
                    interestPaid: { increment: interestPortion },
                    status: newStatus,
                },
            }),
        ]);

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "CREATE",
            module: "Pinjaman",
            description: `Angsuran Rp ${numAmount.toLocaleString("id-ID")} untuk pinjaman ${loan.loanNo} (${loan.member.name}) via mobile`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: newStatus === "paid" ? "Pinjaman LUNAS! 🎉" : "Angsuran berhasil dicatat",
            data: { newPrincipalOutstanding: newPrincipalOut, newInterestOutstanding: newInterestOut, status: newStatus },
        });
    } catch (error) {
        console.error("POST /api/mobile/loan-payment error:", error);
        return NextResponse.json({ message: "Gagal memproses angsuran" }, { status: 500 });
    }
}
