import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateSystemSHU } from "@/lib/services/shu-calculator";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const year = searchParams.get("year") || new Date().getFullYear().toString();
        const yearNum = parseInt(year);
        const monthParam = searchParams.get("month");
        const month = monthParam && monthParam !== "all" ? parseInt(monthParam) : null;

        // Fetch data from SSOT
        const data = await calculateSystemSHU(yearNum, month);

        // Helper to find exact allocation amount based on key
        const getAllocM = (key: string) => data.allocationsMember.find(a => a.key === key)?.amount || 0;
        const getAllocNM = (key: string) => data.allocationsNonMember.find(a => a.key === key)?.amount || 0;

        // Determine status dynamically
        const hasAnyContribution = data.totalSavingsCapital > 0 || data.memberDistribution.some(m => m.loanContribution > 0);
        const status = hasAnyContribution ? "calculated" : "draft";

        return NextResponse.json({
            data: {
                shuData: {
                    year: yearNum,
                    status,
                    totalIncome: data.totalIncome,
                    totalExpense: data.totalExpense,
                    netSurplus: data.netSurplus,
                    // Member metrics
                    memberIncome: data.totalIncome * data.memberRatio, // Simplified mapping
                    memberExpense: data.totalExpense * data.memberRatio, 
                    memberSurplus: data.memberSurplus,
                    // Non-Member metrics
                    nonMemberIncome: data.totalIncome * data.nonMemberRatio,
                    nonMemberExpense: data.totalExpense * data.nonMemberRatio,
                    nonMemberSurplus: data.nonMemberSurplus,
                    
                    // Funds mapping - combine member and non-member for system-wide display
                    reserveFund: getAllocM('cadangan') + getAllocNM('cadangan'),
                    educationFund: getAllocM('pendidikan') + getAllocNM('pendidikan1') + getAllocNM('pendidikan2'),
                    employeeBonus: getAllocM('pegawai') + getAllocNM('pegawai'),
                    pengurusFund: getAllocM('pengurus'),
                    socialFund: getAllocM('sosial') + getAllocNM('sosial'),
                    
                    memberDividend: data.memberDividend,
                    jasaModalPool: data.jasaModalPool,
                    jasaUsahaPool: data.jasaUsahaPool,
                    totalSavingsCapital: data.totalSavingsCapital,
                    totalTabunganWajib: 0, // Fallback, not strictly needed separately now
                    memberCount: data.memberCount
                },
                memberSHU: data.memberDistribution,
                unitBreakdown: data.unitBreakdown
            }
        });

    } catch (error) {
        console.error("SHU calculation error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
