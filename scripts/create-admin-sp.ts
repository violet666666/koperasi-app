import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. Create role if not exists
  let role = await prisma.role.findUnique({ where: { name: "admin_sp" } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        name: "admin_sp",
        displayName: "Admin Simpan Pinjam",
        description: "Admin khusus Simpan Pinjam",
        isSystem: true,
      },
    });
    console.log("Created role admin_sp, id:", role.id);
  } else {
    console.log("Role admin_sp already exists, id:", role.id);
  }

  // 2. Link permissions
  const permNames = [
    "view_dashboard", "manage_anggota", "view_anggota",
    "manage_simpanan", "view_simpanan",
    "manage_pinjaman", "view_pinjaman", "approve_pinjaman",
    "manage_kas_bank", "view_jurnal", "view_laporan",
    "approve_transactions", "manage_unit_transactions", "manage_pengumuman",
  ];
  let linked = 0;
  for (const pn of permNames) {
    const perm = await prisma.permission.findUnique({ where: { name: pn } });
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
      linked++;
    } else {
      console.log("  SKIP (not found):", pn);
    }
  }
  console.log("Permissions linked:", linked + "/" + permNames.length);

  // 3. Create user
  const existing = await prisma.user.findUnique({ where: { email: "adminsp@koperasi.com" } });
  if (existing) {
    console.log("User adminsp@koperasi.com already exists, id:", existing.id);
  } else {
    const hash = await bcrypt.hash("password123", 10);
    const branch = await prisma.branch.findFirst();
    const user = await prisma.user.create({
      data: {
        name: "Admin Simpan Pinjam",
        email: "adminsp@koperasi.com",
        password: hash,
        roleId: role.id,
        branchId: branch?.id || 1,
        unitType: "simpan_pinjam",
        isActive: true,
      },
    });
    console.log("User created: adminsp@koperasi.com, id:", user.id);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
