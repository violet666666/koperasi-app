import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";

        const where: any = {
            sourceType: "NON_SP_OUT",
        };
        if (search) {
            where.description = { contains: search, mode: "insensitive" };
        }

        const journals = await prisma.journal.findMany({
            where,
            include: {
                lines: {
                    include: { account: true }
                },
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { transactionDate: "desc" },
            take: 100,
        });

        // Map back to the NonSPTransaction interface format used by the frontend
        const data = journals.map((j) => {
            // Find the expense line and the asset line
            const expenseLine = j.lines.find(l => l.account.type === 'expense');
            const assetLine = j.lines.find(l => l.account.type === 'asset');
            
            return {
                id: j.id,
                transactionNo: j.journalNo,
                transactionDate: j.transactionDate.toISOString().split("T")[0],
                category: expenseLine?.account.name || "Biaya Lain-lain",
                description: j.description,
                amount: Number(expenseLine?.debit || 0),
                paymentMethod: assetLine?.account.name || "Tunai",
                createdBy: j.createdBy,
            };
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error("GET /api/non-sp/pengeluaran error:", error);
        return NextResponse.json({ message: "Failed to fetch pengeluaran" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        let userId = session?.user?.id ? parseInt(session.user.id) : undefined;
        
        if (!userId) {
            const firstUser = await prisma.user.findFirst({ where: { isActive: true } });
            if (firstUser) userId = firstUser.id;
            else return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { categoryAccountId, amount, description, paymentAccountId, date } = body;

        if (!categoryAccountId || !amount || !paymentAccountId) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        const amountNum = Number(amount);
        if (amountNum <= 0) {
            return NextResponse.json({ message: "Amount must be greater than 0" }, { status: 400 });
        }

        const transactionDate = date ? new Date(date) : new Date();

        // Check active fiscal period
        const period = await prisma.fiscalPeriod.findFirst({
            where: {
                status: "open",
                startDate: { lte: transactionDate },
                endDate: { gte: transactionDate },
            },
        });

        if (!period) {
            return NextResponse.json({ message: "No open fiscal period for this date" }, { status: 400 });
        }

        // Get branch (use default branch 1 if user has none assigned)
        let branchId = 1;

        // Generate Journal Number
        const currentYear = transactionDate.getFullYear();
        const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
        const journalNo = `NSP-OUT-${currentYear}-${random}`;

        // Create Journal and Lines transactionally
        const result = await prisma.$transaction(async (tx) => {
            const journal = await tx.journal.create({
                data: {
                    journalNo,
                    branchId,
                    transactionDate,
                    description: description || "Pengeluaran Non-S/P",
                    sourceType: "NON_SP_OUT",
                    periodId: period.id,
                    isPosted: true,
                    createdById: userId,
                },
            });

            // Debit Expense Account
            await tx.journalLine.create({
                data: {
                    journalId: journal.id,
                    accountId: parseInt(categoryAccountId),
                    description: description || "Beban Pengeluaran",
                    debit: amountNum,
                    credit: 0,
                },
            });

            // Credit Asset (Cash/Bank)
            await tx.journalLine.create({
                data: {
                    journalId: journal.id,
                    accountId: parseInt(paymentAccountId),
                    description: description || "Pengeluaran Kas/Bank",
                    debit: 0,
                    credit: amountNum,
                },
            });

            return journal;
        });

        return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
        console.error("POST /api/non-sp/pengeluaran error:", error);
        return NextResponse.json({ message: "Failed to create pengeluaran" }, { status: 500 });
    }
}
