import { NextResponse } from "next/server";
import { getMobileUser, unauthorizedResponse } from "../../middleware";
import { calculateSystemSHU } from "@/lib/services/shu-calculator";

// GET /api/mobile/reports/shu-calculator
// Uses the SAME calculator as web admin to ensure consistent data
// Supports: ?year=2026 (full year) or ?year=2026&month=3 (specific month, 1-12)
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const monthParam = searchParams.get("month");
        const month = (!monthParam || monthParam === "all") ? undefined : parseInt(monthParam);

        // Gunakan kalkulator yang sama agar data konsisten
        const result = await calculateSystemSHU(year, month);

        // Reshape ke format yang diharapkan mobile app
        const allocations = result.allocationsMember.map((a: any) => ({
            key: a.key,
            label: a.category || a.key,
            percentage: a.percentage,
            amount: a.amount,
        }));

        const topMembers = result.memberDistribution.slice(0, 10).map((m: any) => ({
            id: m.id,
            memberNo: m.memberNo,
            name: m.name,
            totalSavings: m.savingsContribution || 0,
            totalShu: m.shuAmount || 0,
            modalPortion: m.modalPortion || 0,
            usahaPortion: m.usahaPortion || 0,
            carwashBonus: m.carwashBonus || 0,
            carwashCount: m.carwashCount || 0,
        }));

        return NextResponse.json({
            data: {
                year: result.year,
                month: result.month ?? 0,
                periodLabel: result.periodLabel,
                netIncome: result.netSurplus,
                totalIncome: result.totalIncome,
                totalExpense: result.totalExpense,
                totalCarwashBonus: result.totalCarwashBonus || 0,
                allocations,
                incomeDetails: result.incomeDetails,
                expenseDetails: result.expenseDetails,
                topMembers,
                summary: {
                    totalSavingsAll: result.totalSavingsCapital,
                    totalLoanContribAll: 0,
                }
            }
        });

    } catch (error) {
        console.error("GET /api/mobile/reports/shu-calculator error:", error);
        return NextResponse.json({ message: "Gagal memproses kalkulasi SHU" }, { status: 500 });
    }
}

