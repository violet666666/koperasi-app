import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createBranchSchema, updateBranchSchema, paginationSchema } from "@/lib/validations";

// GET /api/master/branches - List all branches
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

        const where = query.search
            ? {
                OR: [
                    { code: { contains: query.search, mode: "insensitive" as const } },
                    { name: { contains: query.search, mode: "insensitive" as const } },
                ],
                deletedAt: null,
            }
            : { deletedAt: null };

        const [branches, total] = await Promise.all([
            prisma.branch.findMany({
                where,
                orderBy: { [query.sortBy || "name"]: query.sortOrder },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.branch.count({ where }),
        ]);

        return NextResponse.json({
            data: branches,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/master/branches error:", error);
        return NextResponse.json(
            { message: "Failed to fetch branches" },
            { status: 500 }
        );
    }
}

// POST /api/master/branches - Create new branch
export async function POST(request: Request) {
    try {
        // LOCKDOWN: PRIMKOPPOL LUMAJANG is a Single-Entity Cooperative.
        // We explicitly prevent creating new organizational branches, but allow Units.
        return NextResponse.json(
            { message: "Fitur dinonaktifkan: Operasional Koperasi dilimitasikan menjadi 1 kesatuan PRIMKOPPOL pusat (Single-Branch). Cabang tidak dapat ditambah, gunakan sistem Unit." },
            { status: 403 }
        );
    } catch (error) {
        console.error("POST /api/master/branches error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create branch" },
            { status: 500 }
        );
    }
}
