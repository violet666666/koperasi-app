import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/loans/products — Fetch all active loan products
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const products = await prisma.loanProduct.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            data: products.map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                interest_method: p.interestMethod,
                interest_rate: Number(p.interestRate), // dari database
                min_amount: p.minAmount ? Number(p.minAmount) : null,
                max_amount: p.maxAmount ? Number(p.maxAmount) : null, // null = No Limit
                min_tenor: p.minTenorMonths,
                max_tenor: p.maxTenorMonths,
                admin_fee_type: p.adminFeeType || "percent",
                admin_fee_value: p.adminFeeValue ? Number(p.adminFeeValue) : 2, // dari database
            })),
        });
    } catch (error) {
        console.error("GET /api/loans/products error:", error);
        return NextResponse.json(
            { message: "Gagal memuat produk pinjaman" },
            { status: 500 }
        );
    }
}
