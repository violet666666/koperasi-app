import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createUnitTransactionSchema, paginationSchema } from "@/lib/validations";

// Helper: map StoreSale into UnitTransaction shape
function mapStoreSale(s: Record<string, unknown>) {
    const metadataObj = typeof s.metadata === "string" ? JSON.parse(s.metadata as string) : s.metadata || {};
    const isVoided = (metadataObj as Record<string, unknown>).isVoided === true;
    const voidReason = (metadataObj as Record<string, unknown>).voidReason || null;
    const voidRequestedAt = (metadataObj as Record<string, unknown>).voidRequestedAt || null;
    const voidRequestedBy = (metadataObj as Record<string, unknown>).voidRequestedBy || null;
    const items = (s.items || []) as Record<string, unknown>[];
    const paymentMethod = s.paymentMethod as string;
    const customerName = s.customerName as string | null;
    const createdAt = s.createdAt as Date;

    return {
        id: (s.id as number) + 1000000,
        transactionNo: s.saleNo,
        memberId: s.memberId,
        unitType: "toko",
        description: `Penjualan Toko ${paymentMethod === 'salary_cut' ? '(Potong Gaji)' : ''} ${customerName ? `- ${customerName}` : ''} ${isVoided ? '[DIBATALKAN]' : ''}`,
        amount: s.totalAmount,
        transactionDate: createdAt,
        isPaid: isVoided ? false : (paymentMethod !== "salary_cut"),
        paidDate: paymentMethod !== "salary_cut" && !isVoided ? createdAt : null,
        paymentMethod,
        cashReceived: s.cashReceived ? Number(s.cashReceived) : null,
        changeAmount: s.changeAmount ? Number(s.changeAmount) : null,
        notes: `Total Item: ${items.length}`,
        status: isVoided ? "voided" : "completed",
        voidReason,
        voidRequestedAt,
        voidRequestedBy,
        member: s.member,
        customerName,
        createdBy: s.createdBy,
        createdAt,
        items: items.map((i) => {
            const product = (i.product || {}) as Record<string, unknown>;
            return {
                id: i.id as number,
                productId: i.productId as number,
                productName: (product.name as string) || "Produk Dihapus",
                productSku: (product.sku as string) || null,
                productCategory: (product.category as string) || null,
                quantity: i.quantity as number,
                unitPrice: Number(i.unitPrice),
                discount: Number(i.discount || 0),
                subtotal: Number(i.subtotal),
            };
        }),
    };
}

// GET /api/unit-transactions - List unit transactions with server-side pagination
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const isExport = searchParams.get("export") === "true";

        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 25,
            search: searchParams.get("search") || undefined,
            sortBy: searchParams.get("sortBy") || "transactionDate",
            sortOrder: searchParams.get("sortOrder") || "desc",
        });

        const unitType = searchParams.get("unitType");
        const isPaid = searchParams.get("isPaid");
        const memberId = searchParams.get("memberId");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const paymentMethod = searchParams.get("paymentMethod");

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

        if (isPaid !== null && isPaid !== "all" && isPaid !== undefined) {
            where.isPaid = isPaid === "true";
        }

        // Server-side date range filter
        if (dateFrom || dateTo) {
            const dateFilter: Record<string, Date> = {};
            if (dateFrom) dateFilter.gte = new Date(dateFrom);
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                dateFilter.lte = toDate;
            }
            where.transactionDate = dateFilter;
        }

        // Server-side payment method filter
        if (paymentMethod && paymentMethod !== "all") {
            where.paymentMethod = paymentMethod;
        }

        if (query.search) {
            where.OR = [
                { description: { contains: query.search, mode: "insensitive" } },
                { transactionNo: { contains: query.search, mode: "insensitive" } },
                { member: { name: { contains: query.search, mode: "insensitive" } } },
                { member: { nrp: { contains: query.search, mode: "insensitive" } } },
            ];
        }

        // For export mode, skip pagination -- fetch everything with filters applied
        // For paginated mode, fetch with generous limits from both tables, then merge+slice
        const fetchLimit = query.perPage * 3;

        // Fetch unitTransactions
        const [unitTransactions, unitCount] = await Promise.all([
            prisma.unitTransaction.findMany({
                where,
                include: {
                    member: { select: { id: true, memberNo: true, nrp: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: { [query.sortBy || "transactionDate"]: query.sortOrder },
                ...(isExport ? {} : { take: fetchLimit }),
            }),
            prisma.unitTransaction.count({ where }),
        ]);

        // If 'all' or 'toko' units are requested, fetch from StoreSale as well
        let storeSales: Record<string, unknown>[] = [];
        let storeCount = 0;
        const includeStoreSales = !unitType || unitType === "all" || unitType === "toko";

        if (includeStoreSales) {
            const storeWhere: Record<string, unknown> = {};
            if (where.memberId) storeWhere.memberId = where.memberId;
            if (isPaid !== null && isPaid !== "all" && isPaid !== undefined) {
                // StoreSales are paid unless it is salary_cut
                if (isPaid === "true") {
                    storeWhere.paymentMethod = { not: "salary_cut" };
                } else {
                    storeWhere.paymentMethod = "salary_cut";
                }
            }

            // Date range filter for StoreSales (uses createdAt)
            if (dateFrom || dateTo) {
                const dateFilter: Record<string, Date> = {};
                if (dateFrom) dateFilter.gte = new Date(dateFrom);
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    dateFilter.lte = toDate;
                }
                storeWhere.createdAt = dateFilter;
            }

            // Payment method filter for StoreSales
            if (paymentMethod && paymentMethod !== "all") {
                storeWhere.paymentMethod = paymentMethod;
            }

            if (query.search) {
                storeWhere.OR = [
                    { saleNo: { contains: query.search, mode: "insensitive" } },
                    { customerName: { contains: query.search, mode: "insensitive" } },
                    { member: { name: { contains: query.search, mode: "insensitive" } } },
                    { member: { nrp: { contains: query.search, mode: "insensitive" } } },
                ];
            }

            [storeSales, storeCount] = await Promise.all([
                prisma.storeSale.findMany({
                    where: storeWhere,
                    include: {
                        member: { select: { id: true, memberNo: true, nrp: true, name: true } },
                        createdBy: { select: { id: true, name: true } },
                        items: {
                            include: { product: { select: { id: true, sku: true, name: true, category: true } } },
                        },
                    },
                    orderBy: { createdAt: query.sortOrder },
                    ...(isExport ? {} : { take: fetchLimit }),
                }),
                prisma.storeSale.count({ where: storeWhere }),
            ]);
        }

        const mappedStoreSales = storeSales.map(mapStoreSale);

        let allTransactions = [...unitTransactions, ...mappedStoreSales];

        // Sort merged results
        const sortKey = query.sortBy || "transactionDate";
        const order = query.sortOrder === "desc" ? -1 : 1;
        allTransactions.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
            const valA = new Date(a[sortKey] as string | Date).getTime();
            const valB = new Date(b[sortKey] as string | Date).getTime();
            return (valA - valB) * order;
        });

        // For export mode: return everything
        if (isExport) {
            return NextResponse.json({
                data: allTransactions,
                meta: {
                    page: 1,
                    perPage: allTransactions.length,
                    total: allTransactions.length,
                    totalPages: 1,
                },
            });
        }

        // For paginated mode: slice the merged sorted results
        const total = unitCount + storeCount;
        const startIndex = (query.page - 1) * query.perPage;
        const paginatedTransactions = allTransactions.slice(startIndex, startIndex + query.perPage);

        return NextResponse.json({
            data: paginatedTransactions,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.max(1, Math.ceil(total / query.perPage)),
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
