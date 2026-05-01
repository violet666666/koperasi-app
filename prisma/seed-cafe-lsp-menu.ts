import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MenuItem {
    sku: string;
    name: string;
    category: string;
    sellPrice: number;
    costPrice: number;
}

// SKU format: LSP-{CATEGORY}-{VARIANT}
// Following F&B industry standard: Brand-Dept-Item
const MENU: MenuItem[] = [
    // ── MOCKTAIL (MT) ─────────────────────────────────────────
    { sku: "LSP-MT-BLUFSH",  name: "Blue Fresh",       category: "Mocktail",    sellPrice: 14000, costPrice: 4221 },
    { sku: "LSP-MT-GRNLCS",  name: "Greenlicious",     category: "Mocktail",    sellPrice: 19000, costPrice: 4140 },
    { sku: "LSP-MT-PNKS",    name: "Pinkish",          category: "Mocktail",    sellPrice: 19000, costPrice: 3851 },
    { sku: "LSP-MT-RMYSNS",  name: "Rummy Sunset",     category: "Mocktail",    sellPrice: 19000, costPrice: 4295 },
    { sku: "LSP-MT-PCSQSH",  name: "Peachy Squash",    category: "Mocktail",    sellPrice: 14000, costPrice: 4735 },

    // ── TEA SERIES (TS) ────────────────────────────────────────
    { sku: "LSP-TS-PCH",     name: "Peach Tea",        category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "LSP-TS-LMN",     name: "Lemon Tea",        category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "LSP-TS-LCH",     name: "Lychee Tea",       category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "LSP-TS-MNG",     name: "Mango Tea",        category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "LSP-TS-STW",     name: "Strawberry Tea",   category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },

    // ── FRAPPE (FP) ────────────────────────────────────────────
    { sku: "LSP-FP-CKCRM",   name: "Cookies & Cream",  category: "Frappe",      sellPrice: 18000, costPrice: 6100 },
    { sku: "LSP-FP-RDVLV",   name: "Red Velvet",       category: "Frappe",      sellPrice: 18000, costPrice: 6375 },

    // ── CHOCO SERIES (CH) ──────────────────────────────────────
    { sku: "LSP-CH-DRKCO",   name: "Dark Choco",       category: "Choco Series", sellPrice: 17000, costPrice: 6600 },
    { sku: "LSP-CH-CHBNA",   name: "Choco Banana",     category: "Choco Series", sellPrice: 18000, costPrice: 5870 },
    { sku: "LSP-CH-CHBRY",   name: "Choco Berry",      category: "Choco Series", sellPrice: 18000, costPrice: 6000 },
    { sku: "LSP-CH-HTCLT",   name: "Hot Choco Latte",  category: "Choco Series", sellPrice: 16000, costPrice: 6562 },

    // ── MATCHA SERIES (MA) ─────────────────────────────────────
    { sku: "LSP-MA-MTLTD",   name: "Matcha Latte",     category: "Matcha Series", sellPrice: 18000, costPrice: 6440 },
    { sku: "LSP-MA-MTHOT",   name: "Matcha Latte Hot", category: "Matcha Series", sellPrice: 17000, costPrice: 6535 },
    { sku: "LSP-MA-MTBRY",   name: "Matcha Berry",     category: "Matcha Series", sellPrice: 20000, costPrice: 7160 },

    // ── ICE COFFEE (IC) ────────────────────────────────────────
    { sku: "LSP-IC-BTSC",    name: "Butterscotch",     category: "Ice Coffee",  sellPrice: 15000, costPrice: 7495 },
    { sku: "LSP-IC-VNL",     name: "Vanilla",          category: "Ice Coffee",  sellPrice: 15000, costPrice: 7495 },
    { sku: "LSP-IC-CRML",    name: "Caramel",          category: "Ice Coffee",  sellPrice: 18000, costPrice: 7495 },
    { sku: "LSP-IC-HZNL",    name: "Hazelnut",         category: "Ice Coffee",  sellPrice: 18000, costPrice: 7495 },
    { sku: "LSP-IC-TRMS",    name: "Tiramisu",         category: "Ice Coffee",  sellPrice: 18000, costPrice: 7495 },
    { sku: "LSP-IC-AMRC",    name: "Americano",        category: "Ice Coffee",  sellPrice: 15000, costPrice: 3000 },
    { sku: "LSP-IC-PSTC",    name: "Pistachio",        category: "Ice Coffee",  sellPrice: 18000, costPrice: 6408 },
    { sku: "LSP-IC-IRCM",    name: "Irish Cream",      category: "Ice Coffee",  sellPrice: 18000, costPrice: 6495 },
    { sku: "LSP-IC-AREN",    name: "Aren",             category: "Ice Coffee",  sellPrice: 18000, costPrice: 6275 },

    // ── HOT COFFEE (HC) ────────────────────────────────────────
    { sku: "LSP-HC-CRMLT",   name: "Caramel Latte",    category: "Hot Coffee",  sellPrice: 17000, costPrice: 7210 },
    { sku: "LSP-HC-HZNLT",   name: "Hazelnut Latte",   category: "Hot Coffee",  sellPrice: 17000, costPrice: 7210 },
    { sku: "LSP-HC-VNLLT",   name: "Vanilla Latte",    category: "Hot Coffee",  sellPrice: 17000, costPrice: 7210 },
    { sku: "LSP-HC-VNMDR",   name: "Vietnam Drip",     category: "Hot Coffee",  sellPrice: 12000, costPrice: 3000 },
    { sku: "LSP-HC-V60",     name: "V60",              category: "Hot Coffee",  sellPrice: 16000, costPrice: 4000 },
    { sku: "LSP-HC-TBRK",    name: "Tubruk",           category: "Hot Coffee",  sellPrice: 8000,  costPrice: 2000 },
    { sku: "LSP-HC-ESPR",    name: "Espresso",         category: "Hot Coffee",  sellPrice: 10000, costPrice: 1800 },
];

async function main() {
    console.log(`Seeding ${MENU.length} menu items for Cafe LSP...\n`);

    // First, update old CFL- SKUs to new LSP- format
    const oldProducts = await prisma.storeProduct.findMany({
        where: { unitType: "cafe_lsp", sku: { startsWith: "CFL-" } },
    });

    if (oldProducts.length > 0) {
        console.log(`Migrating ${oldProducts.length} old CFL- SKUs to LSP- format...`);
        for (const old of oldProducts) {
            const match = MENU.find(m => m.name === old.name);
            if (match && match.sku !== old.sku) {
                await prisma.storeProduct.update({
                    where: { id: old.id },
                    data: { sku: match.sku },
                });
                console.log(`  ${old.sku} → ${match.sku} (${old.name})`);
            }
        }
        console.log("");
    }

    let created = 0;
    let skipped = 0;

    for (const item of MENU) {
        const existing = await prisma.storeProduct.findUnique({ where: { sku: item.sku } });

        if (existing) {
            const needsUpdate =
                Number(existing.sellPrice) !== item.sellPrice ||
                Number(existing.costPrice) !== item.costPrice ||
                existing.name !== item.name ||
                existing.category !== item.category;

            if (needsUpdate) {
                await prisma.storeProduct.update({
                    where: { id: existing.id },
                    data: { name: item.name, category: item.category, sellPrice: item.sellPrice, costPrice: item.costPrice },
                });
                console.log(`  UPDATED: ${item.name} (${item.sku})`);
            } else {
                skipped++;
            }
        } else {
            await prisma.storeProduct.create({
                data: {
                    sku: item.sku, name: item.name, category: item.category,
                    unitType: "cafe_lsp", sellPrice: item.sellPrice, costPrice: item.costPrice,
                    isService: true, isActive: true, stock: 0, unit: "cup",
                },
            });
            created++;
            console.log(`  CREATED: ${item.name} (${item.sku}) — Rp${item.sellPrice.toLocaleString("id-ID")}`);
        }
    }

    console.log(`\nDone: ${created} created, ${MENU.length - created - skipped} updated, ${skipped} unchanged`);
    const categories = [...new Set(MENU.map(m => m.category))];
    console.log(`\nCategories: ${categories.join(", ")}`);
    for (const cat of categories) {
        const items = MENU.filter(m => m.category === cat);
        console.log(`  ${cat}: ${items.length} items`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
