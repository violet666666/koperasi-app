import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Backfill unitType for existing Toko module logs that have NULL unitType
    const result = await prisma.$executeRaw`
        UPDATE audit_logs
        SET unit_type = 'toko'
        WHERE module = 'Toko' AND unit_type IS NULL
    `;
    console.log(`Updated ${result} Toko audit logs with unitType = 'toko'`);

    // Also backfill any other known modules
    const mappings: [string, string][] = [
        ["Simpanan", "simpan_pinjam"],
        ["Pinjaman", "simpan_pinjam"],
        ["Kwitansi", "simpan_pinjam"],
        ["Anggota", "simpan_pinjam"],
        ["Jurnal", "simpan_pinjam"],
        ["Kas-Bank", "simpan_pinjam"],
        ["Laporan", "simpan_pinjam"],
        ["Approval", "simpan_pinjam"],
    ];

    for (const [module, unitType] of mappings) {
        const r = await prisma.$executeRaw`
            UPDATE audit_logs
            SET unit_type = ${unitType}
            WHERE module = ${module} AND unit_type IS NULL
        `;
        if (r > 0) console.log(`Updated ${r} ${module} logs → unitType = '${unitType}'`);
    }

    // Verify
    const total = await prisma.$queryRaw<{ unit_type: string | null; count: number }[]>`
        SELECT unit_type, COUNT(*)::int as count
        FROM audit_logs
        GROUP BY unit_type
        ORDER BY count DESC
    `;
    console.log("\n=== unitType distribution after backfill ===");
    for (const t of total) {
        console.log(`  ${t.unit_type || "(null)"}: ${t.count}`);
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
