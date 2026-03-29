import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/audit-logs — Endpoint untuk menarik riwayat aksi system
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    // Pastikan hanya operator/admin/superadmin yang bisa melihat audit log
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "superadmin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const url = new URL(request.url);
        const search = url.searchParams.get("search") || "";
        const limitStr = url.searchParams.get("limit");
        const limit = Math.min(limitStr ? parseInt(limitStr, 10) : 50, 100);

        const where: any = {};
        if (search) {
            where.OR = [
                { userName: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { module: { contains: search, mode: "insensitive" } },
            ];
        }

        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
                id: true,
                action: true,
                module: true,
                description: true,
                userName: true,
                userRole: true,
                status: true,
                createdAt: true,
            },
        });

        return NextResponse.json({
            data: logs.map(log => ({
                id: log.id,
                action: log.action,
                module: log.module,
                description: log.description,
                userName: log.userName,
                userRole: log.userRole,
                status: log.status,
                timestamp: log.createdAt.toISOString(),
            })),
        });
    } catch (error: any) {
        console.error("GET /api/mobile/audit-logs error:", error);
        return NextResponse.json({ message: "Gagal memuat log audit" }, { status: 500 });
    }
}
