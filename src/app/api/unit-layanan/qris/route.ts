import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isSameUnit } from "@/lib/unit-aliases";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "operator"];
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * GET /api/unit-layanan/qris?unitType=xxx
 * Fetch QRIS base64 image on-demand (lazy-loaded, not in stats).
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const unitType = searchParams.get("unitType");
        if (!unitType) {
            return NextResponse.json({ message: "unitType wajib diisi" }, { status: 400 });
        }

        // Unit isolation: non-operator only see their own unit
        const hasManageAll = session.user.permissions?.includes("manage_all");
        const userUnitType = (session.user as any).unitType as string | undefined;
        if (!hasManageAll && userUnitType && !isSameUnit(userUnitType, unitType.replace(/-/g, "_"))) {
            return NextResponse.json({ message: "Anda tidak memiliki akses ke unit ini." }, { status: 403 });
        }

        const safeUnitType = unitType.replace(/[^a-z0-9_]/gi, "").toLowerCase();
        const setting = await prisma.unitSetting.findUnique({
            where: { unitType: safeUnitType },
            select: { qrisBase64: true },
        });

        return NextResponse.json({
            qrisUrl: setting?.qrisBase64 || null,
        });
    } catch (error: unknown) {
        console.error("GET /api/unit-layanan/qris error:", error);
        return NextResponse.json(
            { message: "Gagal memuat QRIS" },
            { status: 500 }
        );
    }
}

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

        // Unit isolation: admin hanya bisa upload QRIS untuk unit sendiri
        const hasManageAll = session.user.permissions?.includes("manage_all");
        const userUnitType = (session.user as any).unitType as string | undefined;
        if (!hasManageAll && userUnitType && !isSameUnit(userUnitType, unitType.replace(/-/g, "_"))) {
            return NextResponse.json({ message: "Anda tidak memiliki akses ke unit ini." }, { status: 403 });
        }

        // Validate size
        if (file.size > MAX_SIZE_BYTES) {
            return NextResponse.json({ message: "Ukuran file maksimal 4MB" }, { status: 400 });
        }

        // Validate type
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ message: "Format file harus PNG, JPG, atau WebP" }, { status: 400 });
        }

        const safeUnitType = unitType.replace(/[^a-z0-9_]/gi, "").toLowerCase();

        // Convert image to Base64 string
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64String = `data:${file.type};base64,${buffer.toString("base64")}`;

        // Upsert direct to UnitSetting table
        await prisma.unitSetting.upsert({
            where: { unitType: safeUnitType },
            update: { qrisBase64: base64String },
            create: { unitType: safeUnitType, qrisBase64: base64String }
        });

        return NextResponse.json({
            message: `QRIS untuk unit ${safeUnitType} berhasil diunggah.`,
            data: { url: base64String, unitType: safeUnitType },
        }, { status: 201 });

    } catch (error: any) {
        console.error("POST /api/unit-layanan/qris error:", error);
        return NextResponse.json({ message: `Gagal mengunggah QRIS: ${error?.message || "Unknown error"}` }, { status: 500 });
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

        // Unit isolation: admin hanya bisa hapus QRIS untuk unit sendiri
        const hasManageAll = session.user.permissions?.includes("manage_all");
        const userUnitType = (session.user as any).unitType as string | undefined;
        if (!hasManageAll && userUnitType && !isSameUnit(userUnitType, unitType.replace(/-/g, "_"))) {
            return NextResponse.json({ message: "Anda tidak memiliki akses ke unit ini." }, { status: 403 });
        }

        const safeUnitType = unitType.replace(/[^a-z0-9_]/gi, "").toLowerCase();

        // Nullify the Base64 in UnitSetting instead of deleting a file
        await prisma.unitSetting.update({
            where: { unitType: safeUnitType },
            data: { qrisBase64: null }
        }).catch((e: any) => {
            // Ignore error if unit setting doesn't exist
            if (e.code !== 'P2025') throw e; 
        });

        return NextResponse.json({ message: `QRIS unit ${safeUnitType} berhasil dihapus.` });

    } catch (error: any) {
        console.error("DELETE /api/unit-layanan/qris error:", error);
        return NextResponse.json({ message: `Gagal menghapus QRIS: ${error?.message || "Unknown error"}` }, { status: 500 });
    }
}
