/**
 * Seed: kasir_pos Permission + Stock Import dari PDF
 * Run dengan: npx ts-node --skip-project prisma/seed-kasir-stock.ts
 * Atau via: npx tsx prisma/seed-kasir-stock.ts
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
    console.log("=== Seed: kasir_pos permission + Stock Import ===\n");

    // ============================================================
    // STEP 1: Tambah permission kasir_pos ke database
    // ============================================================
    console.log("1. Memeriksa permission kasir_pos...");

    let kasirPosPerm = await prisma.permission.findFirst({ where: { name: "kasir_pos" } });
    if (!kasirPosPerm) {
        kasirPosPerm = await prisma.permission.create({
            data: { name: "kasir_pos", displayName: "Kasir Cepat POS", module: "Kasir" },
        });
        console.log("   ✅ Permission kasir_pos dibuat (id:", kasirPosPerm.id, ")");
    } else {
        console.log("   ℹ️  Permission kasir_pos sudah ada (id:", kasirPosPerm.id, ")");
    }

    // ============================================================
    // STEP 2: Berikan permission ke role kasir, admin, dan operator
    // ============================================================
    const targetRoles = ["kasir", "admin", "super_admin"];
    for (const roleName of targetRoles) {
        const role = await prisma.role.findFirst({ where: { name: roleName } });
        if (!role) {
            console.log(`   ⚠️  Role '${roleName}' tidak ditemukan, dilewati.`);
            continue;
        }

        const existing = await prisma.rolePermission.findFirst({
            where: { roleId: role.id, permissionId: kasirPosPerm.id },
        });
        if (!existing) {
            await prisma.rolePermission.create({
                data: { roleId: role.id, permissionId: kasirPosPerm.id },
            });
            console.log(`   ✅ Permission kasir_pos diberikan ke role '${roleName}'`);
        } else {
            console.log(`   ℹ️  Role '${roleName}' sudah punya permission kasir_pos`);
        }
    }

    // ============================================================
    // STEP 3: Import data stok dari JSON
    // ============================================================
    const stockJsonPath = path.join("c:\\tmp", "stock_data.json");

    if (!fs.existsSync(stockJsonPath)) {
        console.log("\n⚠️  File c:\\tmp\\stock_data.json tidak ditemukan. Silakan jalankan extract_stock.py terlebih dahulu.");
        return;
    }

    const stockData: Array<{
        sku: string; name: string; category: string;
        buyPrice: number; sellPrice: number; stock: number; unit: string;
    }> = JSON.parse(fs.readFileSync(stockJsonPath, "utf-8"));

    console.log(`\n2. Mengimpor ${stockData.length} produk dari PDF...`);

    // Find required fields
    const adminUser = await prisma.user.findFirst({ where: { role: { name: "admin" } } });
    const createdById = adminUser?.id ?? 1;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of stockData) {
        try {
            if (!item.sku || !item.name || item.sellPrice <= 0) {
                skipped++;
                continue;
            }

            // Upsert: If SKU exists, update stock and price. If not, create.
            const existing = await prisma.storeProduct.findFirst({
                where: { sku: item.sku, deletedAt: null },
            });

            if (existing) {
                await prisma.storeProduct.update({
                    where: { id: existing.id },
                    data: {
                        stock: item.stock,
                        costPrice: item.buyPrice,
                        sellPrice: item.sellPrice,
                        isActive: true,
                    },
                });
                updated++;
            } else {
                await prisma.storeProduct.create({
                    data: {
                        sku: item.sku,
                        name: item.name,
                        category: item.category,
                        costPrice: item.buyPrice,
                        sellPrice: item.sellPrice,
                        stock: item.stock,
                        unit: item.unit,
                        isActive: true,
                        unitType: "toko",
                    },
                });
                inserted++;
            }
        } catch (err: any) {
            console.error(`   ❌ Error pada SKU ${item.sku}: ${err.message}`);
            skipped++;
        }
    }

    console.log(`\n=== Hasil Import Stok ===`);
    console.log(`✅ Produk baru ditambahkan : ${inserted}`);
    console.log(`🔄 Produk diperbarui stoknya: ${updated}`);
    console.log(`⚠️  Produk dilewati (error) : ${skipped}`);
    console.log(`\nTotal produk aktif di database:`);
    const totalActive = await prisma.storeProduct.count({ where: { isActive: true, deletedAt: null } });
    console.log(`   ${totalActive} produk aktif`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
        console.log("\n✅ Seed selesai!");
    })
    .catch(async (e) => {
        console.error("❌ Error:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
