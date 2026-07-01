import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware"; // adjust path if needed
import { createLoanApplicationSchema } from "@/lib/validations";
import { resolveCashBankAccount } from "@/lib/kas-bank-loan-helpers";

function generateApplicationNo(date: Date): string {
    const year = date.getFullYear();
    const random = (crypto.randomBytes(4).readUInt32BE(0) % 100000).toString().padStart(5, "0");
    return `APP-${year}-${random}`;
}

export async function POST(request: Request) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();

        // Hanya Operator yang boleh menggunakan endpoint ini
        // Note: Check permissions array if available, otherwise check role
        const isOperator = user.role === "operator" || user.role === "admin" || user.role === "admin_sp" || user.permissions?.includes("manage_all");
        if (!isOperator) {
            return NextResponse.json(
                { message: "Endpoint ini hanya untuk Operator. Gunakan alur pengajuan normal." },
                { status: 403 }
            );
        }

        const currentUserId = parseInt(String(user.id));
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
        const interestPerMonth = Math.round(principalAmount * (product.interestRate / 100));
        const totalInterest = interestPerMonth * tenorMonths;
        const totalAmount = principalAmount + totalInterest;
        const adminFee = Math.round(principalAmount * (product.adminFeeValue / 100));
        const disbursedAmount = principalAmount - adminFee;
        const monthlyInstallment = Math.round(principalAmount / tenorMonths) + interestPerMonth;
        const interestRate = product.interestRate;

        // Nomor kwitansi
        const romawi = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
        const monthRomawi = romawi[baseDate.getMonth() + 1];
        const currentYear = baseDate.getFullYear();
        let receiptNo = ``;

        // Notes: tambahkan backdated tag jika perlu
        let finalNotes = data.notes || "";
        if (data.backdatedDate) {
            const tag = `[BACKDATED_TO:${data.backdatedDate}]`;
            finalNotes = finalNotes ? `${finalNotes}\n${tag}` : tag;
        }

        // --- Atomic Transaction: Buat semua sekaligus ---
        const result = await prisma.$transaction(async (tx) => {
            // Generate sequence receipt
            const count = await tx.receipt.count({
                where: {
                    receiptNo: { endsWith: `/BKK-PJM/PRIM/${monthRomawi}/${currentYear}` }
                }
            });
            const receiptSeq = (count + 1).toString().padStart(4, "0");
            receiptNo = `${receiptSeq}/BKK-PJM/PRIM/${monthRomawi}/${currentYear}`;

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
            const countLoan = await tx.loan.count({
                where: { loanNo: { startsWith: `PJM-${loanYear}-` } }
            });
            const loanIdSeq = (countLoan + 1).toString().padStart(4, "0");
            const loan = await tx.loan.create({
                data: {
                    loanNo: `PJM-${loanYear}-${loanIdSeq}`,
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
                    description: `Pencairan Pinjaman Bersih (Setelah dipotong administrasi) untuk ${member.name} sejumlah ${disbursedAmount}`,
                    paymentMethod: "cash",
                    receiptDate: baseDate,
                    createdById: currentUserId,
                },
            });

            // 5. Record cash outflow (disbursement) to Cash/Bank
            // Gunakan akun kas/bank yang dipilih operator, fallback auto-detect jika tidak disediakan
            const cashAccount = await resolveCashBankAccount(tx, {
                cashBankAccountId: data.cashBankAccountId || null,
                branchId: member.branchId,
                preferredType: "cash",
            });

            if (!cashAccount) {
                throw new Error("Tidak ada akun kas/bank aktif untuk pencairan. Hubungi operator.");
            }

            {
                const balBefore = Number(cashAccount.currentBalance);
                const balAfter = balBefore - disbursedAmount;

                await tx.cashBankTransaction.create({
                    data: {
                        transactionNo: `CBM-PJM-${loan.loanNo}`,
                        accountId: cashAccount.id,
                        branchId: member.branchId,
                        type: "out",
                        category: "pencairan_pinjaman",
                        amount: disbursedAmount,
                        balanceBefore: balBefore,
                        balanceAfter: balAfter,
                        referenceType: "Loan",
                        referenceId: loan.id,
                        unitType: "simpan_pinjam",
                        description: `Pencairan Pinjaman ${loan.loanNo} untuk ${member.name}`,
                        transactionDate: baseDate,
                        memberId: data.memberId,
                        createdById: currentUserId,
                    },
                });

                await tx.cashBankAccount.update({
                    where: { id: cashAccount.id },
                    data: { currentBalance: balAfter },
                });

                await tx.loan.update({
                    where: { id: loan.id },
                    data: { disbursementCashBankId: cashAccount.id },
                });
            }

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
        console.error("POST /api/mobile/loans-operator/direct-disburse error:", error);
        if (error?.name === "ZodError") {
            return NextResponse.json({ message: "Validasi gagal", errors: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { message: "Gagal memproses direct disburse: " + error.message },
            { status: 500 }
        );
    }
}
