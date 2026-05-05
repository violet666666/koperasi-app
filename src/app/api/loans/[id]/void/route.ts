import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

        if (role !== "operator") {
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

        await prisma.$transaction(async (tx) => {
            // 1. If payments exist, reverse them first
            if (hasPayments) {
                // Delete payment allocations (must come before payments/schedules)
                await tx.loanPaymentAllocation.deleteMany({
                    where: { paymentId: { in: loan.payments.map(p => p.id) } },
                });

                // Reverse each payment's cash/bank and journal entries
                for (const payment of loan.payments) {
                    // Delete payment-level CashBankTransaction records
                    await tx.cashBankTransaction.deleteMany({
                        where: {
                            referenceType: "LoanPayment",
                            referenceId: payment.id,
                        },
                    });

                    // Reverse cash/bank balance — payment was IN, so SUBTRACT
                    if (payment.cashBankAccountId) {
                        await tx.cashBankAccount.update({
                            where: { id: payment.cashBankAccountId },
                            data: { currentBalance: { decrement: payment.amount } }
                        });
                    }

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
            if (loan.disbursementCashBankId) {
                const cbTx = await tx.cashBankTransaction.findUnique({
                    where: { id: loan.disbursementCashBankId }
                });

                if (cbTx) {
                    // Disbursement was OUT, so ADD it back
                    await tx.cashBankAccount.update({
                        where: { id: cbTx.accountId },
                        data: { currentBalance: { increment: cbTx.amount } }
                    });
                    await tx.cashBankTransaction.delete({ where: { id: cbTx.id } });
                }
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

                    if (kompenPayment) {
                        // Reverse cash/bank for the kompen payment
                        if (kompenPayment.cashBankAccountId) {
                            await tx.cashBankAccount.update({
                                where: { id: kompenPayment.cashBankAccountId },
                                data: { currentBalance: { decrement: kompenPayment.amount } }
                            });
                        }
                        // Delete kompen payment allocations and payment
                        await tx.loanPaymentAllocation.deleteMany({ where: { paymentId: kompenPayment.id } });
                        await tx.cashBankTransaction.deleteMany({
                            where: { referenceType: "LoanPayment", referenceId: kompenPayment.id },
                        });
                        if (kompenPayment.journalId) {
                            await tx.journalLine.deleteMany({ where: { journalId: kompenPayment.journalId } });
                            await tx.journal.delete({ where: { id: kompenPayment.journalId } });
                        }
                        await tx.loanPayment.delete({ where: { id: kompenPayment.id } });
                    }

                    // Re-open the old loan
                    await tx.loan.update({
                        where: { id: oldLoan.id },
                        data: {
                            status: "active",
                            paidOffDate: null,
                            principalOutstanding: kompenPayment ? kompenPayment.principalPortion : oldLoan.principalAmount,
                            interestOutstanding: oldLoan.interestAmount,
                            principalPaid: kompenPayment
                                ? Number(oldLoan.principalPaid) - Number(kompenPayment.principalPortion)
                                : 0,
                        },
                    });

                    // Re-open old schedules that were paid by kompen
                    await tx.loanSchedule.updateMany({
                        where: {
                            loanId: oldLoan.id,
                            status: "paid",
                            notes: { contains: "KOMPEN" },
                        },
                        data: { status: "pending", paidDate: null, notes: null },
                    });
                }
            }

            // 7. Void the loan (set status instead of deleting to preserve kompen linkage)
            await tx.loan.update({
                where: { id: loan.id },
                data: { status: "voided" },
            });
        });

        const msg = hasPayments
            ? `Pinjaman berhasil dibatalkan (VOID) beserta ${loan._count.payments} riwayat pembayaran. Jurnal kas bank telah di-rollback.`
            : "Pinjaman berhasil dibatalkan (VOID). Jurnal kas bank telah di-rollback.";

        return NextResponse.json({
            message: msg,
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
