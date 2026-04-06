import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// Helper to check Operator or Admin Unit access
async function checkAccess(slug: string) {
    const session = await auth();
    if (!session?.user) return { authorized: false };

    const unitType = slug.replace(/-/g, "_");
    const roleName = session.user.role;
    const userUnitType = (session.user as any).unitType;
    const isOperator = roleName === "operator" || session.user.permissions?.includes("manage_all");
    const isAdminUnit = roleName === "admin" && userUnitType === unitType;

    if (!isOperator && !isAdminUnit) {
        return { authorized: false, session, unitType };
    }
    return { authorized: true, session, unitType };
}

// DELETE /api/unit/[slug]/operational-expense/[id]
export async function DELETE(
    request: Request,
    context: { params: Promise<{ slug: string; id: string }> }
) {
    try {
        const { slug, id } = await context.params;
        const access = await checkAccess(slug);
        
        if (!access.authorized) {
            return NextResponse.json({ message: "Hanya Admin Unit atau Operator yang dapat menghapus pengeluaran." }, { status: 403 });
        }

        const transactionId = parseInt(id);

        await prisma.$transaction(async (tx) => {
            const t = await tx.cashBankTransaction.findUnique({
                where: { id: transactionId },
            });
            if (!t) throw new Error("Transaksi tidak ditemukan");

            const accountId = t.accountId;
            // Pengeluaran operasional (type: out). Menghapus ini berarti KITA MENGEMBALIKAN saldo (+amount).
            const amountImpact = Number(t.amount);

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

        return NextResponse.json({ message: "Pengeluaran berhasil dihapus dan saldo kas/bank terkalkulasi ulang" });
    } catch (error: any) {
        console.error("DELETE Ops Expense Error:", error);
        return NextResponse.json({ message: error.message || "Gagal menghapus pengeluaran." }, { status: 500 });
    }
}

// PUT /api/unit/[slug]/operational-expense/[id]
export async function PUT(
    request: Request,
    context: { params: Promise<{ slug: string; id: string }> }
) {
    try {
        const { slug, id } = await context.params;
        const access = await checkAccess(slug);
        
        if (!access.authorized) {
            return NextResponse.json({ message: "Hanya Admin Unit atau Operator yang dapat mengubah pengeluaran." }, { status: 403 });
        }

        const transactionId = parseInt(id);
        const unitType = access.unitType;

        const formData = await request.formData();
        const amount = Number(formData.get("amount"));
        const descriptionRaw = String(formData.get("description") || "").trim();
        const transactionDate = formData.get("transactionDate") as string | null;
        const receiptFile = formData.get("receipt") as File | null;
        let keepExistingReceipt = formData.get("keepExistingReceipt") === "true"; // flag khusus jika file tidak diganti

        if (!amount || amount <= 0) {
            return NextResponse.json({ message: "Nominal pengeluaran harus lebih dari 0." }, { status: 400 });
        }
        if (!descriptionRaw) {
            return NextResponse.json({ message: "Keterangan pengeluaran wajib diisi." }, { status: 400 });
        }

        const txDate = transactionDate ? new Date(transactionDate) : new Date();

        await prisma.$transaction(async (tx) => {
            const t = await tx.cashBankTransaction.findUnique({
                where: { id: transactionId },
            });
            if (!t) throw new Error("Transaksi tidak ditemukan");

            // Extract old receipt path if any
            let oldReceiptPath = null;
            const oldRawDescription = t.description ?? "";
            const receiptSplit = oldRawDescription.split("||RECEIPT:");
            if (receiptSplit.length > 1) {
                oldReceiptPath = receiptSplit[1];
            }

            let receiptImagePath = keepExistingReceipt ? oldReceiptPath : null;

            if (receiptFile && receiptFile.size > 0) {
                if (receiptFile.size > 5 * 1024 * 1024) {
                    throw new Error("Ukuran file maksimal 5MB.");
                }
                const uploadDir = path.join(process.cwd(), "public", "uploads", "expenses", unitType as string);
                await mkdir(uploadDir, { recursive: true });
                
                const ext = receiptFile.name.split(".").pop() || "jpg";
                const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
                const filePath = path.join(uploadDir, filename);
                
                const bytes = await receiptFile.arrayBuffer();
                await writeFile(filePath, Buffer.from(bytes));
                
                receiptImagePath = `/uploads/expenses/${unitType}/${filename}`;
            }

            // Because this is an OUT payment, its net impact was -oldAmount
            const oldNet = -Number(t.amount);
            const newNet = -amount;
            
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

            const descWithMeta = receiptImagePath
                ? `[${(unitType as string).toUpperCase()}] Pengeluaran Operasional: ${descriptionRaw}||RECEIPT:${receiptImagePath}`
                : `[${(unitType as string).toUpperCase()}] Pengeluaran Operasional: ${descriptionRaw}`;

            const newBalanceAfter = Number(t.balanceBefore) + newNet;
            
            await tx.cashBankTransaction.update({
                where: { id: transactionId },
                data: {
                    amount: amount,
                    description: descWithMeta,
                    transactionDate: txDate,
                    balanceAfter: newBalanceAfter
                }
            });
        });

        return NextResponse.json({ message: "Pengeluaran operasional berhasil diperbarui." });
    } catch (error: any) {
        console.error("PUT Ops Expense Error:", error);
        return NextResponse.json({ message: error.message || "Gagal mengubah transaksi" }, { status: 500 });
    }
}
