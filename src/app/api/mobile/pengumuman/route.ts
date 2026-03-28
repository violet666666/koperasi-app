import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/pengumuman — Daftar pengumuman koperasi
export async function GET(request: Request) {
    const mobileUser = getMobileUser(request);
    if (!mobileUser) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "20");

        const announcements = await prisma.announcement.findMany({
            where: { status: "published", deletedAt: null },
            orderBy: [
                { isPinned: "desc" },
                { createdAt: "desc" },
            ],
            take: limit,
            include: {
                author: { select: { name: true } },
            },
        });

        return NextResponse.json({
            data: announcements.map((a) => ({
                id: a.id,
                title: a.title,
                content: a.content,
                category: a.category,
                isPinned: a.isPinned,
                authorName: a.author?.name || "Admin",
                createdAt: a.createdAt,
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/pengumuman error:", error);
        return NextResponse.json({ message: "Gagal memuat pengumuman" }, { status: 500 });
    }
}
