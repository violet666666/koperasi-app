import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// GET /api/savings/transactions/[id] — Get single transaction
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const transaction = await prisma.savingsTransaction.findUnique({
            where: { id: parseInt(id) },
            include: {
                member: { select: { id: true, memberNo: true, name: true } },
                account: { include: { product: true } },
                branch: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });

        if (!transaction) {
            return NextResponse.json({ message: "Transaksi tidak ditemukan" }, { status: 404 });
        }

        return NextResponse.json({ data: transaction });
    } catch (error) {
        console.error("GET /api/savings/transactions/[id] error:", error);
        return NextResponse.json({ message: "Gagal mengambil data transaksi" }, { status: 500 });
    }
}

// PUT /api/savings/transactions/[id] — Edit transaction (full edit)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const userId = Number((session.user as any).id);
        const { id } = await params;
        const txId = parseInt(id);

        const body = await request.json();
        const { type, amount, notes, transactionDate } = body;

        if (!type || !amount || amount <= 0) {
            return NextResponse.json({ message: "Tipe dan jumlah wajib diisi" }, { status: 400 });
        }

        const existing = await prisma.savingsTransaction.findUnique({
            where: { id: txId },
            include: { account: true },
        });

        if (!existing) {
            return NextResponse.json({ message: "Transaksi tidak ditemukan" }, { status: 404 });
        }

        // Calculate balance adjustment
        const oldEffect = existing.type === "deposit" || existing.type === "interest"
            ? Number(existing.amount)
            : -Number(existing.amount);
        const newEffect = type === "deposit" || type === "interest"
            ? Number(amount)
            : -Number(amount);
        const balanceDiff = newEffect - oldEffect;

        const currentAccountBalance = Number(existing.account.balance);
        const newAccountBalance = currentAccountBalance + balanceDiff;

        if (newAccountBalance < 0) {
            return NextResponse.json(
                { message: `Perubahan akan menyebabkan saldo negatif (${newAccountBalance}). Batalkan perubahan.` },
                { status: 400 }
            );
        }

        // Parse date as WIB
        let parsedDate: Date | undefined;
        if (transactionDate) {
            const raw = String(transactionDate);
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                parsedDate = new Date(raw + "T12:00:00+07:00");
            } else {
                parsedDate = new Date(raw);
            }
        }

        const newBalanceBefore = type === "deposit" || type === "interest"
            ? newAccountBalance - Number(amount)
            : newAccountBalance + Number(amount);

        const [updatedTx] = await prisma.$transaction(async (tx) => {
            const updated = await tx.savingsTransaction.update({
                where: { id: txId },
                data: {
                    type,
                    amount: Number(amount),
                    balanceBefore: newBalanceBefore,
                    balanceAfter: newAccountBalance,
                    notes: notes ?? existing.notes,
                    ...(parsedDate && { transactionDate: parsedDate }),
                },
                include: {
                    member: { select: { id: true, memberNo: true, name: true } },
                    account: { include: { product: true } },
                },
            });

            await tx.savingsAccount.update({
                where: { id: existing.accountId },
                data: { balance: newAccountBalance },
            });

            return [updated];
        });

        // Audit
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "UPDATE", module: "Simpanan",
                description: `Edit transaksi ${existing.transactionNo}: ${existing.type} Rp${Number(existing.amount).toLocaleString()} → ${type} Rp${Number(amount).toLocaleString()}`,
                targetId: String(txId), targetType: "SavingsTransaction",
                oldData: { type: existing.type, amount: Number(existing.amount), notes: existing.notes },
                newData: { type, amount: Number(amount), notes },
            });
        } catch (e) { }

        return NextResponse.json({ data: updatedTx });
    } catch (error) {
        console.error("PUT /api/savings/transactions/[id] error:", error);
        return NextResponse.json({ message: "Gagal mengubah transaksi" }, { status: 500 });
    }
}

// DELETE /api/savings/transactions/[id] — Delete transaction & recalculate balance
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const userId = Number((session.user as any).id);
        const { id } = await params;
        const txId = parseInt(id);

        const existing = await prisma.savingsTransaction.findUnique({
            where: { id: txId },
            include: { account: true, member: { select: { name: true } } },
        });

        if (!existing) {
            return NextResponse.json({ message: "Transaksi tidak ditemukan" }, { status: 404 });
        }

        // Calculate how much to reverse from the account balance
        const effect = existing.type === "deposit" || existing.type === "interest"
            ? Number(existing.amount)
            : -Number(existing.amount);

        const currentBalance = Number(existing.account.balance);
        const newBalance = currentBalance - effect;

        if (newBalance < 0) {
            return NextResponse.json(
                { message: `Penghapusan akan menyebabkan saldo negatif. Saldo saat ini: Rp ${currentBalance.toLocaleString("id-ID")}, efek transaksi: Rp ${effect.toLocaleString("id-ID")}` },
                { status: 400 }
            );
        }

        await prisma.$transaction(async (tx) => {
            // Also clean up linked CashBankTransaction if any
            if (existing.transactionNo) {
                await tx.cashBankTransaction.deleteMany({
                    where: { transactionNo: `CBT-${existing.transactionNo}` },
                });
            }

            await tx.savingsTransaction.delete({ where: { id: txId } });

            await tx.savingsAccount.update({
                where: { id: existing.accountId },
                data: { balance: newBalance },
            });
        });

        // Audit
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "DELETE", module: "Simpanan",
                description: `Hapus transaksi ${existing.transactionNo}: ${existing.type} Rp${Number(existing.amount).toLocaleString()} (${existing.member?.name})`,
                targetId: String(txId), targetType: "SavingsTransaction",
                oldData: { transactionNo: existing.transactionNo, type: existing.type, amount: Number(existing.amount) },
            });
        } catch (e) { }

        return NextResponse.json({ message: "Transaksi berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/savings/transactions/[id] error:", error);
        return NextResponse.json({ message: "Gagal menghapus transaksi" }, { status: 500 });
    }
}
