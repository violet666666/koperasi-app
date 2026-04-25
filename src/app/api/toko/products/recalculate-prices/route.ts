import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/toko/products/recalculate-prices
 * 
 * Hitung ulang harga jual SEMUA produk berdasarkan formula dinamis:
 *   sellPrice = ceil((costPrice * (1 + markup/100) * (1 + ppn/100)) / 100) * 100
 * 
 * Markup dan PPN dibaca dari tabel app_settings (configurable).
 * Default: markup=2%, ppn=0%.
 * 
 * Hanya produk dengan costPrice > 0 yang dihitung ulang.
 * Produk dengan costPrice = 0 akan dilewati (harga tetap).
 * Produk kategori "rokok" akan dilewati (harga manual/HET).
 * 
 * Query params:
 *   ?preview=true  → Hanya tampilkan preview perubahan, TIDAK simpan ke DB
 *   ?preview=false  → Simpan perubahan ke DB (default)
 *   ?unitType=toko  → Unit type untuk membaca settings (default: toko)
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan menghitung ulang harga" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const isPreview = searchParams.get("preview") === "true";
        const unitType = searchParams.get("unitType") || (session.user as any).unitType || "toko";

        // Read markup & PPN settings from DB
        const settingsKeys = [`${unitType}_markup_percent`, `${unitType}_ppn_percent`];
        const settings = await prisma.appSetting.findMany({
            where: { key: { in: settingsKeys } },
        });
        const settingsMap: Record<string, string> = {};
        for (const s of settings) settingsMap[s.key] = s.value;

        const markupPercent = parseFloat(settingsMap[`${unitType}_markup_percent`] || "2");
        const ppnPercent = parseFloat(settingsMap[`${unitType}_ppn_percent`] || "0");
        const markupMultiplier = 1 + markupPercent / 100;
        const ppnMultiplier = 1 + ppnPercent / 100;

        // Build formula description
        const formulaParts = [`HPP × ${markupMultiplier}`];
        if (ppnPercent > 0) formulaParts[0] = `HPP × ${markupMultiplier} × ${ppnMultiplier}`;
        const formulaStr = `ceil((${formulaParts[0]}) / 100) × 100`;

        // Ambil semua produk aktif dengan costPrice > 0
        const products = await prisma.storeProduct.findMany({
            where: {
                deletedAt: null,
                costPrice: { gt: 0 },
                // Exclude kategori rokok (harga manual/HET dari pabrikan)
                NOT: {
                    category: { in: ["rokok", "Rokok", "ROKOK"] },
                },
            },
            select: {
                id: true,
                sku: true,
                name: true,
                category: true,
                costPrice: true,
                sellPrice: true,
            },
            orderBy: { name: "asc" },
        });

        const changes: {
            id: number;
            sku: string;
            name: string;
            costPrice: number;
            oldSellPrice: number;
            newSellPrice: number;
            changed: boolean;
        }[] = [];

        let updatedCount = 0;
        let skippedCount = 0;

        for (const p of products) {
            const hpp = Number(p.costPrice);
            const currentSellPrice = Number(p.sellPrice);
            // Dynamic formula from settings
            const newSellPrice = Math.ceil((hpp * markupMultiplier * ppnMultiplier) / 100) * 100;

            const changed = currentSellPrice !== newSellPrice;

            changes.push({
                id: p.id,
                sku: p.sku,
                name: p.name,
                costPrice: hpp,
                oldSellPrice: currentSellPrice,
                newSellPrice,
                changed,
            });

            if (changed) {
                updatedCount++;
            } else {
                skippedCount++;
            }
        }

        // Jika bukan preview, update ke DB
        if (!isPreview) {
            const toUpdate = changes.filter(c => c.changed);
            const BATCH_SIZE = 100;

            for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
                const batch = toUpdate.slice(i, i + BATCH_SIZE);
                await Promise.all(
                    batch.map(item =>
                        prisma.storeProduct.update({
                            where: { id: item.id },
                            data: { sellPrice: item.newSellPrice },
                        })
                    )
                );
            }
        }

        // Ambil juga produk tanpa HPP (costPrice = 0)
        const noCostPrice = await prisma.storeProduct.count({
            where: { deletedAt: null, costPrice: { lte: 0 } },
        });

        // Count produk rokok yang dilewati
        const rokokSkipped = await prisma.storeProduct.count({
            where: {
                deletedAt: null,
                costPrice: { gt: 0 },
                category: { in: ["rokok", "Rokok", "ROKOK"] },
            },
        });

        return NextResponse.json({
            message: isPreview
                ? `Preview: ${updatedCount} produk akan diupdate harga jualnya. ${skippedCount} sudah sesuai.${rokokSkipped > 0 ? ` ${rokokSkipped} produk rokok dilewati (harga manual).` : ''}`
                : `${updatedCount} produk berhasil diupdate harga jualnya. ${skippedCount} sudah sesuai formula.${rokokSkipped > 0 ? ` ${rokokSkipped} produk rokok dilewati.` : ''}`,
            data: {
                mode: isPreview ? "preview" : "committed",
                formula: formulaStr,
                markupPercent,
                ppnPercent,
                totalWithHPP: products.length,
                updated: updatedCount,
                alreadyCorrect: skippedCount,
                noHPP: noCostPrice,
                rokokSkipped,
                changes: changes.filter(c => c.changed).slice(0, 100), // Max 100 untuk response
            },
        });
    } catch (error) {
        console.error("POST /api/toko/products/recalculate-prices error:", error);
        return NextResponse.json({ message: "Gagal menghitung ulang harga" }, { status: 500 });
    }
}
