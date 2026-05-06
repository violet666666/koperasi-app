import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

// POST /api/mobile/loans-operator/kompen-disburse — Mobile kompen execution
export async function POST(request: Request) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();
        if (!["operator", "admin", "admin_sp"].includes(user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { memberId, existingLoanId, productId, amount, tenorMonths, backdatedDate } = body;

        if (!memberId || !existingLoanId || !productId || !amount || !tenorMonths) {
            return NextResponse.json({ message: "Data tidak lengkap" }, { status: 400 });
        }

        let baseDate = new Date();
        if (backdatedDate) {
            const parsed = new Date(backdatedDate);
            if (!isNaN(parsed.getTime())) baseDate = parsed;
        }

        const result = await prisma.$transaction(async (tx) => {
            const member = await tx.member.findUnique({ where: { id: memberId } });
            if (!member || member.status !== "active") throw new Error("Anggota tidak aktif");

            const existingLoan = await tx.loan.findUnique({ where: { id: existingLoanId } });
            if (!existingLoan || existingLoan.status !== "active") throw new Error("Pinjaman lama tidak aktif");
            if (existingLoan.memberId !== memberId) throw new Error("Pinjaman bukan milik anggota ini");

            const product = await tx.loanProduct.findFirst({ where: { id: productId, isActive: true } });
            if (!product) throw new Error("Produk pinjaman tidak ditemukan");

            const principalOutstanding = Number(existingLoan.principalOutstanding);
            const oldMonthlyInterest = Math.round(Number(existingLoan.principalAmount) * (Number(existingLoan.interestRate) / 100));
            const penaltyFee = existingLoan.tenorMonths <= 24 ? oldMonthlyInterest : oldMonthlyInterest * 2;
            const totalKompen = principalOutstanding + penaltyFee;

            const interestRate = Number(product.interestRate) || 1;
            const interestPerMonth = Math.round(amount * (interestRate / 100));
            const totalInterest = interestPerMonth * tenorMonths;
            const totalAmount = amount + totalInterest;
            const adminFee = product.adminFeeType === "fixed"
                ? Number(product.adminFeeValue) || 0
                : Math.round(amount * (Number(product.adminFeeValue) || 0.02));
            const disbursedToMember = amount - totalKompen - adminFee;
            const monthlyInstallment = Math.round(amount / tenorMonths) + interestPerMonth;

            if (disbursedToMember <= 0) throw new Error("Plafon baru tidak cukup untuk kompen + admin fee");

            const year = baseDate.getFullYear();
            const romawi = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

            const appNo = `APP-${year}-${Math.floor(Math.random() * 100000).toString().padStart(5, "0")}`;
            const lastLoan = await tx.loan.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
            const loanSeq = (lastLoan?.id || 0) + 1;
            const loanNo = `PJM-${year}-${loanSeq.toString().padStart(4, "0")}`;

            const application = await tx.loanApplication.create({
                data: {
                    applicationNo: appNo, memberId, branchId: member.branchId, productId,
                    amount, tenorMonths,
                    purpose: `[KOMPEN MOBILE] Melunasi ${existingLoan.loanNo}`,
                    notes: `Total kompen: ${totalKompen}. Dana ke anggota: ${disbursedToMember}`,
                    status: "disbursed", submittedAt: baseDate, approvedAt: baseDate,
                    approvedById: parseInt(user.id), createdById: parseInt(user.id),
                },
            });

            const firstDue = new Date(baseDate);
            firstDue.setMonth(firstDue.getMonth() + 1); firstDue.setDate(28);
            const lastDue = new Date(firstDue);
            lastDue.setMonth(lastDue.getMonth() + tenorMonths - 1);

            const newLoan = await tx.loan.create({
                data: {
                    loanNo, applicationId: application.id, memberId, branchId: member.branchId,
                    productSnapshot: JSON.parse(JSON.stringify(product)),
                    principalAmount: amount, interestAmount: totalInterest, totalAmount,
                    adminFee, disbursedAmount: disbursedToMember, tenorMonths,
                    interestRate, interestMethod: product.interestMethod, monthlyInstallment,
                    principalPaid: 0, interestPaid: 0, lateFeePaid: 0,
                    principalOutstanding: amount, interestOutstanding: totalInterest,
                    disbursementDate: baseDate, firstDueDate: firstDue, lastDueDate: lastDue,
                    status: "active", disbursedById: parseInt(user.id),
                    compensatedLoanId: existingLoanId,
                },
            });

            const principalPerMonth = Math.floor(amount / tenorMonths);
            const principalRemainder = amount - principalPerMonth * tenorMonths;
            const schedules = [];
            for (let i = 1; i <= tenorMonths; i++) {
                const dueDate = new Date(firstDue);
                dueDate.setMonth(dueDate.getMonth() + (i - 1));
                const p = i === tenorMonths ? principalPerMonth + principalRemainder : principalPerMonth;
                schedules.push({ loanId: newLoan.id, installmentNo: i, dueDate, principalAmount: p, interestAmount: interestPerMonth, totalAmount: p + interestPerMonth, status: "pending" });
            }
            await tx.loanSchedule.createMany({ data: schedules });

            const preKompenState = JSON.stringify({
                principalOutstanding: Number(existingLoan.principalOutstanding),
                interestOutstanding: Number(existingLoan.interestOutstanding),
                principalPaid: Number(existingLoan.principalPaid),
            });
            const payNo = `PAY-${year}-${Math.floor(Math.random() * 1000000).toString().padStart(6, "0")}`;
            await tx.loanPayment.create({
                data: {
                    paymentNo: payNo, loanId: existingLoanId, memberId, branchId: member.branchId,
                    amount: totalKompen, principalPortion: principalOutstanding, interestPortion: 0,
                    earlySettlementFee: penaltyFee, paymentType: "early_settlement",
                    notes: `[KOMPEN MOBILE] Pelunasan dari ${newLoan.loanNo}`,
                    referenceNo: preKompenState,
                    paymentDate: baseDate, createdById: parseInt(user.id),
                },
            });

            await tx.loan.update({
                where: { id: existingLoanId },
                data: { status: "paid_off", paidOffDate: baseDate, principalOutstanding: 0, interestOutstanding: 0, principalPaid: Number(existingLoan.principalPaid) + principalOutstanding },
            });

            await tx.loanSchedule.updateMany({
                where: { loanId: existingLoanId, status: { in: ["pending", "partial", "overdue"] } },
                data: { status: "paid", paidDate: baseDate },
            });

            return {
                newLoanId: newLoan.id, newLoanNo: newLoan.loanNo,
                existingLoanNo: existingLoan.loanNo, totalKompen,
                disbursedToMember, adminFee, penaltyFee,
            };
        });

        return NextResponse.json({ data: result, message: "Kompen berhasil diproses" });
    } catch (error: any) {
        console.error("POST /api/mobile/loans-operator/kompen-disburse error:", error);
        return NextResponse.json({ message: error.message || "Gagal memproses kompen" }, { status: 500 });
    }
}
