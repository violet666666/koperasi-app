import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createLoanProductSchema, paginationSchema } from "@/lib/validations";

// GET /api/master/loan-products
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 50,
            search: searchParams.get("search") || undefined,
        });

        const currentOnly = searchParams.get("currentOnly") === "true";

        const where = {
            isActive: true,
            ...(currentOnly && { isCurrent: true }),
            ...(query.search && {
                OR: [
                    { code: { contains: query.search, mode: "insensitive" as const } },
                    { name: { contains: query.search, mode: "insensitive" as const } },
                ],
            }),
        };

        const [products, total] = await Promise.all([
            prisma.loanProduct.findMany({
                where,
                orderBy: [{ code: "asc" }, { version: "desc" }],
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.loanProduct.count({ where }),
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
        console.error("GET /api/master/loan-products error:", error);
        return NextResponse.json(
            { message: "Failed to fetch loan products" },
            { status: 500 }
        );
    }
}

// POST /api/master/loan-products
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = createLoanProductSchema.parse(body);

        // === AD-ART Pasal 25: Bunga pinjaman maksimal 9% per tahun ===
        const AD_ART_MAX_INTEREST_RATE = 9.00;
        if (Number(data.interestRate) > AD_ART_MAX_INTEREST_RATE) {
            return NextResponse.json(
                { message: `Sesuai AD-ART Pasal 25, bunga pinjaman maksimal 9% per tahun (0,3% per bulan)` },
                { status: 400 }
            );
        }

        // === AD-ART Pasal 26: Tenor maksimal 36 bulan ===
        if (data.maxTenorMonths && data.maxTenorMonths > 36) {
            return NextResponse.json(
                { message: `Sesuai AD-ART Pasal 26, tenor pinjaman maksimal 3 tahun (36 bulan)` },
                { status: 400 }
            );
        }

        // Check for existing current version and deprecate
        const existing = await prisma.loanProduct.findFirst({
            where: { code: data.code, isCurrent: true },
            orderBy: { version: "desc" },
        });

        let version = 1;
        if (existing) {
            await prisma.loanProduct.update({
                where: { id: existing.id },
                data: { isCurrent: false },
            });
            version = existing.version + 1;
        }

        const product = await prisma.loanProduct.create({
            data: {
                ...data,
                version,
                isCurrent: true,
            },
        });

        return NextResponse.json({ data: product }, { status: 201 });
    } catch (error) {
        console.error("POST /api/master/loan-products error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create loan product" },
            { status: 500 }
        );
    }
}
