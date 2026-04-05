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

        // Fetch unitTransactions
        const unitTransactions = await prisma.unitTransaction.findMany({
            where,
            include: {
                member: { select: { id: true, memberNo: true, nrp: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { [query.sortBy || "transactionDate"]: query.sortOrder },
        });

        // If 'all' or 'toko' units are requested, fetch from StoreSale as well
        let storeSales: any[] = [];
        if (!unitType || unitType === "all" || unitType === "toko") {
            const storeWhere: Record<string, unknown> = {};
            if (where.memberId) storeWhere.memberId = where.memberId;
            if (isPaid !== null && isPaid !== "all") {
                // StoreSales are paid unless it is salary_cut
                if (isPaid === "true") {
                    storeWhere.paymentMethod = { not: "salary_cut" };
                } else {
                    storeWhere.paymentMethod = "salary_cut";
                }
            }
            if (query.search) {
                storeWhere.OR = [
                    { saleNo: { contains: query.search, mode: "insensitive" } },
                    { customerName: { contains: query.search, mode: "insensitive" } },
                    { member: { name: { contains: query.search, mode: "insensitive" } } },
                    { member: { nrp: { contains: query.search, mode: "insensitive" } } },
                ];
            }
            
            storeSales = await prisma.storeSale.findMany({
                where: storeWhere,
                include: {
                    member: { select: { id: true, memberNo: true, nrp: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: { [query.sortBy === "transactionDate" ? "createdAt" : "createdAt"]: query.sortOrder },
            });
        }
        
        // Map StoreSale into UnitTransaction shape
        const mappedStoreSales = storeSales.map((s) => ({
            id: s.id + 1000000, // Make ID unique
            transactionNo: s.saleNo,
            memberId: s.memberId,
            unitType: "toko",
            description: `Penjualan Toko ${s.paymentMethod === 'salary_cut' ? '(Potong Gaji)' : ''} ${s.customerName ? `- ${s.customerName}`: ''}`,
            amount: s.totalAmount,
            transactionDate: s.createdAt,
            isPaid: s.paymentMethod !== "salary_cut",
            paidDate: s.paymentMethod !== "salary_cut" ? s.createdAt : null,
            notes: `Total Item: ${s.items?.length || 0}`,
            member: s.member,
            createdBy: s.createdBy,
        }));
        
        let allTransactions = [...unitTransactions, ...mappedStoreSales];
        
        // Sort
        const sortKey = query.sortBy || "transactionDate";
        const order = query.sortOrder === "desc" ? -1 : 1;
        allTransactions.sort((a: any, b: any) => {
            const valA = new Date(a[sortKey]).getTime();
            const valB = new Date(b[sortKey]).getTime();
            return (valA - valB) * order;
        });

        // Paginate
        const total = allTransactions.length;
        const startIndex = (query.page - 1) * query.perPage;
        const paginatedTransactions = allTransactions.slice(startIndex, startIndex + query.perPage);


        return NextResponse.json({
            data: paginatedTransactions,
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
