import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/pengumuman/[id]
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const announcement = await prisma.announcement.findUnique({
            where: { id: parseInt(id) },
            include: { author: { select: { id: true, name: true } } },
        });

        if (!announcement || announcement.deletedAt) {
            return NextResponse.json(
                { message: "Pengumuman tidak ditemukan" },
                { status: 404 }
            );
        }

        // Increment views
        await prisma.announcement.update({
            where: { id: parseInt(id) },
            data: { views: { increment: 1 } },
        });

        return NextResponse.json({ data: announcement });
    } catch (error) {
        console.error("GET /api/pengumuman/[id] error:", error);
        return NextResponse.json(
            { message: "Gagal mengambil pengumuman" },
            { status: 500 }
        );
    }
}

// PUT /api/pengumuman/[id]
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const existing = await prisma.announcement.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existing || existing.deletedAt) {
            return NextResponse.json(
                { message: "Pengumuman tidak ditemukan" },
                { status: 404 }
            );
        }

        const isPublished = body.status === "published" && existing.status !== "published";

        const announcement = await prisma.announcement.update({
            where: { id: parseInt(id) },
            data: {
                title: body.title !== undefined ? body.title : existing.title,
                content: body.content !== undefined ? body.content : existing.content,
                category: body.category !== undefined ? body.category : existing.category,
                isPinned: body.isPinned !== undefined ? body.isPinned : existing.isPinned,
                status: body.status !== undefined ? body.status : existing.status,
                publishedAt: isPublished ? new Date() : existing.publishedAt,
            },
            include: { author: { select: { id: true, name: true } } },
        });

        return NextResponse.json({ data: announcement });
    } catch (error) {
        console.error("PUT /api/pengumuman/[id] error:", error);
        return NextResponse.json(
            { message: "Gagal mengupdate pengumuman" },
            { status: 500 }
        );
    }
}

// DELETE /api/pengumuman/[id] (soft delete)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.announcement.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() },
        });

        return NextResponse.json({ message: "Pengumuman berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/pengumuman/[id] error:", error);
        return NextResponse.json(
            { message: "Gagal menghapus pengumuman" },
            { status: 500 }
        );
    }
}
