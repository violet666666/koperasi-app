import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/member-portal/haji-umrah
// Member's own Haji & Umrah savings accounts (tabungan_haji / tabungan_umrah) with
// progress tracking, deposit history, and any active talangan loan. View-only.
//
// Auth model mirrors the rest of the member portal: the logged-in user is resolved
// to a member via session.user.memberId, and all queries are scoped to that member.
// Unlike the admin /api/haji-umrah/* endpoints (operator/admin RBAC), this route
// never accepts a memberId parameter from the client — it always uses the session.
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || !session.user.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const memberId = session.user.memberId;

        // 1. Fetch this member's H&U savings accounts (both active and closed — members
        //    should still see their history on closed accounts)
        const accounts = await prisma.savingsAccount.findMany({
            where: {
                memberId,
                product: { type: { in: ["tabungan_haji", "tabungan_umrah"] } },
            },
            include: {
                product: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        type: true,
                        targetAmount: true,
                        linkedBankName: true,
                    },
                },
                // Exclude voided transactions — members should only see real deposits
                transactions: {
                    where: { status: { not: "voided" } },
                    select: {
                        id: true,
                        transactionNo: true,
                        type: true,
                        amount: true,
                        notes: true,
                        transactionDate: true,
                        referenceNo: true,
                    },
                    orderBy: { transactionDate: "desc" },
                    take: 50,
                },
            },
            orderBy: { createdAt: "asc" },
        });

        // 2. Fetch talangan loans linked to these accounts (Phase 2B denormalized
        //    linkedSavingsAccountId). Status active OR paid_off so members see history.
        const accountIds = accounts.map((a) => a.id);
        const talanganLoans =
            accountIds.length > 0
                ? await prisma.loan.findMany({
                      where: {
                          memberId,
                          linkedSavingsAccountId: { in: accountIds },
                          status: { in: ["active", "paid_off"] },
                      },
                      select: {
                          id: true,
                          loanNo: true,
                          status: true,
                          principalOutstanding: true,
                          interestOutstanding: true,
                          monthlyInstallment: true,
                          tenorMonths: true,
                          linkedSavingsAccountId: true,
                          lastDueDate: true,
                          // Next unpaid schedule for "cicilan jatuh tempo berikutnya"
                          schedules: {
                              where: { status: { in: ["pending", "partial", "overdue"] } },
                              select: { dueDate: true, totalAmount: true, status: true },
                              orderBy: { dueDate: "asc" },
                              take: 1,
                          },
                      },
                  })
                : [];

        // Index talangan by linked savings account for O(1) lookup per account
        const talanganByAccount = new Map<number, (typeof talanganLoans)[number]>();
        for (const loan of talanganLoans) {
            if (loan.linkedSavingsAccountId) {
                talanganByAccount.set(loan.linkedSavingsAccountId, loan);
            }
        }

        // 3. Build per-account view
        const now = new Date();
        const accountViews = accounts.map((acc) => {
            const balance = Number(acc.balance);
            // Account-level target overrides product-level target (set saat buka rekening)
            const productTarget = acc.product.targetAmount ? Number(acc.product.targetAmount) : 0;
            const target = acc.targetAmount ? Number(acc.targetAmount) : productTarget;
            const progress = target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : 0;
            const remaining = Math.max(0, target - balance);

            // Deposit stats (this month + all-time)
            const deposits = acc.transactions.filter((t) => t.type === "deposit");
            const totalDeposits = deposits.reduce((sum, t) => sum + Number(t.amount), 0);
            const monthlyDeposits = deposits
                .filter(
                    (t) =>
                        t.transactionDate.getFullYear() === now.getFullYear() &&
                        t.transactionDate.getMonth() === now.getMonth(),
                )
                .reduce((sum, t) => sum + Number(t.amount), 0);

            // Months remaining until maturity (rough estimate for countdown)
            let monthsRemaining: number | null = null;
            if (acc.maturityDate && remaining > 0) {
                const msDiff = new Date(acc.maturityDate).getTime() - now.getTime();
                const months = Math.ceil(msDiff / (1000 * 60 * 60 * 24 * 30));
                monthsRemaining = months > 0 ? months : 0;
            }

            const talangan = talanganByAccount.get(acc.id);

            return {
                id: acc.id,
                accountNo: acc.accountNo,
                status: acc.status,
                createdAt: acc.createdAt,
                product: {
                    name: acc.product.name,
                    code: acc.product.code,
                    type: acc.product.type,
                    linkedBankName: acc.product.linkedBankName,
                },
                balance,
                target,
                progress,
                remaining,
                monthlyTarget: acc.monthlyTarget ? Number(acc.monthlyTarget) : 0,
                maturityDate: acc.maturityDate,
                monthsRemaining,
                isTargetReached: target > 0 && balance >= target,
                stats: {
                    totalDeposits,
                    monthlyDeposits,
                    depositCount: deposits.length,
                },
                transactions: acc.transactions.map((t) => ({
                    id: t.id,
                    transactionNo: t.transactionNo,
                    type: t.type,
                    amount: Number(t.amount),
                    notes: t.notes,
                    transactionDate: t.transactionDate,
                    referenceNo: t.referenceNo,
                })),
                talangan: talangan
                    ? {
                          loanNo: talangan.loanNo,
                          status: talangan.status,
                          outstanding:
                              Number(talangan.principalOutstanding) + Number(talangan.interestOutstanding),
                          monthlyInstallment: Number(talangan.monthlyInstallment),
                          tenorMonths: talangan.tenorMonths,
                          nextDueDate: talangan.schedules[0]?.dueDate ?? null,
                          nextDueAmount: talangan.schedules[0] ? Number(talangan.schedules[0].totalAmount) : null,
                          lastDueDate: talangan.lastDueDate,
                      }
                    : null,
            };
        });

        // 4. Aggregate summary
        const totalBalance = accountViews.reduce((sum, a) => sum + a.balance, 0);
        const totalTarget = accountViews.reduce((sum, a) => sum + a.target, 0);
        const overallProgress =
            totalTarget > 0 ? Math.min(100, Math.round((totalBalance / totalTarget) * 100)) : 0;
        const activeTalangan = accountViews.filter((a) => a.talangan?.status === "active");
        const totalTalanganOutstanding = activeTalangan.reduce(
            (sum, a) => sum + (a.talangan?.outstanding ?? 0),
            0,
        );

        return NextResponse.json({
            data: {
                summary: {
                    totalBalance,
                    totalTarget,
                    overallProgress,
                    accountCount: accountViews.length,
                    activeTalanganCount: activeTalangan.length,
                    totalTalanganOutstanding,
                },
                accounts: accountViews,
            },
        });
    } catch (error) {
        console.error("GET /api/member-portal/haji-umrah error:", error);
        return NextResponse.json(
            { message: "Failed to fetch Haji & Umrah data" },
            { status: 500 },
        );
    }
}
