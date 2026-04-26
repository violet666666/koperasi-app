import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/loans-recap
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const yearParam = searchParams.get("year");

        // Build date range if year is specified
        const yearFilter = yearParam
            ? { createdAt: { gte: new Date(`${yearParam}-01-01`), lte: new Date(`${yearParam}-12-31`) } }
            : {};

        // 1. Get all loan products
        const loanProducts = await prisma.loanProduct.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true, interestRate: true },
        });

        // 2. Get all loans joined with their application to know the productId
        const loans = await prisma.loan.findMany({
            where: {
                ...(branchId && { branchId: parseInt(branchId) }),
                ...yearFilter,
            },
            select: {
                id: true,
                principalAmount: true,
                principalOutstanding: true,
                principalPaid: true,
                disbursedAmount: true,
                status: true,
                application: {
                    select: { productId: true },
                },
            },
        });

        // 3. Group loans by productId
        const loansByProduct: Record<number, typeof loans> = {};
        for (const loan of loans) {
            const pid = loan.application.productId;
            if (!loansByProduct[pid]) loansByProduct[pid] = [];
            loansByProduct[pid].push(loan);
        }

        // 4. Build per-product summary
        const productSummary = loanProducts.map((product) => {
            const productLoans = loansByProduct[product.id] || [];
            
            const totalLoans = productLoans.length;
            const totalDisbursed = productLoans.reduce(
                (sum, l) => sum + Number(l.disbursedAmount || l.principalAmount || 0), 0
            );
            const totalOutstanding = productLoans.reduce(
                (sum, l) => sum + Number(l.principalOutstanding || 0), 0
            );
            const totalPaid = productLoans.reduce(
                (sum, l) => sum + Number(l.principalPaid || 0), 0
            );

            // Collectibility ratio: principalPaid / principalAmount * 100
            const totalPrincipal = productLoans.reduce(
                (sum, l) => sum + Number(l.principalAmount || 0), 0
            );
            const collectibilityRatio = totalPrincipal > 0
                ? Math.round((totalPaid / totalPrincipal) * 100)
                : 0;

            return {
                productCode: product.code,
                productName: product.name,
                interestRate: Number(product.interestRate),
                totalLoans,
                totalDisbursed,
                totalOutstanding,
                totalPaid,
                collectibilityRatio,
            };
        });

        return NextResponse.json({ data: { products: productSummary } });
    } catch (error) {
        console.error("GET /api/reports/loans-recap error:", error);
        return NextResponse.json(
            { message: "Failed to generate loans recap" },
            { status: 500 }
        );
    }
}
