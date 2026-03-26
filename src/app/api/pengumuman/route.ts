import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/pengumuman
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const category = searchParams.get("category") || "";
        const status = searchParams.get("status") || "";

        const where: any = { deletedAt: null };
        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { content: { contains: search, mode: "insensitive" } },
            ];
        }
        if (category) where.category = category;
        if (status) where.status = status;

        const announcements = await prisma.announcement.findMany({
            where,
            include: { author: { select: { id: true, name: true } } },
            orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        });

        return NextResponse.json({ data: announcements });
    } catch (error) {
        console.error("GET /api/pengumuman error:", error);
        return NextResponse.json(
            { message: "Gagal mengambil data pengumuman" },
            { status: 500 }
        );
    }
}

// POST /api/pengumuman
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { title, content, category, isPinned, status } = body;

        if (!title || !content) {
            return NextResponse.json(
                { message: "Judul dan isi pengumuman wajib diisi" },
                { status: 400 }
            );
        }

        const isPublished = status === "published";

        const announcement = await prisma.announcement.create({
            data: {
                title,
                content,
                category: category || "info",
                isPinned: isPinned || false,
                status: status || "draft",
                authorId: parseInt(session.user.id),
                publishedAt: isPublished ? new Date() : null,
            },
            include: { author: { select: { id: true, name: true } } },
        });

        return NextResponse.json({ data: announcement }, { status: 201 });
    } catch (error) {
        console.error("POST /api/pengumuman error:", error);
        return NextResponse.json(
            { message: "Gagal membuat pengumuman" },
            { status: 500 }
        );
    }
}
