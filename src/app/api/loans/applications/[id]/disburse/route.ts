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
        const allowedRoles = ["operator", "admin", "super_admin"];
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
        // Bunga Pinjaman: 1% Flat per bulan dari Plafon
        // Potongan Resiko: 2% dari Plafon, potong di depan saat pencairan
        const principalAmount = Number(application.amount);
        const tenorMonths = application.tenorMonths;
        const interestRate = 1; // 1%
        
        const adminFee = Math.round(principalAmount * 0.02); // 2% Potongan Resiko
        const interestPerMonth = Math.round(principalAmount * 0.01); // Bunga 1% per bulan
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
                    disbursedAmount,
                    tenorMonths,
                    interestRate,
                    interestMethod: product.interestMethod,
                    monthlyInstallment,
                    principalOutstanding: principalAmount,
                    interestOutstanding: totalInterest,
                    disbursementDate: new Date(),
                    firstDueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                    lastDueDate: new Date(new Date().setMonth(new Date().getMonth() + tenorMonths)),
                    disbursedById: currentUserId,
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

            // 4. Create Kvintasi (Receipt) for Disbursement
            const receiptRandom = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
            const receipt = await tx.receipt.create({
                data: {
                    receiptNo: `KWT-PJM-${dateStr}-${receiptRandom}`,
                    type: "pinjaman",
                    memberId: application.memberId,
                    amount: disbursedAmount,
                    receivedFrom: application.member.name,
                    description: `Pencairan Pinjaman Bersih (Setelah Dipotong Biaya Resiko) untuk ${application.member.name} sejumlah ${disbursedAmount}`,
                    paymentMethod: "cash",
                    receiptDate: new Date(),
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
