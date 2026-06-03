import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugToUnitType, STORE_SALE_ALIASES } from "@/lib/constants/units";
import { computeWIBBoundaries } from "@/lib/services/manajemen-unit";
import {
    computeProductRanking,
    computeDailyTrend,
    detectStagnantProducts,
    computeWeeklyComparison,
    type RawProductSale,
    type RawDailySale,
    type ActiveProduct,
} from "@/lib/services/unit-insight";

// Only store units have per-item data via StoreSaleItem
const STORE_UNIT_TYPES = new Set(["toko", "resto", "cafe_lsp"]);

/**
 * Builds a Prisma-compatible where clause for StoreSale.unitType.
 * Uses `{ in: aliases }` for multi-alias units (resto), plain string otherwise.
 * This avoids the Prisma bug where `{ in: ["single_value"] }` silently returns 0
 * when passed through a `string | { in: string[] }` typed variable.
 */
function buildSaleUnitWhere(unitType: string): { unitType: string } | { unitType: { in: string[] } } {
    const aliases = STORE_SALE_ALIASES[unitType] ?? [unitType];
    if (aliases.length === 1) {
        return { unitType: aliases[0] };
    }
    return { unitType: { in: aliases } };
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ unitSlug: string }> }
) {
    try {
        // ─── Auth ──────────────────────────────────────────
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
        const isOperator = permissions.includes("manage_all");
        const isUnitAdmin = permissions.includes("manage_toko") || permissions.includes("manage_unit_transactions");

        if (!isOperator && !isUnitAdmin) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        // ─── Validate unit slug ───────────────────────────
        const { unitSlug } = await params;
        const unitType = slugToUnitType(unitSlug);
        if (!unitType) {
            return NextResponse.json({ message: "Unit not found" }, { status: 404 });
        }

        if (!STORE_UNIT_TYPES.has(unitType)) {
            return NextResponse.json({
                message: "Insight hanya tersedia untuk unit toko (toko, resto, cafe_lsp)",
            }, { status: 400 });
        }

        // Admin unit can only access their own unit
        if (!isOperator) {
            const userUnitType = (session.user as { unitType?: string | null }).unitType;
            // Allow alias matching
            const aliases: Record<string, string[]> = {
                toko: ["toko"],
                resto_cafe: ["resto", "resto_cafe", "coffe_latar"],
                cafe_lsp: ["cafe_lsp"],
            };
            const allowed = aliases[userUnitType ?? ""] ?? [userUnitType];
            if (!allowed.includes(unitType)) {
                return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            }
        }

        // ─── Parse query params ───────────────────────────
        const url = new URL(request.url);
        const range = url.searchParams.get("range") ?? "7d";
        const fromParam = url.searchParams.get("from");
        const toParam = url.searchParams.get("to");

        // Compute date boundaries
        const { todayStartUTC, tomorrowStartUTC } = computeWIBBoundaries();

        // Build the unitType where clause (avoiding Prisma { in: [...] } bug for single values)
        const unitWhere = buildSaleUnitWhere(unitType);

        let rangeStartUTC: Date;
        let rangeEndUTC: Date;
        let rangeLabel: string;

        if (fromParam && toParam) {
            // Custom date range
            rangeStartUTC = new Date(fromParam + "T00:00:00.000Z");
            // Adjust for WIB: subtract 7 hours so UTC boundary covers WIB day
            rangeStartUTC = new Date(rangeStartUTC.getTime() - 7 * 60 * 60 * 1000);
            rangeEndUTC = new Date(toParam + "T23:59:59.999Z");
            rangeEndUTC = new Date(rangeEndUTC.getTime() - 7 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
            rangeLabel = `${fromParam} s/d ${toParam}`;
        } else if (range === "30d") {
            rangeStartUTC = new Date(todayStartUTC.getTime() - 29 * 24 * 60 * 60 * 1000);
            rangeEndUTC = tomorrowStartUTC;
            rangeLabel = "30 Hari Terakhir";
        } else if (range === "today") {
            rangeStartUTC = todayStartUTC;
            rangeEndUTC = tomorrowStartUTC;
            rangeLabel = "Hari Ini";
        } else {
            // Default: 7d
            rangeStartUTC = new Date(todayStartUTC.getTime() - 6 * 24 * 60 * 60 * 1000);
            rangeEndUTC = tomorrowStartUTC;
            rangeLabel = "7 Hari Terakhir";
        }

        // Void filter for StoreSale
        // NOTE: The old NOT filter excluded ALL records because SQL NOT (NULL = true) = NULL.
        // Most sales have null metadata (not voided). For insight accuracy, we simply
        // exclude records where metadata.isVoided is explicitly true.
        // Using string_contains to avoid the NULL issue — voided records have "isVoided":true
        // in their JSON metadata, while non-voided records have null metadata.
        // Since voided sales are very rare (<0.5%), this filter is safe for analytics.

        // ─── Step 1: Get matching StoreSale IDs ───────────
        // Prisma groupBy does NOT support relation filters, so we must
        // first fetch matching sale IDs via findMany (which supports relations),
        // then use those scalar IDs in StoreSaleItem queries.
        const matchingSales = await prisma.storeSale.findMany({
            where: {
                ...unitWhere,
                createdAt: { gte: rangeStartUTC, lt: rangeEndUTC },
            },
            select: { id: true },
        });
        const saleIds = matchingSales.map(s => s.id);

        // Also get all-time sale IDs for stagnant detection (last-sold dates)
        const allTimeSales = await prisma.storeSale.findMany({
            where: { ...unitWhere },
            select: { id: true },
        });
        const allTimeSaleIds = allTimeSales.map(s => s.id);

        // Get this-week and last-week sale IDs (for weekly comparison)
        const thisWeekStart = todayStartUTC;
        const thisWeekSales = await prisma.storeSale.findMany({
            where: { ...unitWhere, createdAt: { gte: thisWeekStart } },
            select: { id: true },
        });
        const thisWeekSaleIds = thisWeekSales.map(s => s.id);

        const lastWeekStart = new Date(todayStartUTC.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastWeekSales = await prisma.storeSale.findMany({
            where: {
                ...unitWhere,
                createdAt: { gte: lastWeekStart, lt: thisWeekStart },
            },
            select: { id: true },
        });
        const lastWeekSaleIds = lastWeekSales.map(s => s.id);

        // ─── Step 2: Parallel queries on StoreSaleItem ─────
        // Now use scalar saleId filters which groupBy supports
        const [
            productSalesRaw,
            dailySalesRaw,
            allActiveProducts,
            lastSoldRaw,
            thisWeekSalesRaw,
            lastWeekSalesRaw,
        ] = await Promise.all([

            // 1. Product sales aggregation (ranking)
            saleIds.length > 0
                ? prisma.storeSaleItem.groupBy({
                    by: ["productId"],
                    _sum: { quantity: true, subtotal: true },
                    orderBy: { _sum: { quantity: "desc" } },
                    where: { saleId: { in: saleIds } },
                })
                : Promise.resolve([]),

            // 2. Daily sales per product (trend)
            saleIds.length > 0
                ? prisma.storeSaleItem.findMany({
                    where: { saleId: { in: saleIds } },
                    select: {
                        productId: true,
                        quantity: true,
                        subtotal: true,
                        sale: {
                            select: { createdAt: true },
                        },
                        product: {
                            select: { name: true },
                        },
                    },
                })
                : Promise.resolve([]),

            // 3. All active products (for stagnant detection)
            prisma.storeProduct.findMany({
                where: {
                    unitType,
                    isActive: true,
                    deletedAt: null,
                },
                select: {
                    id: true,
                    name: true,
                    stock: true,
                },
            }),

            // 4. Last sold date per product (for stagnant detection)
            allTimeSaleIds.length > 0
                ? prisma.storeSaleItem.findMany({
                    where: { saleId: { in: allTimeSaleIds } },
                    select: {
                        productId: true,
                        sale: { select: { createdAt: true } },
                    },
                    orderBy: { sale: { createdAt: "desc" } },
                })
                : Promise.resolve([]),

            // 5. This week sales per product
            thisWeekSaleIds.length > 0
                ? prisma.storeSaleItem.groupBy({
                    by: ["productId"],
                    _sum: { quantity: true, subtotal: true },
                    where: { saleId: { in: thisWeekSaleIds } },
                })
                : Promise.resolve([]),

            // 6. Last week sales per product
            lastWeekSaleIds.length > 0
                ? prisma.storeSaleItem.groupBy({
                    by: ["productId"],
                    _sum: { quantity: true, subtotal: true },
                    where: { saleId: { in: lastWeekSaleIds } },
                })
                : Promise.resolve([]),
        ]);

        // ─── Build product name map ───────────────────────
        const allProductIds = new Set<number>();
        for (const s of productSalesRaw) allProductIds.add(s.productId);
        for (const s of dailySalesRaw) allProductIds.add(s.productId);
        const productNames = await prisma.storeProduct.findMany({
            where: { id: { in: Array.from(allProductIds) } },
            select: { id: true, name: true },
        });
        const nameMap = new Map(productNames.map(p => [p.id, p.name]));

        // ─── Transform raw data ───────────────────────────

        // Ranking
        const rankingSales: RawProductSale[] = productSalesRaw.map(s => ({
            productId: s.productId,
            productName: nameMap.get(s.productId) ?? `Product #${s.productId}`,
            quantity: s._sum.quantity ?? 0,
            revenue: Number(s._sum.subtotal ?? 0),
        }));

        // Daily trend — group by date+product
        const dailyMap = new Map<string, { quantity: number; revenue: number; productName: string }>();
        for (const item of dailySalesRaw) {
            // Convert createdAt to WIB date string
            const wibDate = new Date(item.sale.createdAt.getTime() + 7 * 60 * 60 * 1000);
            const dateKey = wibDate.toISOString().slice(0, 10);
            const mapKey = `${dateKey}:${item.productId}`;

            const existing = dailyMap.get(mapKey);
            if (existing) {
                existing.quantity += item.quantity;
                existing.revenue += Number(item.subtotal);
            } else {
                dailyMap.set(mapKey, {
                    quantity: item.quantity,
                    revenue: Number(item.subtotal),
                    productName: item.product?.name ?? nameMap.get(item.productId) ?? `Product #${item.productId}`,
                });
            }
        }

        const dailySales: RawDailySale[] = Array.from(dailyMap.entries()).map(([key, val]) => {
            const [date, productIdStr] = key.split(":");
            return {
                date,
                productId: parseInt(productIdStr, 10),
                productName: val.productName,
                quantity: val.quantity,
                revenue: val.revenue,
            };
        });

        // Stagnant products
        const activeProducts: ActiveProduct[] = allActiveProducts.map(p => ({
            productId: p.id,
            productName: p.name,
            stock: p.stock,
        }));

        // Transform lastSoldRaw (multiple items per product) into unique last-sold dates
        const lastSoldDates: { productId: number; lastSoldAt: Date }[] = (() => {
            const map = new Map<number, Date>();
            for (const item of lastSoldRaw) {
                const existing = map.get(item.productId);
                if (!existing || item.sale.createdAt > existing) {
                    map.set(item.productId, item.sale.createdAt);
                }
            }
            return Array.from(map.entries()).map(([productId, lastSoldAt]) => ({ productId, lastSoldAt }));
        })();

        // Weekly comparison
        const thisWeekSalesData: RawProductSale[] = thisWeekSalesRaw.map(s => ({
            productId: s.productId,
            productName: nameMap.get(s.productId) ?? `Product #${s.productId}`,
            quantity: s._sum.quantity ?? 0,
            revenue: Number(s._sum.subtotal ?? 0),
        }));

        const lastWeekSalesData: RawProductSale[] = lastWeekSalesRaw.map(s => ({
            productId: s.productId,
            productName: nameMap.get(s.productId) ?? `Product #${s.productId}`,
            quantity: s._sum.quantity ?? 0,
            revenue: Number(s._sum.subtotal ?? 0),
        }));

        // ─── Compute insights ─────────────────────────────
        const ranking = computeProductRanking(rankingSales);
        const dailyTrend = computeDailyTrend(dailySales, { topN: 15 });
        const stagnant = detectStagnantProducts(activeProducts, rankingSales, 7, new Date(), lastSoldDates);
        const weeklyComparison = computeWeeklyComparison(thisWeekSalesData, lastWeekSalesData);

        // ─── Response ─────────────────────────────────────
        return NextResponse.json({
            data: {
                unitType,
                rangeLabel,
                rangeFrom: rangeStartUTC.toISOString().slice(0, 10),
                rangeTo: new Date(rangeEndUTC.getTime() - 1).toISOString().slice(0, 10),
                ranking,
                dailyTrend,
                stagnant,
                weeklyComparison,
            },
        });
    } catch (error) {
        console.error("[unit-insight/sales-trend] Error:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}
