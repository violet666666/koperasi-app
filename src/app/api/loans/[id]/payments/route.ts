import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createLoanPaymentSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

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

        // Allocate payment to schedules (FIFO)
        let remainingAmount = data.amount;
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
            const totalDue = principalDue + interestDue + lateFeeDue;

            if (totalDue <= 0) continue;

            const payAmount = Math.min(remainingAmount, totalDue);

            // Allocate: late fee first, then interest, then principal
            let lateFeePay = Math.min(payAmount, lateFeeDue);
            let interestPay = Math.min(payAmount - lateFeePay, interestDue);
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

        // Create payment with allocations
        const paymentNo = await generatePaymentNo();
        const payment = await prisma.loanPayment.create({
            data: {
                paymentNo,
                loanId: parseInt(id),
                memberId: loan.memberId,
                branchId: loan.branchId,
                amount: data.amount,
                principalPortion: totalPrincipal,
                interestPortion: totalInterest,
                lateFeePortion: totalLateFee,
                paymentMethod: data.paymentMethod,
                cashBankAccountId: data.cashBankAccountId,
                referenceNo: data.referenceNo,
                notes: data.notes,
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

        // Update schedules
        for (const alloc of allocations) {
            const schedule = loan.schedules.find((s) => s.id === alloc.scheduleId)!;
            const newPrincipalPaid = Number(schedule.principalPaid) + alloc.principalAmount;
            const newInterestPaid = Number(schedule.interestPaid) + alloc.interestAmount;
            const newLateFeePaid = Number(schedule.lateFeePaid) + alloc.lateFeeAmount;

            const totalPaid = newPrincipalPaid + newInterestPaid + newLateFeePaid;
            const totalDue = Number(schedule.principalAmount) + Number(schedule.interestAmount) + Number(schedule.lateFee);

            await prisma.loanSchedule.update({
                where: { id: alloc.scheduleId },
                data: {
                    principalPaid: newPrincipalPaid,
                    interestPaid: newInterestPaid,
                    lateFeePaid: newLateFeePaid,
                    status: totalPaid >= totalDue ? "paid" : "partial",
                    paidDate: totalPaid >= totalDue ? data.paymentDate : null,
                },
            });
        }

        // Update loan totals
        await prisma.loan.update({
            where: { id: parseInt(id) },
            data: {
                principalPaid: { increment: totalPrincipal },
                interestPaid: { increment: totalInterest },
                lateFeePaid: { increment: totalLateFee },
                principalOutstanding: { decrement: totalPrincipal },
                interestOutstanding: { decrement: totalInterest },
            },
        });

        // Check if loan is fully paid
        const updatedLoan = await prisma.loan.findUnique({
            where: { id: parseInt(id) },
        });

        if (
            updatedLoan &&
            Number(updatedLoan.principalOutstanding) <= 0 &&
            Number(updatedLoan.interestOutstanding) <= 0
        ) {
            await prisma.loan.update({
                where: { id: parseInt(id) },
                data: {
                    status: "paid_off",
                    paidOffDate: data.paymentDate,
                },
            });
        }

        // ── Post to Cash/Bank (Kas Masuk) ──────────────────────────────
        if (data.cashBankAccountId) {
            const cashBank = await prisma.cashBankAccount.findUnique({
                where: { id: data.cashBankAccountId },
            });

            if (cashBank) {
                // Fetch member name for description
                const member = await prisma.member.findUnique({
                    where: { id: loan.memberId },
                    select: { name: true, memberNo: true },
                });
                const memberLabel = member ? `${member.name} (${member.memberNo})` : `Member #${loan.memberId}`;

                let runningBalance = Number(cashBank.currentBalance);

                // 1. Angsuran Pokok → Kas Masuk
                if (totalPrincipal > 0) {
                    const balBefore = runningBalance;
                    runningBalance += totalPrincipal;
                    const txNoPokok = `CBM-${paymentNo}-P`;
                    await prisma.cashBankTransaction.create({
                        data: {
                            transactionNo: txNoPokok,
                            accountId: data.cashBankAccountId,
                            branchId: loan.branchId,
                            type: "in",
                            category: "angsuran_pokok",
                            amount: totalPrincipal,
                            balanceBefore: balBefore,
                            balanceAfter: runningBalance,
                            referenceType: "LoanPayment",
                            referenceId: payment.id,
                            description: `Angsuran Pokok Pinjaman ${loan.loanNo} — ${memberLabel}`,
                            transactionDate: data.paymentDate,
                            memberId: loan.memberId,
                            createdById: userId,
                        },
                    });
                }

                // 2. Jasa/Bunga Pinjaman → Kas Masuk
                if (totalInterest > 0) {
                    const balBefore = runningBalance;
                    runningBalance += totalInterest;
                    const txNoBunga = `CBM-${paymentNo}-I`;
                    await prisma.cashBankTransaction.create({
                        data: {
                            transactionNo: txNoBunga,
                            accountId: data.cashBankAccountId,
                            branchId: loan.branchId,
                            type: "in",
                            category: "jasa_pinjaman",
                            amount: totalInterest,
                            balanceBefore: balBefore,
                            balanceAfter: runningBalance,
                            referenceType: "LoanPayment",
                            referenceId: payment.id,
                            description: `Jasa/Bunga Pinjaman ${loan.loanNo} — ${memberLabel}`,
                            transactionDate: data.paymentDate,
                            memberId: loan.memberId,
                            createdById: userId,
                        },
                    });
                }

                // 3. Update saldo kas/bank koperasi
                await prisma.cashBankAccount.update({
                    where: { id: data.cashBankAccountId },
                    data: { currentBalance: runningBalance },
                });
            }
        }

        return NextResponse.json({
            data: payment,
            message: "Pembayaran berhasil dicatat",
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/loans/[id]/payments error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create payment" },
            { status: 500 }
        );
    }
}
