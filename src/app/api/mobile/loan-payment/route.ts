import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getMobileUser, getMobileUserWithScope, unauthorizedResponse } from "../middleware";
import { canAccessBranch } from "@/lib/mobile-auth-scope";
import { logAudit } from "@/lib/audit-logger";
import { buildCashBankTransactionData } from "@/lib/kas-bank-loan-helpers";
import { allocatePayment } from "@/lib/loan-payment-helpers";

// GET /api/mobile/loan-payment?memberId=xxx — Get member's active loans
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
        return NextResponse.json({ message: "memberId wajib diisi" }, { status: 400 });
    }

    try {
        const loans = await prisma.loan.findMany({
            where: { memberId: Number(memberId), status: { in: ["active", "overdue"] } },
            select: {
                id: true,
                loanNo: true,
                principalAmount: true,
                principalOutstanding: true,
                interestOutstanding: true,
                interestRate: true,
                monthlyInstallment: true,
                tenorMonths: true,
                status: true,
                memberId: true,
                application: { select: { product: { select: { name: true } } } },
            },
        });

        return NextResponse.json({
            data: loans.map((l) => ({
                id: l.id,
                loanNo: l.loanNo,
                productName: l.application.product.name,
                principalAmount: Number(l.principalAmount),
                principalOutstanding: Number(l.principalOutstanding),
                interestOutstanding: Number(l.interestOutstanding),
                interestRate: Number(l.interestRate),
                monthlyInstallment: Number(l.monthlyInstallment),
                tenor: l.tenorMonths,
                status: l.status,
                memberId: l.memberId,
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/loan-payment error:", error);
        return NextResponse.json({ message: "Gagal memuat data pinjaman" }, { status: 500 });
    }
}

// Collision-safe payment number — crypto (repo rule: never Math.random for txn numbers).
async function generateMobilePaymentNo(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
        const random = crypto.randomBytes(4).readUInt32BE(0) % 1_000_000;
        const paymentNo = `PAY-M-${year}-${random.toString().padStart(6, "0")}`;
        const exists = await tx.loanPayment.findUnique({ where: { paymentNo }, select: { id: true } });
        if (!exists) return paymentNo;
    }
    return `PAY-M-${year}-${Date.now().toString().slice(-8)}`;
}

// Explicit crypto CB transactionNo — avoids buildCashBankTransactionData's Math.random default.
function mobileCbTxNo(base: string): string {
    const rand = crypto.randomBytes(4).readUInt32BE(0) % 1_000_000;
    return `${base}-${rand.toString().padStart(6, "0")}`;
}

// POST /api/mobile/loan-payment — Record a loan installment or early settlement payment.
// Unified FIFO allocation (matches web api/loans/[id]/payments): creates PaymentAllocation
// records, updates each LoanSchedule, updates loan totals, posts CashBank — all atomic.
export async function POST(request: Request) {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { loanId, amount, notes, cashBankAccountId, isEarlySettlement } = body;

        if (!loanId || !amount) {
            return NextResponse.json({ message: "loanId dan amount wajib diisi" }, { status: 400 });
        }
        const numAmount = Number(amount);
        if (numAmount <= 0) {
            return NextResponse.json({ message: "Jumlah harus lebih dari 0" }, { status: 400 });
        }

        const loan = await prisma.loan.findUnique({
            where: { id: Number(loanId) },
            include: {
                member: { select: { id: true, name: true, memberNo: true } },
                application: { select: { product: { select: { name: true } } } },
                schedules: {
                    where: { status: { in: ["pending", "partial", "overdue"] } },
                    orderBy: { installmentNo: "asc" },
                },
            },
        });

        if (!loan || !["active", "overdue"].includes(loan.status)) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan atau sudah lunas" }, { status: 404 });
        }

        const branchOk = canAccessBranch(user, loan.branchId);
        if (!branchOk.allowed) {
            return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
        }

        const principalOut = Number(loan.principalOutstanding);
        const interestOut = Number(loan.interestOutstanding);

        // ── Early-settlement penalty (same formula as web + old mobile branch) ──
        let earlySettlementFee = 0;
        if (isEarlySettlement) {
            const principalAmount = Number(loan.principalAmount);
            const interestRate = Number(loan.interestRate || 1);
            const monthlyInterest = Math.round(principalAmount * (interestRate / 100));
            const penaltyMultiplier = loan.tenorMonths <= 24 ? 1 : 2;
            earlySettlementFee = monthlyInterest * penaltyMultiplier;
            const expectedTotal = principalOut + earlySettlementFee;
            if (Math.abs(numAmount - expectedTotal) > 100) {
                return NextResponse.json({
                    message: `Jumlah pelunasan tidak sesuai. Harus ${expectedTotal.toLocaleString("id-ID")} (Pokok: ${principalOut.toLocaleString("id-ID")} + Penalti: ${earlySettlementFee.toLocaleString("id-ID")})`,
                }, { status: 400 });
            }
        }

        const allocationAmount = isEarlySettlement ? numAmount - earlySettlementFee : numAmount;

        // ── Pure FIFO allocation ──
        const scheduleInputs = loan.schedules.map((s) => ({
            id: s.id,
            installmentNo: s.installmentNo,
            principalAmount: Number(s.principalAmount),
            principalPaid: Number(s.principalPaid),
            interestAmount: Number(s.interestAmount),
            interestPaid: Number(s.interestPaid),
            lateFee: Number(s.lateFee),
            lateFeePaid: Number(s.lateFeePaid),
        }));
        const { allocations, totalPrincipal, totalInterest, totalLateFee } = allocatePayment(
            scheduleInputs,
            allocationAmount,
            Boolean(isEarlySettlement),
        );

        const today = new Date();

        // ── ATOMIC TRANSACTION ──
        const result = await prisma.$transaction(async (tx) => {
            const paymentNo = await generateMobilePaymentNo(tx);

            // 1. LoanPayment + PaymentAllocation records
            const payment = await tx.loanPayment.create({
                data: {
                    paymentNo,
                    loanId: loan.id,
                    memberId: loan.memberId,
                    branchId: loan.branchId,
                    amount: numAmount,
                    principalPortion: totalPrincipal,
                    interestPortion: totalInterest,
                    lateFeePortion: totalLateFee,
                    earlySettlementFee,
                    paymentType: isEarlySettlement ? "early_settlement" : "installment",
                    paymentMethod: null,
                    cashBankAccountId: cashBankAccountId ? Number(cashBankAccountId) : null,
                    notes: notes || (isEarlySettlement ? "Pelunasan Dipercepat via mobile" : "Angsuran via mobile"),
                    paymentDate: today,
                    createdById: Number(user.id),
                    allocations: { create: allocations },
                },
            });

            // 2. Update each schedule per allocation
            for (const alloc of allocations) {
                const s = loan.schedules.find((x) => x.id === alloc.scheduleId)!;
                const newPrincipalPaid = Number(s.principalPaid) + alloc.principalAmount;
                const newInterestPaid = Number(s.interestPaid) + alloc.interestAmount;
                const newLateFeePaid = Number(s.lateFeePaid) + alloc.lateFeeAmount;
                const totalPaid = newPrincipalPaid + newInterestPaid + newLateFeePaid;
                const totalScheduleDue = Number(s.principalAmount) + Number(s.interestAmount) + Number(s.lateFee);
                const isFullyPaid = isEarlySettlement
                    ? newPrincipalPaid >= Number(s.principalAmount)
                    : totalPaid >= totalScheduleDue;
                await tx.loanSchedule.update({
                    where: { id: alloc.scheduleId },
                    data: {
                        principalPaid: newPrincipalPaid,
                        interestPaid: newInterestPaid,
                        lateFeePaid: newLateFeePaid,
                        status: isFullyPaid ? "paid" : "partial",
                        paidDate: isFullyPaid ? today : null,
                    },
                });
            }

            // 3. Early-settlement: mark unallocated pending schedules as paid
            if (isEarlySettlement) {
                const allocatedIds = new Set(allocations.map((a) => a.scheduleId));
                for (const s of loan.schedules) {
                    if (!allocatedIds.has(s.id)) {
                        await tx.loanSchedule.update({
                            where: { id: s.id },
                            data: { status: "paid", paidDate: today },
                        });
                    }
                }
            }

            // 4. Update loan totals
            const updateData: Record<string, any> = {
                principalPaid: { increment: totalPrincipal },
                interestPaid: { increment: totalInterest },
                lateFeePaid: { increment: totalLateFee },
                principalOutstanding: { decrement: totalPrincipal },
                interestOutstanding: { decrement: totalInterest },
            };
            let finalStatus = loan.status;
            if (isEarlySettlement) {
                updateData.principalOutstanding = 0;
                updateData.interestOutstanding = 0;
                updateData.status = "paid_off";
                updateData.paidOffDate = today;
                finalStatus = "paid_off";
            }
            await tx.loan.update({ where: { id: loan.id }, data: updateData });

            // 5. Regular: check fully paid
            if (!isEarlySettlement) {
                const updated = await tx.loan.findUnique({
                    where: { id: loan.id },
                    select: { principalOutstanding: true, interestOutstanding: true, status: true },
                });
                if (updated && Number(updated.principalOutstanding) <= 0 && Number(updated.interestOutstanding) <= 0) {
                    await tx.loan.update({ where: { id: loan.id }, data: { status: "paid_off", paidOffDate: today } });
                    finalStatus = "paid_off";
                } else {
                    finalStatus = (updated?.status as string) || loan.status;
                }
            }

            // 6. Cash/Bank posts (if account selected)
            if (cashBankAccountId) {
                const cashAccount = await tx.cashBankAccount.findFirst({
                    where: { id: Number(cashBankAccountId), isActive: true },
                });
                if (!cashAccount) throw new Error("Akun kas/bank tidak ditemukan atau tidak aktif");

                let bal = Number(cashAccount.currentBalance);
                const memberLabel = `${loan.member.name} (${loan.member.memberNo})`;
                const settlementLabel = isEarlySettlement ? " [PELUNASAN]" : "";

                if (totalPrincipal > 0) {
                    const before = bal; bal += totalPrincipal;
                    await tx.cashBankTransaction.create({
                        data: buildCashBankTransactionData({
                            accountId: cashAccount.id, branchId: loan.branchId, type: "in",
                            category: "angsuran_pokok", amount: totalPrincipal,
                            balanceBefore: before, balanceAfter: bal,
                            description: `Angsuran Pokok ${loan.loanNo}${settlementLabel} — ${memberLabel}`,
                            transactionDate: today, createdById: Number(user.id),
                            referenceType: "LoanPayment", referenceId: payment.id,
                            unitType: "simpan_pinjam", memberId: loan.memberId,
                            transactionNo: mobileCbTxNo(`CBM-${paymentNo}-P`),
                        }),
                    });
                }
                if (totalInterest > 0) {
                    const before = bal; bal += totalInterest;
                    await tx.cashBankTransaction.create({
                        data: buildCashBankTransactionData({
                            accountId: cashAccount.id, branchId: loan.branchId, type: "in",
                            category: "jasa_pinjaman", amount: totalInterest,
                            balanceBefore: before, balanceAfter: bal,
                            description: `Jasa/Bunga ${loan.loanNo}${settlementLabel} — ${memberLabel}`,
                            transactionDate: today, createdById: Number(user.id),
                            referenceType: "LoanPayment", referenceId: payment.id,
                            unitType: "simpan_pinjam", memberId: loan.memberId,
                            transactionNo: mobileCbTxNo(`CBM-${paymentNo}-I`),
                        }),
                    });
                }
                if (isEarlySettlement && earlySettlementFee > 0) {
                    const before = bal; bal += earlySettlementFee;
                    await tx.cashBankTransaction.create({
                        data: buildCashBankTransactionData({
                            accountId: cashAccount.id, branchId: loan.branchId, type: "in",
                            category: "penalti_pelunasan", amount: earlySettlementFee,
                            balanceBefore: before, balanceAfter: bal,
                            description: `Penalti Pelunasan ${loan.loanNo} — ${memberLabel}`,
                            transactionDate: today, createdById: Number(user.id),
                            referenceType: "LoanPayment", referenceId: payment.id,
                            unitType: "simpan_pinjam", memberId: loan.memberId,
                            transactionNo: mobileCbTxNo(`CBM-${paymentNo}-ES`),
                        }),
                    });
                }
                await tx.cashBankAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: bal } });
            }

            return {
                payment,
                finalStatus,
                newPrincipalOutstanding: isEarlySettlement ? 0 : principalOut - totalPrincipal,
                newInterestOutstanding: isEarlySettlement ? 0 : interestOut - totalInterest,
            };
        }, { timeout: 30000 });

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "CREATE",
            module: "Pinjaman",
            description: `${isEarlySettlement ? "PELUNASAN DIPERCEPAT" : "Angsuran"} Rp ${numAmount.toLocaleString("id-ID")} untuk ${loan.loanNo} (${loan.member.name}) via mobile`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: result.finalStatus === "paid_off"
                ? (isEarlySettlement ? "Pinjaman LUNAS! 🎉 (Pelunasan Dipercepat)" : "Pinjaman LUNAS! 🎉")
                : "Angsuran berhasil dicatat",
            data: {
                newPrincipalOutstanding: result.newPrincipalOutstanding,
                newInterestOutstanding: result.newInterestOutstanding,
                status: result.finalStatus,
            },
        });
    } catch (error) {
        console.error("POST /api/mobile/loan-payment error:", error);
        return NextResponse.json({ message: "Gagal memproses angsuran" }, { status: 500 });
    }
}
