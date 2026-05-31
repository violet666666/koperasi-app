/**
 * Diagnostic: Cek data manajemen unit dari database
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const now = new Date();
    const wibOffset = 7 * 60;
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const wibNow = new Date(utcMs + wibOffset * 60000);
    const todayStart = new Date(wibNow.getFullYear(), wibNow.getMonth(), wibNow.getDate(), 0, 0, 0, 0);
    const todayStartUTC = new Date(todayStart.getTime() - wibOffset * 60000);

    console.log("=== DIAGNOSTIK MANAJEMEN UNIT ===");
    console.log(`WIB Now: ${wibNow.toISOString()}`);
    console.log(`Today start UTC: ${todayStartUTC.toISOString()}`);
    console.log("");

    const unitTypes = ["toko", "cuci_mobil", "cafe_lsp", "fitness", "game_center", "laundry", "foto_copy", "latar_coffee"];

    for (const ut of unitTypes) {
        const [prodCount, activeProd, todaySales, todayUnitTx, weekSalesCount, weekUnitTxCount] = await Promise.all([
            prisma.storeProduct.count({ where: { unitType: ut, deletedAt: null } }),
            prisma.storeProduct.count({ where: { unitType: ut, isActive: true, deletedAt: null } }),
            prisma.storeSale.aggregate({
                _sum: { totalAmount: true }, _count: true,
                where: { unitType: ut, createdAt: { gte: todayStartUTC }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
            }),
            prisma.unitTransaction.aggregate({
                _sum: { amount: true }, _count: true,
                where: { unitType: ut, transactionDate: { gte: todayStartUTC }, status: { not: "voided" } },
            }),
            prisma.storeSale.count({ where: { unitType: ut, createdAt: { gte: new Date(todayStartUTC.getTime() - 7 * 86400000) } } }),
            prisma.unitTransaction.count({ where: { unitType: ut, transactionDate: { gte: new Date(todayStartUTC.getTime() - 7 * 86400000) }, status: { not: "voided" } } }),
        ]);

        const isStore = ["toko", "resto", "cafe_lsp"].includes(ut);
        const todayRev = isStore ? Number(todaySales._sum.totalAmount ?? 0) : Number(todayUnitTx._sum.amount ?? 0);
        const todayTx = isStore ? todaySales._count : todayUnitTx._count;

        if (prodCount > 0 || todayTx > 0 || weekSalesCount > 0 || weekUnitTxCount > 0) {
            console.log(`[${ut}] ${isStore ? "STORE" : "SERVICE"}`);
            console.log(`  Produk: ${prodCount} (aktif: ${activeProd})`);
            console.log(`  Hari ini: ${todayTx} tx, Rp ${todayRev.toLocaleString("id-ID")}`);
            console.log(`  7 hari: StoreSale=${weekSalesCount}, UnitTx=${weekUnitTxCount}`);
            console.log("");
        }
    }

    // Cek apakah ada products dengan stock 0 atau di bawah min_stock
    const lowStockProducts = await prisma.storeProduct.findMany({
        where: { isActive: true, deletedAt: null, stock: { lte: prisma.storeProduct.fields?.minStock as any } },
        select: { id: true, name: true, unitType: true, stock: true, minStock: true },
        take: 10,
    });
    console.log(`[LOW STOCK] Produk aktif dengan stok <= minStock:`);
    const rawLowStock = await prisma.$queryRaw<any[]>`
        SELECT id, name, unit_type as "unitType", stock, min_stock as "minStock"
        FROM store_products
        WHERE is_active = true AND deleted_at IS NULL AND stock <= min_stock
        ORDER BY stock ASC
        LIMIT 10
    `;
    rawLowStock.forEach(p => {
        console.log(`  ${p.name} (${p.unitType}): stock=${p.stock}, minStock=${p.minStock}`);
    });

    await prisma.$disconnect();
}

main().catch(console.error);
