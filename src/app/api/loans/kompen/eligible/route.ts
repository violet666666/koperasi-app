import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/loans/kompen/eligible?memberId=X — List active loans eligible for kompen
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const memberId = parseInt(searchParams.get("memberId") || "");
        if (isNaN(memberId)) return NextResponse.json({ message: "memberId wajib diisi" }, { status: 400 });

        const loans = await prisma.loan.findMany({
            where: { memberId, status: "active" },
            select: {
                id: true,
                loanNo: true,
                principalAmount: true,
                principalOutstanding: true,
                interestOutstanding: true,
                tenorMonths: true,
                interestRate: true,
                disbursementDate: true,
                productSnapshot: true,
            },
            orderBy: { disbursementDate: "desc" },
        });

        const result = loans.map(l => {
            const snapshot = l.productSnapshot as any;
            const monthlyInterest = Math.round(Number(l.principalAmount) * (Number(l.interestRate) / 100));
            const penaltyFee = l.tenorMonths <= 24 ? monthlyInterest : monthlyInterest * 2;
            return {
                id: l.id,
                loanNo: l.loanNo,
                principalAmount: Number(l.principalAmount),
                principalOutstanding: Number(l.principalOutstanding),
                interestOutstanding: Number(l.interestOutstanding),
                tenorMonths: l.tenorMonths,
                interestRate: Number(l.interestRate),
                disbursementDate: l.disbursementDate,
                productName: snapshot?.name || "-",
                monthlyInterest,
                penaltyFee,
                totalKompen: Number(l.principalOutstanding) + penaltyFee,
            };
        });

        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("GET /api/loans/kompen/eligible error:", error);
        return NextResponse.json({ message: "Gagal memuat data" }, { status: 500 });
    }
}
