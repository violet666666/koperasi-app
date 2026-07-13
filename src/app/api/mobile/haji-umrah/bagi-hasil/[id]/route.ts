import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../middleware";

// GET /api/mobile/haji-umrah/bagi-hasil/[id] — Detail distribution + items (READ-ONLY)
// Mirror of web GET /api/haji-umrah/bagi-hasil/[id] with mobile auth.
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { id } = await params;
        const distId = parseInt(id);
        if (isNaN(distId)) {
            return NextResponse.json({ message: "Invalid id" }, { status: 400 });
        }

        const distribution = await prisma.bagiHasilDistribution.findUnique({
            where: { id: distId },
            include: { items: { orderBy: { amount: "desc" } } },
        });

        if (!distribution) {
            return NextResponse.json({ message: "Distribusi tidak ditemukan" }, { status: 404 });
        }

        return NextResponse.json({
            distribution: {
                id: distribution.id,
                distributionNo: distribution.distributionNo,
                periodLabel: distribution.periodLabel,
                periodStart: distribution.periodStart,
                periodEnd: distribution.periodEnd,
                totalBsiAmount: Number(distribution.totalBsiAmount),
                memberRate: Number(distribution.memberRate),
                memberPoolAmount: Number(distribution.memberPoolAmount),
                spreadAmount: Number(distribution.spreadAmount),
                totalBalanceSnapshot: Number(distribution.totalBalanceSnapshot),
                memberCount: distribution.memberCount,
                status: distribution.status,
                processedAt: distribution.processedAt,
                voidedAt: distribution.voidedAt,
                voidReason: distribution.voidReason,
                notes: distribution.notes,
                createdAt: distribution.createdAt,
            },
            items: distribution.items.map((it) => ({
                id: it.id,
                memberId: it.memberId,
                savingsAccountId: it.savingsAccountId,
                memberName: it.memberName,
                accountNo: it.accountNo,
                balanceSnapshot: Number(it.balanceSnapshot),
                sharePercent: Number(it.sharePercent),
                amount: Number(it.amount),
                savingsTransactionId: it.savingsTransactionId,
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/bagi-hasil/[id] error:", error);
        return NextResponse.json({ message: "Gagal mengambil detail bagi hasil" }, { status: 500 });
    }
}
