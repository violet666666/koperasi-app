import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const unitType = formData.get("unitType") as string;

        if (!file || !unitType) {
            return NextResponse.json({ message: "File atau unitType hilang" }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ message: "File harus berupa gambar (PNG/JPG)" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Always save as .png for consistency, or keep original extension. We'll force .png for predictable fetching
        const fileName = `qris-${unitType}.png`;
        const uploadDir = path.join(process.cwd(), "public", "uploads", "qris");

        // Ensure directory exists
        try {
            await fs.access(uploadDir);
        } catch (_) {
            await fs.mkdir(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, fileName);

        // Write the file
        await fs.writeFile(filePath, buffer);

        return NextResponse.json({ 
            message: "QRIS berhasil disimpan",
            url: `/uploads/qris/${fileName}?t=${Date.now()}` // Cache buster
        });
    } catch (error) {
        console.error("POST /api/upload-qris error:", error);
        return NextResponse.json(
            { message: "Gagal menyimpan QRIS" },
            { status: 500 }
        );
    }
}
