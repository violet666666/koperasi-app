import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MenuItem {
    sku: string;
    name: string;
    category: string;
    sellPrice: number;
    costPrice: number;
}

const MENU: MenuItem[] = [
    // ── MOCKTAIL ──────────────────────────────────────────────
    { sku: "CFL-MOCK-BF",   name: "Blue Fresh",       category: "Mocktail",    sellPrice: 14000, costPrice: 4221 },
    { sku: "CFL-MOCK-GR",   name: "Greenlicious",     category: "Mocktail",    sellPrice: 19000, costPrice: 4140 },
    { sku: "CFL-MOCK-PK",   name: "Pinkish",          category: "Mocktail",    sellPrice: 19000, costPrice: 3851 },
    { sku: "CFL-MOCK-RS",   name: "Rummy Sunset",     category: "Mocktail",    sellPrice: 19000, costPrice: 4295 },
    { sku: "CFL-MOCK-PS",   name: "Peachy Squash",    category: "Mocktail",    sellPrice: 14000, costPrice: 4735 },

    // ── TEA SERIES ────────────────────────────────────────────
    { sku: "CFL-TEA-PC",    name: "Peach Tea",        category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "CFL-TEA-LM",    name: "Lemon Tea",        category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "CFL-TEA-LC",    name: "Lychee Tea",       category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "CFL-TEA-MG",    name: "Mango Tea",        category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "CFL-TEA-ST",    name: "Strawberry Tea",   category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },

    // ── FRAPPE ────────────────────────────────────────────────
    { sku: "CFL-FRP-CC",    name: "Cookies & Cream",  category: "Frappe",      sellPrice: 18000, costPrice: 6100 },
    { sku: "CFL-FRP-RV",    name: "Red Velvet",       category: "Frappe",      sellPrice: 18000, costPrice: 6375 },

    // ── CHOCO SERIES ──────────────────────────────────────────
    { sku: "CFL-CHO-DC",    name: "Dark Choco",       category: "Choco Series", sellPrice: 17000, costPrice: 6600 },
    { sku: "CFL-CHO-CB",    name: "Choco Banana",     category: "Choco Series", sellPrice: 18000, costPrice: 5870 },
    { sku: "CFL-CHO-CBR",   name: "Choco Berry",      category: "Choco Series", sellPrice: 18000, costPrice: 6000 },
    { sku: "CFL-CHO-HCL",   name: "Hot Choco Latte",  category: "Choco Series", sellPrice: 16000, costPrice: 6562 },

    // ── MATCHA SERIES ─────────────────────────────────────────
    { sku: "CFL-MAT-ML",    name: "Matcha Latte",     category: "Matcha Series", sellPrice: 18000, costPrice: 6440 },
    { sku: "CFL-MAT-MH",    name: "Matcha Latte Hot", category: "Matcha Series", sellPrice: 17000, costPrice: 6535 },
    { sku: "CFL-MAT-MBR",   name: "Matcha Berry",     category: "Matcha Series", sellPrice: 20000, costPrice: 7160 },

    // ── ICE COFFEE ────────────────────────────────────────────
    { sku: "CFL-ICF-BS",    name: "Butterscotch",     category: "Ice Coffee",  sellPrice: 15000, costPrice: 7495 },
    { sku: "CFL-ICF-VN",    name: "Vanilla",          category: "Ice Coffee",  sellPrice: 15000, costPrice: 7495 },
    { sku: "CFL-ICF-CR",    name: "Caramel",          category: "Ice Coffee",  sellPrice: 18000, costPrice: 7495 },
    { sku: "CFL-ICF-HZ",    name: "Hazelnut",         category: "Ice Coffee",  sellPrice: 18000, costPrice: 7495 },
    { sku: "CFL-ICF-TM",    name: "Tiramisu",         category: "Ice Coffee",  sellPrice: 18000, costPrice: 7495 },
    { sku: "CFL-ICF-AM",    name: "Americano",        category: "Ice Coffee",  sellPrice: 15000, costPrice: 3000 },
    { sku: "CFL-ICF-PS",    name: "Pistachio",        category: "Ice Coffee",  sellPrice: 18000, costPrice: 6408 },
    { sku: "CFL-ICF-IC",    name: "Irish Cream",      category: "Ice Coffee",  sellPrice: 18000, costPrice: 6495 },
    { sku: "CFL-ICF-AR",    name: "Aren",             category: "Ice Coffee",  sellPrice: 18000, costPrice: 6275 },

    // ── HOT COFFEE ────────────────────────────────────────────
    { sku: "CFL-HCF-CL",    name: "Caramel Latte",    category: "Hot Coffee",  sellPrice: 17000, costPrice: 7210 },
    { sku: "CFL-HCF-HL",    name: "Hazelnut Latte",   category: "Hot Coffee",  sellPrice: 17000, costPrice: 7210 },
    { sku: "CFL-HCF-VL",    name: "Vanilla Latte",    category: "Hot Coffee",  sellPrice: 17000, costPrice: 7210 },
    { sku: "CFL-HCF-VD",    name: "Vietnam Drip",     category: "Hot Coffee",  sellPrice: 12000, costPrice: 3000 },
    { sku: "CFL-HCF-V6",    name: "V60",              category: "Hot Coffee",  sellPrice: 16000, costPrice: 4000 },
    { sku: "CFL-HCF-TB",    name: "Tubruk",           category: "Hot Coffee",  sellPrice: 8000,  costPrice: 2000 },
    { sku: "CFL-HCF-ES",    name: "Espresso",         category: "Hot Coffee",  sellPrice: 10000, costPrice: 1800 },
];

async function main() {
    console.log(`Seeding ${MENU.length} menu items for Cafe LSP...\n`);

    let created = 0;
    let skipped = 0;

    for (const item of MENU) {
        const existing = await prisma.storeProduct.findUnique({ where: { sku: item.sku } });

        if (existing) {
            // Update if prices changed
            const needsUpdate =
                Number(existing.sellPrice) !== item.sellPrice ||
                Number(existing.costPrice) !== item.costPrice ||
                existing.name !== item.name ||
                existing.category !== item.category;

            if (needsUpdate) {
                await prisma.storeProduct.update({
                    where: { id: existing.id },
                    data: {
                        name: item.name,
                        category: item.category,
                        sellPrice: item.sellPrice,
                        costPrice: item.costPrice,
                    },
                });
                console.log(`  UPDATED: ${item.name} (${item.sku})`);
            } else {
                skipped++;
            }
        } else {
            await prisma.storeProduct.create({
                data: {
                    sku: item.sku,
                    name: item.name,
                    category: item.category,
                    unitType: "cafe_lsp",
                    sellPrice: item.sellPrice,
                    costPrice: item.costPrice,
                    isService: true,
                    isActive: true,
                    stock: 0,
                    unit: "cup",
                },
            });
            created++;
            console.log(`  CREATED: ${item.name} (${item.sku}) — Rp${item.sellPrice.toLocaleString("id-ID")}`);
        }
    }

    console.log(`\nDone: ${created} created, ${MENU.length - created - skipped} updated, ${skipped} unchanged`);

    // Summary by category
    const categories = [...new Set(MENU.map(m => m.category))];
    console.log(`\nCategories: ${categories.join(", ")}`);
    for (const cat of categories) {
        const items = MENU.filter(m => m.category === cat);
        console.log(`  ${cat}: ${items.length} items`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
