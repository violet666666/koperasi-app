import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createCashBankTransactionSchema, paginationSchema } from "@/lib/validations";

// Helper to generate transaction number
function generateTransactionNo(type: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const prefix = type === "in" ? "CBM" : "CBK"; // Masuk / Keluar
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `${prefix}-${year}-${random}`;
}

// GET /api/cash-bank/transactions
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 15,
        });

        const accountId = searchParams.get("accountId");
        const branchId = searchParams.get("branchId");
        const type = searchParams.get("type");
        const category = searchParams.get("category");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");

        const where: any = {
            ...(accountId && { accountId: parseInt(accountId) }),
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(type && { type }),
            ...(category && { category }),
            ...(dateFrom && dateTo && {
                transactionDate: {
                    gte: new Date(dateFrom),
                    lte: new Date(dateTo),
                },
            }),
        };

        const [transactions, total] = await Promise.all([
            prisma.cashBankTransaction.findMany({
                where,
                include: {
                    account: { select: { id: true, code: true, name: true } },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.cashBankTransaction.count({ where }),
        ]);

        return NextResponse.json({
            data: transactions,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/cash-bank/transactions error:", error);
        return NextResponse.json(
            { message: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

// POST /api/cash-bank/transactions
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = createCashBankTransactionSchema.parse(body);

        const account = await prisma.cashBankAccount.findUnique({
            where: { id: data.accountId },
        });

        if (!account) {
            return NextResponse.json(
                { message: "Akun kas/bank tidak ditemukan" },
                { status: 404 }
            );
        }

        const currentBalance = Number(account.currentBalance);

        // Validate for outgoing
        if (data.type === "out" && data.amount > currentBalance) {
            return NextResponse.json(
                { message: "Saldo tidak mencukupi" },
                { status: 400 }
            );
        }

        const balanceAfter =
            data.type === "in"
                ? currentBalance + data.amount
                : currentBalance - data.amount;

        const transaction = await prisma.cashBankTransaction.create({
            data: {
                transactionNo: generateTransactionNo(data.type),
                accountId: data.accountId,
                branchId: account.branchId,
                type: data.type,
                category: data.category,
                amount: data.amount,
                balanceBefore: currentBalance,
                balanceAfter,
                description: data.description,
                transactionDate: data.transactionDate,
                createdById: 1, // TODO: Get from session
            },
            include: {
                account: true,
            },
        });

        // Update account balance
        await prisma.cashBankAccount.update({
            where: { id: data.accountId },
            data: { currentBalance: balanceAfter },
        });

        return NextResponse.json({ data: transaction }, { status: 201 });
    } catch (error) {
        console.error("POST /api/cash-bank/transactions error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create transaction" },
            { status: 500 }
        );
    }
}
