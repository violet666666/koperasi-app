import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const allowedRoles = ["operator"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ message: "Tidak ada izin melakukan pencairan" }, { status: 403 });
        }

        const { id } = await params;
        
        const application = await prisma.loanApplication.findUnique({
            where: { id: parseInt(id) },
            include: { product: true, member: true }
        });

        if (!application) {
            return NextResponse.json({ message: "Pengajuan tidak ditemukan" }, { status: 404 });
        }

        if (application.status !== "approved") {
            return NextResponse.json({ message: "Pengajuan belum di-approve atau sudah dicairkan" }, { status: 400 });
        }

        const product = application.product;
        // Bunga Pinjaman: from product configuration
        // Potongan Resiko: 2% dari Plafon, potong di depan saat pencairan
        const principalAmount = Number(application.amount);
        const tenorMonths = application.tenorMonths;
        const interestRate = Number(product.interestRate) || 1;

        const adminFee = Math.round(principalAmount * 0.02); // 2% Potongan Resiko
        const interestPerMonth = Math.round(principalAmount * (interestRate / 100));
        const totalInterest = interestPerMonth * tenorMonths; 
        const totalAmount = principalAmount + totalInterest;
        const monthlyInstallment = Math.round(principalAmount / tenorMonths) + interestPerMonth;
        const disbursedAmount = principalAmount - adminFee; // Dana bersih cair

        const currentUserId = parseInt(session.user.id);

        // Transaction Block for Disbursement
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update Application status
            await tx.loanApplication.update({
                where: { id: application.id },
                data: { status: "disbursed" }
            });

            // Parse Base Date for Backdating
            let baseDate = new Date();
            if (application.notes) {
                const backdateMatch = application.notes.match(/\[BACKDATED_TO:(.*?)\]/);
                if (backdateMatch && backdateMatch[1]) {
                    const parsedDate = new Date(backdateMatch[1]);
                    if (!isNaN(parsedDate.getTime())) {
                        baseDate = parsedDate;
                    }
                }
            }

            // 2. Generate new Loan
            const dateStr = baseDate.getFullYear().toString();
            const lastLoan = await tx.loan.findFirst({
                where: { loanNo: { startsWith: `PJM-${dateStr}-` } },
                orderBy: { loanNo: 'desc' },
                select: { loanNo: true },
            });
            let seq = 1;
            if (lastLoan) {
                const match = lastLoan.loanNo.match(/PJM-\d{4}-(\d+)/);
                if (match) seq = parseInt(match[1], 10) + 1;
            }
            const loanNo = `PJM-${dateStr}-${seq.toString().padStart(4, "0")}`;
            const newLoan = await tx.loan.create({
                data: {
                    loanNo,
                    applicationId: application.id,
                    memberId: application.memberId,
                    branchId: application.branchId,
                    productSnapshot: JSON.parse(JSON.stringify(product)),
                    principalAmount,
                    interestAmount: totalInterest,
                    totalAmount,
                    adminFee,
                    disbursedAmount,
                    tenorMonths,
                    interestRate,
                    interestMethod: product.interestMethod,
                    monthlyInstallment,
                    principalOutstanding: principalAmount,
                    interestOutstanding: totalInterest,
                    disbursementDate: baseDate,
                    firstDueDate: new Date(new Date(baseDate).setMonth(baseDate.getMonth() + 1)),
                    lastDueDate: new Date(new Date(baseDate).setMonth(baseDate.getMonth() + tenorMonths)),
                    disbursedById: currentUserId,
                    status: "active",
                }
            });

            // 3. Create Schedules
            const schedules = [];
            let currentPrincipal = principalAmount;
            
            for (let i = 1; i <= tenorMonths; i++) {
                const dueDate = new Date(baseDate);
                dueDate.setMonth(dueDate.getMonth() + i);
                
                schedules.push({
                    loanId: newLoan.id,
                    installmentNo: i,
                    dueDate,
                    principalAmount: Math.floor(principalAmount / tenorMonths),
                    interestAmount: Math.floor(totalInterest / tenorMonths),
                    totalAmount: Math.floor(totalAmount / tenorMonths),
                    status: "pending"
                });
            }
            // Fix last installment rounding
            const installedPrincipal = Math.floor(principalAmount / tenorMonths) * tenorMonths;
            const installedInterest = Math.floor(totalInterest / tenorMonths) * tenorMonths;
            
            schedules[tenorMonths - 1].principalAmount += (principalAmount - installedPrincipal);
            schedules[tenorMonths - 1].interestAmount += (totalInterest - installedInterest);
            schedules[tenorMonths - 1].totalAmount = schedules[tenorMonths - 1].principalAmount + schedules[tenorMonths - 1].interestAmount;

            await tx.loanSchedule.createMany({ data: schedules });

            // 4. Record cash outflow (disbursement)
            const cashAccount = await tx.cashBankAccount.findFirst({
                where: { branchId: application.branchId, isActive: true },
                orderBy: { id: 'asc' },
            });

            if (cashAccount) {
                const balBefore = Number(cashAccount.currentBalance);
                const balAfter = balBefore - disbursedAmount;

                const cbTx = await tx.cashBankTransaction.create({
                    data: {
                        transactionNo: `CBM-PJM-${newLoan.loanNo}`,
                        accountId: cashAccount.id,
                        branchId: application.branchId,
                        type: "out",
                        category: "pencairan_pinjaman",
                        amount: disbursedAmount,
                        balanceBefore: balBefore,
                        balanceAfter: balAfter,
                        referenceType: "Loan",
                        referenceId: newLoan.id,
                        unitType: "simpan_pinjam",
                        description: `Pencairan Pinjaman ${newLoan.loanNo} untuk ${application.member.name}`,
                        transactionDate: baseDate,
                        memberId: application.memberId,
                        createdById: currentUserId,
                    },
                });

                await tx.cashBankAccount.update({
                    where: { id: cashAccount.id },
                    data: { currentBalance: balAfter },
                });

                await tx.loan.update({
                    where: { id: newLoan.id },
                    data: { disbursementCashBankId: cashAccount.id },
                });
            }

            // 5. Create Kwitansi (Receipt) for Disbursement
            const receiptRandom = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
            const romawi = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
            const monthRomawi = romawi[baseDate.getMonth() + 1] ?? "I";
            const currentYear = baseDate.getFullYear();
            
            const receipt = await tx.receipt.create({
                data: {
                    receiptNo: `${receiptRandom}/BKK-PJM/PRIM/${monthRomawi}/${currentYear}`,
                    type: "pinjaman",
                    memberId: application.memberId,
                    amount: disbursedAmount,
                    receivedFrom: application.member.name,
                    description: `Pencairan Pinjaman Bersih (Setelah Dipotong Biaya Resiko) untuk ${application.member.name} sejumlah ${disbursedAmount}`,
                    paymentMethod: "cash",
                    receiptDate: baseDate,
                    createdById: currentUserId,
                }
            });

            return { loanId: newLoan.id, receiptId: receipt.id };
        });

        return NextResponse.json({ message: "Pencairan berhasil dicatat!", ...result });
    } catch (error) {
        console.error("POST /api/loans/applications/disburse error:", error);
        return NextResponse.json({ message: "Gagal memproses pencairan. " + (error as any).message }, { status: 500 });
    }
}
