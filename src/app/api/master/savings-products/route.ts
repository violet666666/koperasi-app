import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSavingsProductSchema, paginationSchema } from "@/lib/validations";

// GET /api/master/savings-products
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 50,
            search: searchParams.get("search") || undefined,
        });

        const where = {
            deletedAt: null,
            ...(query.search && {
                OR: [
                    { code: { contains: query.search, mode: "insensitive" as const } },
                    { name: { contains: query.search, mode: "insensitive" as const } },
                ],
            }),
        };

        const [products, total] = await Promise.all([
            prisma.savingsProduct.findMany({
                where,
                orderBy: { code: "asc" },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.savingsProduct.count({ where }),
        ]);

        return NextResponse.json({
            data: products,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/master/savings-products error:", error);
        return NextResponse.json(
            { message: "Failed to fetch savings products" },
            { status: 500 }
        );
    }
}

// POST /api/master/savings-products
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = createSavingsProductSchema.parse(body);

        const existing = await prisma.savingsProduct.findUnique({
            where: { code: data.code },
        });

        if (existing) {
            return NextResponse.json(
                { message: "Kode produk sudah digunakan" },
                { status: 400 }
            );
        }

        const product = await prisma.savingsProduct.create({
            data,
        });

        return NextResponse.json({ data: product }, { status: 201 });
    } catch (error) {
        console.error("POST /api/master/savings-products error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create savings product" },
            { status: 500 }
        );
    }
}
