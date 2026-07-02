import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getMobileUser, getMobileUserWithScope, unauthorizedResponse } from "../middleware";
import { branchListFilter, canAccessBranch } from "@/lib/mobile-auth-scope";
import { logAudit } from "@/lib/audit-logger";
import { buildCashBankTransactionData } from "@/lib/kas-bank-loan-helpers";
import { isWithdrawalBlocked } from "@/lib/savings-helpers";

// POST /api/mobile/savings-tx — Create savings deposit or withdrawal.
// Atomic (single $transaction callback): SavingsTransaction + SavingsAccount update +
// CashBank sync all commit or roll back together. AD-ART Pasal 26 enforced.
export async function POST(request: Request) {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { accountId, amount, type, description, cashBankAccountId } = body;

        if (!accountId || !amount || !type || !["deposit", "withdrawal"].includes(type)) {
            return NextResponse.json({ message: "accountId, amount, dan type (deposit/withdrawal) wajib diisi" }, { status: 400 });
        }
        const numAmount = Number(amount);
        if (numAmount <= 0) {
            return NextResponse.json({ message: "Jumlah harus lebih dari 0" }, { status: 400 });
        }

        const account = await prisma.savingsAccount.findUnique({
            where: { id: Number(accountId) },
            include: {
                member: { select: { id: true, name: true, memberNo: true, status: true } },
                product: { select: { id: true, name: true, type: true, canWithdraw: true } },
            },
        });

        if (!account || account.status !== "active") {
            return NextResponse.json({ message: "Rekening simpanan tidak ditemukan atau tidak aktif" }, { status: 404 });
        }

        const branchOk = canAccessBranch(user, account.branchId);
        if (!branchOk.allowed) {
            return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
        }

        // ── AD-ART Pasal 26: blok penarikan Pokok/Wajib saat anggota aktif ──
        if (isWithdrawalBlocked({ type, canWithdraw: account.product.canWithdraw, memberStatus: account.member.status })) {
            return NextResponse.json({
                message: `${account.product.name} tidak dapat ditarik selama anggota masih aktif (AD/ART Pasal 26). Hanya Simpanan Sukarela yang dapat ditarik sewaktu-waktu.`,
            }, { status: 400 });
        }

        const currentBalance = Number(account.balance);
        if (type === "withdrawal" && numAmount > currentBalance) {
            return NextResponse.json({ message: `Saldo tidak cukup. Saldo saat ini: Rp ${currentBalance.toLocaleString("id-ID")}` }, { status: 400 });
        }

        const newBalance = type === "deposit" ? currentBalance + numAmount : currentBalance - numAmount;
        const txNo = `STX-M-${crypto.randomBytes(4).readUInt32BE(0) % 1_000_000}`;
        const today = new Date();

        // ── ATOMIC TRANSACTION ──
        await prisma.$transaction(async (tx) => {
            // 1. SavingsTransaction
            const savingsTx = await tx.savingsTransaction.create({
                data: {
                    transactionNo: txNo,
                    accountId: account.id,
                    memberId: account.memberId,
                    productId: account.productId,
                    branchId: account.branchId,
                    type,
                    amount: numAmount,
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    paymentMethod: null,
                    cashBankAccountId: cashBankAccountId ? Number(cashBankAccountId) : null,
                    notes: description || `${type === "deposit" ? "Setoran" : "Penarikan"} via mobile`,
                    transactionDate: today,
                    createdById: Number(user.id),
                },
            });

            // 2. Update saldo rekening anggota
            await tx.savingsAccount.update({
                where: { id: account.id },
                data: { balance: newBalance },
            });

            // 3. Cash/Bank sync (ATOMIC — same tx, no longer non-fatal try/catch)
            if (cashBankAccountId) {
                const cbAccount = await tx.cashBankAccount.findUnique({ where: { id: Number(cashBankAccountId) } });
                if (!cbAccount || !cbAccount.isActive) {
                    throw new Error("Akun kas/bank tidak ditemukan atau tidak aktif");
                }
                const cbBal = Number(cbAccount.currentBalance);
                const cashType = type === "deposit" ? "in" : "out";
                const cbNewBal = cashType === "in" ? cbBal + numAmount : cbBal - numAmount;

                await tx.cashBankTransaction.create({
                    data: buildCashBankTransactionData({
                        accountId: cbAccount.id,
                        branchId: account.branchId,
                        type: cashType,
                        category: "savings",
                        amount: numAmount,
                        balanceBefore: cbBal,
                        balanceAfter: cbNewBal,
                        description: `${type === "deposit" ? "Setoran" : "Penarikan"} simpanan ${account.member.name} (${account.product.name}) via mobile - ${txNo}`,
                        transactionDate: today,
                        createdById: Number(user.id),
                        referenceType: "SavingsTransaction",
                        referenceId: savingsTx.id,
                        unitType: "simpan_pinjam",
                        memberId: account.memberId,
                        transactionNo: `CBT-${txNo}`,
                    }),
                });
                await tx.cashBankAccount.update({ where: { id: cbAccount.id }, data: { currentBalance: cbNewBal } });
            }
        }, { timeout: 30000 });

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
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();

    // Hanya operator, admin, kasir yang bisa melihat saldo akun simpanan
    const role = (user as any).role;
    if (role !== "operator" && role !== "admin" && role !== "kasir" && role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    const f = branchListFilter(user);
    if (!f.ok) return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });

    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
        return NextResponse.json({ message: "memberId wajib diisi" }, { status: 400 });
    }

    try {
        const accounts = await prisma.savingsAccount.findMany({
            where: { ...f.filter, memberId: Number(memberId), status: "active" },
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
