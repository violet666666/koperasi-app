import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/members?search=xxx — Search members
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "kasir") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);

    try {
        const where: any = { status: "active", deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { nrp: { contains: search, mode: "insensitive" } },
                { memberNo: { contains: search, mode: "insensitive" } },
            ];
        }

        const members = await prisma.member.findMany({
            where,
            select: {
                id: true,
                memberNo: true,
                name: true,
                nrp: true,
                status: true,
                branch: { select: { name: true } },
                savingsAccounts: {
                    where: { status: "active" },
                    select: { balance: true },
                },
                loans: {
                    where: { status: { in: ["active", "overdue"] } },
                    select: { principalOutstanding: true },
                },
            },
            orderBy: { name: "asc" },
            take: limit,
        });

        return NextResponse.json({
            data: members.map((m) => ({
                id: m.id,
                memberNo: m.memberNo,
                name: m.name,
                nrp: m.nrp,
                status: m.status,
                branch: m.branch?.name,
                totalSavings: m.savingsAccounts.reduce((s, a) => s + Number(a.balance), 0),
                totalLoanOutstanding: m.loans.reduce((s, l) => s + Number(l.principalOutstanding), 0),
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/members error:", error);
        return NextResponse.json({ message: "Gagal memuat data anggota" }, { status: 500 });
    }
}
