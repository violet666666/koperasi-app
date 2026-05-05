import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/notifications — Paginated notification list for current user
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(request.url);
        const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 100);
        const type = searchParams.get("type");
        const unreadOnly = searchParams.get("unread") === "true";

        const where: any = { userId: parseInt(user.id) };
        if (type) {
            where.type = type;
        }
        if (unreadOnly) {
            where.isRead = false;
        }

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    type: true,
                    title: true,
                    message: true,
                    data: true,
                    isRead: true,
                    readAt: true,
                    createdAt: true,
                },
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({
                where: { userId: parseInt(user.id), isRead: false },
            }),
        ]);

        return NextResponse.json({
            data: notifications.map((n) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                data: n.data,
                isRead: n.isRead,
                readAt: n.readAt?.toISOString() ?? null,
                createdAt: n.createdAt.toISOString(),
            })),
            unreadCount,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        console.error("GET /api/mobile/notifications error:", error);
        return NextResponse.json(
            { message: "Gagal memuat notifikasi" },
            { status: 500 }
        );
    }
}

// PUT /api/mobile/notifications — Mark all unread notifications as read
export async function PUT(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    try {
        const userId = parseInt(user.id);

        const result = await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });

        return NextResponse.json({
            message: "Semua notifikasi ditandai sudah dibaca",
            updatedCount: result.count,
        });
    } catch (error: any) {
        console.error("PUT /api/mobile/notifications error:", error);
        return NextResponse.json(
            { message: "Gagal menandai notifikasi" },
            { status: 500 }
        );
    }
}
