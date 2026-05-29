import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createTransferSchema } from "@/lib/validations";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp", "kasir"];

// Helper to generate transfer numbers
function generateTransferNo(): string {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `TRF-${year}-${random}`;
}

// POST /api/cash-bank/transfers
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as any).role?.name || session.user.role;
        if (!ALLOWED_ROLES.includes(roleName)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        const userId = Number((session.user as any).id);

        const body = await request.json();
        const data = createTransferSchema.parse(body);

        if (data.fromAccountId === data.toAccountId) {
            return NextResponse.json(
                { message: "Akun asal dan tujuan tidak boleh sama" },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            const [fromAccount, toAccount] = await Promise.all([
                tx.cashBankAccount.findUnique({ where: { id: data.fromAccountId } }),
                tx.cashBankAccount.findUnique({ where: { id: data.toAccountId } }),
            ]);

            if (!fromAccount || !toAccount) {
                throw new Error("Akun tidak ditemukan");
            }
            if (!fromAccount.isActive) {
                throw new Error("Akun sumber tidak aktif");
            }
            if (!toAccount.isActive) {
                throw new Error("Akun tujuan tidak aktif");
            }

            const fromBalance = Number(fromAccount.currentBalance);
            if (data.amount > fromBalance) {
                throw new Error("Saldo tidak mencukupi");
            }

            const toBalance = Number(toAccount.currentBalance);
            const transferNo = generateTransferNo();

            // 1. Create outgoing transaction
            await tx.cashBankTransaction.create({
                data: {
                    transactionNo: `${transferNo}-OUT`,
                    accountId: data.fromAccountId,
                    branchId: fromAccount.branchId,
                    type: "out",
                    category: "transfer",
                    amount: data.amount,
                    balanceBefore: fromBalance,
                    balanceAfter: fromBalance - data.amount,
                    unitType: fromAccount.unitType || null,
                    description: data.description || `Transfer ke ${toAccount.name}`,
                    transactionDate: data.transactionDate,
                    createdById: userId,
                },
            });

            // 2. Create incoming transaction
            await tx.cashBankTransaction.create({
                data: {
                    transactionNo: `${transferNo}-IN`,
                    accountId: data.toAccountId,
                    branchId: toAccount.branchId,
                    type: "in",
                    category: "transfer",
                    amount: data.amount,
                    balanceBefore: toBalance,
                    balanceAfter: toBalance + data.amount,
                    unitType: toAccount.unitType || null,
                    description: data.description || `Transfer dari ${fromAccount.name}`,
                    transactionDate: data.transactionDate,
                    createdById: userId,
                },
            });

            // 3. Update both balances atomically
            await tx.cashBankAccount.update({
                where: { id: data.fromAccountId },
                data: { currentBalance: fromBalance - data.amount },
            });
            await tx.cashBankAccount.update({
                where: { id: data.toAccountId },
                data: { currentBalance: toBalance + data.amount },
            });

            return { transferNo, fromBalance: fromBalance - data.amount, toBalance: toBalance + data.amount };
        }, { timeout: 15000 });

        return NextResponse.json({
            message: "Transfer berhasil",
            transferNo: result.transferNo,
        }, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/cash-bank/transfers error:", error);

        // Handle known business logic errors thrown inside transaction
        if (error?.message === "Akun tidak ditemukan") {
            return NextResponse.json({ message: error.message }, { status: 404 });
        }
        if (error?.message === "Saldo tidak mencukupi") {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }
        if (error?.message === "Akun sumber tidak aktif" || error?.message === "Akun tujuan tidak aktif") {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }

        // Zod validation error
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validasi gagal", errors: error },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { message: "Failed to process transfer" },
            { status: 500 }
        );
    }
}
