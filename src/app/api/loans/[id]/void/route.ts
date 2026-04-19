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

        // Only Operator can void loans
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
                _count: {
                    select: { payments: true }
                }
            }
        });

        if (!loan) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan" }, { status: 404 });
        }

        // Business Rule: Cannot void if there are payments
        if (loan._count.payments > 0 || Number(loan.principalPaid) > 0 || Number(loan.interestPaid) > 0) {
            return NextResponse.json(
                { message: "Pinjaman tidak dapat dibatalkan (VOID) karena sudah memiliki riwayat angsuran/pembayaran." },
                { status: 400 }
            );
        }

        if (loan.status === "voided" || loan.status === "written_off") {
            return NextResponse.json({ message: "Pinjaman sudah dibatalkan atau dihapusbukukan." }, { status: 400 });
        }

        // Execute Wipe Transaction
        await prisma.$transaction(async (tx) => {
            // 1. Delete all schedules
            await tx.loanSchedule.deleteMany({
                where: { loanId: loan.id }
            });

            // 2. Revert CashBank Transaction
            if (loan.disbursementCashBankId) {
                const cbTx = await tx.cashBankTransaction.findUnique({
                    where: { id: loan.disbursementCashBankId }
                });
                
                if (cbTx) {
                    // Reverse the balance (it was an OUT transfer, so we ADD it back)
                    await tx.cashBankAccount.update({
                        where: { id: cbTx.accountId },
                        data: {
                            currentBalance: {
                                increment: cbTx.amount
                            }
                        }
                    });
                    
                    // Delete the transaction Jejak
                    await tx.cashBankTransaction.delete({
                        where: { id: cbTx.id }
                    });
                }
            }

            // 3. Revert Journal
            if (loan.disbursementJournalId) {
                await tx.journalEntry.deleteMany({
                    where: { journalId: loan.disbursementJournalId }
                });
                await tx.journal.delete({
                    where: { id: loan.disbursementJournalId }
                });
            }

            // 4. Update the source Application to "cancelled" so it sits quietly in history
            await tx.loanApplication.update({
                where: { id: loan.applicationId },
                data: {
                    status: "cancelled",
                    rejectionReason: "Dibatalkan secara kolektif (VOID) oleh Operator setelah pencairan."
                }
            });

            // 5. Finally, Wipe the Loan Record itself or set it to voided 
            // Setting to voided if deletion causes relationship issues, but we already assured 0 payments.
            // Since user allowed pure WIPING, we will wipe the Loan Record to totally clean the accounting.
            await tx.loan.delete({
                where: { id: loan.id }
            });
        });

        return NextResponse.json({ 
            message: "Pinjaman berhasil dibatalkan (VOID). Jurnal kas bank telah di-rollback.",
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
