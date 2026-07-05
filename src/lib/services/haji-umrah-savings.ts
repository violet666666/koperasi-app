import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";

/** H&U savings product types. */
export const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

/**
 * Typed Error carrying an HTTP status code, so routes can map helper failures
 * back to the exact status/message the original web routes returned.
 */
export class HajiUmrahSavingsError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
        super(message);
        this.name = "HajiUmrahSavingsError";
        this.statusCode = statusCode;
    }
}

/** Cryptographically-secure SavingsTransaction number: HU-{year}-{9-digit}. */
function generateTxNo(): string {
    const year = new Date().getFullYear();
    const random = randomBytes(4).readUInt32BE(0) % 1_000_000_000;
    return `HU-${year}-${random.toString().padStart(9, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// processHajiUmrahDeposit — setoran (deposit) money-core
// Extracted VERBATIM from
// src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts (web lines 92-266).
// The $transaction callback body (web lines 151-249) is copied byte-for-byte;
// every field, category, unitType, balanceBefore/After, and description string
// is preserved exactly. The T2 opus review verifies byte-identity.
// ─────────────────────────────────────────────────────────────────────────────

export interface DepositInput {
    accountId: number;
    amount: number;
    paymentMethod?: string;
    cashBankAccountId?: number | null;
    referenceNo?: string | null;
    notes?: string | null;
    transactionDate?: string;
    userId: number;
}

export interface DepositResult {
    transaction: any; // SavingsTransaction with member + account.product includes
    meta: { adminFee: number; balanceAfter: number; target: number; progress: number; isTargetReached: boolean };
}

export async function processHajiUmrahDeposit(input: DepositInput): Promise<DepositResult> {
    const { accountId: id, amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate, userId } = input;

    // ── Validation — VERBATIM web lines 95-97 ──
    if (!amount || amount <= 0) {
        throw new HajiUmrahSavingsError(400, "Jumlah setoran harus lebih dari 0");
    }

    // ── Fetch account with product — VERBATIM web lines 100-114 ──
    const account = await prisma.savingsAccount.findUnique({
        where: { id },
        include: {
            member: { select: { id: true, name: true, branchId: true } },
            product: true,
        },
    });

    if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
        throw new HajiUmrahSavingsError(404, "Rekening tidak ditemukan");
    }

    if (account.status !== "active") {
        throw new HajiUmrahSavingsError(400, "Rekening sudah ditutup");
    }

    // ── Calculate admin fee — VERBATIM web lines 117-126 ──
    let adminFee = 0;
    const product = account.product;
    if (product.adminFeeType && product.adminFeeValue) {
        const feeValue = Number(product.adminFeeValue);
        if (product.adminFeeType === "percent") {
            adminFee = Math.round(amount * feeValue / 100);
        } else {
            adminFee = feeValue;
        }
    }

    const currentBalance = Number(account.balance);
    const balanceAfter = currentBalance + amount;

    const txNo = generateTxNo();

    // ── Parse date — WIB handling — VERBATIM web lines 134-144 ──
    let txDate: Date;
    if (transactionDate) {
        const raw = String(transactionDate);
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            txDate = new Date(raw + "T12:00:00+07:00");
        } else {
            txDate = new Date(raw);
        }
    } else {
        txDate = new Date();
    }

    const typeLabel = product.type === "tabungan_haji" ? "Haji" : "Umrah";

    // ── ATOMIC TRANSACTION — VERBATIM web lines 149-250 ──
    const [transaction] = await prisma.$transaction(async (tx) => {
        // 1. Create SavingsTransaction (deposit)
        const savingsTx = await tx.savingsTransaction.create({
            data: {
                transactionNo: txNo,
                accountId: id,
                memberId: account.memberId,
                productId: account.productId,
                branchId: account.member.branchId,
                type: "deposit",
                amount,
                balanceBefore: currentBalance,
                balanceAfter,
                paymentMethod: paymentMethod || "cash",
                cashBankAccountId: cashBankAccountId ?? null,
                referenceNo: referenceNo ?? null,
                notes: notes ?? `Setoran Tabungan ${typeLabel}`,
                transactionDate: txDate,
                createdById: userId,
            },
            include: {
                member: { select: { id: true, name: true } },
                account: { include: { product: true } },
            },
        });

        // 2. Update account balance
        await tx.savingsAccount.update({
            where: { id },
            data: { balance: balanceAfter },
        });

        // 3. CashBank posting — deposit amount
        if (cashBankAccountId) {
            const cashBank = await tx.cashBankAccount.findUnique({
                where: { id: cashBankAccountId },
            });
            if (cashBank) {
                const cbBefore = Number(cashBank.currentBalance);
                const cbAfter = cbBefore + amount;

                await tx.cashBankTransaction.create({
                    data: {
                        transactionNo: `CBT-${txNo}`,
                        accountId: cashBankAccountId,
                        branchId: account.member.branchId,
                        type: "in",
                        category: "savings",
                        amount,
                        balanceBefore: cbBefore,
                        balanceAfter: cbAfter,
                        referenceType: "SavingsTransaction",
                        referenceId: savingsTx.id,
                        unitType: "simpan_pinjam",
                        description: `Setoran Tabungan ${typeLabel} — ${account.member.name} (${txNo})`,
                        transactionDate: txDate,
                        createdById: userId,
                    },
                });

                // Update CB balance
                await tx.cashBankAccount.update({
                    where: { id: cashBankAccountId },
                    data: { currentBalance: cbAfter },
                });

                // 4. Admin fee — separate CashBankTransaction (revenue for koperasi)
                if (adminFee > 0) {
                    const feeCbBefore = Number(
                        (await tx.cashBankAccount.findUnique({ where: { id: cashBankAccountId } }))!.currentBalance
                    );
                    const feeCbAfter = feeCbBefore + adminFee;

                    await tx.cashBankTransaction.create({
                        data: {
                            transactionNo: `CBT-${txNo}-FEE`,
                            accountId: cashBankAccountId,
                            branchId: account.member.branchId,
                            type: "in",
                            category: "pendapatan_unit",
                            amount: adminFee,
                            balanceBefore: feeCbBefore,
                            balanceAfter: feeCbAfter,
                            referenceType: "SavingsTransaction",
                            referenceId: savingsTx.id,
                            unitType: "haji_umrah",
                            description: `Admin Fee Tabungan ${typeLabel} — ${account.member.name} (${txNo})`,
                            transactionDate: txDate,
                            createdById: userId,
                        },
                    });

                    await tx.cashBankAccount.update({
                        where: { id: cashBankAccountId },
                        data: { currentBalance: feeCbAfter },
                    });
                }
            }
        }

        return [savingsTx];
    });
    // ───────────────────────────────────────────────────────────────────────────

    // ── Meta — VERBATIM web lines 253-265 ──
    const target = Number(account.targetAmount ?? product.targetAmount ?? 0);
    const isTargetReached = target > 0 && balanceAfter >= target;

    return {
        transaction,
        meta: {
            adminFee,
            balanceAfter,
            target,
            progress: target > 0 ? Math.min(100, Math.round((balanceAfter / target) * 10000) / 100) : 0,
            isTargetReached,
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// createHajiUmrahAccount — buka rekening (account create)
// Extracted VERBATIM from src/app/api/haji-umrah/savings/route.ts (web lines 91-156).
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateAccountInput {
    memberId: number;
    productId: number;
    targetAmount?: any;
    monthlyTarget?: any;
    maturityDate?: string;
}

export async function createHajiUmrahAccount(input: CreateAccountInput) {
    const { memberId, productId, targetAmount, monthlyTarget, maturityDate } = input;

    // ── Validation — VERBATIM web lines 94-99 ──
    if (!memberId || !productId) {
        throw new HajiUmrahSavingsError(400, "memberId dan productId wajib diisi");
    }

    // ── Validate product is haji/umrah type — VERBATIM web lines 102-110 ──
    const product = await prisma.savingsProduct.findUnique({
        where: { id: productId },
    });
    if (!product || !HAJI_UMRAH_TYPES.includes(product.type)) {
        throw new HajiUmrahSavingsError(400, "Produk bukan tipe tabungan haji/umrah");
    }

    // ── Get member — VERBATIM web lines 113-122 ──
    const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, branchId: true, status: true },
    });
    if (!member) {
        throw new HajiUmrahSavingsError(404, "Anggota tidak ditemukan");
    }

    // ── Check if account already exists — VERBATIM web lines 125-133 ──
    const existing = await prisma.savingsAccount.findUnique({
        where: { memberId_productId: { memberId, productId } },
    });
    if (existing) {
        throw new HajiUmrahSavingsError(409, "Anggota sudah memiliki rekening untuk produk ini");
    }

    // ── accountNo + create — VERBATIM web lines 135-154 ──
    const accountNo = `HU-${memberId}-${productId}-${Date.now().toString().slice(-4)}`;
    const effectiveTarget = targetAmount ?? product.targetAmount;

    return prisma.savingsAccount.create({
        data: {
            accountNo,
            memberId,
            productId,
            branchId: member.branchId,
            balance: 0,
            openedDate: new Date(),
            targetAmount: effectiveTarget,
            monthlyTarget: monthlyTarget ?? null,
            maturityDate: maturityDate ? new Date(maturityDate) : null,
        },
        include: {
            member: { select: { id: true, memberNo: true, name: true, nrp: true } },
            product: true,
        },
    });
}
