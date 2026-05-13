import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/toko/movements - Rekapan riwayat masuk keluar stok produk (with server-side pagination)
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get("productId");
        const filterType = searchParams.get("type") || null;
        const searchQuery = searchParams.get("search")?.trim() || null;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const perPage = Math.min(500, Math.max(1, parseInt(searchParams.get("perPage") || "50")));
        const unitType = (session.user.unitType as string) || "toko";

        const whereClause: Record<string, unknown> = {
            product: { unitType },
        };
        if (productId) {
            whereClause.productId = parseInt(productId);
        }
        if (filterType && filterType !== "all") {
            whereClause.type = filterType;
        }
        if (searchQuery) {
            whereClause.OR = [
                { product: { name: { contains: searchQuery, mode: "insensitive" } } },
                { product: { sku: { contains: searchQuery, mode: "insensitive" } } },
                { reference: { contains: searchQuery, mode: "insensitive" } } as any,
                { notes: { contains: searchQuery, mode: "insensitive" } } as any,
            ];
        }

        // ── 1) Coba ambil dari tabel StoreStockMovement ───────────────
        let formatted: Record<string, unknown>[] = [];
        let totalCount = 0;
        try {
            const [movements, count] = await Promise.all([
                prisma.storeStockMovement.findMany({
                    where: whereClause,
                    include: {
                        product: { select: { id: true, sku: true, name: true, stock: true } },
                        operator: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    skip: (page - 1) * perPage,
                    take: perPage,
                }),
                prisma.storeStockMovement.count({ where: whereClause }),
            ]);

            totalCount = count;
            formatted = movements.map(m => ({
                id: m.id,
                date: m.createdAt,
                productSku: m.product.sku,
                productName: m.product.name,
                type: m.type,
                quantity: m.quantity,
                notes: (m.reference ? m.reference + (m.notes ? " - " + m.notes : "") : m.notes) || "-",
                operator: m.operator?.name || "System",
                status: m.status || "active",
                reference: m.reference || null,
            }));
        } catch (tableErr) {
            // Tabel belum ada di database (belum migrasi) — lanjut fallback
            console.warn("StoreStockMovement table query failed, using fallback:", (tableErr as Error)?.message || tableErr);
        }

        // ── 2) Fallback: derive dari StoreSale jika tabel kosong/belum ada ──
        if (formatted.length === 0 && totalCount === 0) {
            try {
                const sales = await prisma.storeSale.findMany({
                    where: {
                        ...(productId ? { items: { some: { productId: parseInt(productId) } } } : {}),
                    },
                    include: {
                        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
                        createdBy: { select: { name: true } },
                    },
                    orderBy: { createdAt: "desc" },
                });

                const allFormatted: Record<string, unknown>[] = [];
                for (const sale of sales) {
                    // Skip voided sales
                    const meta = typeof sale.metadata === "string" ? JSON.parse(sale.metadata) : sale.metadata || {};
                    if ((meta as Record<string, unknown>).isVoided) continue;

                    for (const item of sale.items) {
                        const itemData = {
                            id: `sale-${sale.id}-${item.id}`,
                            date: sale.createdAt,
                            productSku: item.product?.sku || "-",
                            productName: item.product?.name || `Produk #${item.productId}`,
                            type: "out",
                            quantity: item.quantity,
                            notes: `Penjualan ${sale.saleNo}`,
                            operator: sale.createdBy?.name || "Kasir",
                        };
                        // Apply type filter
                        if (!filterType || filterType === "all" || itemData.type === filterType) {
                            allFormatted.push(itemData);
                        }
                    }
                }

                // Sort by date desc
                allFormatted.sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());

                totalCount = allFormatted.length;
                // Apply pagination to fallback results
                formatted = allFormatted.slice((page - 1) * perPage, page * perPage);
            } catch (fallbackErr) {
                console.error("Fallback StoreSale derivation failed:", fallbackErr);
            }
        }

        const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

        return NextResponse.json({
            data: formatted,
            pagination: {
                page,
                perPage,
                totalCount,
                totalPages,
            },
        });
    } catch (error) {
        console.error("GET /api/toko/movements error:", error);
        return NextResponse.json({ message: "Failed to fetch stock movements" }, { status: 500 });
    }
}
