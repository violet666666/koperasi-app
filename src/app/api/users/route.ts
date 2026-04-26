import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { createUserSchema, paginationSchema } from "@/lib/validations";

// Roles that require unitType
const UNIT_REQUIRED_ROLES = ["kasir", "admin"];
const VALID_UNIT_TYPES = ["toko", "resto_cafe", "barbershop", "cuci_mobil", "fitness", "playstation", "laundry", "fotocopy", "simpan_pinjam"];

// GET /api/users - List all users
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 15,
            search: searchParams.get("search") || undefined,
            sortBy: searchParams.get("sortBy") || "name",
            sortOrder: searchParams.get("sortOrder") || "asc",
        });

        const branchId = searchParams.get("branchId");
        const roleId = searchParams.get("roleId");

        const where = {
            deletedAt: null,
            ...(query.search && {
                OR: [
                    { name: { contains: query.search, mode: "insensitive" as const } },
                    { email: { contains: query.search, mode: "insensitive" as const } },
                ],
            }),
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(roleId && { roleId: parseInt(roleId) }),
        };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    role: true,
                    branch: true,
                },
                orderBy: { [query.sortBy || "name"]: query.sortOrder },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.user.count({ where }),
        ]);

        // Remove password from response
        const safeUsers = users.map(({ password, ...user }) => user);

        return NextResponse.json({
            data: safeUsers,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/users error:", error);
        return NextResponse.json(
            { message: "Failed to fetch users" },
            { status: 500 }
        );
    }
}

// POST /api/users - Create new user
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        if (!session.user.permissions?.includes("user_management") && !session.user.permissions?.includes("manage_all")) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const data = createUserSchema.parse(body);

        // Validate unitType is required for kasir/admin
        const role = await prisma.role.findUnique({ where: { id: data.roleId } });
        if (role && UNIT_REQUIRED_ROLES.includes(role.name) && !data.unitType) {
            return NextResponse.json(
                { message: `Role ${role.displayName} wajib memilih unit usaha` },
                { status: 400 }
            );
        }

        // Validate unitType is a recognized value
        if (data.unitType && !VALID_UNIT_TYPES.includes(data.unitType)) {
            return NextResponse.json(
                { message: `Unit type "${data.unitType}" tidak valid` },
                { status: 400 }
            );
        }

        // Check for duplicate email
        const existing = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existing) {
            return NextResponse.json(
                { message: "Email sudah digunakan" },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(data.password, 12);

        const user = await prisma.user.create({
            data: {
                ...data,
                password: hashedPassword,
            },
            include: {
                role: true,
                branch: true,
            },
        });

        // Remove password from response
        const { password, ...safeUser } = user;

        return NextResponse.json({ data: safeUser }, { status: 201 });
    } catch (error) {
        console.error("POST /api/users error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create user" },
            { status: 500 }
        );
    }
}
