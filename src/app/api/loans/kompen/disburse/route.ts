/**
 * POST /api/loans/kompen/disburse
 *
 * Kompen/Rollover: Buat akad baru yang otomatis melunasi akad lama + cairkan selisih.
 * Satu transaksi atomik.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const isOperator = (session.user as any).permissions?.includes("manage_all");
        if (!isOperator) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const body = await request.json();
        const { memberId, existingLoanId, productId, amount, tenorMonths, paymentMethod, cashBankAccountId, backdatedDate } = body;

        if (!memberId || !existingLoanId || !productId || !amount || !tenorMonths) {
            return NextResponse.json({ message: "Data tidak lengkap" }, { status: 400 });
        }

        let baseDate = new Date();
        if (backdatedDate) {
            const parsed = new Date(backdatedDate);
            if (!isNaN(parsed.getTime())) baseDate = parsed;
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Validate member
            const member = await tx.member.findUnique({ where: { id: memberId } });
            if (!member || member.status !== "active") throw new Error("Anggota tidak aktif");

            // 2. Validate existing loan
            const existingLoan = await tx.loan.findUnique({ where: { id: existingLoanId } });
            if (!existingLoan || existingLoan.status !== "active") throw new Error("Pinjaman lama tidak aktif");
            if (existingLoan.memberId !== memberId) throw new Error("Pinjaman bukan milik anggota ini");

            // 3. Validate product
            const product = await tx.loanProduct.findFirst({ where: { id: productId, isActive: true } });
            if (!product) throw new Error("Produk pinjaman tidak ditemukan");

            // 4. Calculate kompen
            const principalOutstanding = Number(existingLoan.principalOutstanding);
            const oldMonthlyInterest = Math.round(Number(existingLoan.principalAmount) * (Number(existingLoan.interestRate) / 100));
            const penaltyFee = existingLoan.tenorMonths <= 24 ? oldMonthlyInterest : oldMonthlyInterest * 2;
            const totalKompen = principalOutstanding + penaltyFee;

            // 5. Calculate new loan
            const interestRate = Number(product.interestRate) || 1;
            const interestPerMonth = Math.round(amount * (interestRate / 100));
            const totalInterest = interestPerMonth * tenorMonths;
            const totalAmount = amount + totalInterest;
            const adminFee = Math.round(amount * (Number(product.adminFeeValue) || 0.02));
            const disbursedToMember = amount - totalKompen - adminFee;
            const monthlyInstallment = Math.round(amount / tenorMonths) + interestPerMonth;

            if (disbursedToMember <= 0) throw new Error("Plafon baru tidak cukup untuk kompen + admin fee");

            // 6. Generate numbers
            const year = baseDate.getFullYear();
            const appNo = `APP-${year}-${Math.floor(Math.random() * 100000).toString().padStart(5, "0")}`;
            const romawi = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

            const lastLoan = await tx.loan.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
            const loanSeq = (lastLoan?.id || 0) + 1;
            const loanNo = `PJM-${year}-${loanSeq.toString().padStart(4, "0")}`;

            // 7. Create LoanApplication
            const application = await tx.loanApplication.create({
                data: {
                    applicationNo: appNo,
                    memberId, branchId: member.branchId, productId,
                    amount, tenorMonths,
                    purpose: `[KOMPEN] Melunasi ${existingLoan.loanNo} dan mencairkan selisih`,
                    notes: `Kompen pinjaman ${existingLoan.loanNo}. Total kompen: Rp ${totalKompen.toLocaleString('id-ID')}. Dana ke anggota: Rp ${disbursedToMember.toLocaleString('id-ID')}`,
                    status: "disbursed",
                    submittedAt: baseDate, approvedAt: baseDate,
                    approvedById: parseInt(session.user.id),
                    createdById: parseInt(session.user.id),
                },
            });

            // 8. Create new Loan
            const firstDue = new Date(baseDate);
            firstDue.setMonth(firstDue.getMonth() + 1);
            firstDue.setDate(28);
            const lastDue = new Date(firstDue);
            lastDue.setMonth(lastDue.getMonth() + tenorMonths - 1);

            const newLoan = await tx.loan.create({
                data: {
                    loanNo,
                    applicationId: application.id,
                    memberId, branchId: member.branchId,
                    productSnapshot: JSON.parse(JSON.stringify(product)),
                    principalAmount: amount,
                    interestAmount: totalInterest,
                    totalAmount,
                    adminFee,
                    disbursedAmount: disbursedToMember,
                    tenorMonths,
                    interestRate,
                    interestMethod: product.interestMethod,
                    monthlyInstallment,
                    principalPaid: 0, interestPaid: 0, lateFeePaid: 0,
                    principalOutstanding: amount,
                    interestOutstanding: totalInterest,
                    disbursementDate: baseDate,
                    firstDueDate: firstDue,
                    lastDueDate: lastDue,
                    status: "active",
                    disbursedById: parseInt(session.user.id),
                    compensatedLoanId: existingLoanId,
                },
            });

            // 9. Create LoanSchedule for new loan
            const principalPerMonth = Math.floor(amount / tenorMonths);
            let principalRemainder = amount - principalPerMonth * tenorMonths;
            const schedules = [];
            for (let i = 1; i <= tenorMonths; i++) {
                const dueDate = new Date(firstDue);
                dueDate.setMonth(dueDate.getMonth() + (i - 1));
                const p = i === tenorMonths ? principalPerMonth + principalRemainder : principalPerMonth;
                schedules.push({
                    loanId: newLoan.id, installmentNo: i,
                    dueDate, principalAmount: p, interestAmount: interestPerMonth,
                    totalAmount: p + interestPerMonth, status: "pending",
                });
            }
            await tx.loanSchedule.createMany({ data: schedules });

            // 10. Payoff existing loan (early settlement)
            const payNo = `PAY-${year}-${Math.floor(Math.random() * 1000000).toString().padStart(6, "0")}`;
            await tx.loanPayment.create({
                data: {
                    paymentNo: payNo,
                    loanId: existingLoanId,
                    memberId,
                    branchId: member.branchId,
                    amount: totalKompen,
                    principalPortion: principalOutstanding,
                    interestPortion: 0,
                    earlySettlementFee: penaltyFee,
                    paymentType: "early_settlement",
                    paymentMethod: paymentMethod || "internal",
                    notes: `[KOMPEN] Pelunasan dari pinjaman baru ${newLoan.loanNo}`,
                    paymentDate: baseDate,
                    createdById: parseInt(session.user.id),
                },
            });

            // 11. Update existing loan to paid_off
            await tx.loan.update({
                where: { id: existingLoanId },
                data: {
                    status: "paid_off",
                    paidOffDate: baseDate,
                    principalOutstanding: 0,
                    interestOutstanding: 0,
                    principalPaid: Number(existingLoan.principalPaid) + principalOutstanding,
                },
            });

            // 12. Mark existing schedules as paid
            await tx.loanSchedule.updateMany({
                where: { loanId: existingLoanId, status: { in: ["pending", "partial", "overdue"] } },
                data: { status: "paid", paidDate: baseDate },
            });

            // 13. CashBank transactions (if account provided)
            if (cashBankAccountId) {
                const cashAccount = await tx.cashBankAccount.findUnique({ where: { id: cashBankAccountId } });
                if (!cashAccount) throw new Error("Rekening kas/bank tidak ditemukan");
                const balBefore = Number(cashAccount.currentBalance);

                const cbRandom = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
                const monthRom = romawi[baseDate.getMonth() + 1];

                // OUT: Disbursement to member
                const balAfterOut = balBefore - disbursedToMember;
                await tx.cashBankTransaction.create({
                    data: {
                        transactionNo: `KK-${cbRandom}/PRIM/${monthRom}/${year}`, accountId: cashBankAccountId, branchId: member.branchId,
                        type: "out", amount: disbursedToMember, balanceBefore: balBefore, balanceAfter: balAfterOut,
                        category: "pencairan_pinjaman",
                        description: `[KOMPEN] Pencairan selisih ke anggota ${member.name} (${newLoan.loanNo})`,
                        transactionDate: baseDate,
                        createdById: parseInt(session.user.id),
                    },
                });
                await tx.cashBankAccount.update({ where: { id: cashBankAccountId }, data: { currentBalance: balAfterOut } });

                // IN: Pelunasan pokok old loan
                const balAfterIn = balAfterOut + principalOutstanding;
                await tx.cashBankTransaction.create({
                    data: {
                        transactionNo: `KM-${cbRandom}/PRIM/${monthRom}/${year}`, accountId: cashBankAccountId, branchId: member.branchId,
                        type: "in", amount: principalOutstanding, balanceBefore: balAfterOut, balanceAfter: balAfterIn,
                        category: "angsuran_pokok",
                        description: `[KOMPEN] Pelunasan pokok ${existingLoan.loanNo} dari ${newLoan.loanNo}`,
                        transactionDate: baseDate,
                        createdById: parseInt(session.user.id),
                    },
                });
                await tx.cashBankAccount.update({ where: { id: cashBankAccountId }, data: { currentBalance: balAfterIn } });

                // IN: Penalti
                if (penaltyFee > 0) {
                    const balAfterPenalty = balAfterIn + penaltyFee;
                    await tx.cashBankTransaction.create({
                        data: {
                            transactionNo: `KM-${cbRandom}-P/PRIM/${monthRom}/${year}`, accountId: cashBankAccountId, branchId: member.branchId,
                            type: "in", amount: penaltyFee, balanceBefore: balAfterIn, balanceAfter: balAfterPenalty,
                            category: "penalti_pelunasan",
                            description: `[KOMPEN] Penalti pelunasan ${existingLoan.loanNo}`,
                            transactionDate: baseDate,
                            createdById: parseInt(session.user.id),
                        },
                    });
                    await tx.cashBankAccount.update({ where: { id: cashBankAccountId }, data: { currentBalance: balAfterPenalty } });
                }
            }

            // 14. Receipt
            const rcptRandom = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
            const rcptNo = `${rcptRandom}/BKK-PKM-KP/PRIM/${romawi[baseDate.getMonth() + 1]}/${year}`;
            const receipt = await tx.receipt.create({
                data: {
                    receiptNo: rcptNo,
                    type: "pinjaman",
                    memberId,
                    referenceNo: newLoan.loanNo,
                    amount,
                    description: `Kompen: ${newLoan.loanNo} melunasi ${existingLoan.loanNo}. Dana ke anggota: Rp ${disbursedToMember.toLocaleString('id-ID')}`,
                    receivedFrom: member.name,
                    paymentMethod: paymentMethod || "cash",
                    receiptDate: baseDate,
                    createdById: parseInt(session.user.id),
                },
            });

            return {
                applicationId: application.id,
                applicationNo: application.applicationNo,
                newLoanId: newLoan.id,
                newLoanNo: newLoan.loanNo,
                existingLoanNo: existingLoan.loanNo,
                totalKompen,
                disbursedToMember,
                adminFee,
                penaltyFee,
                receiptId: receipt.id,
                receiptNo: receipt.receiptNo,
            };
        });

        return NextResponse.json({ data: result, message: "Kompen berhasil diproses" });
    } catch (error: any) {
        console.error("POST /api/loans/kompen/disburse error:", error);
        return NextResponse.json({ message: error.message || "Gagal memproses kompen" }, { status: 500 });
    }
}
