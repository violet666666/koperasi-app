import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcPaymentReversalAmount, buildKompenReversalUpdate, buildVoidResponse } from "@/lib/loan-void-helpers";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = typeof session.user.role === "string"
            ? session.user.role
            : (session.user.role as any)?.name;

        if (!["operator", "admin_sp"].includes(role)) {
            return NextResponse.json({ message: "Hanya Operator yang diizinkan untuk membatalkan pinjaman." }, { status: 403 });
        }

        const resolvedParams = await params;
        const loanId = parseInt(resolvedParams.id);
        if (isNaN(loanId)) {
            return NextResponse.json({ message: "ID pinjaman tidak valid" }, { status: 400 });
        }

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                payments: {
                    select: {
                        id: true,
                        journalId: true,
                        cashBankAccountId: true,
                        amount: true,
                        paymentType: true,
                        earlySettlementFee: true,
                        principalPortion: true,
                    },
                },
                _count: {
                    select: { payments: true }
                }
            }
        });

        if (!loan) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan" }, { status: 404 });
        }

        if (loan.status === "voided" || loan.status === "written_off") {
            return NextResponse.json({ message: "Pinjaman sudah dibatalkan atau dihapusbukukan." }, { status: 400 });
        }

        const hasPayments = loan._count.payments > 0;

        let disbursementReversed = false;
        let kompenReversed = false;
        let oldLoanId: number | undefined;

        await prisma.$transaction(async (tx) => {
            // 1. If payments exist, reverse them first
            if (hasPayments) {
                // Delete payment allocations (must come before payments/schedules)
                await tx.loanPaymentAllocation.deleteMany({
                    where: { paymentId: { in: loan.payments.map(p => p.id) } },
                });

                // Reverse each payment's cash/bank and journal entries
                for (const payment of loan.payments) {
                    // Fetch CB transactions FIRST to calculate exact reversal amount
                    const paymentCbTxns = await tx.cashBankTransaction.findMany({
                        where: {
                            referenceType: "LoanPayment",
                            referenceId: payment.id,
                        },
                    });

                    // Sum actual recorded amounts (avoids over-decrement from lateFee)
                    const reversalAmount = calcPaymentReversalAmount(
                        paymentCbTxns.map(cb => ({ type: cb.type, amount: Number(cb.amount) }))
                    );

                    // Reverse cash/bank balance — payment was IN, so SUBTRACT exact amount
                    if (payment.cashBankAccountId && reversalAmount > 0) {
                        await tx.cashBankAccount.update({
                            where: { id: payment.cashBankAccountId },
                            data: { currentBalance: { decrement: reversalAmount } }
                        });
                    }

                    // Delete payment-level CashBankTransaction records
                    await tx.cashBankTransaction.deleteMany({
                        where: {
                            referenceType: "LoanPayment",
                            referenceId: payment.id,
                        },
                    });

                    // Reverse journal for this payment
                    if (payment.journalId) {
                        await tx.journalLine.deleteMany({ where: { journalId: payment.journalId } });
                        await tx.journal.delete({ where: { id: payment.journalId } });
                    }
                }

                // Delete payment records
                await tx.loanPayment.deleteMany({
                    where: { loanId: loan.id }
                });
            }

            // 2. Delete all schedules
            await tx.loanSchedule.deleteMany({
                where: { loanId: loan.id }
            });

            // 3. Reverse disbursement CashBank transaction
            // Look up by referenceType + referenceId (not disbursementCashBankId which is an account FK)
            const disbursementCbTx = await tx.cashBankTransaction.findFirst({
                where: {
                    referenceType: "Loan",
                    referenceId: loan.id,
                    category: "pencairan_pinjaman",
                },
            });

            if (disbursementCbTx) {
                // Disbursement was OUT, so ADD it back
                await tx.cashBankAccount.update({
                    where: { id: disbursementCbTx.accountId },
                    data: { currentBalance: { increment: disbursementCbTx.amount } }
                });
                await tx.cashBankTransaction.delete({ where: { id: disbursementCbTx.id } });
                disbursementReversed = true;
            }

            // 4. Reverse disbursement Journal
            if (loan.disbursementJournalId) {
                await tx.journalLine.deleteMany({
                    where: { journalId: loan.disbursementJournalId }
                });
                await tx.journal.delete({
                    where: { id: loan.disbursementJournalId }
                });
            }

            // 5. Cancel the loan application
            await tx.loanApplication.update({
                where: { id: loan.applicationId },
                data: {
                    status: "cancelled",
                    rejectionReason: "Dibatalkan secara kolektif (VOID) oleh Operator setelah pencairan."
                }
            });

            // 6. Kompen reversal: if this loan compensated an old loan, re-open the old loan
            if (loan.compensatedLoanId) {
                const oldLoan = await tx.loan.findUnique({ where: { id: loan.compensatedLoanId } });
                if (oldLoan) {
                    // Find the early_settlement payment created by kompen on the old loan
                    const kompenPayment = await tx.loanPayment.findFirst({
                        where: {
                            loanId: oldLoan.id,
                            paymentType: "early_settlement",
                            notes: { contains: "KOMPEN" },
                        },
                    });

                    // Parse pre-kompen state stored in referenceNo
                    let preState: { principalOutstanding: number; interestOutstanding: number; principalPaid: number } | null = null;
                    if (kompenPayment?.referenceNo) {
                        try { preState = JSON.parse(kompenPayment.referenceNo); } catch { /* ignore */ }
                    }

                    if (kompenPayment) {
                        // Reverse CashBank transactions linked to this kompen payment
                        const kompenCbTxns = await tx.cashBankTransaction.findMany({
                            where: { referenceType: "LoanPayment", referenceId: kompenPayment.id },
                        });
                        for (const cbTx of kompenCbTxns) {
                            const balanceUpdate = buildKompenReversalUpdate({ type: cbTx.type, amount: Number(cbTx.amount) });
                            await tx.cashBankAccount.update({
                                where: { id: cbTx.accountId },
                                data: { currentBalance: balanceUpdate },
                            });
                            await tx.cashBankTransaction.delete({ where: { id: cbTx.id } });
                        }

                        // Delete kompen payment allocations and payment
                        await tx.loanPaymentAllocation.deleteMany({ where: { paymentId: kompenPayment.id } });
                        if (kompenPayment.journalId) {
                            await tx.journalLine.deleteMany({ where: { journalId: kompenPayment.journalId } });
                            await tx.journal.delete({ where: { id: kompenPayment.journalId } });
                        }
                        await tx.loanPayment.delete({ where: { id: kompenPayment.id } });
                    }

                    // Re-open the old loan with pre-kompen state
                    await tx.loan.update({
                        where: { id: oldLoan.id },
                        data: {
                            status: "active",
                            paidOffDate: null,
                            principalOutstanding: preState?.principalOutstanding ?? Number(oldLoan.principalAmount),
                            interestOutstanding: preState?.interestOutstanding ?? Number(oldLoan.interestAmount),
                            principalPaid: preState?.principalPaid ?? 0,
                        },
                    });

                    // Re-open old schedules that were batch-marked as paid by kompen
                    // Kompen marks all pending/partial/overdue schedules as paid on the disbursement date.
                    // We identify them by: status=paid AND paidDate matches the kompen loan's disbursement date.
                    await tx.loanSchedule.updateMany({
                        where: {
                            loanId: oldLoan.id,
                            status: "paid",
                            paidDate: loan.disbursementDate,
                        },
                        data: { status: "pending", paidDate: null },
                    });

                    kompenReversed = true;
                    oldLoanId = oldLoan.id;
                }
            }

            // 7. Void the loan (set status instead of deleting to preserve kompen linkage)
            await tx.loan.update({
                where: { id: loan.id },
                data: { status: "voided" },
            });
        }, { timeout: 30000 });

        const result = buildVoidResponse({
            paymentCount: hasPayments ? loan._count.payments : 0,
            disbursementReversed,
            kompenReversed,
            oldLoanId,
        });

        return NextResponse.json({
            message: result.message,
            detail: result.detail,
            status: "voided"
        });

    } catch (error) {
        console.error("Error voiding loan:", error);
        return NextResponse.json(
            { message: "Terjadi kesalahan internal server saat membatalkan pinjaman." },
            { status: 500 }
        );
    }
}
