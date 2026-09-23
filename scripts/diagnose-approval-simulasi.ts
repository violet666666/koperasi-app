// Read-only: simulasikan persis logika GET /api/approvals untuk user admin unit tertentu.
// Bandingkan COUNT (kartu) vs LIST (tabel) untuk status=history — cari divergensi.
import { prisma } from "../src/lib/prisma";
import { isSameUnit, unitAliasGroup } from "../src/lib/unit-aliases";

async function main() {
  const target = process.argv[2] ?? "admintoko@koperasi.com";
  const user = target.includes("@")
    ? await prisma.user.findUnique({ where: { email: target }, include: { role: true } })
    : await prisma.user.findFirst({ where: { name: { contains: target, mode: "insensitive" } }, include: { role: true } });
  if (!user) { console.log(`User ${target} tidak ditemukan`); return; }

  const roleName = user.role.name;
  const userUnitType = user.unitType;
  const isOperator = roleName === "operator" || roleName === "admin_sp";
  const isSimpanPinjamAdmin = roleName === "admin" && userUnitType === "simpan_pinjam";
  const isUnitAdmin = roleName === "admin" && !!userUnitType && userUnitType !== "simpan_pinjam";

  console.log(`=== Simulasi /api/approvals utk ${user.email} ===`);
  console.log(`role=${roleName} unitType=${JSON.stringify(userUnitType)} isOperator=${isOperator} isUnitAdmin=${isUnitAdmin} isSPAdmin=${isSimpanPinjamAdmin}`);
  console.log(`unitAliasGroup=${JSON.stringify(unitAliasGroup(userUnitType))}`);

  for (const statusParam of ["pending", "history"] as const) {
    const voidStatusFilter = statusParam === "pending"
      ? { status: "pending" }
      : { status: { in: ["approved", "rejected"] } };

    const rows = await prisma.approvalRequest.findMany({
      where: { type: { in: ["unit_void", "void_store_sale", "laporan_unit"] }, ...voidStatusFilter },
      include: { requestedBy: { select: { id: true, name: true } } },
      orderBy: { requestedAt: "desc" },
    });

    // Filter list — persis route
    const visible = rows.filter((req) => {
      if (isOperator) return true;
      if (isUnitAdmin) {
        const meta: any = typeof req.metadata === "string" ? JSON.parse(req.metadata) : req.metadata || {};
        return isSameUnit(meta.unitType, userUnitType);
      }
      if (isSimpanPinjamAdmin) {
        const meta: any = typeof req.metadata === "string" ? JSON.parse(req.metadata) : req.metadata || {};
        return meta.unitType === "simpan_pinjam";
      }
      return false;
    });

    // Count — persis route buildVoidCountWhere
    const base: Record<string, unknown> = {
      type: { in: ["unit_void", "void_store_sale", "laporan_unit"] },
      status: statusParam === "pending" ? "pending" : { in: ["approved", "rejected"] },
    };
    if (isUnitAdmin && userUnitType) {
      base.OR = unitAliasGroup(userUnitType).map((a) => ({ metadata: { path: ["unitType"], equals: a } }));
    } else if (isSimpanPinjamAdmin) {
      base.metadata = { path: ["unitType"], equals: "simpan_pinjam" };
    }
    const count = await prisma.approvalRequest.count({ where: base as any });

    console.log(`\n[${statusParam}] rowDb=${rows.length} listTampil=${visible.length} countKartu=${count} ${visible.length !== count ? "  <<< DIVERGEN!" : "  (sinkron)"}`);
    if (visible.length !== count) {
      console.log(`  Rows DB terfilter tapi GAGAL filter list:`);
      for (const r of rows) {
        const meta: any = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata || {};
        const pass = isOperator ? true : isSameUnit(meta.unitType, userUnitType);
        const metaType = typeof r.metadata === "string" ? `STRING:"${String(r.metadata).slice(0, 80)}"` : `OBJ`;
        console.log(`    #${r.id} ${r.requestNo} status=${r.status} meta.unitType=${JSON.stringify(meta.unitType)} rawMeta=${metaType} isSameUnit=${pass}`);
      }
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
