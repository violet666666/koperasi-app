import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // 1. What unitType values exist in audit logs?
    const unitTypes = await prisma.$queryRaw<{ unit_type: string | null; count: number }[]>`
        SELECT unit_type, COUNT(*)::int as count
        FROM audit_logs
        GROUP BY unit_type
        ORDER BY count DESC
    `;
    console.log("=== unitType VALUES IN AUDIT LOGS ===");
    for (const u of unitTypes) {
        console.log(`  ${u.unit_type || "(null)"}: ${u.count}`);
    }

    // 2. What modules exist?
    const modules = await prisma.$queryRaw<{ module: string; count: number }[]>`
        SELECT module, COUNT(*)::int as count
        FROM audit_logs
        GROUP BY module
        ORDER BY count DESC
    `;
    console.log("\n=== MODULES IN AUDIT LOGS ===");
    for (const m of modules) {
        console.log(`  ${m.module}: ${m.count}`);
    }

    // 3. Any Toko-related logs at all?
    const tokoLogs = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int as count FROM audit_logs
        WHERE unit_type = 'toko'
           OR module ILIKE '%toko%'
           OR description ILIKE '%toko%'
           OR description ILIKE '%product%'
           OR description ILIKE '%stock%'
           OR description ILIKE '%produk%'
           OR description ILIKE '%stok%'
           OR description ILIKE '%persediaan%'
    `;
    console.log("\n=== TOKO-RELATED LOGS (any mention) ===");
    console.log(`  Count: ${tokoLogs[0].count}`);

    // 4. Sample recent logs to see what IS being logged
    const recent = await prisma.$queryRaw<{
        id: number; action: string; module: string; description: string; unit_type: string | null; user_role: string;
    }[]>`
        SELECT id, action, module, LEFT(description, 80) as description, unit_type, user_role
        FROM audit_logs
        ORDER BY timestamp DESC
        LIMIT 20
    `;
    console.log("\n=== 20 MOST RECENT LOGS ===");
    for (const r of recent) {
        console.log(`  #${r.id} | ${r.action} | ${r.module} | unit: ${r.unit_type || "(null)"} | role: ${r.user_role} | ${r.description}`);
    }

    // 5. Total count
    const total = await prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int as count FROM audit_logs`;
    console.log(`\n=== TOTAL: ${total[0].count} records ===`);
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
