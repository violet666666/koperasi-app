import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        if (!["operator", "admin"].includes(session.user.role)) {
            return NextResponse.json({ message: "Hanya Admin Unit yang dapat mengubah paket layanan" }, { status: 403 });
        }

        const { slug, id } = await context.params;
        const unitType = slug.replace(/-/g, '_');
        const packageId = parseInt(id);
        const body = await request.json();

        if (session.user.role === "admin" && session.user.unitType !== unitType && session.user.unitType !== null) {
            return NextResponse.json({ message: "Anda tidak berhak memodifikasi paket unit ini" }, { status: 403 });
        }

        const existingPackage = await prisma.unitServicePackage.findUnique({
            where: { id: packageId }
        });

        if (!existingPackage) {
            return NextResponse.json({ message: "Paket tidak ditemukan" }, { status: 404 });
        }

        if (existingPackage.unitType !== unitType) {
            return NextResponse.json({ message: "Paket ini bukan milik unit ini" }, { status: 400 });
        }

        const { name, description, price, isActive, sortOrder } = body;

        const updatedPackage = await prisma.unitServicePackage.update({
            where: { id: packageId },
            data: {
                name: name !== undefined ? name : existingPackage.name,
                description: description !== undefined ? description : existingPackage.description,
                price: price !== undefined ? Number(price) : existingPackage.price,
                isActive: isActive !== undefined ? isActive : existingPackage.isActive,
                sortOrder: sortOrder !== undefined ? Number(sortOrder) : existingPackage.sortOrder,
            }
        });

        return NextResponse.json(updatedPackage);
    } catch (error) {
        console.error("PUT /api/unit/[slug]/packages/[id] error:", error);
        return NextResponse.json({ message: "Gagal memperbarui paket layanan" }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        if (!["operator", "admin"].includes(session.user.role)) {
            return NextResponse.json({ message: "Hanya Admin Unit yang dapat menghapus paket layanan" }, { status: 403 });
        }

        const { slug, id } = await context.params;
        const unitType = slug.replace(/-/g, '_');
        const packageId = parseInt(id);

        if (session.user.role === "admin" && session.user.unitType !== unitType && session.user.unitType !== null) {
            return NextResponse.json({ message: "Anda tidak berhak memodifikasi paket unit ini" }, { status: 403 });
        }

        const existingPackage = await prisma.unitServicePackage.findUnique({
            where: { id: packageId }
        });

        if (!existingPackage) {
            return NextResponse.json({ message: "Paket tidak ditemukan" }, { status: 404 });
        }

        // Just perform soft delete or completely delete if never used. 
        // For simplicity now, let's just delete it directly.
        await prisma.unitServicePackage.delete({
            where: { id: packageId }
        });

        return NextResponse.json({ message: "Paket berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/unit/[slug]/packages/[id] error:", error);
        return NextResponse.json({ message: "Gagal menghapus paket layanan" }, { status: 500 });
    }
}
