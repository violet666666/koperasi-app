import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/toko/movements - Rekapan riwayat masuk keluar stok produk
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "200");
        const productId = searchParams.get("productId");

        const whereClause: any = {};
        if (productId) {
            whereClause.productId = parseInt(productId);
        }

        // ── 1) Coba ambil dari tabel StoreStockMovement ───────────────
        let formatted: any[] = [];
        try {
            const movements = await prisma.storeStockMovement.findMany({
                where: whereClause,
                include: {
                    product: { select: { id: true, sku: true, name: true, stock: true } },
                    operator: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: limit,
            });

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
            console.warn("StoreStockMovement table query failed, using fallback:", (tableErr as any)?.code || tableErr);
        }

        // ── 2) Fallback: derive dari StoreSale jika tabel kosong/belum ada ──
        if (formatted.length === 0) {
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
                    take: limit,
                });

                for (const sale of sales) {
                    // Skip voided sales
                    const meta = typeof sale.metadata === "string" ? JSON.parse(sale.metadata) : sale.metadata || {};
                    if (meta.isVoided) continue;

                    for (const item of sale.items) {
                        formatted.push({
                            id: `sale-${sale.id}-${item.id}`,
                            date: sale.createdAt,
                            productSku: item.product?.sku || "-",
                            productName: item.product?.name || `Produk #${item.productId}`,
                            type: "out",
                            quantity: item.quantity,
                            notes: `Penjualan ${sale.saleNo}`,
                            operator: sale.createdBy?.name || "Kasir",
                        });
                    }
                }

                // Sort by date desc
                formatted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            } catch (fallbackErr) {
                console.error("Fallback StoreSale derivation failed:", fallbackErr);
            }
        }

        return NextResponse.json({ data: formatted });
    } catch (error) {
        console.error("GET /api/toko/movements error:", error);
        return NextResponse.json({ message: "Failed to fetch stock movements" }, { status: 500 });
    }
}
