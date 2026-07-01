import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/loan-payments?loanId=X — list payments for a loan (for the Void Angsuran UI).
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    const url = new URL(request.url);
    const loanId = Number(url.searchParams.get("loanId"));
    if (!loanId || Number.isNaN(loanId)) {
        return NextResponse.json({ message: "loanId wajib diisi" }, { status: 400 });
    }

    try {
        const payments = await prisma.loanPayment.findMany({
            where: { loanId },
            orderBy: { paymentDate: "desc" },
            include: { _count: { select: { allocations: true } } },
        });

        return NextResponse.json({
            data: payments.map((p) => ({
                id: p.id,
                paymentNo: p.paymentNo,
                amount: Number(p.amount),
                principalPortion: Number(p.principalPortion),
                interestPortion: Number(p.interestPortion),
                lateFeePortion: Number(p.lateFeePortion),
                paymentType: p.paymentType,
                status: p.status,
                voidedAt: p.voidedAt,
                voidReason: p.voidReason,
                paymentDate: p.paymentDate,
                allocCount: p._count.allocations,
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/loan-payments error:", error);
        return NextResponse.json({ message: "Gagal memuat riwayat angsuran" }, { status: 500 });
    }
}
