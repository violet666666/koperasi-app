import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/roles
export async function GET() {
    try {
        const roles = await prisma.role.findMany({
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: { users: true },
                },
            },
            orderBy: { name: "asc" },
        });

        const rolesWithPermissions = roles.map((role) => ({
            id: role.id,
            name: role.name,
            displayName: role.displayName,
            description: role.description,
            isSystem: role.isSystem,
            userCount: role._count.users,
            permissions: role.permissions.map((rp) => ({
                id: rp.permission.id,
                name: rp.permission.name,
                displayName: rp.permission.displayName,
                module: rp.permission.module,
            })),
        }));

        return NextResponse.json({ data: rolesWithPermissions });
    } catch (error) {
        console.error("GET /api/roles error:", error);
        return NextResponse.json(
            { message: "Failed to fetch roles" },
            { status: 500 }
        );
    }
}

// POST /api/roles
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, displayName, description, permissionIds } = body;

        if (!name || !displayName) {
            return NextResponse.json(
                { message: "Nama role wajib diisi" },
                { status: 400 }
            );
        }

        const existing = await prisma.role.findUnique({
            where: { name },
        });

        if (existing) {
            return NextResponse.json(
                { message: "Nama role sudah digunakan" },
                { status: 400 }
            );
        }

        const role = await prisma.role.create({
            data: {
                name,
                displayName,
                description,
                isSystem: false,
                permissions: {
                    create: (permissionIds || []).map((id: number) => ({
                        permissionId: id,
                    })),
                },
            },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });

        return NextResponse.json({ data: role }, { status: 201 });
    } catch (error) {
        console.error("POST /api/roles error:", error);
        return NextResponse.json(
            { message: "Failed to create role" },
            { status: 500 }
        );
    }
}
