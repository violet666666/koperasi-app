import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

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

// POST /api/mobile/loan-payment — Record a loan installment or early settlement payment
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin") {
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
            include: { member: { select: { name: true } }, application: { select: { product: { select: { name: true } } } } },
        });

        if (!loan || !["active", "overdue"].includes(loan.status)) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan atau sudah lunas" }, { status: 404 });
        }

        const principalOut = Number(loan.principalOutstanding);
        const interestOut = Number(loan.interestOutstanding);

        if (isEarlySettlement) {
            // ═══ PELUNASAN DIPERCEPAT ═══
            // Kebijakan: Total = Sisa Pokok + Penalti (TANPA bunga/jasa)
            const principalAmount = Number(loan.principalAmount);
            const interestRate = Number(loan.interestRate || 1);
            const monthlyInterest = Math.round(principalAmount * (interestRate / 100));
            const penaltyMultiplier = loan.tenorMonths <= 24 ? 1 : 2;
            const penaltyFee = monthlyInterest * penaltyMultiplier;
            const expectedTotal = principalOut + penaltyFee;

            // Validate amount matches expected
            if (Math.abs(numAmount - expectedTotal) > 100) {
                return NextResponse.json({
                    message: `Jumlah pelunasan tidak sesuai. Harus ${expectedTotal.toLocaleString("id-ID")} (Pokok: ${principalOut.toLocaleString("id-ID")} + Penalti: ${penaltyFee.toLocaleString("id-ID")})`,
                }, { status: 400 });
            }

            const paymentNo = `PAY-M-SET-${Date.now()}`;
            const today = new Date();

            // Forward to web API for consistent processing
            // OR process directly with same logic
            const transactions: any[] = [
                // 1. Create payment record
                prisma.loanPayment.create({
                    data: {
                        paymentNo,
                        loanId: Number(loanId),
                        memberId: loan.memberId,
                        branchId: 1,
                        amount: numAmount,
                        principalPortion: principalOut,
                        interestPortion: 0, // Pelunasan tanpa bunga
                        lateFee: penaltyFee,
                        paymentDate: today,
                        paymentType: "early_settlement",
                        notes: notes || `Pelunasan Dipercepat via mobile (Penalti ${penaltyMultiplier}× bunga)`,
                        createdById: Number(user.id),
                    },
                }),
                // 2. Update loan to paid_off
                prisma.loan.update({
                    where: { id: Number(loanId) },
                    data: {
                        principalOutstanding: 0,
                        interestOutstanding: 0,
                        principalPaid: { increment: principalOut },
                        lateFeePaid: { increment: penaltyFee },
                        status: "paid_off",
                        paidOffDate: today,
                    },
                }),
                // 3. Update all pending schedules to paid
                prisma.loanSchedule.updateMany({
                    where: { loanId: Number(loanId), status: { in: ["pending", "partial", "overdue"] } },
                    data: { status: "paid" },
                }),
            ];

            // 4. Create kas/bank entries if account selected
            if (cashBankAccountId) {
                transactions.push(
                    // Kas masuk - pokok
                    prisma.cashBankTransaction.create({
                        data: {
                            cashBankAccountId: Number(cashBankAccountId),
                            transactionDate: today,
                            type: "masuk",
                            category: "angsuran_pokok",
                            amount: principalOut,
                            description: `Pelunasan pokok pinjaman ${loan.loanNo} (${loan.member.name})`,
                            referenceNo: paymentNo,
                            createdById: Number(user.id),
                        },
                    }),
                    // Kas masuk - penalti
                    prisma.cashBankTransaction.create({
                        data: {
                            cashBankAccountId: Number(cashBankAccountId),
                            transactionDate: today,
                            type: "masuk",
                            category: "penalti_pelunasan",
                            amount: penaltyFee,
                            description: `Penalti pelunasan ${penaltyMultiplier}× bunga - ${loan.loanNo} (${loan.member.name})`,
                            referenceNo: paymentNo,
                            createdById: Number(user.id),
                        },
                    }),
                    // Update saldo kas/bank
                    prisma.cashBankAccount.update({
                        where: { id: Number(cashBankAccountId) },
                        data: { currentBalance: { increment: numAmount } },
                    }),
                );
            }

            await prisma.$transaction(transactions);

            await logAudit({
                userId: Number(user.id),
                userName: user.name,
                action: "CREATE",
                module: "Pinjaman",
                description: `PELUNASAN DIPERCEPAT ${loan.loanNo} (${loan.member.name}) - Total: Rp ${numAmount.toLocaleString("id-ID")} (Pokok: ${principalOut.toLocaleString("id-ID")} + Penalti: ${penaltyFee.toLocaleString("id-ID")}) via mobile`,
                ipAddress: "mobile-app",
            });

            return NextResponse.json({
                message: `Pinjaman ${loan.loanNo} LUNAS! 🎉 (Pelunasan Dipercepat)`,
                data: {
                    newPrincipalOutstanding: 0,
                    newInterestOutstanding: 0,
                    penaltyFee,
                    status: "paid_off",
                },
            });
        }

        // ═══ ANGSURAN REGULER ═══
        const interestPortion = Math.min(numAmount, interestOut);
        const principalPortion = Math.min(numAmount - interestPortion, principalOut);
        const newPrincipalOut = principalOut - principalPortion;
        const newInterestOut = interestOut - interestPortion;
        const newStatus = (newPrincipalOut <= 0 && newInterestOut <= 0) ? "paid" : loan.status;

        const paymentNo = `PAY-M-${Date.now()}`;

        const transactions: any[] = [
            prisma.loanPayment.create({
                data: {
                    paymentNo,
                    loanId: Number(loanId),
                    memberId: loan.memberId,
                    branchId: 1,
                    amount: numAmount,
                    principalPortion,
                    interestPortion,
                    paymentDate: new Date(),
                    notes: notes || "Angsuran via mobile",
                    createdById: Number(user.id),
                },
            }),
            prisma.loan.update({
                where: { id: Number(loanId) },
                data: {
                    principalOutstanding: newPrincipalOut,
                    interestOutstanding: newInterestOut,
                    principalPaid: { increment: principalPortion },
                    interestPaid: { increment: interestPortion },
                    status: newStatus,
                },
            }),
        ];

        // Kas/bank entries for regular installment
        if (cashBankAccountId) {
            if (principalPortion > 0) {
                transactions.push(
                    prisma.cashBankTransaction.create({
                        data: {
                            cashBankAccountId: Number(cashBankAccountId),
                            transactionDate: new Date(),
                            type: "masuk",
                            category: "angsuran_pokok",
                            amount: principalPortion,
                            description: `Angsuran pokok ${loan.loanNo} (${loan.member.name})`,
                            referenceNo: paymentNo,
                            createdById: Number(user.id),
                        },
                    }),
                );
            }
            if (interestPortion > 0) {
                transactions.push(
                    prisma.cashBankTransaction.create({
                        data: {
                            cashBankAccountId: Number(cashBankAccountId),
                            transactionDate: new Date(),
                            type: "masuk",
                            category: "jasa_pinjaman",
                            amount: interestPortion,
                            description: `Jasa/bunga pinjaman ${loan.loanNo} (${loan.member.name})`,
                            referenceNo: paymentNo,
                            createdById: Number(user.id),
                        },
                    }),
                );
            }
            transactions.push(
                prisma.cashBankAccount.update({
                    where: { id: Number(cashBankAccountId) },
                    data: { currentBalance: { increment: numAmount } },
                }),
            );
        }

        await prisma.$transaction(transactions);

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "CREATE",
            module: "Pinjaman",
            description: `Angsuran Rp ${numAmount.toLocaleString("id-ID")} untuk pinjaman ${loan.loanNo} (${loan.member.name}) via mobile`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: newStatus === "paid" ? "Pinjaman LUNAS! 🎉" : "Angsuran berhasil dicatat",
            data: { newPrincipalOutstanding: newPrincipalOut, newInterestOutstanding: newInterestOut, status: newStatus },
        });
    } catch (error) {
        console.error("POST /api/mobile/loan-payment error:", error);
        return NextResponse.json({ message: "Gagal memproses angsuran" }, { status: 500 });
    }
}
