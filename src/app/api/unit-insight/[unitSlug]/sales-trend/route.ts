import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugToUnitType, storeSaleUnitTypeFilter } from "@/lib/constants/units";
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
        const isAdmin = session.user.role === "admin";

        if (!isOperator && !isAdmin) {
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
        const { todayStartUTC, todayDateUTC, tomorrowDateUTC } = computeWIBBoundaries();
        const ssFilter = storeSaleUnitTypeFilter(unitType) as string;

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
            rangeEndUTC = tomorrowDateUTC;
            rangeLabel = "30 Hari Terakhir";
        } else if (range === "today") {
            rangeStartUTC = todayStartUTC;
            rangeEndUTC = tomorrowDateUTC;
            rangeLabel = "Hari Ini";
        } else {
            // Default: 7d
            rangeStartUTC = new Date(todayStartUTC.getTime() - 6 * 24 * 60 * 60 * 1000);
            rangeEndUTC = tomorrowDateUTC;
            rangeLabel = "7 Hari Terakhir";
        }

        // Void filter for StoreSale
        const notVoided = { NOT: { metadata: { path: ["isVoided"], equals: true } } } as never;

        // ─── Parallel queries ─────────────────────────────
        const [
            productSalesRaw,
            dailySalesRaw,
            allActiveProducts,
            lastSoldDates,
            thisWeekSalesRaw,
            lastWeekSalesRaw,
        ] = await Promise.all([

            // 1. Product sales aggregation (ranking)
            prisma.storeSaleItem.groupBy({
                by: ["productId"],
                _sum: { quantity: true, subtotal: true },
                orderBy: { _sum: { quantity: "desc" } },
                where: {
                    sale: {
                        unitType: ssFilter,
                        createdAt: { gte: rangeStartUTC, lt: rangeEndUTC },
                        ...notVoided,
                    },
                },
            }),

            // 2. Daily sales per product (trend)
            prisma.storeSaleItem.findMany({
                where: {
                    sale: {
                        unitType: ssFilter,
                        createdAt: { gte: rangeStartUTC, lt: rangeEndUTC },
                        ...notVoided,
                    },
                },
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
            }),

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
            prisma.$queryRaw<Array<{ productId: number; lastSoldAt: Date }>>`
                SELECT ssi.product_id as "productId", MAX(ss.created_at) as "lastSoldAt"
                FROM store_sale_items ssi
                JOIN store_sales ss ON ssi.sale_id = ss.id
                WHERE ss.unit_type = ${ssFilter}
                  AND (ss.metadata->>'isVoided' IS NULL OR ss.metadata->>'isVoided' != 'true')
                GROUP BY ssi.product_id
            `,

            // 5. This week sales per product (for weekly comparison)
            prisma.storeSaleItem.groupBy({
                by: ["productId"],
                _sum: { quantity: true, subtotal: true },
                where: {
                    sale: {
                        unitType: ssFilter,
                        createdAt: { gte: todayStartUTC },
                        ...notVoided,
                    },
                },
            }),

            // 6. Last week sales per product (for weekly comparison)
            prisma.storeSaleItem.groupBy({
                by: ["productId"],
                _sum: { quantity: true, subtotal: true },
                where: {
                    sale: {
                        unitType: ssFilter,
                        createdAt: {
                            gte: new Date(todayStartUTC.getTime() - 7 * 24 * 60 * 60 * 1000),
                            lt: todayStartUTC,
                        },
                        ...notVoided,
                    },
                },
            }),
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

        // Weekly comparison
        const thisWeekSales: RawProductSale[] = thisWeekSalesRaw.map(s => ({
            productId: s.productId,
            productName: nameMap.get(s.productId) ?? `Product #${s.productId}`,
            quantity: s._sum.quantity ?? 0,
            revenue: Number(s._sum.subtotal ?? 0),
        }));

        const lastWeekSales: RawProductSale[] = lastWeekSalesRaw.map(s => ({
            productId: s.productId,
            productName: nameMap.get(s.productId) ?? `Product #${s.productId}`,
            quantity: s._sum.quantity ?? 0,
            revenue: Number(s._sum.subtotal ?? 0),
        }));

        // ─── Compute insights ─────────────────────────────
        const ranking = computeProductRanking(rankingSales);
        const dailyTrend = computeDailyTrend(dailySales, { topN: 15 });
        const stagnant = detectStagnantProducts(activeProducts, rankingSales, 7, new Date(), lastSoldDates);
        const weeklyComparison = computeWeeklyComparison(thisWeekSales, lastWeekSales);

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
