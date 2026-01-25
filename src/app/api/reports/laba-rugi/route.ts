import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/laba-rugi - Income Statement
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const periodFrom = searchParams.get("periodFrom");
        const periodTo = searchParams.get("periodTo");

        // For demo purposes, generate sample income statement
        const incomeStatement = {
            period: {
                from: periodFrom || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
                to: periodTo || new Date().toISOString().split("T")[0],
            },
            branchId: branchId ? parseInt(branchId) : null,
            revenue: {
                items: [
                    { code: "4-1100", name: "Pendapatan Bunga Pinjaman", amount: 180000000 },
                    { code: "4-1200", name: "Pendapatan Administrasi", amount: 15000000 },
                    { code: "4-2100", name: "Pendapatan Denda", amount: 5000000 },
                ],
                total: 200000000,
            },
            expenses: {
                items: [
                    { code: "5-1100", name: "Beban Bunga Simpanan", amount: 45000000 },
                    { code: "5-2100", name: "Beban Gaji", amount: 20000000 },
                    { code: "5-2200", name: "Beban Operasional", amount: 8000000 },
                    { code: "5-2300", name: "Beban Penyusutan", amount: 2000000 },
                ],
                total: 75000000,
            },
            netIncome: 125000000,
        };

        return NextResponse.json({ data: incomeStatement });
    } catch (error) {
        console.error("GET /api/reports/laba-rugi error:", error);
        return NextResponse.json(
            { message: "Failed to generate income statement" },
            { status: 500 }
        );
    }
}
