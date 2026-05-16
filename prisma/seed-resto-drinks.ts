import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── MENU ITEMS (35 drinks, cloned from Cafe LSP with RSTO- prefix) ───────────

interface MenuItem {
    sku: string;
    name: string;
    category: string;
    sellPrice: number;
    costPrice: number;
}

const MENU: MenuItem[] = [
    // ── MOCKTAIL (MT) ─────────────────────────────────────────
    { sku: "RSTO-MT-BLUFSH",  name: "Blue Fresh",       category: "Mocktail",    sellPrice: 14000, costPrice: 4221 },
    { sku: "RSTO-MT-GRNLCS",  name: "Greenlicious",     category: "Mocktail",    sellPrice: 19000, costPrice: 4140 },
    { sku: "RSTO-MT-PNKS",    name: "Pinkish",          category: "Mocktail",    sellPrice: 19000, costPrice: 3851 },
    { sku: "RSTO-MT-RMYSNS",  name: "Rummy Sunset",     category: "Mocktail",    sellPrice: 19000, costPrice: 4295 },
    { sku: "RSTO-MT-PCSQSH",  name: "Peachy Squash",    category: "Mocktail",    sellPrice: 14000, costPrice: 4735 },

    // ── TEA SERIES (TS) ────────────────────────────────────────
    { sku: "RSTO-TS-PCH",     name: "Peach Tea",        category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "RSTO-TS-LMN",     name: "Lemon Tea",        category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "RSTO-TS-LCH",     name: "Lychee Tea",       category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "RSTO-TS-MNG",     name: "Mango Tea",        category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },
    { sku: "RSTO-TS-STW",     name: "Strawberry Tea",   category: "Tea Series",  sellPrice: 12000, costPrice: 3725 },

    // ── FRAPPE (FP) ────────────────────────────────────────────
    { sku: "RSTO-FP-CKCRM",   name: "Cookies & Cream",  category: "Frappe",      sellPrice: 18000, costPrice: 6100 },
    { sku: "RSTO-FP-RDVLV",   name: "Red Velvet",       category: "Frappe",      sellPrice: 18000, costPrice: 6375 },

    // ── CHOCO SERIES (CH) ──────────────────────────────────────
    { sku: "RSTO-CH-DRKCO",   name: "Dark Choco",       category: "Choco Series", sellPrice: 17000, costPrice: 6600 },
    { sku: "RSTO-CH-CHBNA",   name: "Choco Banana",     category: "Choco Series", sellPrice: 18000, costPrice: 5870 },
    { sku: "RSTO-CH-CHBRY",   name: "Choco Berry",      category: "Choco Series", sellPrice: 18000, costPrice: 6000 },
    { sku: "RSTO-CH-HTCLT",   name: "Hot Choco Latte",  category: "Choco Series", sellPrice: 16000, costPrice: 6562 },

    // ── MATCHA SERIES (MA) ─────────────────────────────────────
    { sku: "RSTO-MA-MTLTD",   name: "Matcha Latte",     category: "Matcha Series", sellPrice: 18000, costPrice: 6440 },
    { sku: "RSTO-MA-MTHOT",   name: "Matcha Latte Hot", category: "Matcha Series", sellPrice: 17000, costPrice: 6535 },
    { sku: "RSTO-MA-MTBRY",   name: "Matcha Berry",     category: "Matcha Series", sellPrice: 20000, costPrice: 7160 },

    // ── ICE COFFEE (IC) ────────────────────────────────────────
    { sku: "RSTO-IC-BTSC",    name: "Butterscotch",     category: "Ice Coffee",  sellPrice: 15000, costPrice: 7495 },
    { sku: "RSTO-IC-VNL",     name: "Vanilla",          category: "Ice Coffee",  sellPrice: 15000, costPrice: 7495 },
    { sku: "RSTO-IC-CRML",    name: "Caramel",          category: "Ice Coffee",  sellPrice: 18000, costPrice: 7495 },
    { sku: "RSTO-IC-HZNL",    name: "Hazelnut",         category: "Ice Coffee",  sellPrice: 18000, costPrice: 7495 },
    { sku: "RSTO-IC-TRMS",    name: "Tiramisu",         category: "Ice Coffee",  sellPrice: 18000, costPrice: 7495 },
    { sku: "RSTO-IC-AMRC",    name: "Americano",        category: "Ice Coffee",  sellPrice: 15000, costPrice: 3000 },
    { sku: "RSTO-IC-PSTC",    name: "Pistachio",        category: "Ice Coffee",  sellPrice: 18000, costPrice: 6408 },
    { sku: "RSTO-IC-IRCM",    name: "Irish Cream",      category: "Ice Coffee",  sellPrice: 18000, costPrice: 6495 },
    { sku: "RSTO-IC-AREN",    name: "Aren",             category: "Ice Coffee",  sellPrice: 18000, costPrice: 6275 },

    // ── HOT COFFEE (HC) ────────────────────────────────────────
    { sku: "RSTO-HC-CRMLT",   name: "Caramel Latte",    category: "Hot Coffee",  sellPrice: 17000, costPrice: 7210 },
    { sku: "RSTO-HC-HZNLT",   name: "Hazelnut Latte",   category: "Hot Coffee",  sellPrice: 17000, costPrice: 7210 },
    { sku: "RSTO-HC-VNLLT",   name: "Vanilla Latte",    category: "Hot Coffee",  sellPrice: 17000, costPrice: 7210 },
    { sku: "RSTO-HC-VNMDR",   name: "Vietnam Drip",     category: "Hot Coffee",  sellPrice: 12000, costPrice: 3000 },
    { sku: "RSTO-HC-V60",     name: "V60",              category: "Hot Coffee",  sellPrice: 16000, costPrice: 4000 },
    { sku: "RSTO-HC-TBRK",    name: "Tubruk",           category: "Hot Coffee",  sellPrice: 8000,  costPrice: 2000 },
    { sku: "RSTO-HC-ESPR",    name: "Espresso",         category: "Hot Coffee",  sellPrice: 10000, costPrice: 1800 },
];

// ─── RAW MATERIALS (45 bahan baku, cloned from Cafe LSP with RM-RSTO- prefix) ─

interface RawMaterial {
    name: string;
    sku: string;
    unit: string;
    unitCost: number;
    category: string;
}

const RAW_MATERIALS: RawMaterial[] = [
    // ── SYRUPS ────────────────────────────────────────
    { name: "Arunika Blue Citrus", sku: "RM-RSTO-001", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Lychee", sku: "RM-RSTO-002", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Siracuse / Candy Lemon", sku: "RM-RSTO-003", unit: "ml", unitCost: 66, category: "Syrup" },
    { name: "Soda", sku: "RM-RSTO-004", unit: "ml", unitCost: 11, category: "Base" },
    { name: "Arunika Lemon", sku: "RM-RSTO-005", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Green Apple", sku: "RM-RSTO-006", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Mojito Mint", sku: "RM-RSTO-007", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Strawberry", sku: "RM-RSTO-008", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Mango", sku: "RM-RSTO-009", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Peach", sku: "RM-RSTO-010", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Sunquick Orange", sku: "RM-RSTO-011", unit: "ml", unitCost: 101, category: "Syrup" },
    { name: "Arunika Peach Syrup", sku: "RM-RSTO-012", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Lemon Syrup", sku: "RM-RSTO-013", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Lychee Syrup", sku: "RM-RSTO-014", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Mango Syrup", sku: "RM-RSTO-015", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Strawberry Syrup", sku: "RM-RSTO-016", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Arunika Syrup Banana", sku: "RM-RSTO-017", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Delifru Strawberry Sauce", sku: "RM-RSTO-018", unit: "ml", unitCost: 96, category: "Syrup" },
    { name: "Gula Cair", sku: "RM-RSTO-019", unit: "ml", unitCost: 24, category: "Syrup" },
    { name: "Roccia Butterscotch Syrup", sku: "RM-RSTO-020", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Roccia Vanilla Syrup", sku: "RM-RSTO-021", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Roccia Caramel Syrup", sku: "RM-RSTO-022", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Roccia Hazelnut Syrup", sku: "RM-RSTO-023", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Roccia Tiramisu Syrup", sku: "RM-RSTO-024", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Arunika Pistachio", sku: "RM-RSTO-025", unit: "ml", unitCost: 83, category: "Syrup" },
    { name: "Roccia Vanilla", sku: "RM-RSTO-026", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Irish Cream", sku: "RM-RSTO-027", unit: "ml", unitCost: 100, category: "Syrup" },
    { name: "Mahora Horeca Aren", sku: "RM-RSTO-028", unit: "ml", unitCost: 64, category: "Syrup" },
    { name: "Roccia Irish", sku: "RM-RSTO-029", unit: "ml", unitCost: 100, category: "Syrup" },
    // ── BASE LIQUIDS ──────────────────────────────────
    { name: "Kremilk", sku: "RM-RSTO-030", unit: "ml", unitCost: 20, category: "Base" },
    { name: "Fresh Milk", sku: "RM-RSTO-031", unit: "ml", unitCost: 23, category: "Base" },
    { name: "Biang Teh", sku: "RM-RSTO-032", unit: "ml", unitCost: 11, category: "Base" },
    { name: "Air", sku: "RM-RSTO-033", unit: "ml", unitCost: 5, category: "Base" },
    // ── POWDERS ───────────────────────────────────────
    { name: "Voya Powder Cookies & Cream", sku: "RM-RSTO-034", unit: "gr", unitCost: 136, category: "Powder" },
    { name: "Arunika Powder Red Velvet", sku: "RM-RSTO-035", unit: "gr", unitCost: 147, category: "Powder" },
    { name: "Arunika Powder Choco", sku: "RM-RSTO-036", unit: "gr", unitCost: 156, category: "Powder" },
    { name: "Ito En Matcha", sku: "RM-RSTO-037", unit: "gr", unitCost: 875, category: "Powder" },
    // ── COFFEE ────────────────────────────────────────
    { name: "Espresso", sku: "RM-RSTO-038", unit: "ml", unitCost: 60, category: "Coffee" },
    { name: "Vietnam Ground Coffee", sku: "RM-RSTO-039", unit: "gr", unitCost: 133, category: "Coffee" },
    { name: "Specialty Ground Coffee", sku: "RM-RSTO-040", unit: "gr", unitCost: 150, category: "Coffee" },
    { name: "Ground Coffee", sku: "RM-RSTO-041", unit: "gr", unitCost: 120, category: "Coffee" },
    { name: "Espresso Beans Ground", sku: "RM-RSTO-042", unit: "gr", unitCost: 100, category: "Coffee" },
    // ── OTHERS ────────────────────────────────────────
    { name: "Gula", sku: "RM-RSTO-043", unit: "gr", unitCost: 20, category: "Other" },
    { name: "Gula Aren", sku: "RM-RSTO-044", unit: "gr", unitCost: 40, category: "Other" },
    { name: "Filter Paper", sku: "RM-RSTO-045", unit: "pcs", unitCost: 300, category: "Other" },
];

// ─── RECIPES (35 recipes, cloned from Cafe LSP) ──────────────────────────────

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
            { ingredientName: "Biang Teh", quantity: 40, unit: "ml", unitCost: 11 },
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

    // ── TEA SERIES ────────────────────────────────────────────
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
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Voya Powder Cookies & Cream", quantity: 25, unit: "gr", unitCost: 136 },
        ],
    },
    {
        productName: "Red Velvet",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Arunika Powder Red Velvet", quantity: 25, unit: "gr", unitCost: 147 },
        ],
    },

    // ── CHOCO SERIES ──────────────────────────────────────────
    {
        productName: "Dark Choco",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Arunika Powder Choco", quantity: 25, unit: "gr", unitCost: 156 },
        ],
    },
    {
        productName: "Choco Banana",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Arunika Syrup Banana", quantity: 10, unit: "ml", unitCost: 83 },
            { ingredientName: "Arunika Powder Choco", quantity: 15, unit: "gr", unitCost: 156 },
        ],
    },
    {
        productName: "Choco Berry",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
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
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
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
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Delifru Strawberry Sauce", quantity: 10, unit: "ml", unitCost: 96 },
            { ingredientName: "Ito En Matcha", quantity: 4, unit: "gr", unitCost: 875 },
        ],
    },

    // ── ICE COFFEE ────────────────────────────────────────────
    {
        productName: "Butterscotch",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Roccia Butterscotch Syrup", quantity: 25, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Vanilla",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Roccia Vanilla Syrup", quantity: 25, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Caramel",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Roccia Caramel Syrup", quantity: 25, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Hazelnut",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Roccia Hazelnut Syrup", quantity: 25, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Tiramisu",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
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
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Gula Cair", quantity: 7, unit: "ml", unitCost: 24 },
            { ingredientName: "Arunika Pistachio", quantity: 15, unit: "ml", unitCost: 83 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Irish Cream",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Roccia Vanilla", quantity: 5, unit: "ml", unitCost: 100 },
            { ingredientName: "Irish Cream", quantity: 10, unit: "ml", unitCost: 100 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },
    {
        productName: "Aren",
        ingredients: [
            { ingredientName: "Kremilk", quantity: 150, unit: "ml", unitCost: 20 },
            { ingredientName: "Mahora Horeca Aren", quantity: 20, unit: "ml", unitCost: 64 },
            { ingredientName: "Espresso", quantity: 30, unit: "ml", unitCost: 60 },
        ],
    },

    // ── HOT COFFEE ────────────────────────────────────────────
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

// ─── MAIN SEED FUNCTION ───────────────────────────────────────────────────────

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  SEED RESTO DRINKS — Clone Cafe LSP Menu to Resto Unit     ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // ─── SAFETY: Snapshot Toko stock before seeding ───────────────────────────
    console.log("=== SAFETY CHECK: Snapshot Toko stock BEFORE seeding ===\n");

    const tokoProductsBefore = await prisma.storeProduct.findMany({
        where: { unitType: "toko", deletedAt: null, isActive: true },
        select: { id: true, sku: true, name: true, stock: true, stockGdg: true, stockToko: true },
    });
    const tokoStockSnapshot = new Map(
        tokoProductsBefore.map((p) => [p.id, { stock: p.stock, stockGdg: p.stockGdg, stockToko: p.stockToko }])
    );
    console.log(`  Toko products checked: ${tokoProductsBefore.length}`);
    console.log(`  Toko total stock (sum): ${tokoProductsBefore.reduce((s, p) => s + p.stock + p.stockGdg + p.stockToko, 0)}`);
    console.log("");

    // ─── PHASE 1: Seed Raw Materials (Bahan Baku) ────────────────────────────
    console.log(`=== PHASE 1: Seeding ${RAW_MATERIALS.length} Raw Materials (Bahan Baku) ===\n`);

    let rmCreated = 0;
    let rmSkipped = 0;

    for (const rm of RAW_MATERIALS) {
        const existing = await prisma.storeProduct.findFirst({
            where: { sku: rm.sku },
        });

        if (existing) {
            rmSkipped++;
            continue;
        }

        await prisma.storeProduct.create({
            data: {
                sku: rm.sku,
                name: rm.name,
                category: rm.category,
                unitType: "resto",
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
        rmCreated++;
        console.log(`  Created: ${rm.name} (${rm.sku}) — Rp${rm.unitCost}/${rm.unit}`);
    }

    console.log(`\n  Phase 1 done: ${rmCreated} created, ${rmSkipped} already exist`);

    // ─── PHASE 2: Seed Menu Items (Drinks) ───────────────────────────────────
    console.log(`\n=== PHASE 2: Seeding ${MENU.length} Menu Items (Drinks) ===\n`);

    let menuCreated = 0;
    let menuUpdated = 0;
    let menuSkipped = 0;

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
                menuUpdated++;
                console.log(`  UPDATED: ${item.name} (${item.sku})`);
            } else {
                menuSkipped++;
            }
        } else {
            await prisma.storeProduct.create({
                data: {
                    sku: item.sku,
                    name: item.name,
                    category: item.category,
                    unitType: "resto",
                    sellPrice: item.sellPrice,
                    costPrice: item.costPrice,
                    isService: true,
                    isActive: true,
                    stock: 0,
                    stockGdg: 0,
                    stockToko: 0,
                    unit: "cup",
                    productType: "finished",
                    trackStock: false, // racikan — deduct ingredients via recipe
                },
            });
            menuCreated++;
            console.log(`  CREATED: ${item.name} (${item.sku}) — Rp${item.sellPrice.toLocaleString("id-ID")}`);
        }
    }

    console.log(`\n  Phase 2 done: ${menuCreated} created, ${menuUpdated} updated, ${menuSkipped} unchanged`);

    // ─── PHASE 3: Seed Recipes + Link Ingredients ────────────────────────────
    console.log(`\n=== PHASE 3: Seeding ${RECIPES.length} Recipes ===\n`);

    // Build lookup: ingredient name → Resto ingredient product
    const restoIngredients = await prisma.storeProduct.findMany({
        where: { productType: "ingredient", unitType: "resto", isActive: true },
    });
    const ingredientLookup = new Map<string, number>();
    for (const ing of restoIngredients) {
        ingredientLookup.set(ing.name.toLowerCase().trim(), ing.id);
    }
    console.log(`  Resto ingredients available: ${restoIngredients.length}`);

    let recipesCreated = 0;
    let ingredientsLinked = 0;
    let ingredientsUnmatched = 0;

    for (const recipe of RECIPES) {
        const product = await prisma.storeProduct.findFirst({
            where: { name: recipe.productName, unitType: "resto", productType: "finished" },
        });

        if (!product) {
            console.log(`  SKIP: Product "${recipe.productName}" not found in Resto`);
            continue;
        }

        const totalCost = recipe.ingredients.reduce((sum, ing) => sum + ing.quantity * ing.unitCost, 0);

        // Delete existing recipes and recreate
        await prisma.productRecipe.deleteMany({ where: { productId: product.id } });

        for (const ing of recipe.ingredients) {
            const subtotal = ing.quantity * ing.unitCost;
            const ingredientId = ingredientLookup.get(ing.ingredientName.toLowerCase().trim()) || null;

            if (ingredientId) {
                ingredientsLinked++;
            } else {
                ingredientsUnmatched++;
                console.log(`    WARN: "${ing.ingredientName}" not found in Resto ingredients`);
            }

            await prisma.productRecipe.create({
                data: {
                    productId: product.id,
                    ingredientName: ing.ingredientName,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    unitCost: ing.unitCost,
                    subtotal,
                    ingredientProductId: ingredientId,
                },
            });
        }

        // Update costPrice to match recipe total
        await prisma.storeProduct.update({
            where: { id: product.id },
            data: { costPrice: Math.round(totalCost) },
        });

        recipesCreated++;
        const margin = Number(product.sellPrice) - Math.round(totalCost);
        const marginPct = ((margin / Number(product.sellPrice)) * 100).toFixed(0);
        console.log(`  ${recipe.productName}: ${recipe.ingredients.length} bahan, HPP Rp${Math.round(totalCost).toLocaleString("id-ID")}, Margin ${marginPct}%`);
    }

    console.log(`\n  Phase 3 done: ${recipesCreated} recipes, ${ingredientsLinked} ingredients linked, ${ingredientsUnmatched} unmatched`);

    // ─── SAFETY: Verify Toko stock unchanged ─────────────────────────────────
    console.log(`\n=== SAFETY CHECK: Verify Toko stock AFTER seeding ===\n`);

    const tokoProductsAfter = await prisma.storeProduct.findMany({
        where: { unitType: "toko", deletedAt: null, isActive: true },
        select: { id: true, sku: true, name: true, stock: true, stockGdg: true, stockToko: true },
    });

    let stockOk = true;
    for (const p of tokoProductsAfter) {
        const before = tokoStockSnapshot.get(p.id);
        if (!before) continue;
        if (before.stock !== p.stock || before.stockGdg !== p.stockGdg || before.stockToko !== p.stockToko) {
            console.log(`  CHANGED: ${p.name} (${p.sku}) — Before: stock=${before.stock} gdg=${before.stockGdg} toko=${before.stockToko} → After: stock=${p.stock} gdg=${p.stockGdg} toko=${p.stockToko}`);
            stockOk = false;
        }
    }

    if (stockOk) {
        console.log("  ALL TOKO STOCK UNCHANGED — Safe!");
    } else {
        console.log("  WARNING: Some Toko stock changed! Investigate before proceeding.");
    }

    // ─── SUMMARY ─────────────────────────────────────────────────────────────
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║  SEED COMPLETE                                              ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  Bahan Baku:   ${String(rmCreated).padStart(3)} created, ${String(rmSkipped).padStart(3)} skipped              ║`);
    console.log(`║  Menu Items:   ${String(menuCreated).padStart(3)} created, ${String(menuUpdated).padStart(3)} updated, ${String(menuSkipped).padStart(3)} unchanged  ║`);
    console.log(`║  Recipes:      ${String(recipesCreated).padStart(3)} seeded, ${String(ingredientsLinked).padStart(3)} linked             ║`);
    console.log(`║  Toko Safety:  ${stockOk ? "PASS" : "FAIL - CHECK ABOVE"}                        ║`);
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // Category breakdown
    const categories = [...new Set(MENU.map((m) => m.category))];
    console.log("Categories:");
    for (const cat of categories) {
        const items = MENU.filter((m) => m.category === cat);
        console.log(`  ${cat}: ${items.length} items`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
