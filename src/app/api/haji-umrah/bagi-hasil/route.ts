import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createBagiHasilSchema } from "@/lib/validations/haji-umrah";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

function generateDistributionNo(): string {
    const year = new Date().getFullYear();
    const random = randomBytes(4).readUInt32BE(0) % 1_000_000_000;
    return `BHD-${year}-${random.toString().padStart(9, "0")}`;
}

function generateSavingsTxNo(): string {
    const year = new Date().getFullYear();
    const random = randomBytes(4).readUInt32BE(0) % 1_000_000_000;
    return `BH-${year}-${random.toString().padStart(9, "0")}`;
}

function generateCashTxNo(): string {
    const random = randomBytes(4).readUInt32BE(0) % 1_000_000_000;
    return `CBT-BH-${random.toString().padStart(9, "0")}`;
}

// GET /api/haji-umrah/bagi-hasil — List distributions + summary
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status"); // optional filter
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "20");

        const where = status ? { status } : {};
        const [distributions, total] = await Promise.all([
            prisma.bagiHasilDistribution.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
                include: {
                    _count: { select: { items: true } },
                },
            }),
            prisma.bagiHasilDistribution.count({ where }),
        ]);

        // Summary across all distributions (processed only count toward totals)
        const processed = distributions.filter((d) => d.status === "processed");
        const totalSpread = processed.reduce((s, d) => s + Number(d.spreadAmount), 0);
        const totalDistributed = processed.reduce((s, d) => s + Number(d.memberPoolAmount), 0);

        return NextResponse.json({
            data: distributions.map((d) => ({
                id: d.id,
                distributionNo: d.distributionNo,
                periodLabel: d.periodLabel,
                periodStart: d.periodStart,
                periodEnd: d.periodEnd,
                totalBsiAmount: Number(d.totalBsiAmount),
                memberRate: Number(d.memberRate),
                memberPoolAmount: Number(d.memberPoolAmount),
                spreadAmount: Number(d.spreadAmount),
                totalBalanceSnapshot: Number(d.totalBalanceSnapshot),
                memberCount: d.memberCount,
                status: d.status,
                processedAt: d.processedAt,
                voidedAt: d.voidedAt,
                voidReason: d.voidReason,
                notes: d.notes,
                itemCount: d._count.items,
                createdAt: d.createdAt,
            })),
            meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
            summary: {
                totalDistributions: total,
                processedCount: distributions.filter((d) => d.status === "processed").length,
                voidedCount: distributions.filter((d) => d.status === "voided").length,
                totalSpread,
                totalDistributed,
            },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/bagi-hasil error:", error);
        return NextResponse.json({ message: "Failed to fetch bagi hasil distributions" }, { status: 500 });
    }
}

// POST /api/haji-umrah/bagi-hasil — Preview (dryRun) or Process distribution
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as Record<string, unknown>).role?.name || (session.user as Record<string, unknown>).role;
        const unitType = (session.user as Record<string, unknown>).unitType;
        // RBAC: operator or admin haji_umrah only
        if (roleName !== "operator" && !(roleName === "admin" && unitType === "haji_umrah")) {
            return NextResponse.json({ message: "Forbidden — operator or haji_umrah admin only" }, { status: 403 });
        }
        const userId = parseInt(String(session.user.id));

        const body = await request.json();
        const parsed = createBagiHasilSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { message: "Validasi gagal", errors: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        const { periodLabel, periodStart, periodEnd, totalBsiAmount, memberRate, cashBankAccountId, notes, dryRun } =
            parsed.data;

        // 1. Snapshot all active H&U accounts with balance > 0
        const accounts = await prisma.savingsAccount.findMany({
            where: {
                status: "active",
                product: { type: { in: HAJI_UMRAH_TYPES } },
            },
            include: {
                member: { select: { id: true, name: true, branchId: true } },
                product: { select: { id: true, name: true, type: true } },
            },
            orderBy: { id: "asc" },
        });

        const eligible = accounts.filter((a) => Number(a.balance) > 0);
        if (eligible.length === 0) {
            return NextResponse.json(
                { message: "Tidak ada rekening Haji & Umrah aktif dengan saldo > 0 untuk didistribusi" },
                { status: 400 },
            );
        }

        // 2. Compute pool + spread
        const totalBalance = eligible.reduce((s, a) => s + Number(a.balance), 0);
        const memberPool = Math.round(totalBsiAmount * (memberRate / 100));
        const spread = totalBsiAmount - memberPool;

        // 3. Build per-account shares (proportional to balance). Last absorbs rounding remainder.
        const shares = eligible.map((acc, idx) => {
            const balance = Number(acc.balance);
            const sharePercent = (balance / totalBalance) * 100;
            return {
                idx,
                memberId: acc.memberId,
                savingsAccountId: acc.id,
                memberName: acc.member.name,
                accountNo: acc.accountNo,
                branchId: acc.member.branchId,
                productId: acc.productId,
                productName: acc.product.name,
                productType: acc.product.type,
                currentBalance: balance,
                sharePercent,
                amount: 0, // filled below
            };
        });

        let allocated = 0;
        shares.forEach((s, i) => {
            if (i === shares.length - 1) {
                s.amount = memberPool - allocated; // last absorbs remainder
            } else {
                s.amount = Math.round((s.currentBalance / totalBalance) * memberPool);
                allocated += s.amount;
            }
        });

        const previewItems = shares.map((s) => ({
            memberId: s.memberId,
            savingsAccountId: s.savingsAccountId,
            memberName: s.memberName,
            accountNo: s.accountNo,
            productName: s.productName,
            productType: s.productType,
            balanceSnapshot: s.currentBalance,
            sharePercent: Math.round(s.sharePercent * 10000) / 10000, // 4dp
            amount: s.amount,
        }));

        const summary = {
            totalBsiAmount,
            memberRate,
            memberPool,
            spread,
            totalBalanceSnapshot: totalBalance,
            memberCount: eligible.length,
        };

        // 4. dryRun → return preview only
        if (dryRun) {
            return NextResponse.json({
                message: "Preview distribusi bagi hasil",
                dryRun: true,
                summary,
                items: previewItems,
            });
        }

        // 5. Process — atomic
        if (!cashBankAccountId) {
            return NextResponse.json(
                { message: "Akun kas/bank wajib dipilih untuk pendaratan spread" },
                { status: 400 },
            );
        }

        const cashBank = await prisma.cashBankAccount.findUnique({ where: { id: cashBankAccountId } });
        if (!cashBank) {
            return NextResponse.json({ message: "Akun kas/bank tidak ditemukan" }, { status: 404 });
        }

        const distributionNo = generateDistributionNo();
        const now = new Date();
        const txDate = now;

        const distribution = await prisma.$transaction(async (tx) => {
            // 5a. Create distribution record
            const dist = await tx.bagiHasilDistribution.create({
                data: {
                    distributionNo,
                    periodLabel,
                    periodStart: new Date(periodStart),
                    periodEnd: new Date(periodEnd),
                    totalBsiAmount,
                    memberRate,
                    memberPoolAmount: memberPool,
                    spreadAmount: spread,
                    totalBalanceSnapshot: totalBalance,
                    memberCount: eligible.length,
                    status: "processed",
                    cashBankAccountId,
                    processedById: userId,
                    processedAt: now,
                    notes: notes ?? null,
                },
            });

            // 5b. Per account: SavingsTransaction (interest) + balance update
            const itemRecords: Array<{
                memberId: number;
                savingsAccountId: number;
                memberName: string;
                accountNo: string;
                balanceSnapshot: number;
                sharePercent: number;
                amount: number;
                savingsTransactionId: number;
            }> = [];

            for (const s of shares) {
                const balanceBefore = s.currentBalance;
                const balanceAfter = balanceBefore + s.amount;
                const savingsTx = await tx.savingsTransaction.create({
                    data: {
                        transactionNo: `${generateSavingsTxNo()}-${s.idx}`,
                        accountId: s.savingsAccountId,
                        memberId: s.memberId,
                        productId: s.productId,
                        branchId: s.branchId,
                        type: "interest",
                        amount: s.amount,
                        balanceBefore,
                        balanceAfter,
                        paymentMethod: "bank_transfer",
                        cashBankAccountId,
                        referenceNo: distributionNo,
                        notes: `Bagi Hasil BSI — ${periodLabel}`,
                        transactionDate: txDate,
                        createdById: userId,
                    },
                });

                await tx.savingsAccount.update({
                    where: { id: s.savingsAccountId },
                    data: { balance: balanceAfter },
                });

                itemRecords.push({
                    memberId: s.memberId,
                    savingsAccountId: s.savingsAccountId,
                    memberName: s.memberName,
                    accountNo: s.accountNo,
                    balanceSnapshot: s.currentBalance,
                    sharePercent: Math.round(s.sharePercent * 10000) / 10000,
                    amount: s.amount,
                    savingsTransactionId: savingsTx.id,
                });
            }

            // 5c. CashBank spread income (koperasi revenue — enters SHU)
            // Distinct category "bagi_hasil" (not "pendapatan_unit") so it does NOT pollute the
            // existing admin_fee report / dashboard adminFeeRevenue, which filter on pendapatan_unit.
            const cbBefore = Number(cashBank.currentBalance);
            const cbAfter = cbBefore + spread;
            await tx.cashBankTransaction.create({
                data: {
                    transactionNo: generateCashTxNo(),
                    accountId: cashBankAccountId,
                    branchId: cashBank.branchId,
                    type: "in",
                    category: "bagi_hasil",
                    amount: spread,
                    balanceBefore: cbBefore,
                    balanceAfter: cbAfter,
                    referenceType: "BagiHasilDistribution",
                    referenceId: dist.id,
                    unitType: "haji_umrah",
                    description: `Spread Bagi Hasil BSI — ${periodLabel} (${distributionNo})`,
                    transactionDate: txDate,
                    createdById: userId,
                },
            });
            await tx.cashBankAccount.update({
                where: { id: cashBankAccountId },
                data: { currentBalance: cbAfter },
            });

            // 5d. Create items
            await tx.bagiHasilItem.createMany({
                data: itemRecords.map((it) => ({
                    distributionId: dist.id,
                    memberId: it.memberId,
                    savingsAccountId: it.savingsAccountId,
                    memberName: it.memberName,
                    accountNo: it.accountNo,
                    balanceSnapshot: it.balanceSnapshot,
                    sharePercent: it.sharePercent,
                    amount: it.amount,
                    savingsTransactionId: it.savingsTransactionId,
                })),
            });

            return dist;
        });

        return NextResponse.json(
            {
                message: "Distribusi bagi hasil berhasil diproses",
                dryRun: false,
                data: {
                    id: distribution.id,
                    distributionNo: distribution.distributionNo,
                    ...summary,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("POST /api/haji-umrah/bagi-hasil error:", error);
        const message = error instanceof Error ? error.message : "Failed to process bagi hasil";
        return NextResponse.json({ message }, { status: 500 });
    }
}
