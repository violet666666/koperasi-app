import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/neraca - Balance Sheet
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const asOfDate = searchParams.get("asOfDate") || new Date().toISOString().split("T")[0];

        // Get all accounts with their balances
        const accounts = await prisma.account.findMany({
            where: { deletedAt: null },
            orderBy: { code: "asc" },
        });

        // For demo purposes, generate sample balances
        // In production, this would aggregate journal entries
        const balanceSheet = {
            asOfDate,
            branchId: branchId ? parseInt(branchId) : null,
            assets: {
                currentAssets: [
                    { code: "1-1100", name: "Kas", balance: 50000000 },
                    { code: "1-1200", name: "Bank", balance: 250000000 },
                    { code: "1-1300", name: "Piutang Pinjaman", balance: 1500000000 },
                ],
                fixedAssets: [
                    { code: "1-2100", name: "Inventaris Kantor", balance: 75000000 },
                ],
                totalAssets: 1875000000,
            },
            liabilities: {
                currentLiabilities: [
                    { code: "2-1100", name: "Simpanan Pokok", balance: 500000000 },
                    { code: "2-1200", name: "Simpanan Wajib", balance: 300000000 },
                    { code: "2-1300", name: "Simpanan Sukarela", balance: 750000000 },
                ],
                totalLiabilities: 1550000000,
            },
            equity: {
                items: [
                    { code: "3-1100", name: "Modal Disetor", balance: 200000000 },
                    { code: "3-2000", name: "SHU Tahun Berjalan", balance: 125000000 },
                ],
                totalEquity: 325000000,
            },
            totalLiabilitiesAndEquity: 1875000000,
        };

        return NextResponse.json({ data: balanceSheet });
    } catch (error) {
        console.error("GET /api/reports/neraca error:", error);
        return NextResponse.json(
            { message: "Failed to generate balance sheet" },
            { status: 500 }
        );
    }
}
