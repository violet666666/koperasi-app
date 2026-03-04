import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createUnitTransactionSchema, paginationSchema } from "@/lib/validations";

// GET /api/unit-transactions - List unit transactions
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 15,
            search: searchParams.get("search") || undefined,
            sortBy: searchParams.get("sortBy") || "transactionDate",
            sortOrder: searchParams.get("sortOrder") || "desc",
        });

        const unitType = searchParams.get("unitType");
        const isPaid = searchParams.get("isPaid");
        const memberId = searchParams.get("memberId");

        const where: Record<string, unknown> = {};

        // If anggota role, only show own transactions
        if (session.user.role === "anggota" && session.user.memberId) {
            where.memberId = session.user.memberId;
        } else if (memberId) {
            where.memberId = parseInt(memberId);
        }

        if (unitType && unitType !== "all") {
            where.unitType = unitType;
        }

        if (isPaid !== null && isPaid !== "all") {
            where.isPaid = isPaid === "true";
        }

        if (query.search) {
            where.OR = [
                { description: { contains: query.search, mode: "insensitive" } },
                { transactionNo: { contains: query.search, mode: "insensitive" } },
                { member: { name: { contains: query.search, mode: "insensitive" } } },
                { member: { nrp: { contains: query.search, mode: "insensitive" } } },
            ];
        }

        const [transactions, total] = await Promise.all([
            prisma.unitTransaction.findMany({
                where,
                include: {
                    member: {
                        select: {
                            id: true,
                            memberNo: true,
                            nrp: true,
                            name: true,
                        },
                    },
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { [query.sortBy || "transactionDate"]: query.sortOrder },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.unitTransaction.count({ where }),
        ]);

        return NextResponse.json({
            data: transactions,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/unit-transactions error:", error);
        return NextResponse.json(
            { message: "Failed to fetch unit transactions" },
            { status: 500 }
        );
    }
}

// POST /api/unit-transactions - Create unit transaction (admin only)
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Only admin roles can create unit transactions
        if (session.user.role === "anggota") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const data = createUnitTransactionSchema.parse(body);

        // Lookup member by NRP
        const member = await prisma.member.findUnique({
            where: { nrp: data.nrp },
        });

        if (!member) {
            return NextResponse.json(
                { message: `Anggota dengan NRP ${data.nrp} tidak ditemukan` },
                { status: 404 }
            );
        }

        const transaction = await prisma.unitTransaction.create({
            data: {
                transactionNo: `UT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                memberId: member.id,
                unitType: data.unitType,
                description: data.description,
                amount: data.amount,
                transactionDate: data.transactionDate,
                isPaid: data.isPaid,
                paidDate: data.isPaid ? new Date() : null,
                notes: data.notes,
                createdById: parseInt(session.user.id),
            },
            include: {
                member: {
                    select: {
                        id: true,
                        memberNo: true,
                        nrp: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({ data: transaction }, { status: 201 });
    } catch (error) {
        console.error("POST /api/unit-transactions error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create unit transaction" },
            { status: 500 }
        );
    }
}
