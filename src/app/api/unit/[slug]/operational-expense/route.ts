import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/unit/[slug]/operational-expense
 * Body: { amount, description, transactionDate? }
 *
 * Mencatat pengeluaran operasional unit ke CashBankTransaction.
 * Dikerjakan langsung tanpa approval.
 * Hanya Admin unit atau Operator yang bisa mengakses.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const params = await context.params;
        const slug = params.slug;
        const unitType = slug.replace(/-/g, "_");

        const roleName = session.user.role;
        const userUnitType = (session.user as any).unitType;
        const isOperator = roleName === "operator" || session.user.permissions?.includes("manage_all");
        const isAdminUnit = roleName === "admin" && userUnitType === unitType;

        if (!isOperator && !isAdminUnit) {
            return NextResponse.json({ message: "Hanya Admin Unit atau Operator yang dapat mencatat pengeluaran." }, { status: 403 });
        }

        const body = await request.json();
        const { amount, description, transactionDate } = body;

        if (!amount || Number(amount) <= 0) {
            return NextResponse.json({ message: "Nominal pengeluaran harus lebih dari 0." }, { status: 400 });
        }
        if (!description || !description.trim()) {
            return NextResponse.json({ message: "Keterangan pengeluaran wajib diisi." }, { status: 400 });
        }

        const currentUserId = parseInt(session.user.id);
        const txDate = transactionDate ? new Date(transactionDate) : new Date();

        // Find cash account for this unit, fallback to head office
        const cashAccount = await prisma.cashBankAccount.findFirst({
            where: {
                unitType,
                type: "cash",
                isActive: true,
            },
        }) || await prisma.cashBankAccount.findFirst({
            where: {
                type: "cash",
                isActive: true,
            },
            orderBy: { id: "asc" },
        });

        if (!cashAccount) {
            return NextResponse.json({ message: "Tidak ditemukan akun kas aktif untuk unit ini." }, { status: 404 });
        }

        // Get branch
        let branchId = session.user.branchId || 1;
        if (!session.user.branchId) {
            const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
            if (headOffice) branchId = headOffice.id;
        }

        const nominalAmount = Number(amount);
        const currentBalance = Number(cashAccount.currentBalance);
        const newBalance = currentBalance - nominalAmount;
        const transactionNo = `OPS-${unitType.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`;

        // Create CashBankTransaction
        const cashTx = await prisma.cashBankTransaction.create({
            data: {
                transactionNo,
                accountId: cashAccount.id,
                branchId,
                type: "out",
                category: "operational",
                amount: nominalAmount,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                description: `[${unitType.toUpperCase()}] Pengeluaran Operasional: ${description.trim()}`,
                transactionDate: txDate,
                createdById: currentUserId,
            },
        });

        // Update CashBankAccount balance
        await prisma.cashBankAccount.update({
            where: { id: cashAccount.id },
            data: { currentBalance: newBalance },
        });

        return NextResponse.json({
            message: "Pengeluaran operasional berhasil dicatat.",
            data: {
                transactionNo: cashTx.transactionNo,
                amount: nominalAmount,
                newBalance,
                description: cashTx.description,
            },
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/unit/[slug]/operational-expense error:", error);
        return NextResponse.json({ message: "Gagal mencatat pengeluaran operasional." }, { status: 500 });
    }
}

/**
 * GET /api/unit/[slug]/operational-expense
 * Returns list of operational expenses for the unit (for audit/laporan purposes).
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const params = await context.params;
        const slug = params.slug;
        const unitType = slug.replace(/-/g, "_");

        const expenses = await prisma.cashBankTransaction.findMany({
            where: {
                type: "out",
                category: "operational",
                description: { contains: `[${unitType.toUpperCase()}]` },
            },
            orderBy: { transactionDate: "desc" },
            take: 100,
        });

        return NextResponse.json({
            data: expenses.map((e) => ({
                id: e.id,
                transactionNo: e.transactionNo,
                date: e.transactionDate,
                description: (e.description ?? "").replace(`[${unitType.toUpperCase()}] Pengeluaran Operasional: `, ""),
                amount: Number(e.amount),
            })),
        });
    } catch (error) {
        return NextResponse.json({ message: "Gagal mengambil data pengeluaran." }, { status: 500 });
    }
}
