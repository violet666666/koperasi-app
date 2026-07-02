import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../middleware";
import { canAccessBranch } from "@/lib/mobile-auth-scope";
import { logAudit } from "@/lib/audit-logger";
import {
    calcPaymentCbReversalAmount,
    buildScheduleRollbackOps,
    buildLoanRollbackData,
    buildPaymentVoidResponse,
    type AllocationReversal,
} from "@/lib/payment-void-helpers";

// POST /api/mobile/loan-payment-void — Void a single loan payment (atomic reversal).
// Mirrors web api/loans/[id]/payments/[paymentId]/void, reusing payment-void-helpers.
export async function POST(request: Request) {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Hanya Operator yang dapat membatalkan pembayaran angsuran." }, { status: 403 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const paymentId = Number(body.paymentId);
        const reason = (body.reason as string | undefined)?.trim() || "Dibatalkan oleh Operator";

        if (!paymentId || Number.isNaN(paymentId)) {
            return NextResponse.json({ message: "paymentId wajib diisi" }, { status: 400 });
        }

        // ── Fetch payment with allocations ──
        const payment = await prisma.loanPayment.findUnique({
            where: { id: paymentId },
            include: { allocations: true },
        });
        if (!payment) {
            return NextResponse.json({ message: "Pembayaran tidak ditemukan" }, { status: 404 });
        }
        if (payment.status === "voided") {
            return NextResponse.json({ message: "Pembayaran ini sudah dibatalkan (VOID)" }, { status: 400 });
        }

        const branchOk = canAccessBranch(user, payment.branchId);
        if (!branchOk.allowed) {
            return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
        }

        const loanId = payment.loanId;

        // ── Fetch loan ──
        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        if (!loan) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan" }, { status: 404 });
        }
        if (loan.status === "voided" || loan.status === "written_off") {
            return NextResponse.json(
                { message: "Tidak dapat membatalkan pembayaran pada pinjaman yang sudah dibatalkan/dihapusbukukan" },
                { status: 400 },
            );
        }

        // ── Prepare reversal data ──
        const allocations: AllocationReversal[] = payment.allocations.map((a) => ({
            scheduleId: a.scheduleId,
            principalAmount: Number(a.principalAmount),
            interestAmount: Number(a.interestAmount),
            lateFeeAmount: Number(a.lateFeeAmount),
        }));

        // ── Atomic Transaction (mirror web steps 1-9) ──
        const result = await prisma.$transaction(async (tx) => {
            // 1. Fresh schedules inside tx
            const scheduleIds = allocations.map((a) => a.scheduleId);
            const currentSchedules = await tx.loanSchedule.findMany({ where: { id: { in: scheduleIds } } });
            const mappedSchedules = currentSchedules.map((s) => ({
                id: s.id,
                principalAmount: Number(s.principalAmount),
                interestAmount: Number(s.interestAmount),
                lateFee: Number(s.lateFee),
                principalPaid: Number(s.principalPaid),
                interestPaid: Number(s.interestPaid),
                lateFeePaid: Number(s.lateFeePaid),
                status: s.status,
                paidDate: s.paidDate,
            }));

            // 2. Rollback allocated schedules
            const rollbackOps = buildScheduleRollbackOps(allocations, mappedSchedules);
            for (const op of rollbackOps) {
                await tx.loanSchedule.update({ where: { id: op.scheduleId }, data: op.data });
            }

            // 2b. Early-settlement: revert unallocated schedules that were batch-marked paid
            if (payment.paymentType === "early_settlement") {
                const allocatedIds = allocations.map((a) => a.scheduleId);
                const unallocatedPaid = await tx.loanSchedule.findMany({
                    where: { loanId, id: { notIn: allocatedIds }, status: "paid" },
                });
                for (const s of unallocatedPaid) {
                    await tx.loanSchedule.update({ where: { id: s.id }, data: { status: "pending", paidDate: null } });
                }
            }

            // 3. CashBankTransactions linked to this payment
            const cbTransactions = await tx.cashBankTransaction.findMany({
                where: { referenceType: "LoanPayment", referenceId: payment.id },
            });

            // 4. Total CB reversal amount
            const cbReversalAmount = calcPaymentCbReversalAmount(
                cbTransactions.map((cb) => ({ type: cb.type, amount: Number(cb.amount) })),
            );

            // 5. Reverse CashBankAccount balance
            let cbReversed = false;
            if (payment.cashBankAccountId && cbReversalAmount > 0) {
                const cbAccount = await tx.cashBankAccount.findUnique({ where: { id: payment.cashBankAccountId } });
                if (cbAccount) {
                    const newBalance = Number(cbAccount.currentBalance) - cbReversalAmount;
                    await tx.cashBankAccount.update({
                        where: { id: payment.cashBankAccountId },
                        data: { currentBalance: Math.max(0, newBalance) },
                    });
                    cbReversed = true;
                }
            }

            // 6. Delete CB transactions
            if (cbTransactions.length > 0) {
                await tx.cashBankTransaction.deleteMany({
                    where: { referenceType: "LoanPayment", referenceId: payment.id },
                });
            }

            // 7. Delete LoanPaymentAllocation records
            await tx.loanPaymentAllocation.deleteMany({ where: { paymentId: payment.id } });

            // 8. Void the payment
            const voidedPayment = await tx.loanPayment.update({
                where: { id: payment.id },
                data: { status: "voided", voidedAt: new Date(), voidedById: Number(user.id), voidReason: reason },
            });

            // 9. Reverse loan counters
            const loanRollbackData = buildLoanRollbackData(
                {
                    principalPortion: Number(payment.principalPortion),
                    interestPortion: Number(payment.interestPortion),
                    lateFeePortion: Number(payment.lateFeePortion),
                    paymentType: payment.paymentType,
                    earlySettlementFee: Number(payment.earlySettlementFee),
                },
                loan.status,
            );

            // Early-settlement: recalc outstanding from actual schedule state
            if (payment.paymentType === "early_settlement") {
                const allSchedules = await tx.loanSchedule.findMany({ where: { loanId } });
                const totalPrincipalOut = allSchedules.reduce((s, x) => s + Number(x.principalAmount) - Number(x.principalPaid), 0);
                const totalInterestOut = allSchedules.reduce((s, x) => s + Number(x.interestAmount) - Number(x.interestPaid), 0);
                loanRollbackData.principalOutstanding = Math.max(0, totalPrincipalOut);
                loanRollbackData.interestOutstanding = Math.max(0, totalInterestOut);
                loanRollbackData.status = "active";
                loanRollbackData.paidOffDate = null;
            }

            await tx.loan.update({ where: { id: loanId }, data: loanRollbackData });

            return {
                voidedPayment,
                cbReversed,
                cbReversalAmount,
                schedulesRolledBack: rollbackOps.length,
                loanReactivated: loan.status === "paid_off",
            };
        }, { timeout: 30000 });

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "UPDATE",
            module: "Pinjaman",
            description: `Void pembayaran angsuran ${payment.paymentNo} (Rp ${Number(payment.amount).toLocaleString("id-ID")}) pada pinjaman ID ${loanId} via mobile`,
            ipAddress: "mobile-app",
        });

        const response = buildPaymentVoidResponse({
            paymentNo: payment.paymentNo,
            principalReversed: Number(payment.principalPortion),
            interestReversed: Number(payment.interestPortion),
            lateFeeReversed: Number(payment.lateFeePortion),
            cbReversed: result.cbReversed,
            cbAmount: result.cbReversalAmount,
            schedulesRolledBack: result.schedulesRolledBack,
            loanReactivated: result.loanReactivated,
            reason,
        });

        return NextResponse.json({
            message: response.message,
            detail: response.detail,
            data: { paymentId: payment.id, status: "voided" },
        });
    } catch (error) {
        console.error("POST /api/mobile/loan-payment-void error:", error);
        return NextResponse.json({ message: "Gagal membatalkan pembayaran" }, { status: 500 });
    }
}
