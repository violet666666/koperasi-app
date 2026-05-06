import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/kas-bank — Dashboard Kas & Bank for Operators
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    // Pastikan hanya operator/admin yang bisa akses fitur ini
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "superadmin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const url = new URL(request.url);
        const limitStr = url.searchParams.get("limit");
        const limit = limitStr ? parseInt(limitStr, 10) : 5;

        // Fetch Accounts
        const accounts = await prisma.cashBankAccount.findMany({
            where: { isActive: true, deletedAt: null },
            orderBy: { code: "asc" },
        });

        // Group & sum
        const totals = { cash: 0, bank: 0, total: 0 };
        const formattedAccounts = accounts.map((acc) => {
            const bal = Number(acc.currentBalance || 0);
            if (acc.type === "cash") totals.cash += bal;
            if (acc.type === "bank") totals.bank += bal;
            totals.total += bal;

            return {
                id: acc.id,
                code: acc.code,
                name: acc.name,
                type: acc.type,
                bankName: acc.bankName,
                accountNumber: acc.accountNumber,
                currentBalance: bal,
            };
        });

        // Fetch Latest Transactions
        const latestTransactions = await prisma.cashBankTransaction.findMany({
            orderBy: { transactionDate: "desc" },
            take: limit,
            include: { account: { select: { name: true, code: true, type: true } } },
        });

        return NextResponse.json({
            data: {
                totals,
                accounts: formattedAccounts,
                latestTransactions: latestTransactions.map(tx => ({
                    id: tx.id,
                    transactionNo: tx.transactionNo,
                    type: tx.type, // 'in' | 'out'
                    amount: Number(tx.amount),
                    description: tx.description,
                    transactionDate: tx.transactionDate.toISOString(),
                    account: tx.account,
                })),
            },
        });
    } catch (error: any) {
        console.error("GET /api/mobile/kas-bank error:", error);
        return NextResponse.json({ message: "Gagal memuat data Kas & Bank", error: error?.message }, { status: 500 });
    }
}
