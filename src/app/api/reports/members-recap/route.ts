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

        if (isExport) {
            // Export mode: fetch ALL members (no pagination)
            const allMembers = await prisma.member.findMany({
                where: activeWhere,
                include: {
                    branch: { select: { id: true, name: true } },
                    _count: {
                        select: {
                            savingsAccounts: true,
                            loans: true,
                        },
                    },
                },
                orderBy: { memberNo: "asc" },
            });

            const recap = {
                summary: {
                    total: totalMembers,
                    active: activeMembers,
                    inactive: inactiveMembers,
                    resigned: resignedMembers,
                },
                members: allMembers.map((m) => ({
                    id: m.id,
                    memberNo: m.memberNo,
                    name: m.name,
                    phone: m.phone,
                    status: m.status,
                    joinDate: m.joinDate,
                    branch: m.branch?.name || "Pusat",
                    savingsAccountCount: m._count.savingsAccounts,
                    loanCount: m._count.loans,
                })),
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
                _count: {
                    select: {
                        savingsAccounts: true,
                        loans: true,
                    },
                },
            },
            orderBy: { memberNo: "asc" },
            skip: (page - 1) * perPage,
            take: perPage,
        });

        const recap = {
            summary: {
                total: totalMembers,
                active: activeMembers,
                inactive: inactiveMembers,
                resigned: resignedMembers,
            },
            members: members.map((m) => ({
                id: m.id,
                memberNo: m.memberNo,
                name: m.name,
                phone: m.phone,
                status: m.status,
                joinDate: m.joinDate,
                branch: m.branch?.name || "Pusat",
                savingsAccountCount: m._count.savingsAccounts,
                loanCount: m._count.loans,
            })),
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
