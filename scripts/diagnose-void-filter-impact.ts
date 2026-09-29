/**
 * DIAGNOSTIC (read-only): Kuantifikasi dampak perbaikan void-filter (C2 vs pola
 * lama) — per unit: jumlah sale + omzet yang SELAMA INI hilang dari
 * dashboard/toko stats/manajemen-unit/SHU karena filter NOT path equals (3VL).
 *
 * Usage: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-void-filter-impact.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const BUGGY = { NOT: { metadata: { path: ["isVoided"], equals: true } } } as any;
const FIXED = {
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

async function main() {
    const unitTypes = await prisma.storeSale.groupBy({ by: ["unitType"], _count: true });
    const gte30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    console.log("=== Dampak per unit (all-time) ===");
    console.log("unit | sale tersembunyi (lama) | omzet tersembunyi (Rp)");
    let totHidden = 0, totOmzetHidden = 0;
    for (const u of unitTypes) {
        const ut = u.unitType ?? "(null)";
        const [buggyCount, fixedCount, fixedSum, buggySum] = await Promise.all([
            prisma.storeSale.count({ where: { unitType: u.unitType, ...BUGGY } }),
            prisma.storeSale.count({ where: { unitType: u.unitType, ...FIXED } }),
            prisma.storeSale.aggregate({ where: { unitType: u.unitType, ...FIXED }, _sum: { totalAmount: true } }),
            prisma.storeSale.aggregate({ where: { unitType: u.unitType, ...BUGGY }, _sum: { totalAmount: true } }),
        ]);
        const hidden = fixedCount - buggyCount;
        const omzetHidden = Number(fixedSum._sum.totalAmount ?? 0) - Number(buggySum._sum.totalAmount ?? 0);
        totHidden += hidden; totOmzetHidden += omzetHidden;
        console.log(`${ut} | ${hidden} | ${omzetHidden.toLocaleString("id-ID")}`);
    }
    console.log(`TOTAL | ${totHidden} | Rp${totOmzetHidden.toLocaleString("id-ID")}`);

    console.log("\n=== Dampak 30 hari terakhir (semua unit) ===");
    const [c30B, c30F, s30B, s30F] = await Promise.all([
        prisma.storeSale.count({ where: { createdAt: { gte: gte30 }, ...BUGGY } }),
        prisma.storeSale.count({ where: { createdAt: { gte: gte30 }, ...FIXED } }),
        prisma.storeSale.aggregate({ where: { createdAt: { gte: gte30 }, ...BUGGY }, _sum: { totalAmount: true } }),
        prisma.storeSale.aggregate({ where: { createdAt: { gte: gte30 }, ...FIXED }, _sum: { totalAmount: true } }),
    ]);
    console.log(`sale tersembunyi 30hr: ${c30F - c30B}; omzet tersembunyi 30hr: Rp${(Number(s30F._sum.totalAmount ?? 0) - Number(s30B._sum.totalAmount ?? 0)).toLocaleString("id-ID")}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
