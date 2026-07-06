import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";
import { HAJI_UMRAH_TYPES } from "@/lib/services/haji-umrah-savings";

// GET /api/mobile/haji-umrah/savings — List tabungan haji/umrah accounts
// VERBATIM mirror of web GET /api/haji-umrah/savings (auth swapped for mobile JWT).
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "15");
        const search = searchParams.get("search") || "";
        const type = searchParams.get("type"); // "tabungan_haji" | "tabungan_umrah"
        const status = searchParams.get("status"); // "active" | "closed"

        const types = type ? [type] : HAJI_UMRAH_TYPES;

        const where = {
            product: { type: { in: types }, deletedAt: null },
            ...(status && { status }),
            ...(search && {
                OR: [
                    { accountNo: { contains: search, mode: "insensitive" as const } },
                    { member: { name: { contains: search, mode: "insensitive" as const } } },
                    { member: { memberNo: { contains: search, mode: "insensitive" as const } } },
                    { member: { nrp: { contains: search, mode: "insensitive" as const } } },
                ],
            }),
        };

        const [accounts, total] = await Promise.all([
            prisma.savingsAccount.findMany({
                where,
                include: {
                    member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                    product: true,
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.savingsAccount.count({ where }),
        ]);

        // Enrich with progress data
        const enriched = accounts.map((acc) => {
            const balance = Number(acc.balance);
            const target = Number(acc.targetAmount ?? acc.product.targetAmount ?? 0);
            const progress = target > 0 ? Math.min(100, (balance / target) * 100) : 0;
            return {
                ...acc,
                balance,
                target,
                progress: Math.round(progress * 100) / 100,
                monthlyTarget: Number(acc.monthlyTarget ?? 0),
            };
        });

        return NextResponse.json({
            data: enriched,
            meta: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/savings error:", error);
        return NextResponse.json(
            { message: "Failed to fetch savings accounts" },
            { status: 500 }
        );
    }
}
