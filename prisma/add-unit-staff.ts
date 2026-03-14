/**
 * Add admin/kasir accounts for all 10 units + ensure RBAC roles exist
 * Run: npx tsx prisma/add-unit-staff.ts
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = [
    "manage_all",
    "manage_anggota", "manage_simpanan", "manage_pinjaman",
    "approve_pinjaman", "manage_toko", "view_laporan",
    "manage_kas_bank", "view_jurnal", "manage_periode",
    "manage_users", "input_transaksi",
    "view_own_data", "apply_pinjaman",
];

const ROLES = [
    { name: "operator", display: "Operator", permissions: ["manage_all"] },
    {
        name: "admin", display: "Admin Unit", permissions: [
            "manage_anggota", "manage_simpanan", "manage_pinjaman",
            "approve_pinjaman", "manage_toko", "view_laporan",
            "manage_kas_bank", "view_jurnal", "input_transaksi",
        ]
    },
    { name: "kasir", display: "Kasir Unit", permissions: ["input_transaksi"] },
    { name: "anggota", display: "Anggota", permissions: ["view_own_data", "apply_pinjaman"] },
];

const UNITS = [
    { unit: "simpan_pinjam", label: "Simpan Pinjam", emailKey: "sp" },
    { unit: "toko", label: "Toko", emailKey: "toko" },
    { unit: "fitness", label: "Fitness", emailKey: "fitness" },
    { unit: "cuci_mobil", label: "Cuci Mobil", emailKey: "cucimobil" },
    { unit: "fotocopy", label: "Fotocopy", emailKey: "fotocopy" },
    { unit: "laundry", label: "Laundry", emailKey: "laundry" },
    { unit: "resto_cafe", label: "Resto & Cafe", emailKey: "cafe" },
    { unit: "playstation", label: "Playstation", emailKey: "ps" },
    { unit: "barbershop", label: "Barbershop", emailKey: "barbershop" },
    { unit: "aset", label: "Aset", emailKey: "aset" },
];

async function main() {
    console.log("🔄 Setting up RBAC roles and unit staff accounts...\n");

    // --- Ensure permissions exist ---
    const permMap: Record<string, number> = {};
    for (const p of PERMISSIONS) {
        const perm = await prisma.permission.upsert({
            where: { name: p },
            create: { name: p, displayName: p.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), module: "system" },
            update: {},
        });
        permMap[p] = perm.id;
    }
    console.log(`  ✅ ${Object.keys(permMap).length} permissions ensured`);

    // --- Ensure roles exist ---
    const roleMap: Record<string, number> = {};
    for (const r of ROLES) {
        const role = await prisma.role.upsert({
            where: { name: r.name },
            create: { name: r.name, displayName: r.display, description: `Role: ${r.display}` },
            update: { displayName: r.display },
        });
        roleMap[r.name] = role.id;

        // Ensure role-permission links
        for (const pName of r.permissions) {
            const exists = await prisma.rolePermission.findFirst({
                where: { roleId: role.id, permissionId: permMap[pName] },
            });
            if (!exists) {
                await prisma.rolePermission.create({
                    data: { roleId: role.id, permissionId: permMap[pName] },
                });
            }
        }
    }
    console.log(`  ✅ ${Object.keys(roleMap).length} roles ensured\n`);

    // --- Get branch ---
    const branch = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
    if (!branch) {
        console.error("❌ Head Office branch not found.");
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash("password123", 12);

    // --- Ensure operator account ---
    const opEmail = "admin@koperasi.com";
    const existingOp = await prisma.user.findFirst({ where: { email: opEmail } });
    if (existingOp) {
        // Update role to operator if needed
        await prisma.user.update({
            where: { id: existingOp.id },
            data: { roleId: roleMap["operator"], name: "Operator (Super Admin)" },
        });
        console.log(`  🔄 ${opEmail} — role updated to operator`);
    } else {
        await prisma.user.create({
            data: {
                name: "Operator (Super Admin)", email: opEmail, password: hashedPassword,
                roleId: roleMap["operator"], branchId: branch.id, isActive: true,
            },
        });
        console.log(`  ✅ ${opEmail} — dibuat`);
    }

    // --- Create Admin + Kasir for all 10 units ---
    console.log("\n📋 Unit Staff Accounts:\n");
    let created = 0;

    for (const u of UNITS) {
        for (const role of ["admin", "kasir"] as const) {
            const email = `${role}${u.emailKey}@koperasi.com`;
            const name = `${role === "admin" ? "Admin" : "Kasir"} ${u.label}`;
            const roleId = role === "admin" ? roleMap["admin"] : roleMap["kasir"];

            const existing = await prisma.user.findFirst({ where: { email } });
            if (existing) {
                console.log(`  ⏭️  ${email.padEnd(35)} — sudah ada`);
                continue;
            }

            await prisma.user.create({
                data: {
                    name, email, password: hashedPassword,
                    roleId, branchId: branch.id,
                    unitType: u.unit, isActive: true,
                },
            });
            console.log(`  ✅ ${email.padEnd(35)} — dibuat (${name})`);
            created++;
        }
    }

    // --- Update existing member accounts to anggota role ---
    const anggotaRole = roleMap["anggota"];
    const memberUsers = await prisma.user.findMany({
        where: { memberId: { not: null } },
    });
    let updatedMembers = 0;
    for (const mu of memberUsers) {
        if (mu.roleId !== anggotaRole) {
            await prisma.user.update({
                where: { id: mu.id },
                data: { roleId: anggotaRole },
            });
            updatedMembers++;
        }
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log("              SETUP SELESAI                        ");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  ✅ Staff baru     : ${created} akun`);
    console.log(`  🔄 Member updated : ${updatedMembers} role → anggota`);
    console.log("  🔑 Semua password : password123");
    console.log("═══════════════════════════════════════════════════\n");
}

main()
    .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
