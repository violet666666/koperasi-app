import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ message: "File hilang" }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ message: "File harus berupa gambar" }, { status: 400 });
        }

        // Validate size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ message: "Ukuran file maksimal 5MB" }, { status: 400 });
        }

        // Convert image to Base64 string
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64String = `data:${file.type};base64,${buffer.toString("base64")}`;

        // Save to UploadedFile
        const uploadedFile = await prisma.uploadedFile.create({
            data: {
                fileName: file.name,
                mimeType: file.type,
                base64Data: base64String,
                uploadedById: parseInt(session.user.id),
                category: "RESTO_WEBSITE_ASSET",
                sizeBytes: file.size,
            },
        });

        // Return the internal URL
        return NextResponse.json({
            message: "File berhasil diupload",
            url: `/api/uploads/${uploadedFile.id}`,
        });
    } catch (error) {
        console.error("POST /api/resto/website-settings/upload error:", error);
        return NextResponse.json(
            { message: "Gagal mengupload file" },
            { status: 500 }
        );
    }
}
