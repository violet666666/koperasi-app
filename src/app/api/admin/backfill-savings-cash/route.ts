import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode: "dryRun" | "execute" = body.mode === "execute" ? "execute" : "dryRun";

    try {
        // Find savings transactions without a matching CashBankTransaction
        // They are linked via transactionNo convention: "CBT-" + savingsTx.transactionNo
        const savingsTx = await prisma.savingsTransaction.findMany({
            where: {
                status: "completed",
                cashBankAccountId: { not: null },
            },
            include: {
                member: { select: { id: true, name: true, branchId: true } },
            },
        });

        const existingCashTxNos = new Set(
            (await prisma.cashBankTransaction.findMany({
                where: {
                    transactionNo: { in: savingsTx.map((s) => `CBT-${s.transactionNo}`) },
                },
                select: { transactionNo: true },
            })).map((c) => c.transactionNo)
        );

        const missingTx = savingsTx.filter(
            (s) => !existingCashTxNos.has(`CBT-${s.transactionNo}`)
        );

        if (missingTx.length === 0) {
            return NextResponse.json({
                message: "Semua transaksi simpanan sudah memiliki CashBankTransaction. Tidak ada yang perlu di-backfill.",
                total: 0,
            });
        }

        const results: Array<{
            savingsTxId: number;
            transactionNo: string;
            memberName: string;
            type: string;
            amount: number;
            transactionDate: string;
            status: "will_create" | "created" | "skipped_no_account" | "error";
            error?: string;
        }> = [];

        if (mode === "execute") {
            for (const tx of missingTx) {
                const cashAccountId = tx.cashBankAccountId!;
                const cashAccount = await prisma.cashBankAccount.findUnique({
                    where: { id: cashAccountId },
                });

                if (!cashAccount) {
                    results.push({
                        savingsTxId: tx.id,
                        transactionNo: tx.transactionNo,
                        memberName: tx.member.name,
                        type: tx.type,
                        amount: Number(tx.amount),
                        transactionDate: tx.transactionDate.toISOString().split("T")[0],
                        status: "skipped_no_account",
                        error: `Akun Kas/Bank ID ${cashAccountId} tidak ditemukan`,
                    });
                    continue;
                }

                const amount = Number(tx.amount);
                const isDeposit = tx.type === "deposit" || tx.type === "interest";
                const balBefore = Number(cashAccount.currentBalance);
                const balAfter = isDeposit ? balBefore + amount : balBefore - amount;

                try {
                    await prisma.$transaction(async (prismaTx) => {
                        await prismaTx.cashBankTransaction.create({
                            data: {
                                transactionNo: `CBT-${tx.transactionNo}`,
                                accountId: cashAccount.id,
                                branchId: tx.branchId,
                                type: isDeposit ? "in" : "out",
                                category: "savings",
                                amount,
                                balanceBefore: balBefore,
                                balanceAfter: balAfter,
                                referenceType: "SavingsTransaction",
                                referenceId: tx.id,
                                unitType: "simpan_pinjam",
                                description: `[BACKFILL] ${isDeposit ? "Setoran" : "Penarikan"} simpanan untuk ${tx.member.name}`,
                                transactionDate: tx.transactionDate,
                                memberId: tx.memberId,
                                createdById: parseInt(session.user.id),
                            },
                        });

                        await prismaTx.cashBankAccount.update({
                            where: { id: cashAccount.id },
                            data: { currentBalance: balAfter },
                        });
                    });

                    results.push({
                        savingsTxId: tx.id,
                        transactionNo: tx.transactionNo,
                        memberName: tx.member.name,
                        type: tx.type,
                        amount,
                        transactionDate: tx.transactionDate.toISOString().split("T")[0],
                        status: "created",
                    });
                } catch (err: any) {
                    results.push({
                        savingsTxId: tx.id,
                        transactionNo: tx.transactionNo,
                        memberName: tx.member.name,
                        type: tx.type,
                        amount,
                        transactionDate: tx.transactionDate.toISOString().split("T")[0],
                        status: "error",
                        error: err.message ?? "Unknown error",
                    });
                }
            }
        } else {
            for (const tx of missingTx) {
                results.push({
                    savingsTxId: tx.id,
                    transactionNo: tx.transactionNo,
                    memberName: tx.member.name,
                    type: tx.type,
                    amount: Number(tx.amount),
                    transactionDate: tx.transactionDate.toISOString().split("T")[0],
                    status: "will_create",
                });
            }
        }

        return NextResponse.json({
            mode,
            totalMissing: missingTx.length,
            results,
            summary: {
                willCreate: results.filter((r) => r.status === "will_create").length,
                created: results.filter((r) => r.status === "created").length,
                skipped: results.filter((r) => r.status === "skipped_no_account").length,
                errors: results.filter((r) => r.status === "error").length,
            },
        });
    } catch (error: any) {
        console.error("[backfill-savings-cash]", error);
        return NextResponse.json(
            { message: "Gagal menjalankan backfill", error: error.message },
            { status: 500 }
        );
    }
}
