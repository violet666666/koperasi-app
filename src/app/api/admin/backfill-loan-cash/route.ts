import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode: "dryRun" | "execute" = body.mode === "execute" ? "execute" : "dryRun";

    try {
        // Find all loans that do NOT have a matching CashBankTransaction
        const allLoans = await prisma.loan.findMany({
            where: { status: { in: ["active", "paid_off"] } },
            include: { member: { select: { id: true, name: true, branchId: true } } },
        });

        const loanIdsWithCashTx = new Set(
            (await prisma.cashBankTransaction.findMany({
                where: { referenceType: "Loan", referenceId: { in: allLoans.map((l) => l.id) } },
                select: { referenceId: true },
            })).map((cb) => cb.referenceId!)
        );

        const missingLoans = allLoans.filter((l) => !loanIdsWithCashTx.has(l.id));

        if (missingLoans.length === 0) {
            return NextResponse.json({
                message: "Semua pinjaman sudah memiliki CashBankTransaction. Tidak ada yang perlu di-backfill.",
                total: 0,
            });
        }

        const results: Array<{
            loanId: number;
            loanNo: string;
            memberName: string;
            disbursedAmount: number;
            disbursementDate: string;
            status: "will_create" | "created" | "skipped_no_account" | "error";
            error?: string;
        }> = [];

        if (mode === "execute") {
            for (const loan of missingLoans) {
                const branchId = loan.member.branchId ?? loan.branchId;
                const cashAccount = await prisma.cashBankAccount.findFirst({
                    where: { branchId, isActive: true },
                    orderBy: { id: "asc" },
                });

                if (!cashAccount) {
                    results.push({
                        loanId: loan.id,
                        loanNo: loan.loanNo,
                        memberName: loan.member.name,
                        disbursedAmount: Number(loan.disbursedAmount),
                        disbursementDate: loan.disbursementDate.toISOString().split("T")[0],
                        status: "skipped_no_account",
                        error: `Tidak ada akun Kas/Bank aktif untuk branch ${branchId}`,
                    });
                    continue;
                }

                const disbursedAmount = Number(loan.disbursedAmount);
                const balBefore = Number(cashAccount.currentBalance);
                const balAfter = balBefore - disbursedAmount;

                try {
                    await prisma.$transaction(async (tx) => {
                        await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `CBM-PJM-${loan.loanNo}`,
                                accountId: cashAccount.id,
                                branchId,
                                type: "out",
                                category: "pencairan_pinjaman",
                                amount: disbursedAmount,
                                balanceBefore: balBefore,
                                balanceAfter: balAfter,
                                referenceType: "Loan",
                                referenceId: loan.id,
                                unitType: "simpan_pinjam",
                                description: `[BACKFILL] Pencairan Pinjaman ${loan.loanNo} untuk ${loan.member.name}`,
                                transactionDate: loan.disbursementDate,
                                memberId: loan.memberId,
                                createdById: parseInt(session.user.id),
                            },
                        });

                        await tx.cashBankAccount.update({
                            where: { id: cashAccount.id },
                            data: { currentBalance: balAfter },
                        });

                        await tx.loan.update({
                            where: { id: loan.id },
                            data: { disbursementCashBankId: cashAccount.id },
                        });
                    });

                    results.push({
                        loanId: loan.id,
                        loanNo: loan.loanNo,
                        memberName: loan.member.name,
                        disbursedAmount,
                        disbursementDate: loan.disbursementDate.toISOString().split("T")[0],
                        status: "created",
                    });
                } catch (err: any) {
                    results.push({
                        loanId: loan.id,
                        loanNo: loan.loanNo,
                        memberName: loan.member.name,
                        disbursedAmount,
                        disbursementDate: loan.disbursementDate.toISOString().split("T")[0],
                        status: "error",
                        error: err.message ?? "Unknown error",
                    });
                }
            }
        } else {
            // dryRun — preview only
            for (const loan of missingLoans) {
                results.push({
                    loanId: loan.id,
                    loanNo: loan.loanNo,
                    memberName: loan.member.name,
                    disbursedAmount: Number(loan.disbursedAmount),
                    disbursementDate: loan.disbursementDate.toISOString().split("T")[0],
                    status: "will_create",
                });
            }
        }

        return NextResponse.json({
            mode,
            totalMissing: missingLoans.length,
            results,
            summary: {
                willCreate: results.filter((r) => r.status === "will_create").length,
                created: results.filter((r) => r.status === "created").length,
                skipped: results.filter((r) => r.status === "skipped_no_account").length,
                errors: results.filter((r) => r.status === "error").length,
            },
        });
    } catch (error: any) {
        console.error("[backfill-loan-cash]", error);
        return NextResponse.json(
            { message: "Gagal menjalankan backfill", error: error.message },
            { status: 500 }
        );
    }
}
