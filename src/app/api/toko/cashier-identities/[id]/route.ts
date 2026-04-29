import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

const ALLOWED_ROLES = ["admin", "operator", "super_admin"];

// PUT /api/toko/cashier-identities/[id] — Update identity
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id: rawId } = await params;
        const id = parseInt(rawId);
        if (isNaN(id)) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });

        const existing = await prisma.cashierIdentity.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ message: "Identitas tidak ditemukan" }, { status: 404 });

        const body = await request.json();
        const updateData: Record<string, unknown> = {};

        if (body.displayName !== undefined) {
            if (body.displayName.length > 50) {
                return NextResponse.json({ message: "Nama tampilan maks 50 karakter" }, { status: 400 });
            }
            updateData.displayName = body.displayName;
        }

        if (body.pin !== undefined) {
            if (!/^\d{4,6}$/.test(body.pin)) {
                return NextResponse.json({ message: "PIN harus 4-6 digit angka" }, { status: 400 });
            }
            updateData.pin = await bcrypt.hash(body.pin, 10);
        }

        if (body.isActive !== undefined) {
            updateData.isActive = body.isActive;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: "Tidak ada data yang diubah" }, { status: 400 });
        }

        const updated = await prisma.cashierIdentity.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            data: { id: updated.id, username: updated.username, displayName: updated.displayName, isActive: updated.isActive },
        });
    } catch (error) {
        console.error("PUT /api/toko/cashier-identities/[id] error:", error);
        return NextResponse.json({ message: "Gagal memperbarui identitas" }, { status: 500 });
    }
}

// DELETE /api/toko/cashier-identities/[id] — Soft delete
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id: rawId } = await params;
        const id = parseInt(rawId);
        if (isNaN(id)) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });

        const existing = await prisma.cashierIdentity.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ message: "Identitas tidak ditemukan" }, { status: 404 });

        // Check for active shifts
        const activeShift = await prisma.cashierShift.findFirst({
            where: { cashierIdentityId: id, status: "open" },
        });
        if (activeShift) {
            return NextResponse.json({ message: "Tidak dapat menghapus kasir yang memiliki shift aktif" }, { status: 400 });
        }

        await prisma.cashierIdentity.update({
            where: { id },
            data: { isActive: false },
        });

        return NextResponse.json({ message: "Identitas kasir berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/toko/cashier-identities/[id] error:", error);
        return NextResponse.json({ message: "Gagal menghapus identitas" }, { status: 500 });
    }
}
