import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAuditFromRequest } from "@/lib/audit-logger";
import { isSameUnit } from "@/lib/unit-aliases";

export const dynamic = "force-dynamic";

// Max file size: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const VALID_PAYMENT_METHODS = ["cash", "qris", "lainnya"];

// Helper to check Operator or Admin Unit access
async function checkAccess(slug: string) {
    const session = await auth();
    if (!session?.user) return { authorized: false };

    const unitType = slug.replace(/-/g, "_");
    const roleName = session.user.role;
    const userUnitType = (session.user as any).unitType;
    const isOperator = roleName === "operator" || session.user.permissions?.includes("manage_all");
    const isAdminUnit = roleName === "admin" && isSameUnit(userUnitType, unitType);

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

        // Parse reason from URL params
        const { searchParams } = new URL(request.url);
        const reason = searchParams.get("reason") || "Tanpa alasan";

        let deletedRecord: any = null;

        await prisma.$transaction(async (tx) => {
            const t = await tx.cashBankTransaction.findUnique({
                where: { id: transactionId },
            });
            if (!t) throw new Error("Transaksi tidak ditemukan");

            // Save snapshot for audit log before deleting
            deletedRecord = {
                id: t.id,
                transactionNo: t.transactionNo,
                type: t.type,
                category: t.category,
                amount: Number(t.amount),
                description: t.description,
                transactionDate: t.transactionDate,
                unitType: t.unitType,
                balanceBefore: Number(t.balanceBefore),
                balanceAfter: Number(t.balanceAfter),
            };

            const accountId = t.accountId;
            // Deleting "out" (expense) = add back amount (+). Deleting "in" (income) = subtract amount (-).
            const amountImpact = t.type === "out" ? Number(t.amount) : -Number(t.amount);

            // Extract and delete associated receipt file
            const rawDesc = t.description ?? "";
            const receiptSplit = rawDesc.split("||RECEIPT:");
            if (receiptSplit.length > 1) {
                const receiptPath = receiptSplit[1];
                const fileIdMatch = receiptPath.match(/\/api\/uploads\/(\d+)/);
                if (fileIdMatch) {
                    const fileId = parseInt(fileIdMatch[1]);
                    await tx.uploadedFile.deleteMany({ where: { id: fileId } }).catch(() => {});
                }
            }

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

        // Audit log (fire-and-forget)
        if (deletedRecord && access.session) {
            logAuditFromRequest(request, access.session, {
                action: "DELETE",
                module: "Laporan",
                description: `Hapus ${deletedRecord.type === "in" ? "pemasukan" : "pengeluaran"} operasional ${deletedRecord.unitType || ""}: ${deletedRecord.description?.split("||RECEIPT:")[0] || "-"} — Rp${Number(deletedRecord.amount).toLocaleString("id-ID")}. Alasan: ${reason}`,
                targetId: deletedRecord.id,
                targetType: "CashBankTransaction",
                oldData: deletedRecord,
                metadata: { reason, transactionNo: deletedRecord.transactionNo },
            }).catch(() => {});
        }

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
        const pm = String(formData.get("paymentMethod") || "cash");
        const paymentMethod = VALID_PAYMENT_METHODS.includes(pm) ? pm : "cash";

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
                if (receiptFile.size > MAX_FILE_SIZE) {
                    throw new Error("Ukuran file maksimal 2MB. Silakan kompres gambar terlebih dahulu.");
                }
                // Validasi tipe file
                const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
                if (!allowedTypes.includes(receiptFile.type)) {
                    throw new Error("Format file harus JPG, PNG, atau WebP.");
                }

                // Convert to base64 dan simpan ke database
                const bytes = await receiptFile.arrayBuffer();
                const buffer = Buffer.from(bytes);
                const base64String = `data:${receiptFile.type};base64,${buffer.toString("base64")}`;

                const uploadedFile = await tx.uploadedFile.create({
                    data: {
                        category: "expense_receipt",
                        refId: unitType as string,
                        fileName: receiptFile.name,
                        mimeType: receiptFile.type,
                        base64Data: base64String,
                        sizeBytes: receiptFile.size,
                        uploadedById: parseInt(access.session!.user.id),
                    },
                });

                receiptImagePath = `/api/uploads/${uploadedFile.id}`;

                // Clean up old receipt file if replacing
                if (oldReceiptPath) {
                    const oldFileIdMatch = oldReceiptPath.match(/\/api\/uploads\/(\d+)/);
                    if (oldFileIdMatch) {
                        await tx.uploadedFile.deleteMany({
                            where: { id: parseInt(oldFileIdMatch[1]) },
                        }).catch(() => {});
                    }
                }
            }

            // Because this is an OUT payment, its net impact was -oldAmount
            const oldNet = -Number(t.amount);
            const newNet = -amount;
            const dateChanged = txDate.getTime() !== new Date(t.transactionDate).getTime();

            // Determine balanceBefore for this transaction
            let newBalanceBefore: number;
            if (dateChanged) {
                // Date changed — recalculate balanceBefore from predecessor at new position
                const predecessor = await tx.cashBankTransaction.findFirst({
                    where: {
                        accountId: t.accountId,
                        id: { not: transactionId },
                        OR: [
                            { transactionDate: { lt: txDate } },
                            { transactionDate: txDate, id: { lt: transactionId } },
                        ],
                    },
                    orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
                });
                newBalanceBefore = predecessor ? Number(predecessor.balanceAfter) : 0;
            } else {
                newBalanceBefore = Number(t.balanceBefore);
            }

            const newBalanceAfter = newBalanceBefore + newNet;

            // Diff between old and new running balance impact
            const diffImpact = newBalanceAfter - (Number(t.balanceBefore) + oldNet);

            if (diffImpact !== 0 || dateChanged) {
                // Adjust all subsequent transactions' running balances
                // When date changes, adjust from the EARLIEST affected position
                const affectedDate = dateChanged
                    ? (txDate < t.transactionDate ? txDate : t.transactionDate)
                    : t.transactionDate;
                const affectedId = dateChanged
                    ? 0  // adjust everything after the earlier of old/new date
                    : t.id;

                await tx.$executeRaw`
                    UPDATE "cash_bank_transactions"
                    SET
                        "balance_before" = "balance_before" + ${diffImpact},
                        "balance_after" = "balance_after" + ${diffImpact}
                    WHERE "account_id" = ${t.accountId}
                      AND (
                          "transaction_date" > ${affectedDate}
                          OR ("transaction_date" = ${affectedDate} AND "id" > ${affectedId})
                      )
                      AND "id" != ${transactionId}
                `;

                // Update the master account balance
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

            await tx.cashBankTransaction.update({
                where: { id: transactionId },
                data: {
                    amount: amount,
                    description: descWithMeta,
                    transactionDate: txDate,
                    paymentMethod,
                    balanceBefore: newBalanceBefore,
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
