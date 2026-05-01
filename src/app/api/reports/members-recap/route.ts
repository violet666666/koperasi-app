import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/members-recap
// Pagination: ?page=1&perPage=20 (applies to members array only)
// Export: ?export=true returns ALL members (for Excel/PDF/Print)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");

        // Pagination params
        const isExport = searchParams.get("export") === "true";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "20")));

        const where = {
            deletedAt: null,
            ...(branchId && { branchId: parseInt(branchId) }),
        };

        // Summary counts are always complete (never paginated)
        const [totalMembers, activeMembers, inactiveMembers, resignedMembers] = await Promise.all([
            prisma.member.count({ where }),
            prisma.member.count({ where: { ...where, status: "active" } }),
            prisma.member.count({ where: { ...where, status: "inactive" } }),
            prisma.member.count({ where: { ...where, status: "resigned" } }),
        ]);

        // Get members with their financial summary
        const activeWhere = { ...where, status: "active" as const };

        // Helper: fetch financial totals (savings balance + loan outstanding) for a list of member IDs
        async function getFinancialTotals(memberIds: number[]) {
            if (memberIds.length === 0) return new Map<number, { totalSavings: number; totalLoans: number }>();

            // Sum savings balances per member
            const savingsRows = await prisma.savingsAccount.groupBy({
                by: ["memberId"],
                where: {
                    memberId: { in: memberIds },
                    status: "active",
                },
                _sum: { balance: true },
            });

            // Sum loan outstanding per member (active loans only)
            const loanRows = await prisma.loan.groupBy({
                by: ["memberId"],
                where: {
                    memberId: { in: memberIds },
                    status: "active",
                },
                _sum: {
                    principalOutstanding: true,
                    interestOutstanding: true,
                },
            });

            const savingsMap = new Map(
                savingsRows.map((r) => [r.memberId, Number(r._sum.balance ?? 0)])
            );
            const loanMap = new Map(
                loanRows.map((r) => [r.memberId, Number(r._sum.principalOutstanding ?? 0) + Number(r._sum.interestOutstanding ?? 0)])
            );

            const result = new Map<number, { totalSavings: number; totalLoans: number }>();
            for (const id of memberIds) {
                result.set(id, {
                    totalSavings: savingsMap.get(id) ?? 0,
                    totalLoans: loanMap.get(id) ?? 0,
                });
            }
            return result;
        }

        if (isExport) {
            // Export mode: fetch ALL members (no pagination)
            const allMembers = await prisma.member.findMany({
                where: activeWhere,
                include: {
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { memberNo: "asc" },
            });

            const memberIds = allMembers.map((m) => m.id);
            const financials = await getFinancialTotals(memberIds);

            const recap = {
                summary: {
                    total: totalMembers,
                    active: activeMembers,
                    inactive: inactiveMembers,
                    resigned: resignedMembers,
                },
                members: allMembers.map((m) => {
                    const fin = financials.get(m.id) ?? { totalSavings: 0, totalLoans: 0 };
                    return {
                        id: m.id,
                        memberNo: m.memberNo,
                        name: m.name,
                        phone: m.phone,
                        status: m.status,
                        joinDate: m.joinDate,
                        branch: m.branch?.name || "Pusat",
                        totalSavings: fin.totalSavings,
                        totalLoans: fin.totalLoans,
                    };
                }),
            };

            return NextResponse.json({ data: recap });
        }

        // Paginated mode
        const totalItems = activeMembers;
        const totalPages = Math.ceil(totalItems / perPage);

        const members = await prisma.member.findMany({
            where: activeWhere,
            include: {
                branch: { select: { id: true, name: true } },
            },
            orderBy: { memberNo: "asc" },
            skip: (page - 1) * perPage,
            take: perPage,
        });

        const memberIds = members.map((m) => m.id);
        const financials = await getFinancialTotals(memberIds);

        const recap = {
            summary: {
                total: totalMembers,
                active: activeMembers,
                inactive: inactiveMembers,
                resigned: resignedMembers,
            },
            members: members.map((m) => {
                const fin = financials.get(m.id) ?? { totalSavings: 0, totalLoans: 0 };
                return {
                    id: m.id,
                    memberNo: m.memberNo,
                    name: m.name,
                    phone: m.phone,
                    status: m.status,
                    joinDate: m.joinDate,
                    branch: m.branch?.name || "Pusat",
                    totalSavings: fin.totalSavings,
                    totalLoans: fin.totalLoans,
                };
            }),
            pagination: {
                page,
                perPage,
                totalItems,
                totalPages,
            },
        };

        return NextResponse.json({ data: recap });
    } catch (error) {
        console.error("GET /api/reports/members-recap error:", error);
        return NextResponse.json(
            { message: "Failed to generate members recap" },
            { status: 500 }
        );
    }
}
