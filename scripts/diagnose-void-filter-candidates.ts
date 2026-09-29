/**
 * DIAGNOSTIC (read-only): Cari bentuk Prisma where pengganti untuk
 * `NOT: { metadata: { path: ["isVoided"], equals: true } }` yang aman dari
 * three-valued-logic (bug 3VL — CLAUDE.md gotcha StoreSale.metadata).
 *
 * Kandidat diuji terhadap production: hasil harus = semantik JS
 * `!(metadata?.isVoided === true)`.
 *
 * Usage: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-void-filter-candidates.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Bentuk lama (beracun) — pembanding
const BUGGY = { NOT: { metadata: { path: ["isVoided"], equals: true } } } as any;

// Kandidat C1: hanya menutup kolom NULL (diprediksi masih bocor utk key absen)
const C1 = {
    OR: [
        { metadata: { equals: Prisma.DbNull } },
        { NOT: { metadata: { path: ["isVoided"], equals: true } } },
    ],
} as any;

// Kandidat C2: key absen/null DITANGKAP eksplisit via path equals DbNull,
// key berisi nilai dicek NOT-true (aman 2VL karena operand non-null)
const C2 = {
    OR: [
        { metadata: { path: ["isVoided"], equals: Prisma.DbNull } },
        {
            AND: [
                { metadata: { path: ["isVoided"], not: Prisma.DbNull } },
                { NOT: { metadata: { path: ["isVoided"], equals: true } } },
            ],
        },
    ],
} as any;

async function jsKeptCount(scope: any): Promise<number> {
    const rows = await prisma.storeSale.findMany({ where: scope, select: { metadata: true } });
    return rows.filter((r) => !((r.metadata as any)?.isVoided === true)).length;
}

async function evalCandidates(label: string, scope: any, expected: number) {
    const [buggy, c1, c2, t1, t2] = await Promise.all([
        prisma.storeSale.count({ where: { ...scope, ...BUGGY } }),
        prisma.storeSale.count({ where: { ...scope, ...C1 } }),
        prisma.storeSale.count({ where: { ...scope, ...C2 } }),
        prisma.storeSale.count({ where: { ...scope, metadata: { path: ["isVoided"], equals: Prisma.DbNull } } }),
        prisma.storeSale.count({ where: { ...scope, metadata: { path: ["isVoided"], not: Prisma.DbNull } } }),
    ]);
    console.log(`\n=== ${label} (harus = ${expected}) ===`);
    console.table({
        BUGGY_sekarang: buggy,
        C1_nullColumnOnly: c1,
        C2_keyAbsentAware: c2,
        T1_pathEqualsDbNull: t1,
        T2_pathNotDbNull: t2,
    });
    return c2 === expected;
}

async function main() {
    const all = await jsKeptCount({});
    const okAll = await evalCandidates("SEMUA StoreSale", {}, all);

    const gte = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const scoped = await jsKeptCount({ createdAt: { gte } });
    const okScoped = await evalCandidates("30 hari terakhir", { createdAt: { gte } }, scoped);

    // Scope unit toko + salary_cut (bentuk umum dipakai manajemen-unit)
    const tokoScope = await jsKeptCount({ unitType: "toko", createdAt: { gte } });
    const okToko = await evalCandidates("toko, 30 hari", { unitType: "toko", createdAt: { gte } }, tokoScope);

    console.log(`\nKESIMPULAN: C2 cocok di semua scope = ${okAll && okScoped && okToko}`);
    if (!(okAll && okScoped && okToko)) {
        console.log("C2 GAGAL — jangan dipakai; analisis T1/T2 di atas utk kandidat berikutnya.");
    }
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
