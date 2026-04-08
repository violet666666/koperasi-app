/**
 * POST /api/loans/applications/direct-disburse
 * 
 * Khusus OPERATOR: Membuat pengajuan pinjaman dan langsung mencairkan
 * dalam satu transaksi atomik. Mendukung backdating (input pinjaman lama).
 * 
 * Kwitansi, Jadwal Angsuran, dan data Pinjaman Aktif akan langsung terbuat.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createLoanApplicationSchema } from "@/lib/validations";

function generateApplicationNo(date: Date): string {
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `APP-${year}-${random}`;
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Hanya Operator yang boleh menggunakan endpoint ini
        const isOperator = (session.user as any).permissions?.includes("manage_all");
        if (!isOperator) {
            return NextResponse.json(
                { message: "Endpoint ini hanya untuk Operator. Gunakan alur pengajuan normal." },
                { status: 403 }
            );
        }

        const currentUserId = parseInt(session.user.id);
        const body = await request.json();
        const data = createLoanApplicationSchema.parse(body);

        // Validasi member
        const member = await prisma.member.findUnique({
            where: { id: data.memberId },
            select: { id: true, branchId: true, name: true, status: true },
        });

        if (!member) return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        if (member.status !== "active") return NextResponse.json({ message: "Anggota tidak aktif" }, { status: 400 });

        // Validasi produk pinjaman
        const product = await prisma.loanProduct.findFirst({
            where: { id: data.productId, isActive: true },
        });

        if (!product) return NextResponse.json({ message: "Produk pinjaman tidak ditemukan" }, { status: 404 });

        // Tentukan Base Date (backdating atau saat ini)
        let baseDate = new Date();
        if (data.backdatedDate) {
            const parsed = new Date(data.backdatedDate);
            if (!isNaN(parsed.getTime())) {
                baseDate = parsed;
            }
        }

        // --- Kalkulasi Keuangan ---
        const principalAmount = data.amount;
        const tenorMonths = data.tenorMonths;
        const interestPerMonth = Math.round(principalAmount * 0.01); // 1% flat/bulan
        const totalInterest = interestPerMonth * tenorMonths;
        const totalAmount = principalAmount + totalInterest;
        const adminFee = Math.round(principalAmount * 0.02);         // 2% Potongan Resiko
        const disbursedAmount = principalAmount - adminFee;
        const monthlyInstallment = Math.round(principalAmount / tenorMonths) + interestPerMonth;
        const interestRate = 1; // 1%

        // Nomor kwitansi
        const romawi = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
        const monthRomawi = romawi[baseDate.getMonth() + 1];
        const currentYear = baseDate.getFullYear();
        const receiptRandom = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
        const receiptNo = `${receiptRandom}/BKK-PJM/PRIM/${monthRomawi}/${currentYear}`;

        // Notes: tambahkan backdated tag jika perlu
        let finalNotes = data.notes || "";
        if (data.backdatedDate) {
            const tag = `[BACKDATED_TO:${data.backdatedDate}]`;
            finalNotes = finalNotes ? `${finalNotes}\n${tag}` : tag;
        }

        // --- Atomic Transaction: Buat semua sekaligus ---
        const result = await prisma.$transaction(async (tx) => {
            // 1. Buat LoanApplication (langsung disbursed)
            const applicationNo = generateApplicationNo(baseDate);
            const application = await tx.loanApplication.create({
                data: {
                    applicationNo,
                    memberId: data.memberId,
                    branchId: member.branchId,
                    productId: data.productId,
                    amount: principalAmount,
                    tenorMonths,
                    purpose: data.purpose || "Pencairan Pinjaman",
                    deductionSource: data.deductionSource,
                    notes: finalNotes || null,
                    status: "disbursed",
                    createdById: currentUserId,
                    createdAt: baseDate,
                    submittedAt: baseDate,
                    approvedAt: baseDate,
                    approvedById: currentUserId,
                },
            });

            // 2. Buat Loan Aktif
            const loanYear = baseDate.getFullYear().toString();
            const randomId = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
            const loan = await tx.loan.create({
                data: {
                    loanNo: `PJM-${loanYear}-${randomId}`,
                    applicationId: application.id,
                    memberId: data.memberId,
                    branchId: member.branchId,
                    productSnapshot: JSON.parse(JSON.stringify(product)),
                    principalAmount,
                    interestAmount: totalInterest,
                    totalAmount,
                    adminFee,
                    disbursedAmount,
                    tenorMonths,
                    interestRate,
                    interestMethod: product.interestMethod || "flat",
                    monthlyInstallment,
                    principalOutstanding: principalAmount,
                    interestOutstanding: totalInterest,
                    disbursementDate: baseDate,
                    firstDueDate: new Date(new Date(baseDate).setMonth(baseDate.getMonth() + 1)),
                    lastDueDate: new Date(new Date(baseDate).setMonth(baseDate.getMonth() + tenorMonths)),
                    disbursedById: currentUserId,
                    status: "active",
                },
            });

            // 3. Buat Jadwal Angsuran (LoanSchedule)
            const schedules = [];
            for (let i = 1; i <= tenorMonths; i++) {
                const dueDate = new Date(baseDate);
                dueDate.setMonth(dueDate.getMonth() + i);
                schedules.push({
                    loanId: loan.id,
                    installmentNo: i,
                    dueDate,
                    principalAmount: Math.floor(principalAmount / tenorMonths),
                    interestAmount: Math.floor(totalInterest / tenorMonths),
                    totalAmount: Math.floor(totalAmount / tenorMonths),
                    status: "pending",
                });
            }
            // Koreksi rounding di angsuran terakhir
            const installedPrincipal = Math.floor(principalAmount / tenorMonths) * tenorMonths;
            const installedInterest = Math.floor(totalInterest / tenorMonths) * tenorMonths;
            schedules[tenorMonths - 1].principalAmount += (principalAmount - installedPrincipal);
            schedules[tenorMonths - 1].interestAmount += (totalInterest - installedInterest);
            schedules[tenorMonths - 1].totalAmount =
                schedules[tenorMonths - 1].principalAmount + schedules[tenorMonths - 1].interestAmount;

            await tx.loanSchedule.createMany({ data: schedules });

            // 4. Buat Kwitansi (Receipt)
            const receipt = await tx.receipt.create({
                data: {
                    receiptNo,
                    type: "pinjaman",
                    memberId: data.memberId,
                    amount: disbursedAmount,
                    receivedFrom: member.name,
                    description: `Pencairan Pinjaman Bersih (Setelah Dipotong Biaya Resiko) untuk ${member.name} sejumlah ${disbursedAmount}`,
                    paymentMethod: "cash",
                    receiptDate: baseDate,
                    createdById: currentUserId,
                },
            });

            return {
                applicationId: application.id,
                applicationNo: application.applicationNo,
                loanId: loan.id,
                loanNo: loan.loanNo,
                receiptId: receipt.id,
                receiptNo: receipt.receiptNo,
                disbursedAmount,
                baseDate: baseDate.toISOString(),
            };
        });

        return NextResponse.json({
            message: `Pinjaman berhasil dicairkan & kwitansi diterbitkan!`,
            ...result,
        }, { status: 201 });

    } catch (error: any) {
        console.error("POST /api/loans/applications/direct-disburse error:", error);
        if (error?.name === "ZodError") {
            return NextResponse.json({ message: "Validasi gagal", errors: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { message: "Gagal memproses direct disburse: " + error.message },
            { status: 500 }
        );
    }
}
