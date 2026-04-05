import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "operator", "super_admin"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * POST /api/unit-layanan/qris
 * Upload gambar QRIS untuk sebuah unit.
 * Body: FormData { unitType: string, file: File }
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ message: "Hanya Admin atau Operator yang dapat mengunggah QRIS." }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const unitType = formData.get("unitType") as string | null;

        if (!file || !unitType) {
            return NextResponse.json({ message: "file dan unitType wajib diisi" }, { status: 400 });
        }

        // Validate size
        if (file.size > MAX_SIZE_BYTES) {
            return NextResponse.json({ message: "Ukuran file maksimal 2MB" }, { status: 400 });
        }

        // Validate type
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ message: "Format file harus PNG, JPG, atau WebP" }, { status: 400 });
        }

        // Sanitize unitType to prevent path traversal
        const safeUnitType = unitType.replace(/[^a-z0-9_]/gi, "").toLowerCase();
        const filename = `qris-${safeUnitType}.png`;
        const uploadDir = path.join(process.cwd(), "public", "uploads", "qris");
        const filePath = path.join(uploadDir, filename);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        return NextResponse.json({
            message: `QRIS untuk unit ${safeUnitType} berhasil diunggah.`,
            data: { url: `/uploads/qris/${filename}`, unitType: safeUnitType },
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/unit-layanan/qris error:", error);
        return NextResponse.json({ message: "Gagal mengunggah QRIS" }, { status: 500 });
    }
}

/**
 * DELETE /api/unit-layanan/qris?unitType=cuci_mobil
 * Hapus gambar QRIS untuk sebuah unit.
 */
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ message: "Hanya Admin atau Operator yang dapat menghapus QRIS." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const unitType = searchParams.get("unitType");

        if (!unitType) {
            return NextResponse.json({ message: "unitType wajib diisi" }, { status: 400 });
        }

        const safeUnitType = unitType.replace(/[^a-z0-9_]/gi, "").toLowerCase();
        const filename = `qris-${safeUnitType}.png`;
        const filePath = path.join(process.cwd(), "public", "uploads", "qris", filename);

        if (!existsSync(filePath)) {
            return NextResponse.json({ message: "File QRIS tidak ditemukan" }, { status: 404 });
        }

        await unlink(filePath);

        return NextResponse.json({ message: `QRIS unit ${safeUnitType} berhasil dihapus.` });

    } catch (error) {
        console.error("DELETE /api/unit-layanan/qris error:", error);
        return NextResponse.json({ message: "Gagal menghapus QRIS" }, { status: 500 });
    }
}
