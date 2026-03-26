import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSavingsTransactionSchema, paginationSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// Helper to generate transaction number
function generateTransactionNo(prefix: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `${prefix}-${year}-${random}`;
}

// GET /api/savings/transactions
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 15,
            search: searchParams.get("search") || undefined,
            sortBy: searchParams.get("sortBy") || "createdAt",
            sortOrder: searchParams.get("sortOrder") || "desc",
        });

        const memberId = searchParams.get("memberId");
        const productId = searchParams.get("productId");
        const branchId = searchParams.get("branchId");
        const type = searchParams.get("type");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");

        const where = {
            ...(memberId && { memberId: parseInt(memberId) }),
            ...(productId && { productId: parseInt(productId) }),
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(type && { type }),
            ...(dateFrom && dateTo && {
                transactionDate: {
                    gte: new Date(dateFrom),
                    lte: new Date(dateTo),
                },
            }),
        };

        const [transactions, total] = await Promise.all([
            prisma.savingsTransaction.findMany({
                where,
                include: {
                    member: { select: { id: true, memberNo: true, name: true } },
                    account: { include: { product: true } },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { [query.sortBy || "createdAt"]: query.sortOrder },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.savingsTransaction.count({ where }),
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
        console.error("GET /api/savings/transactions error:", error);
        return NextResponse.json(
            { message: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

// POST /api/savings/transactions - Create deposit or withdrawal
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = createSavingsTransactionSchema.parse(body);

        // Find or create savings account for member + product
        let account = await prisma.savingsAccount.findUnique({
            where: {
                memberId_productId: {
                    memberId: data.memberId,
                    productId: data.productId,
                },
            },
        });

        const member = await prisma.member.findUnique({
            where: { id: data.memberId },
            select: { branchId: true },
        });

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        if (!account) {
            // Create new savings account
            const accountNo = `SAV-${data.memberId}-${data.productId}`;
            account = await prisma.savingsAccount.create({
                data: {
                    accountNo,
                    memberId: data.memberId,
                    productId: data.productId,
                    branchId: member.branchId,
                    balance: 0,
                    openedDate: new Date(),
                },
            });
        }

        const currentBalance = Number(account.balance);

        // Validate withdrawal
        if (data.type === "withdrawal" && data.amount > currentBalance) {
            return NextResponse.json(
                { message: "Saldo tidak mencukupi" },
                { status: 400 }
            );
        }

        // Calculate new balance
        const balanceAfter =
            data.type === "deposit" || data.type === "interest"
                ? currentBalance + data.amount
                : currentBalance - data.amount;

        // Create transaction
        const transaction = await prisma.savingsTransaction.create({
            data: {
                transactionNo: generateTransactionNo("SIM"),
                accountId: account.id,
                memberId: data.memberId,
                productId: data.productId,
                branchId: member.branchId,
                type: data.type,
                amount: data.amount,
                balanceBefore: currentBalance,
                balanceAfter,
                paymentMethod: data.paymentMethod,
                cashBankAccountId: data.cashBankAccountId,
                referenceNo: data.referenceNo,
                notes: data.notes,
                transactionDate: data.transactionDate,
                createdById: 1, // TODO: Get from session
            },
            include: {
                member: { select: { id: true, memberNo: true, name: true } },
                account: { include: { product: true } },
            },
        });

        // Update account balance
        await prisma.savingsAccount.update({
            where: { id: account.id },
            data: { balance: balanceAfter },
        });

        // Audit log
        try {
            const session = await auth();
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Simpanan",
                description: `Transaksi ${data.type}: Rp ${data.amount.toLocaleString()} untuk anggota ${transaction.member?.name || data.memberId}`,
                targetId: String(transaction.id), targetType: "SavingsTransaction",
                newData: { transactionNo: transaction.transactionNo, type: data.type, amount: data.amount, balanceBefore: currentBalance, balanceAfter },
            });
        } catch (e) { /* audit log failure must not break response */ }

        return NextResponse.json({ data: transaction }, { status: 201 });
    } catch (error) {
        console.error("POST /api/savings/transactions error:", error);
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
