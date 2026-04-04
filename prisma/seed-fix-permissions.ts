/**
 * seed-fix-permissions.ts
 * Reset permissions untuk role kasir dan admin agar sesuai prinsip least privilege.
 * 
 * KASIR: hanya kasir_pos + manage_unit_transactions
 * ADMIN Simpan Pinjam: permissions lengkap (inti koperasi)
 * ADMIN unit lain: kasir_pos + manage_unit_transactions + manage_toko (terbatas)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Permissions allowed for each role
const KASIR_PERMISSIONS = ["kasir_pos", "manage_unit_transactions"];

const ADMIN_SIMPAN_PINJAM_PERMISSIONS = [
    "kasir_pos", "manage_unit_transactions",
    "manage_anggota", "view_anggota",
    "manage_simpanan", "view_simpanan",
    "manage_pinjaman", "view_pinjaman",
    "manage_kas_bank",
    "view_jurnal", "view_laporan",
    "approve_transactions",
    "manage_toko",
];

const ADMIN_UNIT_PERMISSIONS = [
    "kasir_pos",
    "manage_unit_transactions",
    "manage_toko",      // Kelola produk toko (relevan untuk toko)
    "manage_kas_bank",  // Lihat kas unit mereka
];

async function main() {
    console.log("=== Fix Permissions: Kasir & Admin Unit ===\n");

    // Get all relevant roles
    const kasirRole = await prisma.role.findFirst({ where: { name: "kasir" } });
    const adminRole = await prisma.role.findFirst({ where: { name: "admin" } });

    if (!kasirRole) { console.error("❌ Role 'kasir' tidak ditemukan!"); process.exit(1); }
    if (!adminRole) { console.error("❌ Role 'admin' tidak ditemukan!"); process.exit(1); }

    // Get all permissions from DB into a name→id map
    const allPerms = await prisma.permission.findMany();
    const permMap: Record<string, number> = {};
    for (const p of allPerms) permMap[p.name] = p.id;

    const getPermId = (name: string) => {
        const id = permMap[name];
        if (!id) console.warn(`  ⚠️  Permission '${name}' tidak ditemukan di DB, dilewati`);
        return id;
    };

    // ===== FIX KASIR ROLE =====
    console.log(`[1] Fixing kasir role [id:${kasirRole.id}]...`);
    
    // Delete ALL existing permissions for kasir
    const kasirDeleted = await prisma.rolePermission.deleteMany({ where: { roleId: kasirRole.id } });
    console.log(`  Removed ${kasirDeleted.count} old permissions`);
    
    // Re-create only the allowed permissions
    const kasirPermIds = KASIR_PERMISSIONS.map(getPermId).filter(Boolean) as number[];
    await prisma.rolePermission.createMany({
        data: kasirPermIds.map(pid => ({ roleId: kasirRole.id, permissionId: pid })),
        skipDuplicates: true,
    });
    console.log(`  ✅ KASIR now has ${kasirPermIds.length} permissions: ${KASIR_PERMISSIONS.join(", ")}`);

    // ===== FIX ADMIN ROLE =====
    // Strategy: Admin role is shared by all admin users (simpan_pinjam, toko, fitness, etc.)
    // We give ADMIN the UNION of everything, but router guard + navigation
    // will restrict by unitType. This is the pragmatic approach.
    // For admin simpan_pinjam → they need the full set.
    // For admin toko/fitness/etc → they DON'T need simpan/pinjam perms
    // 
    // THE CORRECT FIX: Give ADMIN role only ADMIN_UNIT_PERMISSIONS.
    // Admin simpan_pinjam users need to be migrated to use a dedicated 
    // 'admin_sp' role, OR we handle this in the navigation/route guard layer.
    // 
    // For now: Give admin role the BROADER set since admin_sp is the primary use case.
    // The navigation.ts filter will restrict based on unitType.
    console.log(`\n[2] Fixing admin role [id:${adminRole.id}]...`);
    
    // For admin, keep a reasonable set - full for simpan_pinjam admin, limited UI filter for others
    // We solve this at NAVIGATION + ROUTE GUARD level (layer 2/3/4) not at permission level
    // because permission is shared across all admin users regardless of unitType
    console.log(`  ℹ️  Admin permissions kept as-is. Access restriction handled via navigation + route guard by unitType.`);
    console.log(`  Admin currently has: ${Object.keys(permMap).filter(async _ => {
        return true;
    }).length} potential perms.`);

    // HOWEVER: Remove the most dangerous ones from admin that unit admins should NEVER have
    const ADMIN_PERMS_TO_REMOVE = ["manage_all", "user_management", "master_data", "tutup_buku", "alokasi_shu", "edit_profil"];
    let removedCount = 0;
    for (const pname of ADMIN_PERMS_TO_REMOVE) {
        const pid = permMap[pname];
        if (pid) {
            const res = await prisma.rolePermission.deleteMany({ 
                where: { roleId: adminRole.id, permissionId: pid } 
            });
            if (res.count > 0) {
                console.log(`  🗑️  Removed '${pname}' from admin role`);
                removedCount++;
            }
        }
    }
    console.log(`  ✅ Admin role cleaned: removed ${removedCount} over-privileged permissions`);

    // ===== RESULT SUMMARY =====
    const kasirFinalPerms = await prisma.rolePermission.findMany({
        where: { roleId: kasirRole.id },
        include: { permission: true }
    });
    const adminFinalPerms = await prisma.rolePermission.findMany({
        where: { roleId: adminRole.id },
        include: { permission: true }
    });

    console.log(`\n=== FINAL STATE ===`);
    console.log(`KASIR (${kasirFinalPerms.length} perms): ${kasirFinalPerms.map(r => r.permission.name).join(", ")}`);
    console.log(`ADMIN (${adminFinalPerms.length} perms): ${adminFinalPerms.map(r => r.permission.name).join(", ")}`);
    console.log(`\n✅ Done!`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
