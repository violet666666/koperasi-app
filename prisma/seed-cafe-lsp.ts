import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash("password123", 10);

    const adminRole = await prisma.role.findFirst({ where: { name: "admin" } });
    const kasirRole = await prisma.role.findFirst({ where: { name: "kasir" } });
    const branch = await prisma.branch.findFirst();

    if (!adminRole || !kasirRole) { console.log("Roles not found"); return; }
    console.log("Admin role:", adminRole.id, "Kasir role:", kasirRole.id, "Branch:", branch?.id);

    const existingAdmin = await prisma.user.findUnique({ where: { email: "admincafelsp@koperasi.com" } });
    const existingKasir = await prisma.user.findUnique({ where: { email: "kasircafelsp@koperasi.com" } });

    if (existingAdmin) {
        console.log("Admin already exists, updating unitType");
        await prisma.user.update({ where: { id: existingAdmin.id }, data: { unitType: "cafe_lsp" } });
    } else {
        const admin = await prisma.user.create({
            data: { name: "Admin Cafe LSP", email: "admincafelsp@koperasi.com", password, roleId: adminRole.id, branchId: branch?.id, unitType: "cafe_lsp", isActive: true }
        });
        console.log("Created admin:", admin.email, "id:", admin.id);
    }

    if (existingKasir) {
        console.log("Kasir already exists, updating unitType");
        await prisma.user.update({ where: { id: existingKasir.id }, data: { unitType: "cafe_lsp" } });
    } else {
        const kasir = await prisma.user.create({
            data: { name: "Kasir Cafe LSP", email: "kasircafelsp@koperasi.com", password, roleId: kasirRole.id, branchId: branch?.id, unitType: "cafe_lsp", isActive: true }
        });
        console.log("Created kasir:", kasir.email, "id:", kasir.id);
    }

    // Verify
    const admin = await prisma.user.findUnique({ where: { email: "admincafelsp@koperasi.com" } });
    const kasir = await prisma.user.findUnique({ where: { email: "kasircafelsp@koperasi.com" } });
    console.log("Verify admin:", admin?.email, "unitType:", admin?.unitType, "role:", admin?.roleId);
    console.log("Verify kasir:", kasir?.email, "unitType:", kasir?.unitType, "role:", kasir?.roleId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
