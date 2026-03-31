import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/loans/products — Fetch all active loan products
export async function GET() {
    try {
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
                interest_rate: 0, // 0% interest per Primkoppol policy
                min_amount: Number(p.minAmount),
                max_amount: Number(p.maxAmount),
                min_tenor: p.minTenorMonths,
                max_tenor: p.maxTenorMonths,
                admin_fee_type: p.adminFeeType,
                admin_fee_value: Number(p.adminFeeValue),
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
