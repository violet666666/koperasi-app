import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/members-recap
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");

        const where = {
            deletedAt: null,
            ...(branchId && { branchId: parseInt(branchId) }),
        };

        const [totalMembers, activeMembers, inactiveMembers, resignedMembers] = await Promise.all([
            prisma.member.count({ where }),
            prisma.member.count({ where: { ...where, status: "active" } }),
            prisma.member.count({ where: { ...where, status: "inactive" } }),
            prisma.member.count({ where: { ...where, status: "resigned" } }),
        ]);

        // Get members with their financial summary
        const members = await prisma.member.findMany({
            where: { ...where, status: "active" },
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
            take: 50,
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
