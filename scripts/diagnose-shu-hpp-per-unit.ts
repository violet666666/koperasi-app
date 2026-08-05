/**
 * DIAGNOSTIK: Kelayakan fitur Laba Kotor per Unit — apakah StoreSaleItem punya data?
 * --------------------------------------------------------------------------------
 * Cek per unit (toko, resto/resto_cafe/coffe_latar, cafe_lsp) untuk 2026:
 *   - jumlah StoreSaleItem
 *   - sum(subtotal)        → omzet (harga jual)
 *   - sum(costPrice * qty) → HPP
 *   - laba kotor = omzet − HPP
 *
 * Jalankan:
 *   NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-hpp-per-unit.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const toNum = (d: any) => (d === null || d === undefined ? 0 : typeof d === "number" ? d : Number(d));
const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    console.log(`=== KELAYAKAN FITUR LABA KOTOR PER UNIT — ${year} ===\n`);

    const groups: { label: string; unitTypes: string[] }[] = [
        { label: "Toko", unitTypes: ["toko"] },
        { label: "Resto & Cafe", unitTypes: ["resto", "resto_cafe", "coffe_latar"] },
        { label: "Cafe LSP", unitTypes: ["cafe_lsp"] },
    ];

    console.log("Unit".padEnd(16) + "Items".padStart(8) + "Omzet(subtotal)".padStart(20) + "HPP(costPxqty)".padStart(20) + "Laba Kotor".padStart(20) + "Margin".padStart(10));
    console.log("-".repeat(94));

    console.log("(filter void di JS — hindari Prisma JSON NULL bug)\n");
    for (const g of groups) {
        // Fetch semua item + sale.metadata, filter voided di JS (filter Prisma NOT+path BUG)
        const items = await prisma.storeSaleItem.findMany({
            where: {
                sale: {
                    createdAt: { gte: startDate, lte: endDate },
                    unitType: { in: g.unitTypes },
                },
            },
            select: { subtotal: true, costPrice: true, quantity: true, sale: { select: { metadata: true } }, product: { select: { costPrice: true } } },
        });
        // Bandingkan: dgn vs tanpa filter void
        const allItems = items;
        const activeItems = items.filter(it => !(it.sale?.metadata as any)?.isVoided);
        let omzet = 0, hpp = 0;
        for (const it of activeItems) {
            omzet += toNum(it.subtotal);
            const cp = toNum(it.costPrice) > 0 ? toNum(it.costPrice) : toNum(it.product?.costPrice);
            hpp += cp * toNum(it.quantity);
        }
        const laba = omzet - hpp;
        const margin = omzet > 0 ? Math.round((laba / omzet) * 100) : 0;
        console.log(
            g.label.padEnd(16) +
            String(activeItems.length).padStart(8) +
            rp(omzet).padStart(20) +
            rp(hpp).padStart(20) +
            rp(laba).padStart(20) +
            (margin + "%").padStart(10)
        );
        console.log(`   (total baris item: ${allItems.length}, setelah buang voided: ${activeItems.length})`);
    }

    // Bonus: StoreSale.totalAmount (TANPA filter void) vs dgn filter void (buktikan bug)
    console.log("\n--- Bukti Prisma JSON NULL bug: StoreSale toko dgn vs tanpa filter void ---");
    const [tanpaFilter, dgnFilter] = await Promise.all([
        prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, unitType: "toko" },
            _sum: { totalAmount: true }, _count: true,
        }),
        prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, unitType: "toko", NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
            _sum: { totalAmount: true }, _count: true,
        }),
    ]);
    console.log(`  TANPA filter void : ${dgnFilter._count} baris, sum = ${rp(toNum(tanpaFilter._sum.totalAmount))}`);
    console.log(`  DGN filter void   : ${dgnFilter._count} baris, sum = ${rp(toNum(dgnFilter._sum.totalAmount))}  ← ini yg dipakai kalkulator (BUG: buang hampir semua)`);
    console.log(`  Selisih omzet toko yg HILANG dari SHU: ${rp(toNum(tanpaFilter._sum.totalAmount) - toNum(dgnFilter._sum.totalAmount))}`);

    await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
