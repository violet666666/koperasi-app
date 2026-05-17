import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["admin", "operator"];

async function validateUnitAccess(session: any, productId: number): Promise<Response | null> {
    if (["operator"].includes(session.user.role as string)) return null;
    const user = await prisma.user.findUnique({
        where: { id: Number(session.user.id) },
        select: { unitType: true },
    });
    if (!user?.unitType) return null;
    const product = await prisma.storeProduct.findUnique({
        where: { id: productId },
        select: { unitType: true },
    });
    if (!product || product.unitType !== user.unitType) {
        return NextResponse.json({ message: "Produk tidak ditemukan di unit Anda" }, { status: 403 });
    }
    return null;
}

// GET /api/toko/products/[id]/recipe — List recipe ingredients
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        if (!ALLOWED_ROLES.includes(session.user.role as string))
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { id } = await params;
        const productId = parseInt(id);
        if (isNaN(productId)) return NextResponse.json({ message: "Invalid product ID" }, { status: 400 });

        const accessDenied = await validateUnitAccess(session, productId);
        if (accessDenied) return accessDenied;

        const recipes = await prisma.productRecipe.findMany({
            where: { productId },
            orderBy: { id: "asc" },
        });

        const totalCost = recipes.reduce((sum, r) => sum + Number(r.subtotal), 0);

        return NextResponse.json({
            data: recipes.map(r => ({
                id: r.id,
                ingredientName: r.ingredientName,
                ingredientProductId: r.ingredientProductId,
                quantity: Number(r.quantity),
                unit: r.unit,
                unitCost: Number(r.unitCost),
                subtotal: Number(r.subtotal),
            })),
            totalCost,
        });
    } catch {
        return NextResponse.json({ message: "Gagal memuat resep" }, { status: 500 });
    }
}

// POST /api/toko/products/[id]/recipe — Add ingredient or bulk set
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        if (!ALLOWED_ROLES.includes(session.user.role as string))
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { id } = await params;
        const productId = parseInt(id);
        if (isNaN(productId)) return NextResponse.json({ message: "Invalid product ID" }, { status: 400 });

        const accessDenied = await validateUnitAccess(session, productId);
        if (accessDenied) return accessDenied;

        const body = await request.json();

        // Bulk mode: replace all ingredients at once
        if (Array.isArray(body)) {
            const ingredients = body as { ingredientName: string; quantity: number; unit: string; unitCost: number; ingredientProductId?: number | null }[];

            for (const ing of ingredients) {
                if (!ing.ingredientName || ing.quantity <= 0 || ing.unitCost < 0) {
                    return NextResponse.json({ message: `Invalid ingredient: ${ing.ingredientName}` }, { status: 400 });
                }
                if (ing.ingredientProductId) {
                    const linked = await prisma.storeProduct.findUnique({ where: { id: ing.ingredientProductId } });
                    if (!linked || linked.productType !== "ingredient") {
                        return NextResponse.json({ message: `Invalid ingredient link: ${ing.ingredientName}` }, { status: 400 });
                    }
                }
            }

            const totalCost = ingredients.reduce((sum, ing) => sum + ing.quantity * ing.unitCost, 0);

            await prisma.$transaction(async (tx) => {
                await tx.productRecipe.deleteMany({ where: { productId } });

                for (const ing of ingredients) {
                    const subtotal = ing.quantity * ing.unitCost;
                    await tx.productRecipe.create({
                        data: {
                            productId,
                            ingredientName: ing.ingredientName,
                            quantity: ing.quantity,
                            unit: ing.unit || "ml",
                            unitCost: ing.unitCost,
                            subtotal,
                            ingredientProductId: ing.ingredientProductId || null,
                        },
                    });
                }

                await tx.storeProduct.update({
                    where: { id: productId },
                    data: { costPrice: totalCost },
                });
            });

            return NextResponse.json({ message: "Resep berhasil disimpan", totalCost });
        }

        // Single ingredient mode
        const { ingredientName, quantity, unit, unitCost } = body;
        if (!ingredientName || quantity <= 0 || unitCost < 0) {
            return NextResponse.json({ message: "Data bahan tidak lengkap" }, { status: 400 });
        }

        const subtotal = quantity * unitCost;

        await prisma.$transaction(async (tx) => {
            await tx.productRecipe.create({
                data: { productId, ingredientName, quantity, unit: unit || "ml", unitCost, subtotal },
            });

            const allRecipes = await tx.productRecipe.findMany({ where: { productId } });
            const newTotal = allRecipes.reduce((sum, r) => sum + Number(r.subtotal), 0);
            await tx.storeProduct.update({ where: { id: productId }, data: { costPrice: newTotal } });
        });

        return NextResponse.json({ message: "Bahan berhasil ditambahkan" }, { status: 201 });
    } catch {
        return NextResponse.json({ message: "Gagal menyimpan resep" }, { status: 500 });
    }
}

// PUT /api/toko/products/[id]/recipe — Update single ingredient
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        if (!ALLOWED_ROLES.includes(session.user.role as string))
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { id } = await params;
        const productId = parseInt(id);
        if (isNaN(productId)) return NextResponse.json({ message: "Invalid product ID" }, { status: 400 });

        const accessDenied = await validateUnitAccess(session, productId);
        if (accessDenied) return accessDenied;

        const { recipeId, ingredientName, quantity, unit, unitCost, ingredientProductId } = await request.json();
        if (!recipeId || !ingredientName || quantity <= 0 || unitCost < 0) {
            return NextResponse.json({ message: "Data tidak lengkap" }, { status: 400 });
        }

        const subtotal = quantity * unitCost;

        await prisma.$transaction(async (tx) => {
            await tx.productRecipe.update({
                where: { id: recipeId },
                data: {
                    ingredientName,
                    quantity,
                    unit: unit || "ml",
                    unitCost,
                    subtotal,
                    ...(ingredientProductId !== undefined && { ingredientProductId: ingredientProductId || null }),
                },
            });

            const allRecipes = await tx.productRecipe.findMany({ where: { productId } });
            const newTotal = allRecipes.reduce((sum, r) => sum + Number(r.subtotal), 0);
            await tx.storeProduct.update({ where: { id: productId }, data: { costPrice: newTotal } });
        });

        return NextResponse.json({ message: "Bahan berhasil diupdate" });
    } catch {
        return NextResponse.json({ message: "Gagal mengupdate bahan" }, { status: 500 });
    }
}

// DELETE /api/toko/products/[id]/recipe?recipeId=X — Delete ingredient
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        if (!ALLOWED_ROLES.includes(session.user.role as string))
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { id } = await params;
        const productId = parseInt(id);
        if (isNaN(productId)) return NextResponse.json({ message: "Invalid product ID" }, { status: 400 });

        const accessDenied = await validateUnitAccess(session, productId);
        if (accessDenied) return accessDenied;

        const { searchParams } = new URL(request.url);
        const recipeId = parseInt(searchParams.get("recipeId") || "");
        if (isNaN(recipeId)) return NextResponse.json({ message: "Invalid recipe ID" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            await tx.productRecipe.delete({ where: { id: recipeId } });

            const allRecipes = await tx.productRecipe.findMany({ where: { productId } });
            const newTotal = allRecipes.reduce((sum, r) => sum + Number(r.subtotal), 0);
            await tx.storeProduct.update({ where: { id: productId }, data: { costPrice: newTotal } });
        });

        return NextResponse.json({ message: "Bahan berhasil dihapus" });
    } catch {
        return NextResponse.json({ message: "Gagal menghapus bahan" }, { status: 500 });
    }
}
