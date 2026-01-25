import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paginationSchema, createMemberSchema } from "@/lib/validations";

// GET /api/members - List all members
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
        const status = searchParams.get("status");

        const where = {
            deletedAt: null,
            ...(query.search && {
                OR: [
                    { name: { contains: query.search, mode: "insensitive" as const } },
                    { memberNo: { contains: query.search, mode: "insensitive" as const } },
                    { nik: { contains: query.search, mode: "insensitive" as const } },
                ],
            }),
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(status && status !== "all" && { status }),
        };

        const [members, total] = await Promise.all([
            prisma.member.findMany({
                where,
                include: {
                    branch: true,
                },
                orderBy: { [query.sortBy || "name"]: query.sortOrder },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.member.count({ where }),
        ]);

        return NextResponse.json({
            data: members,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/members error:", error);
        return NextResponse.json(
            { message: "Failed to fetch members" },
            { status: 500 }
        );
    }
}

// POST /api/members - Create new member
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = createMemberSchema.parse(body);

        // Check for duplicate member number
        const existingMemberNo = await prisma.member.findUnique({
            where: { memberNo: data.memberNo },
        });

        if (existingMemberNo) {
            return NextResponse.json(
                { message: "Nomor anggota sudah digunakan" },
                { status: 400 }
            );
        }

        // Check for duplicate NIK
        if (data.nik) {
            const existingNik = await prisma.member.findUnique({
                where: { nik: data.nik },
            });
            if (existingNik) {
                return NextResponse.json(
                    { message: "NIK sudah terdaftar" },
                    { status: 400 }
                );
            }
        }

        const member = await prisma.member.create({
            data,
            include: {
                branch: true,
            },
        });

        return NextResponse.json({ data: member }, { status: 201 });
    } catch (error) {
        console.error("POST /api/members error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create member" },
            { status: 500 }
        );
    }
}
