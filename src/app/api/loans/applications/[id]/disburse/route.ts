import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
    try {
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
        // Bunga Pinjaman calculation (Flat) -> Rate is Year. Monthly = Rate / 12
        const principalAmount = Number(application.amount);
        const tenorMonths = application.tenorMonths;
        const interestRate = Number(product.interestRate); // e.g. 3.6 yearly
        
        const totalInterest = Math.round(principalAmount * (interestRate / 100) * (tenorMonths / 12));
        const totalAmount = principalAmount + totalInterest;
        const monthlyInstallment = Math.round(totalAmount / tenorMonths);
        const adminFee = Math.round(principalAmount * (Number(product.adminFeeValue) / 100)); // percent admin fee

        // Transaction Block for Disbursement
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update Application status
            await tx.loanApplication.update({
                where: { id: application.id },
                data: { status: "disbursed" }
            });

            // 2. Generate new Loan
            const dateStr = new Date().getFullYear().toString();
            const randomId = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
            const newLoan = await tx.loan.create({
                data: {
                    loanNo: `PJM-${dateStr}-${randomId}`,
                    applicationId: application.id,
                    memberId: application.memberId,
                    branchId: application.branchId,
                    productSnapshot: JSON.parse(JSON.stringify(product)),
                    principalAmount,
                    interestAmount: totalInterest,
                    totalAmount,
                    adminFee,
                    disbursedAmount: principalAmount - adminFee,
                    tenorMonths,
                    interestRate,
                    interestMethod: product.interestMethod,
                    monthlyInstallment,
                    principalOutstanding: principalAmount,
                    interestOutstanding: totalInterest,
                    disbursementDate: new Date(),
                    firstDueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                    lastDueDate: new Date(new Date().setMonth(new Date().getMonth() + tenorMonths)),
                    status: "active",
                }
            });

            // 3. Create Schedules
            const schedules = [];
            let currentPrincipal = principalAmount;
            
            for (let i = 1; i <= tenorMonths; i++) {
                const dueDate = new Date();
                dueDate.setMonth(dueDate.getMonth() + i);
                
                schedules.push({
                    loanId: newLoan.id,
                    installmentNo: i,
                    dueDate,
                    principalAmount: Math.round(principalAmount / tenorMonths),
                    interestAmount: Math.round(totalInterest / tenorMonths),
                    totalAmount: monthlyInstallment,
                    status: "pending"
                });
            }
            // Fix last installment rounding
            const installedPrincipal = Math.round(principalAmount / tenorMonths) * tenorMonths;
            if (installedPrincipal !== principalAmount) {
                schedules[tenorMonths - 1].principalAmount += (principalAmount - installedPrincipal);
                schedules[tenorMonths - 1].totalAmount = schedules[tenorMonths - 1].principalAmount + schedules[tenorMonths - 1].interestAmount;
            }
            await tx.loanSchedule.createMany({ data: schedules });

            // 4. Create Kvintasi (Receipt) for Disbursement
            const receiptRandom = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
            const receipt = await tx.receipt.create({
                data: {
                    receiptNo: `KWT-PJM-${dateStr}-${receiptRandom}`,
                    type: "pinjaman",
                    memberId: application.memberId,
                    amount: principalAmount,
                    receivedFrom: application.member.name,
                    description: `Pencairan Pinjaman (Kwitansi Bukti Penghadapan) untuk ${application.member.name} sejumlah ${principalAmount}`,
                    paymentMethod: "cash",
                    receiptDate: new Date(),
                    createdById: 1, // session id
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
