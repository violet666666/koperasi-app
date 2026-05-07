import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createLoanPaymentSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";

interface Params {
    params: Promise<{ id: string }>;
}

// Helper to generate payment number (with collision-safe retry)
async function generatePaymentNo(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const maxRetries = 5;

    for (let i = 0; i < maxRetries; i++) {
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
        const paymentNo = `PAY-${year}-${random}`;
        const exists = await prisma.loanPayment.findUnique({
            where: { paymentNo },
            select: { id: true },
        });
        if (!exists) return paymentNo;
    }

    // Fallback: timestamp-based to guarantee uniqueness
    return `PAY-${year}-${Date.now().toString().slice(-8)}`;
}

// GET /api/loans/[id]/payments
export async function GET(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
        if (!["operator", "admin_sp", "admin"].includes(roleName)) {
            return NextResponse.json({ message: "Hanya Operator yang dapat mengakses data pembayaran." }, { status: 403 });
        }

        const { id } = await params;
        const payments = await prisma.loanPayment.findMany({
            where: { loanId: parseInt(id) },
            orderBy: { paymentDate: "desc" },
            include: {
                allocations: {
                    include: {
                        schedule: true,
                    },
                },
            },
        });

        return NextResponse.json({ data: payments });
    } catch (error) {
        console.error("GET /api/loans/[id]/payments error:", error);
        return NextResponse.json(
            { message: "Failed to fetch payments" },
            { status: 500 }
        );
    }
}

// POST /api/loans/[id]/payments
export async function POST(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const userId = Number((session.user as any).id);
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
        if (!["operator", "admin_sp", "admin"].includes(roleName)) {
            return NextResponse.json({ message: "Hanya Operator yang dapat mencatat pembayaran pinjaman." }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const data = createLoanPaymentSchema.parse({
            ...body,
            loanId: parseInt(id),
        });

        const loan = await prisma.loan.findUnique({
            where: { id: parseInt(id) },
            include: {
                schedules: {
                    where: { status: { in: ["pending", "partial", "overdue"] } },
                    orderBy: { installmentNo: "asc" },
                },
            },
        });

        if (!loan) {
            return NextResponse.json(
                { message: "Pinjaman tidak ditemukan" },
                { status: 404 }
            );
        }

        if (loan.status !== "active") {
            return NextResponse.json(
                { message: "Pinjaman tidak aktif" },
                { status: 400 }
            );
        }

        const isEarlySettlement = data.paymentType === "early_settlement";

        // ══════════════════════════════════════════════════════════════
        // EARLY SETTLEMENT: Calculate penalty fee
        // ══════════════════════════════════════════════════════════════
        let earlySettlementFee = 0;
        if (isEarlySettlement) {
            // Penalti berdasarkan tenor:
            // Tenor ≤ 24 bulan → 1× bunga bulanan
            // Tenor > 24 bulan → 2× bunga bulanan
            // Bunga bulanan = pokok awal × interestRate%
            const monthlyInterest = Math.round(
                Number(loan.principalAmount) * (Number(loan.interestRate) / 100)
            );
            const penaltyMultiplier = loan.tenorMonths <= 24 ? 1 : 2;
            earlySettlementFee = monthlyInterest * penaltyMultiplier;
        }

        // ══════════════════════════════════════════════════════════════
        // Allocate payment to schedules (FIFO)
        // For early settlement: allocate ALL remaining schedules
        // ══════════════════════════════════════════════════════════════
        // For early settlement, the "amount" from frontend already includes penalty.
        // We need to subtract penalty to get the actual amount for schedule allocation.
        const allocationAmount = isEarlySettlement
            ? data.amount - earlySettlementFee
            : data.amount;

        let remainingAmount = allocationAmount;
        let totalPrincipal = 0;
        let totalInterest = 0;
        let totalLateFee = 0;
        const allocations: Array<{
            scheduleId: number;
            principalAmount: number;
            interestAmount: number;
            lateFeeAmount: number;
        }> = [];

        for (const schedule of loan.schedules) {
            if (remainingAmount <= 0) break;

            const principalDue = Number(schedule.principalAmount) - Number(schedule.principalPaid);
            const interestDue = Number(schedule.interestAmount) - Number(schedule.interestPaid);
            const lateFeeDue = Number(schedule.lateFee) - Number(schedule.lateFeePaid);

            // For early settlement: skip ALL interest (kebijakan: hanya pokok + penalti)
            let effectiveInterestDue = interestDue;
            if (isEarlySettlement) {
                // Pelunasan dipercepat: tidak dikenakan bunga/jasa
                effectiveInterestDue = 0;
            }

            const totalDue = principalDue + effectiveInterestDue + lateFeeDue;

            if (totalDue <= 0) continue;

            const payAmount = Math.min(remainingAmount, totalDue);

            // Allocate: late fee first, then interest, then principal
            let lateFeePay = Math.min(payAmount, lateFeeDue);
            let interestPay = Math.min(payAmount - lateFeePay, effectiveInterestDue);
            let principalPay = payAmount - lateFeePay - interestPay;

            allocations.push({
                scheduleId: schedule.id,
                principalAmount: principalPay,
                interestAmount: interestPay,
                lateFeeAmount: lateFeePay,
            });

            totalPrincipal += principalPay;
            totalInterest += interestPay;
            totalLateFee += lateFeePay;
            remainingAmount -= payAmount;
        }

        // ══════════════════════════════════════════════════════════════
        // ATOMIC TRANSACTION — semua operasi di bawah ini dijamin
        // all-or-nothing (rollback jika salah satu gagal)
        // ══════════════════════════════════════════════════════════════

        const result = await prisma.$transaction(async (tx) => {
            // Generate payment number inside transaction for atomicity
            const pYear = new Date().getFullYear();
            let paymentNo = '';
            for (let attempt = 0; attempt < 5; attempt++) {
                const random = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
                paymentNo = `PAY-${pYear}-${random}`;
                const exists = await tx.loanPayment.findUnique({
                    where: { paymentNo },
                    select: { id: true },
                });
                if (!exists) break;
                if (attempt === 4) paymentNo = `PAY-${pYear}-${Date.now().toString().slice(-8)}`;
            }

            // 1. Create payment with allocations
            const payment = await tx.loanPayment.create({
                data: {
                    paymentNo,
                    loanId: parseInt(id),
                    memberId: loan.memberId,
                    branchId: loan.branchId,
                    amount: data.amount,
                    principalPortion: totalPrincipal,
                    interestPortion: totalInterest,
                    lateFeePortion: totalLateFee,
                    earlySettlementFee: earlySettlementFee,
                    paymentType: data.paymentType,
                    paymentMethod: data.paymentMethod,
                    cashBankAccountId: data.cashBankAccountId,
                    referenceNo: data.referenceNo,
                    notes: isEarlySettlement
                        ? `[PELUNASAN DIPERCEPAT] ${data.notes || ""}`.trim()
                        : data.notes,
                    paymentDate: data.paymentDate,
                    createdById: userId,
                    allocations: {
                        create: allocations,
                    },
                },
                include: {
                    allocations: true,
                },
            });

            // 2. Update schedules
            for (const alloc of allocations) {
                const schedule = loan.schedules.find((s) => s.id === alloc.scheduleId)!;
                const newPrincipalPaid = Number(schedule.principalPaid) + alloc.principalAmount;
                const newInterestPaid = Number(schedule.interestPaid) + alloc.interestAmount;
                const newLateFeePaid = Number(schedule.lateFeePaid) + alloc.lateFeeAmount;

                const totalPaid = newPrincipalPaid + newInterestPaid + newLateFeePaid;
                const totalScheduleDue = Number(schedule.principalAmount) + Number(schedule.interestAmount) + Number(schedule.lateFee);

                // For early settlement with discount, mark schedule as paid even if interest not fully paid
                const isFullyPaid = isEarlySettlement
                    ? (newPrincipalPaid >= Number(schedule.principalAmount))
                    : (totalPaid >= totalScheduleDue);

                await tx.loanSchedule.update({
                    where: { id: alloc.scheduleId },
                    data: {
                        principalPaid: newPrincipalPaid,
                        interestPaid: newInterestPaid,
                        lateFeePaid: newLateFeePaid,
                        status: isFullyPaid ? "paid" : "partial",
                        paidDate: isFullyPaid ? data.paymentDate : null,
                    },
                });
            }

            // For early settlement: also mark any remaining un-allocated schedules as paid
            // (e.g. schedules with 0 remaining due that were skipped)
            if (isEarlySettlement) {
                const allocatedScheduleIds = allocations.map(a => a.scheduleId);
                const unallocatedSchedules = loan.schedules.filter(
                    s => !allocatedScheduleIds.includes(s.id)
                );
                for (const schedule of unallocatedSchedules) {
                    await tx.loanSchedule.update({
                        where: { id: schedule.id },
                        data: {
                            status: "paid",
                            paidDate: data.paymentDate,
                        },
                    });
                }
            }

            // 3. Update loan totals
            const updateData: Record<string, any> = {
                principalPaid: { increment: totalPrincipal },
                interestPaid: { increment: totalInterest },
                lateFeePaid: { increment: totalLateFee },
                principalOutstanding: { decrement: totalPrincipal },
                interestOutstanding: { decrement: totalInterest },
            };

            // For early settlement: force loan to paid_off status
            // Kebijakan: pelunasan dipercepat tanpa bunga/jasa
            if (isEarlySettlement) {
                // Set outstanding to 0 and status to paid_off
                updateData.principalOutstanding = 0;
                updateData.interestOutstanding = 0;  // Bunga dibebaskan saat pelunasan dipercepat
                updateData.principalPaid = Number(loan.principalPaid) + totalPrincipal;
                updateData.interestPaid = Number(loan.interestPaid) + totalInterest;
                updateData.lateFeePaid = Number(loan.lateFeePaid) + totalLateFee;
                updateData.status = "paid_off";
                updateData.paidOffDate = data.paymentDate;
            }

            await tx.loan.update({
                where: { id: parseInt(id) },
                data: updateData,
            });

            // 4. Check if loan is fully paid (for regular installment mode)
            if (!isEarlySettlement) {
                const updatedLoan = await tx.loan.findUnique({
                    where: { id: parseInt(id) },
                });

                if (
                    updatedLoan &&
                    Number(updatedLoan.principalOutstanding) <= 0 &&
                    Number(updatedLoan.interestOutstanding) <= 0
                ) {
                    await tx.loan.update({
                        where: { id: parseInt(id) },
                        data: {
                            status: "paid_off",
                            paidOffDate: data.paymentDate,
                        },
                    });
                }
            }

            // 5. Post to Cash/Bank (Kas Masuk) — WAJIB untuk integritas akuntansi
            if (data.cashBankAccountId) {
                const cashBank = await tx.cashBankAccount.findUnique({
                    where: { id: data.cashBankAccountId },
                });

                if (cashBank) {
                    // Fetch member name for description
                    const member = await tx.member.findUnique({
                        where: { id: loan.memberId },
                        select: { name: true, memberNo: true },
                    });
                    const memberLabel = member ? `${member.name} (${member.memberNo})` : `Member #${loan.memberId}`;
                    const settlementLabel = isEarlySettlement ? " [PELUNASAN]" : "";

                    let runningBalance = Number(cashBank.currentBalance);

                    // 5a. Angsuran Pokok → Kas Masuk
                    if (totalPrincipal > 0) {
                        const balBefore = runningBalance;
                        runningBalance += totalPrincipal;
                        await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `CBM-${paymentNo}-P`,
                                accountId: data.cashBankAccountId,
                                branchId: loan.branchId,
                                type: "in",
                                category: "angsuran_pokok",
                                amount: totalPrincipal,
                                balanceBefore: balBefore,
                                balanceAfter: runningBalance,
                                referenceType: "LoanPayment",
                                referenceId: payment.id,
                                unitType: "simpan_pinjam",
                                description: `Angsuran Pokok Pinjaman ${loan.loanNo}${settlementLabel} — ${memberLabel}`,
                                transactionDate: data.paymentDate,
                                memberId: loan.memberId,
                                createdById: userId,
                            },
                        });
                    }

                    // 5b. Jasa/Bunga Pinjaman → Kas Masuk
                    if (totalInterest > 0) {
                        const balBefore = runningBalance;
                        runningBalance += totalInterest;
                        await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `CBM-${paymentNo}-I`,
                                accountId: data.cashBankAccountId,
                                branchId: loan.branchId,
                                type: "in",
                                category: "jasa_pinjaman",
                                amount: totalInterest,
                                balanceBefore: balBefore,
                                balanceAfter: runningBalance,
                                referenceType: "LoanPayment",
                                referenceId: payment.id,
                                unitType: "simpan_pinjam",
                                description: `Jasa/Bunga Pinjaman ${loan.loanNo}${settlementLabel} — ${memberLabel}`,
                                transactionDate: data.paymentDate,
                                memberId: loan.memberId,
                                createdById: userId,
                            },
                        });
                    }

                    // 5c. Penalti Pelunasan Dipercepat → Kas Masuk (ONLY for early settlement)
                    if (isEarlySettlement && earlySettlementFee > 0) {
                        const balBefore = runningBalance;
                        runningBalance += earlySettlementFee;
                        await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `CBM-${paymentNo}-ES`,
                                accountId: data.cashBankAccountId,
                                branchId: loan.branchId,
                                type: "in",
                                category: "penalti_pelunasan",
                                amount: earlySettlementFee,
                                balanceBefore: balBefore,
                                balanceAfter: runningBalance,
                                referenceType: "LoanPayment",
                                referenceId: payment.id,
                                unitType: "simpan_pinjam",
                                description: `Biaya Penalti Pelunasan Dipercepat Pinjaman ${loan.loanNo} (Tenor ${loan.tenorMonths} bln → ${loan.tenorMonths <= 24 ? "1" : "2"}× bunga) — ${memberLabel}`,
                                transactionDate: data.paymentDate,
                                memberId: loan.memberId,
                                createdById: userId,
                            },
                        });
                    }

                    // 5d. Update saldo kas/bank koperasi
                    await tx.cashBankAccount.update({
                        where: { id: data.cashBankAccountId },
                        data: { currentBalance: runningBalance },
                    });
                }
            }

            return payment;
        }, { timeout: 30000 });
        // ══════════════════════════════════════════════════════════════

        return NextResponse.json({
            data: result,
            message: isEarlySettlement
                ? "Pelunasan dipercepat berhasil diproses! Pinjaman telah lunas."
                : "Pembayaran berhasil dicatat",
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/loans/[id]/payments error:", error);
        if (error instanceof ZodError) {
            return NextResponse.json(
                { message: "Validation error", errors: error.flatten() },
                { status: 400 }
            );
        }
        const detail = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { message: `Gagal mencatat pembayaran: ${detail}` },
            { status: 500 }
        );
    }
}
