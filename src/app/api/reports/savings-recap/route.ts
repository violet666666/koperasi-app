import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/savings-recap
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const yearParam = searchParams.get("year");

        // Build date range if year is specified
        const yearFilter = yearParam
            ? { transactionDate: { gte: new Date(`${yearParam}-01-01`), lte: new Date(`${yearParam}-12-31`) } }
            : {};

        // 1. Get all savings products
        const products = await prisma.savingsProduct.findMany({
            where: { deletedAt: null },
            select: { id: true, code: true, name: true, type: true },
        });

        // 2. Get savings accounts grouped by product (for totalMembers & currentBalance)
        const accountsByProduct = await prisma.savingsAccount.groupBy({
            by: ["productId"],
            where: {
                ...(branchId && { branchId: parseInt(branchId) }),
            },
            _count: { id: true },
            _sum: { balance: true },
        });

        // 3. Get savings transactions grouped by product + type (for totalDeposit & totalWithdrawal)
        const transactionsByProduct = await prisma.savingsTransaction.groupBy({
            by: ["productId", "type"],
            where: {
                ...(branchId && { branchId: parseInt(branchId) }),
                ...yearFilter,
            },
            _sum: { amount: true },
        });

        // 4. Build response per product
        const productSummary = products.map((product) => {
            const accountStats = accountsByProduct.find((a) => a.productId === product.id);
            
            // Get deposit total for this product
            const depositStats = transactionsByProduct.find(
                (t) => t.productId === product.id && t.type === "deposit"
            );
            // Get withdrawal total for this product
            const withdrawalStats = transactionsByProduct.find(
                (t) => t.productId === product.id && t.type === "withdrawal"
            );

            return {
                productCode: product.code,
                productName: product.name,
                productType: product.type,
                totalMembers: accountStats?._count.id || 0,
                totalDeposit: Number(depositStats?._sum.amount || 0),
                totalWithdrawal: Number(withdrawalStats?._sum.amount || 0),
                currentBalance: Number(accountStats?._sum.balance || 0),
            };
        });

        // Filter out products with zero data if desired, or show all
        return NextResponse.json({ data: { products: productSummary } });
    } catch (error) {
        console.error("GET /api/reports/savings-recap error:", error);
        return NextResponse.json(
            { message: "Failed to generate savings recap" },
            { status: 500 }
        );
    }
}
