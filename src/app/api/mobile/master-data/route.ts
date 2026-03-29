import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "operator" && user.role !== "admin" && user.role !== "superadmin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const module = searchParams.get("module") || "all"; // all, coa, p_simpanan, p_pinjaman

        let data: any = {};

        if (module === "all" || module === "coa") {
            const accounts = await prisma.account.findMany({
                orderBy: { code: "asc" }
            });
            data.coa = accounts;
        }

        if (module === "all" || module === "p_simpanan") {
            const savingsProducts = await prisma.savingsProduct.findMany({
                orderBy: { name: "asc" }
            });
            data.savingsProducts = savingsProducts.map(p => ({
                ...p,
                minBalance: Number(p.minimumAmount)
            }));
        }

        if (module === "all" || module === "p_pinjaman") {
            const loanProducts = await prisma.loanProduct.findMany({
                orderBy: { name: "asc" }
            });
            data.loanProducts = loanProducts.map(p => ({
                ...p,
                interestRate: Number(p.interestRate),
                maxAmount: p.maxAmount ? Number(p.maxAmount) : null,
                adminFee: p.adminFeeValue ? Number(p.adminFeeValue) : 0
            }));
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error("GET /api/mobile/master-data error:", error);
        return NextResponse.json(
            { message: "Gagal memuat master data" },
            { status: 500 }
        );
    }
}
