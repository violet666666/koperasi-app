import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { HAJI_UMRAH_TYPES, HajiUmrahSavingsError, processHajiUmrahDeposit } from "@/lib/services/haji-umrah-savings";

// GET /api/haji-umrah/savings/[accountId]/transactions — Riwayat transaksi
export async function GET(
    request: Request,
    { params }: { params: Promise<{ accountId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "20");

        // Verify account is haji/umrah type
        const account = await prisma.savingsAccount.findUnique({
            where: { id },
            include: { product: true },
        });
        if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
            return NextResponse.json({ message: "Rekening tidak ditemukan" }, { status: 404 });
        }

        const where = { accountId: id, status: "completed" };

        const [transactions, total] = await Promise.all([
            prisma.savingsTransaction.findMany({
                where,
                include: {
                    member: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: { transactionDate: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.savingsTransaction.count({ where }),
        ]);

        return NextResponse.json({
            data: transactions,
            meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/savings/[accountId]/transactions error:", error);
        return NextResponse.json({ message: "Failed to fetch transactions" }, { status: 500 });
    }
}

// POST /api/haji-umrah/savings/[accountId]/transactions — Setoran (deposit)
// Money-core lives in processHajiUmrahDeposit (shared with mobile). Behavior-preserving.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ accountId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as Record<string, unknown>).role?.name || (session.user as Record<string, unknown>).role;
        if (roleName === "anggota") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        const userId = Number((session.user as Record<string, unknown>).id);

        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        }

        const body = await request.json();
        const { amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate } = body;

        const result = await processHajiUmrahDeposit({
            accountId: id,
            amount,
            paymentMethod,
            cashBankAccountId,
            referenceNo,
            notes,
            transactionDate,
            userId,
        });
        return NextResponse.json({ data: result.transaction, meta: result.meta }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof HajiUmrahSavingsError) {
            return NextResponse.json({ message: error.message }, { status: error.statusCode });
        }
        console.error("POST /api/haji-umrah/savings/[accountId]/transactions error:", error);
        return NextResponse.json({ message: "Failed to create transaction" }, { status: 500 });
    }
}
