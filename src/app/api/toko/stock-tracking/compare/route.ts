import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface CompareItem {
    productId: string;
    physicalStock: number;
}

// POST /api/toko/stock-tracking/compare
// Analyze stock discrepancies and flag suspicious items
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userRole = typeof session.user.role === "string"
            ? session.user.role
            : (session.user.role as { name: string })?.name;

        if (!["admin", "operator"].includes(userRole)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { items, location, dateFrom, dateTo } = body as {
            items: CompareItem[];
            location: string;
            dateFrom?: string;
            dateTo?: string;
        };

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "Data items kosong" }, { status: 400 });
        }

        const productIds = items.map((item) => item.productId);

        const products = await prisma.storeProduct.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                unit: true,
                stockGdg: true,
                stockToko: true,
                costPrice: true,
                sellPrice: true,
            },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));
        const stockField = location === "gudang" ? "stockGdg" : "stockToko";

        const toDate = dateTo ? new Date(dateTo) : new Date();
        const fromDate = dateFrom ? new Date(dateFrom) : new Date(toDate);
        if (!dateFrom) {
            fromDate.setDate(fromDate.getDate() - 7);
        }
        toDate.setHours(23, 59, 59, 999);
        fromDate.setHours(0, 0, 0, 0);

        const saleItems = await prisma.storeSaleItem.findMany({
            where: {
                productId: { in: productIds },
                sale: {
                    createdAt: { gte: fromDate, lte: toDate },
                    unitType: "toko",
                },
            },
            select: {
                productId: true,
                quantity: true,
                sale: {
                    select: {
                        metadata: true,
                    },
                },
            },
        });

        const soldByProduct = new Map<string, number>();
        for (const item of saleItems) {
            const meta = item.sale?.metadata as Record<string, unknown> | null;
            if (meta?.isVoided === true) continue;
            const current = soldByProduct.get(item.productId) || 0;
            soldByProduct.set(item.productId, current + item.quantity);
        }

        const movements = await prisma.storeStockMovement.findMany({
            where: {
                productId: { in: productIds },
                type: "out",
                status: "active",
                createdAt: { gte: fromDate, lte: toDate },
            },
            select: {
                productId: true,
                quantity: true,
                reason: true,
            },
        });

        const outByProduct = new Map<string, number>();
        for (const m of movements) {
            if (m.reason === "sale") continue;
            const current = outByProduct.get(m.productId) || 0;
            outByProduct.set(m.productId, current + m.quantity);
        }

        const results = items.map((item) => {
            const product = productMap.get(item.productId);
            if (!product) return null;

            const stockSystem = stockField === "gudang" ? product.stockGdg : product.stockToko;
            const difference = item.physicalStock - stockSystem;
            const costPrice = Number(product.costPrice) || 0;
            const estimatedLoss = difference < 0 ? Math.abs(difference) * costPrice : 0;
            const totalSold = soldByProduct.get(item.productId) || 0;
            const totalOut = outByProduct.get(item.productId) || 0;

            const accountedFor = totalSold + totalOut;
            const isSuspicious = difference < 0 && Math.abs(difference) > accountedFor;
            const unaccounted = isSuspicious ? Math.abs(difference) - accountedFor : 0;

            let status: "sesuai" | "kurang" | "lebih" = "sesuai";
            if (difference < 0) status = "kurang";
            else if (difference > 0) status = "lebih";

            const suspiciousNote = isSuspicious
                ? `Selisih: ${difference} unit, Terjual (${Math.round((toDate.getTime() - fromDate.getTime()) / 86400000)} hari): ${totalSold}, Keluar lain: ${totalOut}, Potensi hilang tanpa transaksi: ${unaccounted} unit`
                : null;

            return {
                productId: product.id,
                name: product.name,
                sku: product.sku || "",
                category: product.category || "",
                unit: product.unit || "pcs",
                stockSystem,
                stockPhysical: item.physicalStock,
                difference,
                costPrice,
                estimatedLoss,
                status,
                suspicious: isSuspicious,
                totalSold,
                totalOut,
                unaccounted,
                suspiciousNote,
            };
        }).filter(Boolean);

        const totalChecked = results.length;
        const totalMatch = results.filter((r) => r!.status === "sesuai").length;
        const totalDiscrepancy = results.filter((r) => r!.status !== "sesuai").length;
        const totalUnitsMissing = results
            .filter((r) => r!.difference < 0)
            .reduce((sum, r) => sum + Math.abs(r!.difference), 0);
        const totalUnitsExtra = results
            .filter((r) => r!.difference > 0)
            .reduce((sum, r) => sum + r!.difference, 0);
        const estimatedLoss = results.reduce((sum, r) => sum + r!.estimatedLoss, 0);
        const suspiciousCount = results.filter((r) => r!.suspicious).length;

        return NextResponse.json({
            results,
            summary: {
                totalChecked,
                totalMatch,
                totalDiscrepancy,
                totalUnitsMissing,
                totalUnitsExtra,
                estimatedLoss,
                suspiciousCount,
                dateFrom: fromDate.toISOString(),
                dateTo: toDate.toISOString(),
            },
        });
    } catch (error) {
        console.error("[stock-tracking/compare] Error:", error);
        return NextResponse.json(
            { message: "Gagal menganalisis data" },
            { status: 500 }
        );
    }
}
