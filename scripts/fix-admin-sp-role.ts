import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: "adminsp@koperasi.com" },
        include: { role: true },
    });

    if (!user) {
        console.log("ERROR: User adminsp@koperasi.com not found");
        return;
    }

    console.log("BEFORE:", {
        id: user.id,
        email: user.email,
        roleId: user.roleId,
        roleName: user.role.name,
        unitType: user.unitType,
    });

    if (user.roleId === 19) {
        console.log("Already correct (roleId=19, admin_sp)");
        return;
    }

    // Verify role 19 exists and is admin_sp
    const adminSpRole = await prisma.role.findUnique({ where: { id: 19 } });
    if (!adminSpRole || adminSpRole.name !== "admin_sp") {
        // Try finding by name instead
        const roleByName = await prisma.role.findUnique({ where: { name: "admin_sp" } });
        if (!roleByName) {
            console.log("ERROR: admin_sp role not found in database");
            return;
        }
        await prisma.user.update({
            where: { id: user.id },
            data: { roleId: roleByName.id },
        });
        console.log(`FIXED: roleId updated from ${user.roleId} to ${roleByName.id} (admin_sp)`);
    } else {
        await prisma.user.update({
            where: { id: user.id },
            data: { roleId: 19 },
        });
        console.log(`FIXED: roleId updated from ${user.roleId} to 19 (admin_sp)`);
    }

    // Verify
    const check = await prisma.user.findUnique({
        where: { email: "adminsp@koperasi.com" },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    console.log("AFTER:", {
        roleId: check!.roleId,
        roleName: check!.role.name,
        unitType: check!.unitType,
    });
    console.log("PERMISSIONS:", check!.role.permissions.map(rp => rp.permission.name));
}

main()
    .then(() => prisma.$disconnect())
    .catch(e => {
        console.error("ERROR:", e.message);
        process.exit(1);
    });
