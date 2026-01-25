import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createTransferSchema } from "@/lib/validations";

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
        const body = await request.json();
        const data = createTransferSchema.parse(body);

        if (data.fromAccountId === data.toAccountId) {
            return NextResponse.json(
                { message: "Akun asal dan tujuan tidak boleh sama" },
                { status: 400 }
            );
        }

        const [fromAccount, toAccount] = await Promise.all([
            prisma.cashBankAccount.findUnique({ where: { id: data.fromAccountId } }),
            prisma.cashBankAccount.findUnique({ where: { id: data.toAccountId } }),
        ]);

        if (!fromAccount || !toAccount) {
            return NextResponse.json(
                { message: "Akun tidak ditemukan" },
                { status: 404 }
            );
        }

        const fromBalance = Number(fromAccount.currentBalance);
        if (data.amount > fromBalance) {
            return NextResponse.json(
                { message: "Saldo tidak mencukupi" },
                { status: 400 }
            );
        }

        const toBalance = Number(toAccount.currentBalance);
        const transferNo = generateTransferNo();

        // Create outgoing transaction
        await prisma.cashBankTransaction.create({
            data: {
                transactionNo: `${transferNo}-OUT`,
                accountId: data.fromAccountId,
                branchId: fromAccount.branchId,
                type: "out",
                category: "transfer",
                amount: data.amount,
                balanceBefore: fromBalance,
                balanceAfter: fromBalance - data.amount,
                description: data.description || `Transfer ke ${toAccount.name}`,
                transactionDate: data.transactionDate,
                createdById: 1,
            },
        });

        // Create incoming transaction
        await prisma.cashBankTransaction.create({
            data: {
                transactionNo: `${transferNo}-IN`,
                accountId: data.toAccountId,
                branchId: toAccount.branchId,
                type: "in",
                category: "transfer",
                amount: data.amount,
                balanceBefore: toBalance,
                balanceAfter: toBalance + data.amount,
                description: data.description || `Transfer dari ${fromAccount.name}`,
                transactionDate: data.transactionDate,
                createdById: 1,
            },
        });

        // Update balances
        await Promise.all([
            prisma.cashBankAccount.update({
                where: { id: data.fromAccountId },
                data: { currentBalance: { decrement: data.amount } },
            }),
            prisma.cashBankAccount.update({
                where: { id: data.toAccountId },
                data: { currentBalance: { increment: data.amount } },
            }),
        ]);

        return NextResponse.json({
            message: "Transfer berhasil",
            transferNo,
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/cash-bank/transfers error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to process transfer" },
            { status: 500 }
        );
    }
}
