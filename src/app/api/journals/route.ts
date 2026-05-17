import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp"];

// GET /api/journals - List journal entries with server-side pagination
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const period = searchParams.get("period"); // "current", "last", "year", "all"
        const adjustment = searchParams.get("adjustment"); // "true" to filter only adjustments
        const search = searchParams.get("search") || "";
        const dateFrom = searchParams.get("dateFrom"); // "YYYY-MM-DD"
        const dateTo = searchParams.get("dateTo"); // "YYYY-MM-DD"

        // Pagination parameters — only paginate when explicitly requested
        const pageParam = searchParams.get("page");
        const perPageParam = searchParams.get("perPage");
        const shouldPaginate = pageParam !== null || perPageParam !== null;
        const page = Math.max(1, Math.floor(Number(pageParam || 1)) || 1);
        const perPage = Math.min(100, Math.max(1, Math.floor(Number(perPageParam || 25))) || 25);

        // Build date filter
        const now = new Date();
        let dateFilter: Record<string, Date> = {};

        if (period === "current") {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            dateFilter = { gte: start, lte: end };
        } else if (period === "last") {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            dateFilter = { gte: start, lte: end };
        } else if (period === "year") {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31);
            dateFilter = { gte: start, lte: end };
        }

        // Override with explicit date range if provided
        if (dateFrom) {
            dateFilter.gte = new Date(dateFrom);
        }
        if (dateTo) {
            dateFilter.lte = new Date(dateTo);
        }

        // Build where clause
        const where: Record<string, unknown> = {};
        if (Object.keys(dateFilter).length > 0) {
            where.transactionDate = dateFilter;
        }
        if (adjustment === "true") {
            where.isAdjustment = true;
        }
        if (search) {
            where.OR = [
                { description: { contains: search, mode: "insensitive" } },
                { journalNo: { contains: search, mode: "insensitive" } },
            ];
        }

        // Get total count for pagination
        const total = await prisma.journal.count({ where });
        const totalPages = shouldPaginate ? Math.ceil(total / perPage) : 1;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const findManyArgs: any = {
            where,
            include: {
                lines: { include: { account: true } },
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
        };

        if (shouldPaginate) {
            findManyArgs.skip = (page - 1) * perPage;
            findManyArgs.take = perPage;
        } else {
            findManyArgs.take = 200;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const journals: any[] = await prisma.journal.findMany(findManyArgs);

        const data = journals.map((j: any) => {
            const totalDebit = j.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
            const totalCredit = j.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
            return {
                id: j.id,
                journalNo: j.journalNo,
                transactionDate: j.transactionDate.toISOString().split("T")[0],
                description: j.description,
                sourceType: j.sourceType,
                totalDebit,
                totalCredit,
                isPosted: j.isPosted,
                isAdjustment: j.isAdjustment,
                createdBy: j.createdBy,
                lines: j.lines.map((l: any) => ({
                    id: l.id,
                    accountId: l.accountId,
                    accountCode: l.account?.code || "",
                    accountName: l.account?.name || "",
                    description: l.description,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                })),
            };
        });

        return NextResponse.json({
            data,
            ...(shouldPaginate
                ? { pagination: { page, perPage, total, totalPages } }
                : {}),
        });
    } catch (error) {
        console.error("GET /api/journals error:", error);
        return NextResponse.json({ message: "Failed to fetch journals" }, { status: 500 });
    }
}

// POST /api/journals - Create a manual journal entry
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { transactionDate, description, isAdjustment, lines } = body;

        if (!transactionDate || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
            return NextResponse.json(
                { message: "Data jurnal tidak lengkap atau minimal baris kurang dari 2." },
                { status: 400 }
            );
        }

        const date = new Date();
        const year = date.getFullYear();
        const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
        const journalNo = `JRN-${year}-${random}`;

        // Default references for now (e.g. branchId 1 if no auth logic provided in snippet)
        const branchId = 1;
        const createdById = 1;
        
        // Ensure there's an active period (dummy implementation for manual input)
        // You should fetch an active FiscalPeriod, here we use periodId 1 as fallback or find latest
        const period = await prisma.fiscalPeriod.findFirst({
            where: { status: 'open' },
            orderBy: { id: 'desc' }
        });
        
        if (!period) {
            return NextResponse.json(
                { message: "Tidak ada periode fiskal yang aktif." },
                { status: 400 }
            );
        }

        const journal = await prisma.$transaction(async (tx) => {
            const createdJournal = await tx.journal.create({
                data: {
                    journalNo,
                    branchId,
                    transactionDate: new Date(transactionDate),
                    description,
                    isAdjustment: Boolean(isAdjustment),
                    isPosted: true, // Auto post manual journals for now
                    periodId: period.id,
                    createdById,
                    sourceType: isAdjustment ? 'manual_adjustment' : 'manual_general',
                }
            });

            const journalLines = lines.map((l: any) => ({
                journalId: createdJournal.id,
                accountId: parseInt(l.accountId),
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
                description: l.description || description,
            }));

            await tx.journalLine.createMany({
                data: journalLines,
            });

            return createdJournal;
        });

        return NextResponse.json({ data: journal, message: "Jurnal berhasil disimpan" }, { status: 201 });
    } catch (error) {
        console.error("POST /api/journals error:", error);
        return NextResponse.json(
            { message: "Gagal menyimpan jurnal" },
            { status: 500 }
        );
    }
}
