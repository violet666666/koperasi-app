import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface ProductLoanSummary {
    product_id: number;
    total_loans: number;
    total_disbursed: number;
    total_outstanding: number;
    total_paid: number;
    total_principal: number;
}

// GET /api/reports/loans-recap
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const yearParam = searchParams.get("year");

        const branchIdInt = branchId ? parseInt(branchId) : null;
        const startDate = yearParam ? new Date(`${yearParam}-01-01`) : null;
        const endDate = yearParam ? new Date(`${yearParam}-12-31T23:59:59.999Z`) : null;

        const [loanProducts, loanAgg] = await Promise.all([
            prisma.loanProduct.findMany({
                where: { isActive: true },
                select: { id: true, code: true, name: true, interestRate: true },
            }),
            prisma.$queryRaw<ProductLoanSummary[]>`
                SELECT
                    la.product_id,
                    COUNT(l.id)::int as total_loans,
                    COALESCE(SUM(COALESCE(l.disbursed_amount, l.principal_amount)), 0)::float as total_disbursed,
                    COALESCE(SUM(l.principal_outstanding), 0)::float as total_outstanding,
                    COALESCE(SUM(l.principal_paid), 0)::float as total_paid,
                    COALESCE(SUM(l.principal_amount), 0)::float as total_principal
                FROM loans l
                JOIN loan_applications la ON l.application_id = la.id
                WHERE (${branchIdInt}::int IS NULL OR l.branch_id = ${branchIdInt})
                  AND (${startDate}::date IS NULL OR l.created_at >= ${startDate})
                  AND (${endDate}::date IS NULL OR l.created_at <= ${endDate})
                GROUP BY la.product_id
            `,
        ]);

        const aggMap = new Map(loanAgg.map(r => [r.product_id, r]));

        const productSummary = loanProducts.map((product) => {
            const agg = aggMap.get(product.id);
            const totalPaid = agg?.total_paid || 0;
            const totalPrincipal = agg?.total_principal || 0;
            const collectibilityRatio = totalPrincipal > 0
                ? Math.round((totalPaid / totalPrincipal) * 100)
                : 0;

            return {
                productCode: product.code,
                productName: product.name,
                interestRate: Number(product.interestRate),
                totalLoans: agg?.total_loans || 0,
                totalDisbursed: agg?.total_disbursed || 0,
                totalOutstanding: agg?.total_outstanding || 0,
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
