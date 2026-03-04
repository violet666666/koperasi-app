import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { paginationSchema } from "@/lib/validations";

// GET /api/member-portal/transactions - Get member's all transactions
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !session.user.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const memberId = session.user.memberId;
        const { searchParams } = new URL(request.url);

        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 20,
            search: searchParams.get("search") || undefined,
        });

        const type = searchParams.get("type"); // unit, savings, loan
        const unitType = searchParams.get("unitType");
        const isPaid = searchParams.get("isPaid");

        // Build response based on transaction type filter
        const result: {
            unitTransactions?: unknown[];
            savingsTransactions?: unknown[];
            loanPayments?: unknown[];
            meta: { page: number; perPage: number; total: number };
        } = {
            meta: { page: query.page, perPage: query.perPage, total: 0 },
        };

        if (!type || type === "unit") {
            const unitWhere: Record<string, unknown> = { memberId };
            if (unitType && unitType !== "all") unitWhere.unitType = unitType;
            if (isPaid !== null && isPaid !== undefined && isPaid !== "all") {
                unitWhere.isPaid = isPaid === "true";
            }

            const [unitTxns, unitCount] = await Promise.all([
                prisma.unitTransaction.findMany({
                    where: unitWhere,
                    orderBy: { transactionDate: "desc" },
                    skip: type === "unit" ? (query.page - 1) * query.perPage : 0,
                    take: type === "unit" ? query.perPage : 5,
                }),
                prisma.unitTransaction.count({ where: unitWhere }),
            ]);

            result.unitTransactions = unitTxns.map((t) => ({
                ...t,
                amount: Number(t.amount),
                category: "unit",
            }));
            if (type === "unit") result.meta.total = unitCount;
        }

        if (!type || type === "savings") {
            const [savingsTxns, savingsCount] = await Promise.all([
                prisma.savingsTransaction.findMany({
                    where: { memberId, status: "completed" },
                    include: {
                        account: {
                            include: {
                                product: {
                                    select: { code: true, name: true, type: true },
                                },
                            },
                        },
                    },
                    orderBy: { transactionDate: "desc" },
                    skip: type === "savings" ? (query.page - 1) * query.perPage : 0,
                    take: type === "savings" ? query.perPage : 5,
                }),
                prisma.savingsTransaction.count({ where: { memberId, status: "completed" } }),
            ]);

            result.savingsTransactions = savingsTxns.map((t) => ({
                id: t.id,
                transactionNo: t.transactionNo,
                type: t.type,
                amount: Number(t.amount),
                balanceBefore: Number(t.balanceBefore),
                balanceAfter: Number(t.balanceAfter),
                transactionDate: t.transactionDate,
                notes: t.notes,
                product: t.account?.product,
                category: "savings",
            }));
            if (type === "savings") result.meta.total = savingsCount;
        }

        if (!type || type === "loan") {
            const [loanPayments, loanCount] = await Promise.all([
                prisma.loanPayment.findMany({
                    where: { memberId },
                    include: {
                        loan: {
                            select: { loanNo: true, productSnapshot: true },
                        },
                    },
                    orderBy: { paymentDate: "desc" },
                    skip: type === "loan" ? (query.page - 1) * query.perPage : 0,
                    take: type === "loan" ? query.perPage : 5,
                }),
                prisma.loanPayment.count({ where: { memberId } }),
            ]);

            result.loanPayments = loanPayments.map((p) => ({
                id: p.id,
                paymentNo: p.paymentNo,
                amount: Number(p.amount),
                principalPortion: Number(p.principalPortion),
                interestPortion: Number(p.interestPortion),
                paymentDate: p.paymentDate,
                loan: p.loan,
                category: "loan",
            }));
            if (type === "loan") result.meta.total = loanCount;
        }

        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("GET /api/member-portal/transactions error:", error);
        return NextResponse.json(
            { message: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}
