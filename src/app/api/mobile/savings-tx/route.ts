import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

// POST /api/mobile/savings-tx — Create savings deposit or withdrawal
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { accountId, amount, type, description } = body;

        if (!accountId || !amount || !type || !["deposit", "withdrawal"].includes(type)) {
            return NextResponse.json({ message: "accountId, amount, dan type (deposit/withdrawal) wajib diisi" }, { status: 400 });
        }

        const numAmount = Number(amount);
        if (numAmount <= 0) {
            return NextResponse.json({ message: "Jumlah harus lebih dari 0" }, { status: 400 });
        }

        const account = await prisma.savingsAccount.findUnique({
            where: { id: Number(accountId) },
            include: { member: { select: { name: true } }, product: { select: { name: true } } },
        });

        if (!account || account.status !== "active") {
            return NextResponse.json({ message: "Rekening simpanan tidak ditemukan atau tidak aktif" }, { status: 404 });
        }

        const currentBalance = Number(account.balance);
        if (type === "withdrawal" && numAmount > currentBalance) {
            return NextResponse.json({ message: `Saldo tidak cukup. Saldo saat ini: Rp ${currentBalance.toLocaleString("id-ID")}` }, { status: 400 });
        }

        const newBalance = type === "deposit" ? currentBalance + numAmount : currentBalance - numAmount;

        // Generate unique transaction number
        const txNo = `STX-M-${Date.now()}`;

        // Transaction + update balance atomically
        await prisma.$transaction([
            prisma.savingsTransaction.create({
                data: {
                    transactionNo: txNo,
                    accountId: Number(accountId),
                    memberId: account.memberId,
                    productId: account.productId,
                    type,
                    amount: numAmount,
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    notes: description || `${type === "deposit" ? "Setoran" : "Penarikan"} via mobile`,
                    transactionDate: new Date(),
                    createdById: Number(user.id),
                },
            }),
            prisma.savingsAccount.update({
                where: { id: Number(accountId) },
                data: { balance: newBalance },
            }),
        ]);

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "CREATE",
            module: "Simpanan",
            description: `${type === "deposit" ? "Setoran" : "Penarikan"} Rp ${numAmount.toLocaleString("id-ID")} pada rekening ${account.member.name} (${account.product.name}) via mobile`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: `${type === "deposit" ? "Setoran" : "Penarikan"} berhasil`,
            data: { newBalance },
        });
    } catch (error) {
        console.error("POST /api/mobile/savings-tx error:", error);
        return NextResponse.json({ message: "Gagal memproses transaksi simpanan" }, { status: 500 });
    }
}

// GET /api/mobile/savings-tx?memberId=xxx — Get savings accounts of a member
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
        return NextResponse.json({ message: "memberId wajib diisi" }, { status: 400 });
    }

    try {
        const accounts = await prisma.savingsAccount.findMany({
            where: { memberId: Number(memberId), status: "active" },
            include: { product: { select: { name: true, type: true } } },
        });

        return NextResponse.json({
            data: accounts.map((a) => ({
                id: a.id,
                accountNo: a.accountNo,
                balance: Number(a.balance),
                productName: a.product.name,
                productType: a.product.type,
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/savings-tx error:", error);
        return NextResponse.json({ message: "Gagal memuat rekening" }, { status: 500 });
    }
}
