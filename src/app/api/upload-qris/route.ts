import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/upload-qris
 * Legacy endpoint — now stores QRIS as base64 in NeonDB (UnitSetting table)
 * instead of writing to the filesystem.
 * Kept for backward compatibility with any existing callers.
 */
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

        // Validate size (4MB max — base64 encoding adds ~33% overhead)
        if (file.size > 4 * 1024 * 1024) {
            return NextResponse.json({ message: "Ukuran file maksimal 4MB" }, { status: 400 });
        }

        const safeUnitType = unitType.replace(/[^a-z0-9_]/gi, "").toLowerCase();

        // Convert image to Base64 string and store in DB
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64String = `data:${file.type};base64,${buffer.toString("base64")}`;

        // Upsert to UnitSetting table (same as /api/unit-layanan/qris)
        await prisma.unitSetting.upsert({
            where: { unitType: safeUnitType },
            update: { qrisBase64: base64String },
            create: { unitType: safeUnitType, qrisBase64: base64String },
        });

        return NextResponse.json({ 
            message: "QRIS berhasil disimpan",
            url: base64String, // Return base64 data URL directly
        });
    } catch (error) {
        console.error("POST /api/upload-qris error:", error);
        return NextResponse.json(
            { message: "Gagal menyimpan QRIS" },
            { status: 500 }
        );
    }
}
