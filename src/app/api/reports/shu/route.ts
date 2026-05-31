import { NextResponse } from "next/server";
import { calculateSystemSHU } from "@/lib/services/shu-calculator";

// GET /api/reports/shu - Real SHU Report based on journal aggregation
// Supports: ?year=2026 (full year) or ?year=2026&month=3 (specific month)
// Pagination: ?page=1&perPage=20 (applies to memberShu array only)
// Export: ?export=true returns ALL members (for Excel/PDF/Print)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const monthParam = searchParams.get("month"); // 1-12 or null/all
        const isAllMonths = !monthParam || monthParam === "all";
        const month = isAllMonths ? null : parseInt(monthParam);

        // Pagination params
        const isExport = searchParams.get("export") === "true";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "20")));

        // Fetch data from SSOT
        const data = await calculateSystemSHU(year, month);

        const allMembers = data.memberDistribution;
        const totalMembers = allMembers.length;

        // Apply pagination only when NOT exporting
        const paginatedMembers = isExport
            ? allMembers
            : allMembers.slice((page - 1) * perPage, page * perPage);

        const shuReport = {
            totalShu: data.netSurplus,
            period: String(year),
            month: month ?? 0,
            periodLabel: data.periodLabel,
            totalIncome: data.totalIncome,
            totalExpense: data.totalExpense,
            memberNetIncome: data.memberSurplus,
            nonMemberNetIncome: data.nonMemberSurplus,
            memberSharePercent: Math.round(data.memberRatio * 100),
            allocationsMember: data.allocationsMember,
            allocationsNonMember: data.allocationsNonMember,
            incomeDetails: data.incomeDetails,
            incomeGroups: data.incomeGroups,
            expenseDetails: data.expenseDetails,
            memberShu: paginatedMembers,
            unitBreakdown: data.unitBreakdown,
            // Pagination metadata
            pagination: isExport ? undefined : {
                page,
                perPage,
                totalItems: totalMembers,
                totalPages: Math.ceil(totalMembers / perPage),
            },
        };

        return NextResponse.json({ data: shuReport });
    } catch (error) {
        console.error("GET /api/reports/shu error:", error);
        return NextResponse.json(
            { message: "Failed to generate SHU report" },
            { status: 500 }
        );
    }
}
