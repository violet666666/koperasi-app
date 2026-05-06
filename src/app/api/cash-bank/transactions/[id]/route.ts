import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const editSchema = z.object({
    type: z.enum(["in", "out"]),
    category: z.string().optional(),
    amount: z.number().positive(),
    description: z.string().optional(),
});

// Helper to check operator role
async function isAuthorizedOperator() {
    const session = await auth();
    let finalUserId = session?.user?.id ? parseInt(session.user.id) : undefined;
    if (!finalUserId) {
        // Fallback for demo if no session. In prod, enforce session.
        const firstUser = await prisma.user.findFirst({ where: { isActive: true } });
        if (firstUser) finalUserId = firstUser.id;
    }

    if (!finalUserId) return false;

    const user = await prisma.user.findUnique({
        where: { id: finalUserId },
        include: { role: true },
    });

    // We allow Operator, Admin, or Admin SP.
    if (!user || (user.role.name !== "operator" && user.role.name !== "admin" && user.role.name !== "admin_sp")) {
        return false;
    }
    return true;
}

// DELETE /api/cash-bank/transactions/[id]
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!(await isAuthorizedOperator())) {
            return NextResponse.json({ message: "Akses ditolak. Hanya Operator/Admin yang dizinkan menghapus riwayat kas." }, { status: 403 });
        }

        const { id } = await params;
        const transactionId = parseInt(id);

        await prisma.$transaction(async (tx) => {
            const t = await tx.cashBankTransaction.findUnique({
                where: { id: transactionId },
            });
            if (!t) throw new Error("Transaksi tidak ditemukan");

            const accountId = t.accountId;
            // The mathematical impact of REMOVING this transaction on subsequent balances
            const amountImpact = t.type === "in" ? -Number(t.amount) : Number(t.amount);

            // Update all SUBSEQUENT transactions' running balances
            await tx.$executeRaw`
                UPDATE "cash_bank_transactions"
                SET 
                    "balance_before" = "balance_before" + ${amountImpact},
                    "balance_after" = "balance_after" + ${amountImpact}
                WHERE "account_id" = ${accountId}
                  AND (
                      "transaction_date" > ${t.transactionDate} 
                      OR ("transaction_date" = ${t.transactionDate} AND "id" > ${t.id})
                  )
            `;

            // Delete the transaction
            await tx.cashBankTransaction.delete({ where: { id: transactionId } });

            // Update the master account balance
            await tx.cashBankAccount.update({
                where: { id: accountId },
                data: {
                    currentBalance: {
                        increment: amountImpact
                    }
                }
            });
        });

        return NextResponse.json({ message: "Transaksi berhasil dihapus dan saldo terkalkulasi ulang" });
    } catch (error: any) {
        console.error("DELETE Kas Error:", error);
        return NextResponse.json({ message: error.message || "Gagal menghapus transaksi" }, { status: 500 });
    }
}

// PUT /api/cash-bank/transactions/[id]
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!(await isAuthorizedOperator())) {
            return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
        }

        const { id } = await params;
        const transactionId = parseInt(id);
        const body = await request.json();
        const data = editSchema.parse(body);

        await prisma.$transaction(async (tx) => {
            const t = await tx.cashBankTransaction.findUnique({
                where: { id: transactionId },
            });
            if (!t) throw new Error("Transaksi tidak ditemukan");

            // 1. Calculate the old impact
            const oldNet = t.type === "in" ? Number(t.amount) : -Number(t.amount);
            
            // 2. Calculate the new impact
            const newNet = data.type === "in" ? data.amount : -data.amount;
            
            // 3. Diff to apply to subsequent transactions
            const diffImpact = newNet - oldNet;
            
            if (diffImpact !== 0) {
                // Update subsequent balances
                await tx.$executeRaw`
                    UPDATE "cash_bank_transactions"
                    SET 
                        "balance_before" = "balance_before" + ${diffImpact},
                        "balance_after" = "balance_after" + ${diffImpact}
                    WHERE "account_id" = ${t.accountId}
                      AND (
                          "transaction_date" > ${t.transactionDate} 
                          OR ("transaction_date" = ${t.transactionDate} AND "id" > ${t.id})
                      )
                `;
                
                // Update the master account
                await tx.cashBankAccount.update({
                    where: { id: t.accountId },
                    data: {
                        currentBalance: {
                            increment: diffImpact
                        }
                    }
                });
            }

            // Update the transaction itself
            const newBalanceAfter = Number(t.balanceBefore) + newNet;
            await tx.cashBankTransaction.update({
                where: { id: transactionId },
                data: {
                    type: data.type,
                    category: data.category,
                    amount: data.amount,
                    description: data.description,
                    balanceAfter: newBalanceAfter
                }
            });
        });

        return NextResponse.json({ message: "Transaksi berhasil diubah" });
    } catch (error: any) {
        console.error("PUT Kas Error:", error);
        return NextResponse.json({ message: error.message || "Gagal mengubah transaksi" }, { status: 500 });
    }
}
