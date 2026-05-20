import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const isDetail = searchParams.get("isDetail");

        // Fetch flat Chart of Accounts for mobile
        const accounts = await prisma.account.findMany({
            where: {
                deletedAt: null,
                ...(isDetail === "true" ? { isDetail: true } : {}),
            },
            orderBy: { code: "asc" },
            select: {
                id: true,
                code: true,
                name: true,
                type: true,
                isDetail: true,
                normalBalance: true,
            },
        });

        return NextResponse.json({ data: accounts });
    } catch (error: any) {
        console.error("GET /api/mobile/accounts error:", error);
        return NextResponse.json({ message: "Gagal memuat daftar akun" }, { status: 500 });
    }
}
