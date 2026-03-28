import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser } from "../../middleware";

export async function GET(request: Request) {
    try {
        // Authenticate request first
        const user = getMobileUser(request);
        const isOperator = user && ["operator", "admin", "superadmin"].includes(user.role);
        if (!user || !isOperator) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const where = {};

        // Get loan products
        const products = await prisma.loanProduct.findMany({
            where: { isCurrent: true }
        });

        const loansByProduct = await prisma.loan.findMany({
            where,
            select: {
                application: { select: { productId: true } },
                status: true,
                principalAmount: true,
                principalOutstanding: true,
                principalPaid: true,
            }
        });

        const productSummary = products.map((product) => {
            const loans = loansByProduct.filter((l) => l.application?.productId === product.id);
            const totalLoans = loans.length;
            const totalDisbursed = loans.reduce((sum, l) => sum + Number(l.principalAmount), 0);
            const totalOutstanding = loans.reduce((sum, l) => sum + Number(l.principalOutstanding), 0);
            const totalPaid = loans.reduce((sum, l) => sum + Number(l.principalPaid), 0);
            
            let collectibilityRatio = 0;
            if (totalDisbursed > 0) {
                collectibilityRatio = Math.round((totalPaid / totalDisbursed) * 100);
            }

            return {
                productCode: product.code,
                productName: product.name,
                interestRate: product.interestRate,
                totalLoans,
                totalDisbursed,
                totalOutstanding,
                totalPaid,
                collectibilityRatio
            };
        });

        // Global aggregations
        const totalDisbursed = productSummary.reduce((sum, p) => sum + p.totalDisbursed, 0);
        const totalOutstanding = productSummary.reduce((sum, p) => sum + p.totalOutstanding, 0);
        const totalPaid = productSummary.reduce((sum, p) => sum + p.totalPaid, 0);
        const totalLoans = productSummary.reduce((sum, p) => sum + p.totalLoans, 0);
        
        let avgCollectibility = 0;
        if (totalDisbursed > 0) {
            avgCollectibility = Math.round((totalPaid / totalDisbursed) * 100);
        }

        const data = {
            totalLoans,
            totalDisbursed,
            totalOutstanding,
            totalPaid,
            avgCollectibility,
            products: productSummary
        };

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error("GET /api/mobile/reports/loans error:", error);
        return NextResponse.json(
            { message: "Failed to generate loans recap", error: error.message },
            { status: 500 }
        );
    }
}
