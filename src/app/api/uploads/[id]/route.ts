import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/uploads/[id]
 * Serve an uploaded file from the database (base64 stored in NeonDB).
 * Returns the raw image binary with correct Content-Type header.
 */
export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const fileId = parseInt(id);

        if (isNaN(fileId)) {
            return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });
        }

        const file = await prisma.uploadedFile.findUnique({
            where: { id: fileId },
            select: { base64Data: true, mimeType: true, fileName: true },
        });

        if (!file) {
            return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
        }

        // base64Data is stored as "data:image/jpeg;base64,/9j/4AAQ..." format
        // Extract just the base64 portion
        const base64Match = file.base64Data.match(/^data:[^;]+;base64,(.+)$/);
        const rawBase64 = base64Match ? base64Match[1] : file.base64Data;
        const buffer = Buffer.from(rawBase64, "base64");

        return new Response(buffer, {
            status: 200,
            headers: {
                "Content-Type": file.mimeType,
                "Content-Disposition": `inline; filename="${file.fileName}"`,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("GET /api/uploads/[id] error:", error);
        return NextResponse.json({ message: "Gagal memuat file" }, { status: 500 });
    }
}
