import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/savings-recap
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const productId = searchParams.get("productId");

        const where = {
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(productId && { productId: parseInt(productId) }),
        };

        // Get savings products summary
        const products = await prisma.savingsProduct.findMany({
            where: { deletedAt: null },
        });

        // Get savings accounts grouped by product
        const accountsByProduct = await prisma.savingsAccount.groupBy({
            by: ["productId"],
            where,
            _count: { id: true },
            _sum: { balance: true },
        });

        const productSummary = products.map((product) => {
            const stats = accountsByProduct.find((a) => a.productId === product.id);
            return {
                productId: product.id,
                productCode: product.code,
                productName: product.name,
                accountCount: stats?._count.id || 0,
                totalBalance: Number(stats?._sum.balance || 0),
            };
        });

        // Get transaction summary
        const transactionSummary = await prisma.savingsTransaction.groupBy({
            by: ["type"],
            where: {
                ...(branchId && { branchId: parseInt(branchId) }),
                createdAt: {
                    gte: new Date(new Date().getFullYear(), 0, 1),
                },
            },
            _count: { id: true },
            _sum: { amount: true },
        });

        const deposits = transactionSummary.find((t) => t.type === "deposit");
        const withdrawals = transactionSummary.find((t) => t.type === "withdrawal");

        const recap = {
            branchId: branchId ? parseInt(branchId) : null,
            totalBalance: productSummary.reduce((sum, p) => sum + p.totalBalance, 0),
            totalAccounts: productSummary.reduce((sum, p) => sum + p.accountCount, 0),
            byProduct: productSummary,
            transactions: {
                deposits: {
                    count: deposits?._count.id || 0,
                    amount: Number(deposits?._sum.amount || 0),
                },
                withdrawals: {
                    count: withdrawals?._count.id || 0,
                    amount: Number(withdrawals?._sum.amount || 0),
                },
            },
        };

        return NextResponse.json({ data: recap });
    } catch (error) {
        console.error("GET /api/reports/savings-recap error:", error);
        return NextResponse.json(
            { message: "Failed to generate savings recap" },
            { status: 500 }
        );
    }
}
