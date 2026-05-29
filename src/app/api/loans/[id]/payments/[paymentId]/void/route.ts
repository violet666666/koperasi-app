import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAuditFromRequest } from "@/lib/audit-logger";
import {
    calcPaymentCbReversalAmount,
    buildScheduleRollbackOps,
    buildLoanRollbackData,
    buildPaymentVoidResponse,
    type AllocationReversal,
} from "@/lib/payment-void-helpers";

interface RouteParams {
    params: Promise<{ id: string; paymentId: string }>;
}

// POST /api/loans/[id]/payments/[paymentId]/void
export async function POST(request: NextRequest, { params }: RouteParams) {
    const startTime = Date.now();
    try {
        // ── Auth ──────────────────────────────────────────────────
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const userId = Number((session.user as any).id);
        const roleName =
            typeof session.user.role === "string"
                ? session.user.role
                : (session.user.role as any)?.name;
        if (!["operator", "admin_sp"].includes(roleName)) {
            return NextResponse.json(
                { message: "Hanya Operator yang dapat membatalkan pembayaran angsuran." },
                { status: 403 }
            );
        }

        // ── Parse params ──────────────────────────────────────────
        const resolvedParams = await params;
        const loanId = parseInt(resolvedParams.id);
        const paymentId = parseInt(resolvedParams.paymentId);
        if (isNaN(loanId) || isNaN(paymentId)) {
            return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });
        }

        // ── Parse body ────────────────────────────────────────────
        const body = await request.json().catch(() => ({}));
        const reason = (body.reason as string)?.trim() || "Dibatalkan oleh Operator";

        // ── Fetch payment with allocations ────────────────────────
        const payment = await prisma.loanPayment.findUnique({
            where: { id: paymentId },
            include: {
                allocations: true,
            },
        });

        if (!payment) {
            return NextResponse.json({ message: "Pembayaran tidak ditemukan" }, { status: 404 });
        }

        if (payment.loanId !== loanId) {
            return NextResponse.json(
                { message: "Pembayaran tidak termasuk dalam pinjaman ini" },
                { status: 400 }
            );
        }

        if (payment.status === "voided") {
            return NextResponse.json(
                { message: "Pembayaran ini sudah dibatalkan (VOID)" },
                { status: 400 }
            );
        }

        // ── Fetch loan ────────────────────────────────────────────
        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
        });

        if (!loan) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan" }, { status: 404 });
        }

        // Prevent voiding payments on voided/written_off loans
        if (loan.status === "voided" || loan.status === "written_off") {
            return NextResponse.json(
                { message: "Tidak dapat membatalkan pembayaran pada pinjaman yang sudah dibatalkan/dihapusbukukan" },
                { status: 400 }
            );
        }

        // ── Prepare reversal data ────────────────────────────────
        const allocations: AllocationReversal[] = payment.allocations.map((a) => ({
            scheduleId: a.scheduleId,
            principalAmount: Number(a.principalAmount),
            interestAmount: Number(a.interestAmount),
            lateFeeAmount: Number(a.lateFeeAmount),
        }));

        // ── Atomic Transaction ────────────────────────────────────
        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch current schedules (fresh inside tx for accuracy)
            const scheduleIds = allocations.map((a) => a.scheduleId);
            const currentSchedules = await tx.loanSchedule.findMany({
                where: { id: { in: scheduleIds } },
            });

            // 2. Rollback LoanSchedule entries
            const rollbackOps = buildScheduleRollbackOps(allocations, currentSchedules);
            for (const op of rollbackOps) {
                await tx.loanSchedule.update({
                    where: { id: op.scheduleId },
                    data: op.data,
                });
            }

            // 3. Fetch CashBankTransactions linked to this payment
            const cbTransactions = await tx.cashBankTransaction.findMany({
                where: {
                    referenceType: "LoanPayment",
                    referenceId: payment.id,
                },
            });

            // 4. Calculate total CB reversal amount
            const cbReversalAmount = calcPaymentCbReversalAmount(
                cbTransactions.map((cb) => ({ type: cb.type, amount: Number(cb.amount) }))
            );

            // 5. Reverse CashBankAccount balance (decrement — payment was kas masuk)
            let cbReversed = false;
            if (payment.cashBankAccountId && cbReversalAmount > 0) {
                const cbAccount = await tx.cashBankAccount.findUnique({
                    where: { id: payment.cashBankAccountId },
                });
                if (cbAccount) {
                    const newBalance = Number(cbAccount.currentBalance) - cbReversalAmount;
                    await tx.cashBankAccount.update({
                        where: { id: payment.cashBankAccountId },
                        data: { currentBalance: Math.max(0, newBalance) },
                    });
                    cbReversed = true;
                }
            }

            // 6. Delete CashBankTransaction records
            if (cbTransactions.length > 0) {
                await tx.cashBankTransaction.deleteMany({
                    where: {
                        referenceType: "LoanPayment",
                        referenceId: payment.id,
                    },
                });
            }

            // 7. Delete LoanPaymentAllocation records
            await tx.loanPaymentAllocation.deleteMany({
                where: { paymentId: payment.id },
            });

            // 8. Soft-delete (void) the payment
            const voidedPayment = await tx.loanPayment.update({
                where: { id: payment.id },
                data: {
                    status: "voided",
                    voidedAt: new Date(),
                    voidedById: userId,
                    voidReason: reason,
                },
            });

            // 9. Update Loan counters (reverse the payment's effect)
            const loanRollbackData = buildLoanRollbackData(
                {
                    principalPortion: Number(payment.principalPortion),
                    interestPortion: Number(payment.interestPortion),
                    lateFeePortion: Number(payment.lateFeePortion),
                    paymentType: payment.paymentType,
                    earlySettlementFee: Number(payment.earlySettlementFee),
                },
                loan.status
            );

            // For early_settlement: also restore outstanding to pre-payment values
            if (payment.paymentType === "early_settlement") {
                // Early settlement set outstanding to 0 and status to paid_off.
                // Reverse: restore outstanding from payment portions.
                loanRollbackData.principalOutstanding = Number(payment.principalPortion);
                loanRollbackData.interestOutstanding = Number(payment.interestPortion);
                loanRollbackData.status = "active";
                loanRollbackData.paidOffDate = null;
            }

            await tx.loan.update({
                where: { id: loanId },
                data: loanRollbackData,
            });

            return {
                voidedPayment,
                cbReversed,
                cbReversalAmount,
                schedulesRolledBack: rollbackOps.length,
                loanReactivated: loan.status === "paid_off",
            };
        }, { timeout: 30000 });

        // ── Audit Log ─────────────────────────────────────────────
        await logAuditFromRequest(request, session, {
            action: "VOID_PAYMENT" as any,
            module: "pinjaman" as any,
            description: `Void pembayaran angsuran ${payment.paymentNo} (Rp ${Number(payment.amount).toLocaleString("id-ID")}) pada pinjaman ID ${loanId}`,
            targetId: paymentId,
            targetType: "LoanPayment",
            oldData: {
                status: "completed",
                amount: Number(payment.amount),
                principalPortion: Number(payment.principalPortion),
                interestPortion: Number(payment.interestPortion),
            },
            newData: {
                status: "voided",
                voidReason: reason,
                cbReversed: result.cbReversed,
                schedulesRolledBack: result.schedulesRolledBack,
            },
            status: "success",
            duration: Date.now() - startTime,
        });

        // ── Response ──────────────────────────────────────────────
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
        console.error("Error voiding payment:", error);
        const detail = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { message: `Gagal membatalkan pembayaran: ${detail}` },
            { status: 500 }
        );
    }
}
