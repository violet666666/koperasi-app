import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/savings-recap/members - Per-member savings breakdown
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "100");
        const search = searchParams.get("search") || "";

        const where: any = {
            status: "active",
            deletedAt: null,
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { memberNo: { contains: search, mode: "insensitive" } },
                ],
            }),
        };

        const [members, total] = await Promise.all([
            prisma.member.findMany({
                where,
                select: {
                    id: true,
                    memberNo: true,
                    name: true,
                    tabunganWajib: true,
                    branch: { select: { id: true, name: true } },
                    savingsAccounts: {
                        where: { status: "active" },
                        include: {
                            product: { select: { id: true, code: true, name: true, type: true } },
                        },
                    },
                },
                orderBy: { name: "asc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.member.count({ where }),
        ]);

        const memberRecap = members.map((member) => {
            // Simpanan Pokok: from SavingsAccount where product type = 'pokok'
            const simpananPokok = member.savingsAccounts
                .filter((acc) => acc.product.type === "pokok")
                .reduce((sum, acc) => sum + Number(acc.balance), 0);

            // Simpanan Sukarela: from SavingsAccount where product type = 'sukarela'
            const simpananSukarela = member.savingsAccounts
                .filter((acc) => acc.product.type === "sukarela")
                .reduce((sum, acc) => sum + Number(acc.balance), 0);

            // Other savings types
            const simpananLainnya = member.savingsAccounts
                .filter((acc) => acc.product.type !== "pokok" && acc.product.type !== "sukarela" && acc.product.type !== "wajib")
                .reduce((sum, acc) => sum + Number(acc.balance), 0);

            // Simpanan Wajib: from SavingsAccount where product type = 'wajib'
            const totalWajib = member.savingsAccounts
                .filter((acc) => acc.product.type === "wajib")
                .reduce((sum, acc) => sum + Number(acc.balance), 0);

            return {
                id: member.id,
                memberNo: member.memberNo,
                name: member.name,
                branchName: member.branch?.name || "-",
                simpananPokok,
                simpananWajib: totalWajib,
                simpananSukarela,
                simpananLainnya,
                total: simpananPokok + totalWajib + simpananSukarela + simpananLainnya,
            };
        });

        // Calculate grand totals
        const grandTotals = memberRecap.reduce(
            (acc, m) => ({
                totalPokok: acc.totalPokok + m.simpananPokok,
                totalWajib: acc.totalWajib + m.simpananWajib,
                totalSukarela: acc.totalSukarela + m.simpananSukarela,
                grandTotal: acc.grandTotal + m.total,
            }),
            { totalPokok: 0, totalWajib: 0, totalSukarela: 0, grandTotal: 0 }
        );

        return NextResponse.json({
            data: memberRecap,
            meta: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            },
            totals: grandTotals,
        });
    } catch (error) {
        console.error("GET /api/reports/savings-recap/members error:", error);
        return NextResponse.json(
            { message: "Failed to generate per-member savings recap" },
            { status: 500 }
        );
    }
}
