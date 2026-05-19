import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST() {
    const session = await auth();
    if (!session?.user || !["operator", "admin", "admin_sp"].includes(session.user.role)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // All non-import loans
    const allLoans = await prisma.loan.findMany({
        where: {
            status: { in: ["active", "paid_off"] },
            loanNo: { not: { startsWith: "SP-IMP/" } },
        },
        select: {
            id: true,
            loanNo: true,
            principalAmount: true,
            disbursedAmount: true,
            status: true,
            disbursementDate: true,
            disbursementCashBankId: true,
            branchId: true,
            member: { select: { name: true } },
        },
        orderBy: { id: "asc" },
    });

    // Cash bank transactions for these loans
    const loanIds = allLoans.map(l => l.id);
    const cashTxs = await prisma.cashBankTransaction.findMany({
        where: {
            referenceType: "Loan",
            referenceId: { in: loanIds },
        },
        select: {
            referenceId: true,
            transactionNo: true,
            amount: true,
            accountId: true,
            account: { select: { code: true, name: true } },
        },
    });

    const cashTxMap = new Map(cashTxs.map(t => [t.referenceId, t]));
    const loansWithCash = allLoans.filter(l => cashTxMap.has(l.id));
    const loansWithoutCash = allLoans.filter(l => !cashTxMap.has(l.id));

    // Also check: PJM specifically
    const pjmLoans = allLoans.filter(l => l.loanNo.startsWith("PJM-"));
    const pjmWithCash = pjmLoans.filter(l => cashTxMap.has(l.id));
    const pjmWithoutCash = pjmLoans.filter(l => !cashTxMap.has(l.id));

    return NextResponse.json({
        summary: {
            totalNonImportLoans: allLoans.length,
            loansWithCashTx: loansWithCash.length,
            loansWithoutCashTx: loansWithoutCash.length,
            pjmTotal: pjmLoans.length,
            pjmWithCash: pjmWithCash.length,
            pjmWithoutCash: pjmWithoutCash.length,
        },
        missing: loansWithoutCash.map(l => ({
            id: l.id,
            loanNo: l.loanNo,
            member: l.member.name,
            principalAmount: Number(l.principalAmount),
            disbursedAmount: Number(l.disbursedAmount),
            status: l.status,
            disbursementDate: l.disbursementDate?.toISOString().split("T")[0],
            hasCashBankLink: !!l.disbursementCashBankId,
        })),
        existingCashTxs: cashTxs.map(t => ({
            loanId: t.referenceId,
            txNo: t.transactionNo,
            amount: Number(t.amount),
            account: t.account?.code,
            accountName: t.account?.name,
        })),
    });
}
