import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { voidBagiHasilSchema } from "@/lib/validations/haji-umrah";

function generateCashTxNo(): string {
    const random = randomBytes(4).readUInt32BE(0) % 1_000_000_000;
    return `CBT-BHV-${random.toString().padStart(9, "0")}`;
}

// POST /api/haji-umrah/bagi-hasil/[id]/void — Reverse a processed distribution (operator only)
// Atomically: reverses each member's interest SavingsTransaction + balance, posts a compensating
// CashBank OUT for the spread, and marks the distribution voided. Touches ONLY bagi-hasil data.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as Record<string, unknown>).role?.name || (session.user as Record<string, unknown>).role;
        // Void is a financial reversal — operator only (not admin haji_umrah)
        if (roleName !== "operator") {
            return NextResponse.json(
                { message: "Forbidden — void hanya untuk operator" },
                { status: 403 },
            );
        }
        const userId = parseInt(String(session.user.id));

        const { id } = await params;
        const distId = parseInt(id);
        if (isNaN(distId)) {
            return NextResponse.json({ message: "Invalid id" }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const parsed = voidBagiHasilSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { message: "Validasi gagal", errors: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        const { voidReason } = parsed.data;

        // Load distribution + items
        const distribution = await prisma.bagiHasilDistribution.findUnique({
            where: { id: distId },
            include: { items: true },
        });
        if (!distribution) {
            return NextResponse.json({ message: "Distribusi tidak ditemukan" }, { status: 404 });
        }
        if (distribution.status !== "processed") {
            return NextResponse.json(
                { message: `Distribusi tidak bisa di-void (status: ${distribution.status})` },
                { status: 409 },
            );
        }

        const now = new Date();
        const reversibleItems = distribution.items.filter((it) => it.savingsTransactionId !== null);

        await prisma.$transaction(async (tx) => {
            // 1. Reverse each member's interest transaction + balance
            for (const item of reversibleItems) {
                const txn = await tx.savingsTransaction.findUnique({
                    where: { id: item.savingsTransactionId! },
                    select: { id: true, amount: true, accountId: true },
                });
                if (!txn) continue; // transaction already gone — skip safely

                // Restore balance (subtract the credited bagi hasil)
                await tx.savingsAccount.update({
                    where: { id: item.savingsAccountId },
                    data: { balance: { decrement: Number(item.amount) } },
                });

                // Mark the original interest transaction voided
                await tx.savingsTransaction.update({
                    where: { id: txn.id },
                    data: {
                        status: "voided",
                        voidedAt: now,
                        voidedById: userId,
                        voidReason: `Void Bagi Hasil ${distribution.distributionNo} — ${voidReason}`,
                    },
                });
            }

            // 2. Compensating CashBank OUT for the spread (ledger is append-only)
            if (distribution.cashBankAccountId) {
                const cashBank = await tx.cashBankAccount.findUnique({
                    where: { id: distribution.cashBankAccountId },
                });
                if (cashBank) {
                    const cbBefore = Number(cashBank.currentBalance);
                    const cbAfter = cbBefore - Number(distribution.spreadAmount);
                    await tx.cashBankTransaction.create({
                        data: {
                            transactionNo: generateCashTxNo(),
                            accountId: distribution.cashBankAccountId,
                            branchId: cashBank.branchId,
                            type: "out",
                            category: "bagi_hasil",
                            amount: Number(distribution.spreadAmount),
                            balanceBefore: cbBefore,
                            balanceAfter: cbAfter,
                            referenceType: "BagiHasilDistribution",
                            referenceId: distribution.id,
                            unitType: "haji_umrah",
                            description: `REVERSAL Spread Bagi Hasil — ${distribution.periodLabel} (${distribution.distributionNo})`,
                            transactionDate: now,
                            createdById: userId,
                        },
                    });
                    await tx.cashBankAccount.update({
                        where: { id: distribution.cashBankAccountId },
                        data: { currentBalance: cbAfter },
                    });
                }
            }

            // 3. Null out item back-refs (prevents double-void) + mark distribution voided
            await tx.bagiHasilItem.updateMany({
                where: { distributionId: distId },
                data: { savingsTransactionId: null },
            });
            await tx.bagiHasilDistribution.update({
                where: { id: distId },
                data: {
                    status: "voided",
                    voidedAt: now,
                    voidedById: userId,
                    voidReason,
                },
            });
        });

        return NextResponse.json({
            message: "Distribusi bagi hasil berhasil di-void (semua kredit anggota & spread dikembalikan)",
            data: {
                id: distId,
                distributionNo: distribution.distributionNo,
                status: "voided",
                reversedItems: reversibleItems.length,
            },
        });
    } catch (error) {
        console.error("POST /api/haji-umrah/bagi-hasil/[id]/void error:", error);
        const message = error instanceof Error ? error.message : "Failed to void distribution";
        return NextResponse.json({ message }, { status: 500 });
    }
}
