import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isFbUnit } from "@/lib/constants/units";
import { normalizeUnitType } from "@/lib/unit-aliases";

// GET /api/toko/products/categories — List categories with product counts
// F&B units: from StoreCategory table (sorted by sortOrder)
// Toko/other: from StoreProduct.category string aggregate (unchanged)
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const rawUnitType = searchParams.get("unitType") || undefined;
        const unitType = rawUnitType ? (normalizeUnitType(rawUnitType) || rawUnitType) : undefined;

        if (unitType && isFbUnit(unitType)) {
            // Auto-backfill: link products with matching category string but no categoryId FK
            const orphanProducts = await prisma.storeProduct.findMany({
                where: {
                    unitType,
                    categoryId: null,
                    category: { not: null },
                    deletedAt: null,
                    isActive: true,
                },
                select: { id: true, category: true },
            });
            if (orphanProducts.length > 0) {
                const allCats = await prisma.storeCategory.findMany({
                    where: { unitType, isActive: true },
                    select: { id: true, name: true },
                });
                const catMap = new Map(allCats.map(c => [c.name.toLowerCase(), c.id]));
                for (const p of orphanProducts) {
                    const catId = catMap.get(p.category!.toLowerCase());
                    if (catId) {
                        await prisma.storeProduct.update({
                            where: { id: p.id },
                            data: { categoryId: catId },
                        }).catch(() => {});
                    }
                }
            }

            const categories = await prisma.storeCategory.findMany({
                where: { unitType, isActive: true },
                orderBy: { sortOrder: "asc" },
                include: {
                    _count: {
                        select: {
                            products: {
                                where: { deletedAt: null, isActive: true },
                            },
                        },
                    },
                },
            });
            return NextResponse.json({
                data: categories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    count: c._count.products,
                    sortOrder: c.sortOrder,
                })),
            });
        }

        // Original Toko/other: aggregate from StoreProduct.category string
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

// POST /api/toko/products/categories — Create (F&B) or rename/delete (Toko)
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

        const rawUnitType = (session.user as any).unitType || "toko";
        const unitType = normalizeUnitType(rawUnitType) || rawUnitType;
        const body = await request.json();
        const { action, category, newCategory } = body;

        // F&B: Create new category in StoreCategory table
        if (isFbUnit(unitType) && (!action || action === "create")) {
            const name = (category || newCategory || "").trim();
            if (!name) {
                return NextResponse.json({ message: "Nama kategori wajib diisi" }, { status: 400 });
            }

            const existing = await prisma.storeCategory.findFirst({
                where: { name: { equals: name, mode: "insensitive" }, unitType },
            });
            if (existing) {
                return NextResponse.json({ message: `Kategori "${name}" sudah ada` }, { status: 409 });
            }

            const maxSort = await prisma.storeCategory.aggregate({
                where: { unitType, isActive: true },
                _max: { sortOrder: true },
            });

            const cat = await prisma.storeCategory.create({
                data: {
                    name,
                    unitType,
                    sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
                },
            });

            return NextResponse.json({ data: { id: cat.id, name: cat.name, sortOrder: cat.sortOrder } }, { status: 201 });
        }

        // Toko/other: existing rename/delete logic (unchanged)
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

// PUT /api/toko/products/categories — Update F&B category (name, sortOrder)
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengelola kategori" }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, sortOrder } = body;

        if (!id) {
            return NextResponse.json({ message: "ID kategori wajib diisi" }, { status: 400 });
        }

        const existing = await prisma.storeCategory.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ message: "Kategori tidak ditemukan" }, { status: 404 });
        }

        if (!isFbUnit(existing.unitType)) {
            return NextResponse.json({ message: "Endpoint ini hanya untuk unit F&B" }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) {
            const trimmed = name.trim();
            if (!trimmed) return NextResponse.json({ message: "Nama kategori tidak boleh kosong" }, { status: 400 });

            const dup = await prisma.storeCategory.findFirst({
                where: { name: { equals: trimmed, mode: "insensitive" }, unitType: existing.unitType, NOT: { id } },
            });
            if (dup) return NextResponse.json({ message: `Kategori "${trimmed}" sudah ada` }, { status: 409 });

            updateData.name = trimmed;
        }
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

        const updated = await prisma.storeCategory.update({
            where: { id },
            data: updateData,
        });

        // Sync denormalized `category` string on linked products when name changes
        if (updateData.name && updateData.name !== existing.name) {
            await prisma.storeProduct.updateMany({
                where: { categoryId: id },
                data: { category: updateData.name },
            });
        }

        return NextResponse.json({ data: { id: updated.id, name: updated.name, sortOrder: updated.sortOrder } });
    } catch (error) {
        console.error("PUT /api/toko/products/categories error:", error);
        return NextResponse.json({ message: "Gagal memperbarui kategori" }, { status: 500 });
    }
}

// DELETE /api/toko/products/categories — Delete F&B category, unlink products
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengelola kategori" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get("id") || "0");
        if (!id) {
            return NextResponse.json({ message: "ID kategori wajib diisi" }, { status: 400 });
        }

        const existing = await prisma.storeCategory.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ message: "Kategori tidak ditemukan" }, { status: 404 });
        }

        if (!isFbUnit(existing.unitType)) {
            return NextResponse.json({ message: "Endpoint ini hanya untuk unit F&B" }, { status: 400 });
        }

        await prisma.$transaction([
            prisma.storeProduct.updateMany({
                where: { categoryId: id },
                data: { categoryId: null, category: null },
            }),
            prisma.storeCategory.update({
                where: { id },
                data: { isActive: false },
            }),
        ]);

        return NextResponse.json({ message: `Kategori "${existing.name}" berhasil dihapus` });
    } catch (error) {
        console.error("DELETE /api/toko/products/categories error:", error);
        return NextResponse.json({ message: "Gagal menghapus kategori" }, { status: 500 });
    }
}
