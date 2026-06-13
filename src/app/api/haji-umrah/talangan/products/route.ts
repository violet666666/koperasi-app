import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const TALANGAN_TYPES = ["talangan_haji", "talangan_umrah"];

// GET /api/haji-umrah/talangan/products — List talangan loan products
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type") || ""; // talangan_haji, talangan_umrah

        const whereClause: Record<string, unknown> = {
            isActive: true,
            isCurrent: true,
            type: { in: TALANGAN_TYPES },
        };
        if (type) {
            whereClause.type = type;
        }

        const products = await prisma.loanProduct.findMany({
            where: whereClause,
            orderBy: { code: "asc" },
        });

        const data = products.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            type: p.type,
            interestMethod: p.interestMethod,
            interestRate: Number(p.interestRate),
            minTenorMonths: p.minTenorMonths,
            maxTenorMonths: p.maxTenorMonths,
            minAmount: p.minAmount ? Number(p.minAmount) : null,
            maxAmount: p.maxAmount ? Number(p.maxAmount) : null,
            adminFeeType: p.adminFeeType,
            adminFeeValue: p.adminFeeValue ? Number(p.adminFeeValue) : null,
        }));

        return NextResponse.json({ data });
    } catch (error) {
        console.error("GET /api/haji-umrah/talangan/products error:", error);
        return NextResponse.json({ message: "Failed to fetch talangan products" }, { status: 500 });
    }
}
