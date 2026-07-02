/**
 * Pre-deploy read-only check for Fase 4b (mobile RBAC scope).
 * Fail-closed scope checks deny non-operator staff whose branchId/unitType is null.
 * This script lists such users so they can be fixed BEFORE deploy (otherwise they
 * get 403 on scoped routes).
 *
 * Run: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-staff-null-scope.ts
 */
import prisma from "../src/lib/prisma";

async function main() {
  const staff = await prisma.user.findMany({
    where: { role: { name: { in: ["admin", "admin_sp", "kasir"] } }, isActive: true },
    include: { role: { select: { name: true } } },
    orderBy: { id: "asc" },
  });

  const nullBranch = staff.filter((u) => u.branchId == null);
  // admin & kasir require unitType; admin_sp is simpan_pinjam-scoped (unitType may be null in legacy rows)
  const nullUnit = staff.filter(
    (u) => (u.role.name === "admin" || u.role.name === "kasir") && (u.unitType == null || u.unitType === "")
  );

  console.log(`\n=== Staff null-scope diagnostic (Fase 4b) ===`);
  console.log(`Active staff (admin/admin_sp/kasir): ${staff.length}`);
  console.log(`With null branchId (would 403 on SP routes): ${nullBranch.length}`);
  for (const u of nullBranch) {
    console.log(`  - id=${u.id} ${u.email} role=${u.role.name} unitType=${u.unitType ?? "null"}`);
  }
  console.log(`admin/kasir with null unitType (would 403 on unit routes): ${nullUnit.length}`);
  for (const u of nullUnit) {
    console.log(`  - id=${u.id} ${u.email} role=${u.role.name} branchId=${u.branchId ?? "null"}`);
  }
  console.log(`\n${nullBranch.length + nullUnit.length === 0 ? "OK: no null-scope staff." : "ACTION: set branchId/unitType for the users above before deploy."}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
