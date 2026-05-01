import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Ingredient {
    ingredientName: string;
    quantity: number;
    unit: string;
    unitCost: number;
}

interface Recipe {
    productName: string;
    ingredients: Ingredient[];
}

const RECIPES: Recipe[] = [
    // ── MOCKTAIL ──────────────────────────────────────────────
    {
        productName: "Blue Fresh",
        ingredients: [
            { ingredientName: "Arunika Blue Citrus", quantity: 10, unit: "ml", unitCost: 83 },
            { ingredientName: "Arunika Lychee", quantity: 17, unit: "ml", unitCost: 83 },
            { ingredientName: "Siracuse / Candy Lemon", quantity: 5, unit: "ml", unitCost: 66 },
            { ingredientName: "Soda", quantity: 150, unit: "ml", unitCost: 11 },
        ],
    },
    {
        productName: "Greenlicious",
        ingredients: [
            { ingredientName: "Arunika Lemon", quantity: 7, unit: "ml", unitCost: 83 },
            { ingredientName: "Arunika Green Apple", quantity: 17, unit: "ml", unitCost: 83 },
            { ingredientName: "Arunika Mojito Mint", quantity: 6, unit: "ml", unitCost: 83 },
            { ingredientName: "Soda", quantity: 150, unit: "ml", unitCost: 11 },
        ],
    },
    {
        productName: "Pinkish",
        ingredients: [
            { ingredientName: "Arunika Strawberry", quantity: 20, unit: "ml", unitCost: 83 },
            { ingredientName: "Biang Teh", quantity: 40, unit: "ml", unitCost: 10 },
            { ingredientName: "Arunika Mojito Mint", quantity: 7, unit: "ml", unitCost: 83 },
            { ingredientName: "Soda", quantity: 110, unit: "ml", unitCost: 11 },
        ],
    },
    {
        productName: "Rummy Sunset",
        ingredients: [
            { ingredientName: "Roccia Irish", quantity: 7, unit: "ml", unitCost: 100 },
            { ingredientName: "Roccia Vanilla", quantity: 7, unit: "ml", unitCost: 100 },
            { ingredientName: "Arunika Mango", quantity: 15, unit: "ml", unitCost: 83 },
            { ingredientName: "Soda", quantity: 150, unit: "ml", unitCost: 11 },
        ],
    },
    {
        productName: "Peachy Squash",
        ingredients: [
            { ingredientName: "Arunika Peach", quantity: 20, unit: "ml", unitCost: 83 },
            { ingredientName: "Arunika Mojito Mint", quantity: 5, unit: "ml", unitCost: 83 },
            { ingredientName: "Sunquick Orange", quantity: 10, unit: "ml", unitCost: 101 },
            { ingredientName: "Soda", quantity: 150, unit: "ml", unitCost: 11 },
        ],
    },

    // ── TEA SERIES (all same recipe, different syrup) ─────────
    {
        productName: "Peach Tea",
        ingredients: [
            { ingredientName: "Biang Teh", quantity: 150, unit: "ml", unitCost: 11 },
            { ingredientName: "Arunika Peach Syrup", quantity: 25, unit: "ml", unitCost: 83 },
        ],
    },
    {
        productName: "Lemon Tea",
        ingredients: [
            { ingredientName: "Biang Teh", quantity: 150, unit: "ml", unitCost: 11 },
            { ingredientName: "Arunika Lemon Syrup", quantity: 25, unit: "ml", unitCost: 83 },
        ],
    },
    {
        productName: "Lychee Tea",
        ingredients: [
            { ingredientName: "Biang Teh", quantity: 150, unit: "ml", unitCost: 11 },
            { ingredientName: "Arunika Lychee Syrup", quantity: 25, unit: "ml", unitCost: 83 },
        ],
    },
    {
        productName: "Mango Tea",
        ingredients: [
            { ingredientName: "Biang Teh", quantity: 150, unit: "ml", unitCost: 11 },
            { ingredientName: "Arunika Mango Syrup", quantity: 25, unit: "ml", unitCost: 83 },
        ],
    },
    {
        productName: "Strawberry Tea",
        ingredients: [
            { ingredientName: "Biang Teh", quantity: 150, unit: "ml", unitCost: 11 },
            { ingredientName: "Arunika Strawberry Syrup", quantity: 25, unit: "ml", unitCost: 83 },
        ],
    },

    // ── FRAPPE ────────────────────────────────────────────────
    {
        productName: "Cookies & Cream",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 18 },
            { ingredientName: "Voya Powder Cookies & Cream", quantity: 25, unit: "gr", unitCost: 136 },
        ],
    },
    {
        productName: "Red Velvet",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 18 },
            { ingredientName: "Arunika Powder Red Velvet", quantity: 25, unit: "gr", unitCost: 147 },
        ],
    },

    // ── CHOCO SERIES ──────────────────────────────────────────
    {
        productName: "Dark Choco",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 18 },
            { ingredientName: "Arunika Powder Choco", quantity: 25, unit: "gr", unitCost: 156 },
        ],
    },
    {
        productName: "Choco Banana",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 18 },
            { ingredientName: "Arunika Syrup Banana", quantity: 10, unit: "ml", unitCost: 83 },
            { ingredientName: "Arunika Powder Choco", quantity: 15, unit: "gr", unitCost: 156 },
        ],
    },
    {
        productName: "Choco Berry",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 18 },
            { ingredientName: "Delifru Strawberry Sauce", quantity: 10, unit: "ml", unitCost: 96 },
            { ingredientName: "Arunika Powder Choco", quantity: 15, unit: "gr", unitCost: 156 },
        ],
    },
    {
        productName: "Hot Choco Latte",
        ingredients: [
            { ingredientName: "Fresh Milk", quantity: 170, unit: "ml", unitCost: 23 },
            { ingredientName: "Arunika Powder Choco", quantity: 17, unit: "gr", unitCost: 156 },
        ],
    },

    // ── MATCHA SERIES ─────────────────────────────────────────
    {
        productName: "Matcha Latte",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 18 },
            { ingredientName: "Ito En Matcha", quantity: 4, unit: "gr", unitCost: 875 },
            { ingredientName: "Gula Cair", quantity: 10, unit: "ml", unitCost: 24 },
        ],
    },
    {
        productName: "Matcha Latte Hot",
        ingredients: [
            { ingredientName: "Fresh Milk", quantity: 170, unit: "ml", unitCost: 23 },
            { ingredientName: "Ito En Matcha", quantity: 3, unit: "gr", unitCost: 875 },
        ],
    },
    {
        productName: "Matcha Berry",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 18 },
            { ingredientName: "Delifru Strawberry Sauce", quantity: 10, unit: "ml", unitCost: 96 },
            { ingredientName: "Ito En Matcha", quantity: 4, unit: "gr", unitCost: 875 },
        ],
    },

    // ── ICE COFFEE ────────────────────────────────────────────
    // Flavored: Butterscotch, Vanilla, Caramel, Hazelnut, Tiramisu (HPP: 7,495)
    {
        productName: "Butterscotch",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 21.3 },
            { ingredientName: "Roccia Butterscotch Syrup", quantity: 25, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Vanilla",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 21.3 },
            { ingredientName: "Roccia Vanilla Syrup", quantity: 25, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Caramel",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 21.3 },
            { ingredientName: "Roccia Caramel Syrup", quantity: 25, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Hazelnut",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 21.3 },
            { ingredientName: "Roccia Hazelnut Syrup", quantity: 25, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Tiramisu",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 21.3 },
            { ingredientName: "Roccia Tiramisu Syrup", quantity: 25, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Americano",
        ingredients: [
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
            { ingredientName: "Air", quantity: 200, unit: "ml", unitCost: 5 },
        ],
    },
    {
        productName: "Pistachio",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 21.3 },
            { ingredientName: "Gula Cair", quantity: 7, unit: "ml", unitCost: 24 },
            { ingredientName: "Arunika Pistachio", quantity: 15, unit: "ml", unitCost: 83 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Irish Cream",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 21.3 },
            { ingredientName: "Roccia Vanilla", quantity: 5, unit: "ml", unitCost: 100 },
            { ingredientName: "Irish Cream", quantity: 10, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Aren",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 21.3 },
            { ingredientName: "Mahora Horeca Aren", quantity: 20, unit: "ml", unitCost: 64 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },

    // ── HOT COFFEE ────────────────────────────────────────────
    // Flavored Latte: Caramel, Hazelnut, Vanilla (HPP: 7,210)
    {
        productName: "Caramel Latte",
        ingredients: [
            { ingredientName: "Fresh Milk", quantity: 170, unit: "ml", unitCost: 23 },
            { ingredientName: "Roccia Caramel Syrup", quantity: 15, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Hazelnut Latte",
        ingredients: [
            { ingredientName: "Fresh Milk", quantity: 170, unit: "ml", unitCost: 23 },
            { ingredientName: "Roccia Hazelnut Syrup", quantity: 15, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Vanilla Latte",
        ingredients: [
            { ingredientName: "Fresh Milk", quantity: 170, unit: "ml", unitCost: 23 },
            { ingredientName: "Roccia Vanilla Syrup", quantity: 15, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Vietnam Drip",
        ingredients: [
            { ingredientName: "Vietnam Ground Coffee", quantity: 15, unit: "gr", unitCost: 133 },
            { ingredientName: "Gula Aren", quantity: 10, unit: "gr", unitCost: 40 },
        ],
    },
    {
        productName: "V60",
        ingredients: [
            { ingredientName: "Specialty Ground Coffee", quantity: 18, unit: "gr", unitCost: 150 },
            { ingredientName: "Filter Paper", quantity: 1, unit: "pcs", unitCost: 300 },
        ],
    },
    {
        productName: "Tubruk",
        ingredients: [
            { ingredientName: "Ground Coffee", quantity: 10, unit: "gr", unitCost: 120 },
            { ingredientName: "Gula", quantity: 10, unit: "gr", unitCost: 20 },
        ],
    },
    {
        productName: "Espresso",
        ingredients: [
            { ingredientName: "Espresso Beans Ground", quantity: 18, unit: "gr", unitCost: 100 },
        ],
    },
];

async function main() {
    console.log(`Seeding recipes for ${RECIPES.length} menu items...\n`);

    let created = 0;
    let updated = 0;

    for (const recipe of RECIPES) {
        const product = await prisma.storeProduct.findFirst({
            where: { name: recipe.productName, unitType: "cafe_lsp" },
        });

        if (!product) {
            console.log(`  SKIP: Product "${recipe.productName}" not found`);
            continue;
        }

        const totalCost = recipe.ingredients.reduce((sum, ing) => sum + ing.quantity * ing.unitCost, 0);

        // Delete existing recipes and recreate
        await prisma.productRecipe.deleteMany({ where: { productId: product.id } });

        for (const ing of recipe.ingredients) {
            const subtotal = ing.quantity * ing.unitCost;
            await prisma.productRecipe.create({
                data: {
                    productId: product.id,
                    ingredientName: ing.ingredientName,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    unitCost: ing.unitCost,
                    subtotal,
                },
            });
        }

        // Update costPrice to match recipe total
        await prisma.storeProduct.update({
            where: { id: product.id },
            data: { costPrice: Math.round(totalCost) },
        });

        const isUpdate = true; // Always upsert
        if (isUpdate) updated++;
        else created++;

        const margin = Number(product.sellPrice) - Math.round(totalCost);
        const marginPct = ((margin / Number(product.sellPrice)) * 100).toFixed(0);
        console.log(`  ${recipe.productName}: ${recipe.ingredients.length} bahan, HPP Rp${Math.round(totalCost).toLocaleString("id-ID")}, Margin ${marginPct}%`);
    }

    console.log(`\nDone: ${RECIPES.length} recipes seeded`);

    // Summary: unique ingredients
    const allIngredients = new Set<string>();
    RECIPES.forEach(r => r.ingredients.forEach(i => allIngredients.add(i.ingredientName)));
    console.log(`\nUnique ingredients: ${allIngredients.size}`);
    console.log([...allIngredients].sort().join(", "));
}

main().catch(console.error).finally(() => prisma.$disconnect());
