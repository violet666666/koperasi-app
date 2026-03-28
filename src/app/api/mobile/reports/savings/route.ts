import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser } from "../middleware";

export async function GET(request: Request) {
    try {
        // Authenticate request first
        const user = await getMobileUser(request);
        if (!user || !user.isOperator) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const branchId = user.branchId; // Limit by operator's branch if they have one

        // Optional filtering by period could be handled here if needed in the future

        const where = {
            ...(branchId && { branchId: branchId }),
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
                productType: product.type,
                accountCount: stats?._count.id || 0,
                totalBalance: Number(stats?._sum.balance || 0),
            };
        });

        // Get transaction summary
        const transactionSummary = await prisma.savingsTransaction.groupBy({
            by: ["type"],
            where: {
                ...(branchId && { branchId: branchId }),
            },
            _count: { id: true },
            _sum: { amount: true },
        });

        const deposits = transactionSummary.find((t) => t.type === "deposit");
        const withdrawals = transactionSummary.find((t) => t.type === "withdrawal");

        const data = {
            totalBalance: productSummary.reduce((sum, p) => sum + p.totalBalance, 0),
            totalAccounts: productSummary.reduce((sum, p) => sum + p.accountCount, 0),
            deposits: {
                count: deposits?._count.id || 0,
                amount: Number(deposits?._sum.amount || 0),
            },
            withdrawals: {
                count: withdrawals?._count.id || 0,
                amount: Number(withdrawals?._sum.amount || 0),
            },
            products: productSummary
        };

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error("GET /api/mobile/reports/savings error:", error);
        return NextResponse.json(
            { message: "Failed to generate savings recap", error: error.message },
            { status: 500 }
        );
    }
}
