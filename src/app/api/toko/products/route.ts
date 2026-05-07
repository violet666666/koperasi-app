import { NextResponse } from "next/server";
import prisma, { prismaRead } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/toko/products - List store products (with server-side pagination)
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const unitType = searchParams.get("unitType") || null;
        const category = searchParams.get("category") || null;
        const pageParam = searchParams.get("page");
        const perPageParam = searchParams.get("perPage");
        const isPaginated = !!pageParam || !!perPageParam;
        const page = Math.max(1, parseInt(pageParam || "1"));
        const perPage = Math.min(200, Math.max(1, parseInt(perPageParam || "50")));

        const where = {
            deletedAt: null,
            isActive: true,
            ...(unitType && { unitType: unitType }),
            ...(category && category !== "all" && { category }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" as const } },
                    { sku: { contains: search, mode: "insensitive" as const } },
                ],
            }),
        };

        const queryOptions = {
            where,
            orderBy: { name: "asc" } as const,
            ...(isPaginated && { skip: (page - 1) * perPage, take: perPage }),
        };

        // Try prismaRead (Neon HTTP) first, fall back to prisma (TCP) if it fails
        let products: any[];
        let totalCount: number;
        try {
            [products, totalCount] = await Promise.all([
                prismaRead.storeProduct.findMany(queryOptions),
                isPaginated ? prismaRead.storeProduct.count({ where }) : Promise.resolve(0),
            ]);
        } catch (readError) {
            console.warn("[Products API] prismaRead failed, falling back to TCP:", readError instanceof Error ? readError.message : readError);
            [products, totalCount] = await Promise.all([
                prisma.storeProduct.findMany(queryOptions),
                isPaginated ? prisma.storeProduct.count({ where }) : Promise.resolve(0),
            ]);
        }

        console.log(`[Products API] unitType=${unitType} search="${search}" found=${products.length} total=${totalCount} isPaginated=${isPaginated}`);

        // Single SQL aggregate replaces two queries (aggregate + findMany for stats)
        const filterUnitType = unitType || null;
        const filterCategory = (category && category !== "all") ? category : null;
        const filterSearch = search || null;
        const agStats = isPaginated ? await prisma.$queryRaw<{
            total_products: number; total_stock: number; total_value: number; out_of_stock: number; low_stock: number;
        }[]>`
            SELECT
                COUNT(*)::int as total_products,
                COALESCE(SUM(stock_gdg + stock_toko), 0)::int as total_stock,
                COALESCE(SUM(CAST(sell_price AS float) * (stock_gdg + stock_toko)), 0)::float as total_value,
                SUM(CASE WHEN stock_gdg + stock_toko <= 0 THEN 1 ELSE 0 END)::int as out_of_stock,
                SUM(CASE WHEN stock_gdg + stock_toko > 0 AND stock_gdg + stock_toko <= min_stock THEN 1 ELSE 0 END)::int as low_stock
            FROM store_products
            WHERE deleted_at IS NULL AND is_active = true
              AND (${filterUnitType}::text IS NULL OR unit_type = ${filterUnitType})
              AND (${filterCategory}::text IS NULL OR category = ${filterCategory})
              AND (${filterSearch}::text IS NULL OR name ILIKE '%' || ${filterSearch} || '%' OR sku ILIKE '%' || ${filterSearch} || '%')
        ` : null;

        const mapped = products.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            imageUrl: p.imageUrl,
            price: Number(p.sellPrice),
            discountType: p.discountType,
            discountValue: Number(p.discountValue),
            costPrice: Number(p.costPrice),
            stock: p.stockGdg + p.stockToko,
            stockGdg: p.stockGdg,
            stockToko: p.stockToko,
            minStock: p.minStock,
            unit: p.unit,
            isService: p.isService,
            unitType: p.unitType,
        }));

        // Backward-compatible: paginated requests return { data: { products, pagination } }
        // Non-paginated requests return { data: [...] } (original format)
        if (isPaginated) {
            const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
            return NextResponse.json({
                data: {
                    products: mapped,
                    pagination: { page, perPage, totalCount, totalPages },
                    stats: agStats?.[0] ? {
                        totalProducts: agStats[0].total_products,
                        totalStock: agStats[0].total_stock,
                        totalValue: agStats[0].total_value,
                        outOfStock: agStats[0].out_of_stock,
                        lowStock: agStats[0].low_stock,
                    } : null,
                },
            });
        }

        return NextResponse.json({ data: mapped });
    } catch (error) {
        console.error("GET /api/toko/products error:", error);
        console.error("Error details:", error instanceof Error ? { message: error.message, stack: error.stack } : error);
        return NextResponse.json(
            { message: "Failed to fetch products", error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// POST /api/toko/products - Create a new product (admin/operator only)
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan menambah produk" }, { status: 403 });
        }

        const userId = parseInt(session.user.id);

        const body = await request.json();
        const { sku, name, category, costPrice, sellPrice, discountType, discountValue, stock, stockGdg, stockToko, minStock, unit, isService, imageUrl, unitType } = body;

        if (!sku || !name || sellPrice === undefined || sellPrice === null) {
            return NextResponse.json(
                { message: "SKU, Nama Produk, dan Harga Jual wajib diisi" },
                { status: 400 }
            );
        }

        if (isNaN(Number(sellPrice)) || Number(sellPrice) < 0) {
            return NextResponse.json(
                { message: "Harga Jual harus berupa angka yang valid" },
                { status: 400 }
            );
        }

        // Check if SKU already exists (including soft-deleted)
        const existing = await prisma.storeProduct.findFirst({
            where: { sku },
        });

        if (existing) {
            // If soft-deleted or inactive, restore with new data
            if (existing.deletedAt || !existing.isActive) {
                const restored = await prisma.storeProduct.update({
                    where: { id: existing.id },
                    data: {
                        name,
                        category: category || null,
                        imageUrl: imageUrl || null,
                        costPrice: costPrice || 0,
                        sellPrice,
                        discountType: discountType || null,
                        discountValue: discountValue || 0,
                        stock: stock || 0,
                        stockGdg: stockGdg || 0,
                        stockToko: stockToko || 0,
                        minStock: minStock || 5,
                        unit: unit || "pcs",
                        unitType: unitType || "toko",
                        isService: isService || false,
                        isActive: true,
                        deletedAt: null,
                    },
                });
                return NextResponse.json({ data: restored, restored: true }, { status: 201 });
            }
            return NextResponse.json(
                { message: `SKU "${sku}" sudah digunakan oleh produk "${existing.name}". Gunakan SKU lain.` },
                { status: 409 }
            );
        }

        const product = await prisma.storeProduct.create({
            data: {
                sku,
                name,
                category: category || null,
                imageUrl: imageUrl || null,
                costPrice: costPrice || 0,
                sellPrice,
                discountType: discountType || null,
                discountValue: discountValue || 0,
                stock: stock || 0,
                stockGdg: stockGdg || 0,
                stockToko: stockToko || 0,
                minStock: minStock || 5,
                unit: unit || "pcs",
                unitType: unitType || "toko",
                isService: isService || false,
            },
        });

        // Insert log inisialisasi jika mengisi sisa stok pada produk baru
        if (product.stock > 0 && !product.isService) {
            await prisma.storeStockMovement.create({
                 data: {
                     productId: product.id,
                     type: "in",
                     quantity: product.stock,
                     reference: "Stok Awal Produk Baru",
                     notes: "Inisialisasi sistem",
                     operatorId: userId
                 }
            });
        }

        return NextResponse.json({ data: product }, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/toko/products error:", error);

        // Prisma unique constraint violation (P2002)
        if (error?.code === "P2002") {
            const target = error.meta?.target as string[] | undefined;
            if (target?.includes("sku")) {
                return NextResponse.json(
                    { message: "SKU sudah digunakan. Gunakan kode produk yang berbeda." },
                    { status: 409 }
                );
            }
        }

        return NextResponse.json(
            { message: "Gagal menambahkan produk. Periksa kembali data yang diinput." },
            { status: 500 }
        );
    }
}
