import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/toko/products/categories — List all categories with product counts
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const unitType = searchParams.get("unitType") || undefined;

        const products = await prisma.storeProduct.findMany({
            where: {
                deletedAt: null,
                isActive: true,
                ...(unitType && { unitType }),
                category: { not: null },
            },
            select: { category: true },
        });

        const countMap = new Map<string, number>();
        for (const p of products) {
            if (p.category) {
                countMap.set(p.category, (countMap.get(p.category) || 0) + 1);
            }
        }

        const categories = Array.from(countMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ data: categories });
    } catch (error) {
        console.error("GET /api/toko/products/categories error:", error);
        return NextResponse.json({ message: "Gagal memuat kategori" }, { status: 500 });
    }
}

// POST /api/toko/products/categories — Rename or delete a category
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengelola kategori" }, { status: 403 });
        }

        const unitType = (session.user as any).unitType || "toko";
        const body = await request.json();
        const { action, category, newCategory } = body;

        if (!action || !category) {
            return NextResponse.json({ message: "Action dan nama kategori wajib diisi" }, { status: 400 });
        }

        const unitFilter = { unitType, deletedAt: null };

        if (action === "rename") {
            if (!newCategory || !newCategory.trim()) {
                return NextResponse.json({ message: "Nama kategori baru tidak boleh kosong" }, { status: 400 });
            }
            if (newCategory.trim().toLowerCase() === category.trim().toLowerCase()) {
                return NextResponse.json({ message: "Nama kategori baru sama dengan yang lama" }, { status: 400 });
            }

            // Check if new category already exists (case-insensitive)
            const existingWithNew = await prisma.storeProduct.findFirst({
                where: { ...unitFilter, category: { equals: newCategory.trim(), mode: "insensitive" } },
            });
            if (existingWithNew) {
                return NextResponse.json(
                    { message: `Kategori "${newCategory.trim()}" sudah ada. Gunakan nama lain.` },
                    { status: 409 }
                );
            }

            const result = await prisma.storeProduct.updateMany({
                where: { ...unitFilter, category },
                data: { category: newCategory.trim() },
            });

            return NextResponse.json({
                message: `Kategori "${category}" berhasil diubah ke "${newCategory.trim()}" (${result.count} produk diperbarui)`,
                data: { affected: result.count },
            });
        }

        if (action === "delete") {
            // Set category to null for all products with this category
            const result = await prisma.storeProduct.updateMany({
                where: { ...unitFilter, category },
                data: { category: null },
            });

            return NextResponse.json({
                message: `Kategori "${category}" berhasil dihapus (${result.count} produk dipindahkan ke "Tanpa Kategori")`,
                data: { affected: result.count },
            });
        }

        return NextResponse.json({ message: `Aksi "${action}" tidak dikenal. Gunakan "rename" atau "delete".` }, { status: 400 });
    } catch (error) {
        console.error("POST /api/toko/products/categories error:", error);
        return NextResponse.json({ message: "Gagal memproses permintaan kategori" }, { status: 500 });
    }
}
