/**
 * DIAGNOSTIC (read-only): Cek apakah filter SQL di GET /api/mobile/transactions
 * (type=unit, commit ce3cd407) salah meng-exclude StoreSale via jebakan
 * three-valued-logic pada filter JSON Prisma — pola yang sama dengan
 * "void-filter Prisma JSON NULL bug" di SHU calculator (CLAUDE.md).
 *
 * Usage: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-unit-visibility.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // 1. Distribusi bentuk metadata StoreSale
    const sales = await prisma.storeSale.findMany({ select: { metadata: true } });
    let nullMeta = 0, emptyObj = 0, isVoidedTrue = 0, isVoidedFalse = 0, absentIsVoided = 0;
    for (const s of sales) {
        const m = s.metadata as any;
        if (m === null || m === undefined) nullMeta++;
        else if (typeof m === "object" && !Array.isArray(m) && Object.keys(m).length === 0) emptyObj++;
        else if (m?.isVoided === true) isVoidedTrue++;
        else if (m?.isVoided === false) isVoidedFalse++;
        else absentIsVoided++;
    }
    const jsKept = sales.length - isVoidedTrue; // semantik filter JS lama

    // 2. Filter SQL yang sekarang dipakai route (commit ce3cd407)
    const sqlKept = await prisma.storeSale.count({
        where: { NOT: { metadata: { path: ["isVoided"], equals: true } } },
    });

    console.log("=== StoreSale ===");
    console.log({
        total: sales.length, nullMeta, emptyObj, isVoidedTrue, isVoidedFalse,
        absentIsVoided, // metadata ada tapi TANPA key isVoided (mis. {isSettled:true})
        jsKept, sqlKept,
        HILANG_OLEH_FILTER_SQL: jsKept - sqlKept,
    });

    // 3. Jebakan yang sama di unitWhere? (salary_cut + notes NULL → NOT(AND) = NULL → ter-exclude)
    const scNullNotes = await prisma.unitTransaction.count({
        where: { paymentMethod: "salary_cut", notes: null },
    });
    const unitTotal = await prisma.unitTransaction.count();
    const unitAutoGen = await prisma.unitTransaction.count({
        where: { paymentMethod: "salary_cut", notes: { startsWith: "Auto-generated" } },
    });
    const unitSqlKept = await prisma.unitTransaction.count({
        where: { NOT: [{ paymentMethod: "salary_cut", notes: { startsWith: "Auto-generated" } }] },
    });
    console.log("=== UnitTransaction ===");
    console.log({
        unitTotal, unitAutoGen, scNullNotes,
        jsKept: unitTotal - unitAutoGen, unitSqlKept,
        HILANG_OLEH_FILTER_SQL: unitTotal - unitAutoGen - unitSqlKept,
    });

    // 4. Contoh korban: sale lunas (isSettled) yang masuk kategori hidden
    if (jsKept - sqlKept > 0) {
        const victims = await prisma.storeSale.findMany({
            where: { metadata: { path: ["isSettled"], equals: true } },
            select: {
                id: true, saleNo: true, createdAt: true,
                paymentMethod: true, totalAmount: true,
                member: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
        });
        console.log("=== Contoh sale LUNAS (positif isSettled — aman dari 3VL) ===");
        for (const v of victims) {
            console.log(`  ${v.saleNo} · ${(v.member as any)?.name ?? "-"} · ${v.paymentMethod} · Rp${v.totalAmount} · ${v.createdAt.toISOString().slice(0, 10)}`);
        }
    }

    // 5. Simulasi logika FIX (count positif + JS filter + window densitas)
    // untuk anggota korban — replika persis route setelah perbaikan.
    const victim = await prisma.member.findFirst({
        where: { name: { contains: "RIZKY DWI" } },
        select: { id: true, name: true },
    });
    if (victim) {
        const page = 1, limit = 50, startIdx = 0, fetchWindow = startIdx + limit;
        const [unitAll, unitExcluded, storeAll, storeVoided] = await Promise.all([
            prisma.unitTransaction.count({ where: { memberId: victim.id } }),
            prisma.unitTransaction.count({
                where: { memberId: victim.id, AND: [{ paymentMethod: "salary_cut" }, { notes: { startsWith: "Auto-generated" } }] },
            }),
            prisma.storeSale.count({ where: { memberId: victim.id } }),
            prisma.storeSale.count({ where: { memberId: victim.id, AND: [{ metadata: { path: ["isVoided"], equals: true } }] } }),
        ]);
        const unitCount = unitAll - unitExcluded;
        const storeCount = storeAll - storeVoided;
        const unitTake = unitCount > 0 ? Math.ceil((fetchWindow * unitAll) / unitCount) + 10 : 0;
        const storeTake = storeCount > 0 ? Math.ceil((fetchWindow * storeAll) / storeCount) + 10 : 0;
        const [unitTxns, storeSales] = await Promise.all([
            prisma.unitTransaction.findMany({ where: { memberId: victim.id }, orderBy: { createdAt: "desc" }, take: unitTake }),
            prisma.storeSale.findMany({ where: { memberId: victim.id }, orderBy: { createdAt: "desc" }, take: storeTake, select: { metadata: true } }),
        ]);
        const filteredUnit = unitTxns.filter((t) => !(t.paymentMethod === "salary_cut" && !!t.notes?.startsWith("Auto-generated")));
        const filteredStore = storeSales.filter((s) => !((s.metadata as any)?.isVoided === true));
        console.log("=== Simulasi FIX (anggota:", victim.name + ", page 1, limit 50) ===");
        console.log({
            unitCount, storeCount, total: unitCount + storeCount,
            halaman1: Math.min(filteredUnit.length + filteredStore.length, limit),
            cukupUntukHalaman1: filteredUnit.length + filteredStore.length >= Math.min(unitCount + storeCount, limit),
        });
    }
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
