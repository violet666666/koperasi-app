import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    // Get KASIR role specifically
    const kasirRole = await prisma.role.findFirst({
        where: { name: 'kasir' },
        include: { permissions: { include: { permission: true } } }
    });
    
    if (kasirRole) {
        console.log(`KASIR Role [${kasirRole.id}]: ${kasirRole.displayName}`);
        console.log(`Permissions: ${kasirRole.permissions.map(rp => rp.permission.name).join(", ")}`);
    } else {
        console.log("Kasir role NOT FOUND in database!");
    }
    
    // Get ALL permissions defined
    const allPerms = await prisma.permission.findMany({ orderBy: { name: 'asc' } });
    console.log("\n=== ALL PERMISSIONS IN DB ===");
    for (const p of allPerms) {
        console.log(`  [${p.id}] ${p.name} | displayName: ${p.displayName} | module: ${p.module}`);
    }
}

main().then(() => prisma.$disconnect()).catch(console.error);
