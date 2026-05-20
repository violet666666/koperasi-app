import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface RawMaterial {
    name: string;
    sku: string;
    unit: string;
    unitCost: number;
    category: string;
}

const RAW_MATERIALS: RawMaterial[] = [
    // ── SYRUPS ────────────────────────────────────────
    { name: "Arunika Blue Citrus", sku: "RM-LSP-001", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Lychee", sku: "RM-LSP-002", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Siracuse / Candy Lemon", sku: "RM-LSP-003", unit: "ml", unitCost: 66, category: "Syrup" },
    { name: "Soda", sku: "RM-LSP-004", unit: "ml", unitCost: 11, category: "Base" },
    { name: "Arunika Lemon", sku: "RM-LSP-005", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Green Apple", sku: "RM-LSP-006", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Mojito Mint", sku: "RM-LSP-007", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Strawberry", sku: "RM-LSP-008", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Mango", sku: "RM-LSP-009", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Peach", sku: "RM-LSP-010", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Sunquick Orange", sku: "RM-LSP-011", unit: "ml", unitCost: 101, category: "Syrup" },
    { name: "Arunika Peach Syrup", sku: "RM-LSP-012", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Lemon Syrup", sku: "RM-LSP-013", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Lychee Syrup", sku: "RM-LSP-014", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Mango Syrup", sku: "RM-LSP-015", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Strawberry Syrup", sku: "RM-LSP-016", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Syrup Banana", sku: "RM-LSP-017", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Delifru Strawberry Sauce", sku: "RM-LSP-018", unit: "ml", unitCost: 96, category: "Syrup" },
    { name: "Gula Cair", sku: "RM-LSP-019", unit: "ml", unitCost: 24, category: "Syrup" },
    { name: "Roccia Butterscotch Syrup", sku: "RM-LSP-020", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Roccia Vanilla Syrup", sku: "RM-LSP-021", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Roccia Caramel Syrup", sku: "RM-LSP-022", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Roccia Hazelnut Syrup", sku: "RM-LSP-023", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Roccia Tiramisu Syrup", sku: "RM-LSP-024", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Arunika Pistachio", sku: "RM-LSP-025", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Roccia Vanilla", sku: "RM-LSP-026", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Irish Cream", sku: "RM-LSP-027", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Mahora Horeca Aren", sku: "RM-LSP-028", unit: "ml", unitCost: 64, category: "Syrup" },
    { name: "Roccia Irish", sku: "RM-LSP-029", unit: "ml", unitCost: 100, category: "Syrup" },
    // ── BASE LIQUIDS ──────────────────────────────────
    { name: "Kremilk", sku: "RM-LSP-030", unit: "ml", unitCost: 20, category: "Base" },
    { name: "Fresh Milk", sku: "RM-LSP-031", unit: "ml", unitCost: 23, category: "Base" },
    { name: "Biang Teh", sku: "RM-LSP-032", unit: "ml", unitCost: 11, category: "Base" },
    { name: "Air", sku: "RM-LSP-033", unit: "ml", unitCost: 5, category: "Base" },
    // ── POWDERS ───────────────────────────────────────
    { name: "Voya Powder Cookies & Cream", sku: "RM-LSP-034", unit: "gr", unitCost: 136, category: "Powder" },
    { name: "Arunika Powder Red Velvet", sku: "RM-LSP-035", unit: "gr", unitCost: 147, category: "Powder" },
    { name: "Arunika Powder Choco", sku: "RM-LSP-036", unit: "gr", unitCost: 156, category: "Powder" },
    { name: "Ito En Matcha", sku: "RM-LSP-037", unit: "gr", unitCost: 875, category: "Powder" },
    // ── COFFEE ────────────────────────────────────────
    { name: "Espresso", sku: "RM-LSP-038", unit: "ml", unitCost: 60, category: "Coffee" },
    { name: "Vietnam Ground Coffee", sku: "RM-LSP-039", unit: "gr", unitCost: 133, category: "Coffee" },
    { name: "Specialty Ground Coffee", sku: "RM-LSP-040", unit: "gr", unitCost: 150, category: "Coffee" },
    { name: "Ground Coffee", sku: "RM-LSP-041", unit: "gr", unitCost: 120, category: "Coffee" },
    { name: "Espresso Beans Ground", sku: "RM-LSP-042", unit: "gr", unitCost: 100, category: "Coffee" },
    // ── OTHERS ────────────────────────────────────────
    { name: "Gula", sku: "RM-LSP-043", unit: "gr", unitCost: 20, category: "Other" },
    { name: "Gula Aren", sku: "RM-LSP-044", unit: "gr", unitCost: 40, category: "Other" },
    { name: "Filter Paper", sku: "RM-LSP-045", unit: "pcs", unitCost: 300, category: "Other" },
];

async function main() {
    console.log(`\n=== Seeding ${RAW_MATERIALS.length} Raw Materials (Bahan Baku) for Cafe LSP ===\n`);

    let created = 0;
    let skipped = 0;

    for (const rm of RAW_MATERIALS) {
        const existing = await prisma.storeProduct.findFirst({
            where: { sku: rm.sku },
        });

        if (existing) {
            skipped++;
            continue;
        }

        await prisma.storeProduct.create({
            data: {
                sku: rm.sku,
                name: rm.name,
                category: rm.category,
                unitType: "cafe_lsp",
                unit: rm.unit,
                costPrice: rm.unitCost,
                sellPrice: 0,
                stock: 0,
                stockGdg: 0,
                stockToko: 0,
                minStock: 100,
                productType: "ingredient",
                trackStock: true,
                isService: false,
                isActive: true,
            },
        });
        created++;
        console.log(`  Created: ${rm.name} (${rm.unit}, Rp${rm.unitCost}/${rm.unit})`);
    }

    console.log(`\nDone: ${created} created, ${skipped} already exist`);

    // Phase 2: Link existing ProductRecipe rows to raw materials by name
    console.log(`\n=== Linking Recipes to Raw Materials ===\n`);

    const ingredients = await prisma.storeProduct.findMany({
        where: { productType: "ingredient", unitType: "cafe_lsp" },
    });

    const recipes = await prisma.productRecipe.findMany();
    let linked = 0;
    let unmatched = new Set<string>();

    for (const recipe of recipes) {
        if (recipe.ingredientProductId) continue;

        const match = ingredients.find(
            (ing) => ing.name.toLowerCase().trim() === recipe.ingredientName.toLowerCase().trim()
        );

        if (match) {
            await prisma.productRecipe.update({
                where: { id: recipe.id },
                data: { ingredientProductId: match.id },
            });
            linked++;
        } else {
            unmatched.add(recipe.ingredientName);
        }
    }

    console.log(`  Linked: ${linked} recipe rows`);
    console.log(`  Unmatched: ${unmatched.size}`);
    if (unmatched.size > 0) {
        console.log(`  Unmatched names:`, [...unmatched].join(", "));
    }

    console.log(`\n=== Seed Complete ===\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
