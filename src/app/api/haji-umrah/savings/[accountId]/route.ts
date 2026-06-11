import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/haji-umrah/savings/[accountId] — Detail + stats
export async function GET(
    request: Request,
    { params }: { params: Promise<{ accountId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        }

        const account = await prisma.savingsAccount.findUnique({
            where: { id },
            include: {
                member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                product: true,
                transactions: {
                    where: { status: "completed" },
                    orderBy: { transactionDate: "desc" },
                    take: 50,
                    include: {
                        createdBy: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
            return NextResponse.json(
                { message: "Rekening tabungan haji/umrah tidak ditemukan" },
                { status: 404 }
            );
        }

        const balance = Number(account.balance);
        const target = Number(account.targetAmount ?? account.product.targetAmount ?? 0);
        const progress = target > 0 ? Math.min(100, (balance / target) * 100) : 0;

        // Stats
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyDeposits = account.transactions
            .filter((t) => t.type === "deposit" && new Date(t.transactionDate) >= startOfMonth)
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const totalDeposits = account.transactions
            .filter((t) => t.type === "deposit")
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const depositCount = account.transactions.filter((t) => t.type === "deposit").length;

        // Months remaining estimate
        const monthlyTargetVal = Number(account.monthlyTarget ?? 0);
        const remaining = Math.max(0, target - balance);
        const monthsRemaining = monthlyTargetVal > 0 ? Math.ceil(remaining / monthlyTargetVal) : null;

        return NextResponse.json({
            data: {
                ...account,
                balance,
                target,
                progress: Math.round(progress * 100) / 100,
                monthlyTarget: Number(account.monthlyTarget ?? 0),
                stats: {
                    totalDeposits,
                    monthlyDeposits,
                    depositCount,
                    remaining,
                    monthsRemaining,
                    isTargetReached: target > 0 && balance >= target,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/savings/[accountId] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch account detail" },
            { status: 500 }
        );
    }
}
