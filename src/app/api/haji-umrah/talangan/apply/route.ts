import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createTalanganSchema, AUTO_DISBURSE_THRESHOLD } from "@/lib/validations/haji-umrah";
import crypto from "crypto";

// POST /api/haji-umrah/talangan/apply — Create talangan application (+ optional auto-disburse)
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const roleName = (session.user as Record<string, unknown>).role?.name || (session.user as Record<string, unknown>).role;
        const unitType = (session.user as Record<string, unknown>).unitType;
        const userId = parseInt(String(session.user.id));

        // RBAC: operator or admin haji_umrah only
        if (roleName !== "operator" && !(roleName === "admin" && unitType === "haji_umrah")) {
            return NextResponse.json({ message: "Forbidden — operator or haji_umrah admin only" }, { status: 403 });
        }

        const body = await request.json();
        const parsed = createTalanganSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Validasi gagal", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
        }
        const { savingsAccountId, productId, amount, tenorMonths, deductionSource, cashBankAccountId, notes, autoDisburse } = parsed.data;

        // 1. Validate savings account exists and is active
        const savingsAccount = await prisma.savingsAccount.findUnique({
            where: { id: savingsAccountId },
            include: {
                member: { select: { id: true, name: true, nrp: true, status: true } },
                product: { select: { id: true, code: true, name: true, type: true } },
                talanganLoans: { where: { status: "active" }, select: { id: true } },
            },
        });

        if (!savingsAccount) {
            return NextResponse.json({ message: "Rekening tabungan tidak ditemukan" }, { status: 404 });
        }
        if (savingsAccount.status !== "active") {
            return NextResponse.json({ message: "Rekening tabungan tidak aktif" }, { status: 400 });
        }
        // Check member status (Member model uses 'status', not 'isActive')
        const memberStatus = (savingsAccount.member as Record<string, unknown>).status as string | undefined;
        if (memberStatus === "inactive" || memberStatus === "resigned" || memberStatus === "pensiun") {
            return NextResponse.json({ message: `Anggota tidak aktif (status: ${memberStatus})` }, { status: 400 });
        }

        // 2. Calculate gap
        const balance = Number(savingsAccount.balance);
        const target = savingsAccount.targetAmount ? Number(savingsAccount.targetAmount) : 0;
        const gap = Math.max(0, target - balance);

        if (gap <= 0 && target > 0) {
            return NextResponse.json({ message: "Tabungan sudah mencapai target, tidak perlu talangan" }, { status: 400 });
        }
        if (!savingsAccount.targetAmount) {
            return NextResponse.json({ message: "Rekening tidak memiliki target amount, tidak bisa ajukan talangan" }, { status: 400 });
        }

        // 3. Validate amount <= gap
        if (amount > gap) {
            return NextResponse.json({ message: `Jumlah talangan (Rp ${amount.toLocaleString("id-ID")}) melebihi gap (Rp ${gap.toLocaleString("id-ID")})` }, { status: 400 });
        }

        // 4. Validate no active talangan for this account
        if (savingsAccount.talanganLoans.length > 0) {
            return NextResponse.json({ message: "Rekening ini sudah memiliki talangan aktif" }, { status: 409 });
        }

        // 5. Validate loan product
        const loanProduct = await prisma.loanProduct.findUnique({ where: { id: productId } });
        if (!loanProduct || !loanProduct.isActive || !loanProduct.isCurrent) {
            return NextResponse.json({ message: "Produk talangan tidak ditemukan atau tidak aktif" }, { status: 404 });
        }
        if (!["talangan_haji", "talangan_umrah"].includes(loanProduct.type || "")) {
            return NextResponse.json({ message: "Produk bukan merupakan produk talangan" }, { status: 400 });
        }

        // 6. Type matching: savings product suffix must match talangan product suffix
        const savingsSuffix = savingsAccount.product.type.replace("tabungan_", ""); // "haji" or "umrah"
        const talanganSuffix = (loanProduct.type || "").replace("talangan_", ""); // "haji" or "umrah"
        if (savingsSuffix !== talanganSuffix) {
            return NextResponse.json({
                message: `Tipe tidak cocok: tabungan ${savingsSuffix} hanya bisa menggunakan talangan ${savingsSuffix}`,
            }, { status: 400 });
        }

        // 7. Validate amount within product range
        if (loanProduct.minAmount && amount < Number(loanProduct.minAmount)) {
            return NextResponse.json({ message: `Jumlah talangan minimum Rp ${Number(loanProduct.minAmount).toLocaleString("id-ID")}` }, { status: 400 });
        }
        if (loanProduct.maxAmount && amount > Number(loanProduct.maxAmount)) {
            return NextResponse.json({ message: `Jumlah talangan maksimum Rp ${Number(loanProduct.maxAmount).toLocaleString("id-ID")}` }, { status: 400 });
        }

        // 8. Validate tenor
        if (loanProduct.minTenorMonths && tenorMonths < loanProduct.minTenorMonths) {
            return NextResponse.json({ message: `Tenor minimum ${loanProduct.minTenorMonths} bulan` }, { status: 400 });
        }
        if (loanProduct.maxTenorMonths && tenorMonths > loanProduct.maxTenorMonths) {
            return NextResponse.json({ message: `Tenor maksimum ${loanProduct.maxTenorMonths} bulan` }, { status: 400 });
        }

        // 9. Determine mode: auto-disburse or needs approval
        const canAutoDisburse = autoDisburse && (amount <= AUTO_DISBURSE_THRESHOLD || roleName === "operator");

        // 10. Generate application number
        const appNoSuffix = crypto.randomBytes(4).readUInt32BE(0) % 1_000_000_000;
        const applicationNo = `TAL-${new Date().getFullYear()}-${String(appNoSuffix).padStart(9, "0")}`;

        // 11. Create LoanApplication
        const application = await prisma.loanApplication.create({
            data: {
                applicationNo,
                memberId: savingsAccount.memberId,
                branchId: savingsAccount.branchId,
                productId,
                amount,
                tenorMonths,
                purpose: `Talangan ${savingsSuffix === "haji" ? "Haji" : "Umrah"} — Gap Rp ${gap.toLocaleString("id-ID")}`,
                notes: notes || `Linked to savings account ${savingsAccount.accountNo}`,
                status: canAutoDisburse ? "approved" : "submitted",
                deductionSource,
                linkedSavingsAccountId: savingsAccountId,
                createdById: userId,
                submittedAt: new Date(),
                ...(canAutoDisburse ? { approvedAt: new Date(), approvedById: userId } : {}),
            },
        });

        // 12. If auto-disburse, create Loan + Schedules
        if (canAutoDisburse) {
            const loan = await disburseTalangan(application, loanProduct, cashBankAccountId);
            return NextResponse.json({
                message: "Talangan berhasil dicairkan",
                data: {
                    applicationId: application.id,
                    applicationNo: application.applicationNo,
                    loanId: loan.id,
                    loanNo: loan.loanNo,
                    status: "disbursed",
                    autoDisbursed: true,
                },
            }, { status: 201 });
        }

        return NextResponse.json({
            message: "Pengajuan talangan berhasil dibuat, menunggu persetujuan",
            data: {
                applicationId: application.id,
                applicationNo: application.applicationNo,
                status: "submitted",
                autoDisbursed: false,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/haji-umrah/talangan/apply error:", error);
        const message = error instanceof Error ? error.message : "Failed to create talangan";
        return NextResponse.json({ message }, { status: 500 });
    }
}

/**
 * Disburse talangan — creates Loan + LoanSchedule + CashBankTransaction
 * Reuses the same pattern as the main loan disburse route.
 */
async function disburseTalangan(
    application: Awaited<ReturnType<typeof prisma.loanApplication.findUnique>> & { id: number; applicationNo: string; memberId: number; branchId: number; productId: number; amount: { toNumber: () => number }; tenorMonths: number; deductionSource: string; linkedSavingsAccountId: number | null; approvedById: number | null },
    product: Awaited<ReturnType<typeof prisma.loanProduct.findUnique>> & { id: number; interestRate: { toNumber: () => number }; interestMethod: string; adminFeeType: string | null; adminFeeValue: { toNumber: () => number } | null },
    cashBankAccountId?: number | null,
) {
    const principalAmount = Number(application.amount);
    const interestRate = product.interestRate.toNumber ? product.interestRate.toNumber() : Number(product.interestRate);
    const tenorMonths = application.tenorMonths;

    // Calculate interest (flat method)
    const interestPerMonth = Math.round(principalAmount * (interestRate / 100));
    const totalInterest = interestPerMonth * tenorMonths;
    const totalAmount = principalAmount + totalInterest;
    const monthlyInstallment = Math.round(totalAmount / tenorMonths);

    // Admin fee
    const adminFeeValue = product.adminFeeValue ? (product.adminFeeValue.toNumber ? product.adminFeeValue.toNumber() : Number(product.adminFeeValue)) : 0;
    let adminFee = 0;
    if (product.adminFeeType === "percent") {
        adminFee = Math.round(principalAmount * (adminFeeValue / 100));
    } else if (product.adminFeeType === "fixed") {
        adminFee = adminFeeValue;
    }

    const disbursedAmount = principalAmount - adminFee;

    // Generate loan number
    const loanSuffix = crypto.randomBytes(4).readUInt32BE(0) % 1_000_000_000;
    const loanNo = `PJM-${new Date().getFullYear()}-${String(loanSuffix).padStart(5, "0")}`;

    // Dates
    const now = new Date();
    const disbursementDate = now;
    const firstDueDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastDueDate = new Date(now.getFullYear(), now.getMonth() + tenorMonths, 1);

    // Product snapshot
    const productSnapshot = {
        id: product.id,
        code: product.code || "",
        name: product.name,
        type: product.type,
        interestMethod: product.interestMethod,
        interestRate,
        adminFeeType: product.adminFeeType,
        adminFeeValue: adminFeeValue,
    };

    const result = await prisma.$transaction(async (tx) => {
        // Update application status
        await tx.loanApplication.update({
            where: { id: application.id },
            data: { status: "disbursed" },
        });

        // Create Loan
        const loan = await tx.loan.create({
            data: {
                loanNo,
                applicationId: application.id,
                memberId: application.memberId,
                branchId: application.branchId,
                productSnapshot,
                principalAmount,
                interestAmount: totalInterest,
                totalAmount,
                adminFee,
                disbursedAmount,
                tenorMonths,
                interestRate,
                interestMethod: product.interestMethod,
                monthlyInstallment,
                principalPaid: 0,
                interestPaid: 0,
                lateFeePaid: 0,
                principalOutstanding: principalAmount,
                interestOutstanding: totalInterest,
                disbursementDate,
                firstDueDate,
                lastDueDate,
                status: "active",
                disbursedById: application.approvedById,
                linkedSavingsAccountId: application.linkedSavingsAccountId,
                ...(cashBankAccountId ? { disbursementCashBankId: cashBankAccountId } : {}),
            },
        });

        // Create LoanSchedule records
        const schedules = [];
        let remainingPrincipal = principalAmount;
        let remainingInterest = totalInterest;

        for (let i = 1; i <= tenorMonths; i++) {
            const dueDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const isLast = i === tenorMonths;

            let schedulePrincipal: number;
            let scheduleInterest: number;

            if (isLast) {
                // Last installment absorbs rounding remainder
                schedulePrincipal = remainingPrincipal;
                scheduleInterest = remainingInterest;
            } else {
                schedulePrincipal = Math.round(principalAmount / tenorMonths);
                scheduleInterest = interestPerMonth;
                remainingPrincipal -= schedulePrincipal;
                remainingInterest -= scheduleInterest;
            }

            schedules.push({
                loanId: loan.id,
                installmentNo: i,
                dueDate,
                principalAmount: schedulePrincipal,
                interestAmount: scheduleInterest,
                totalAmount: schedulePrincipal + scheduleInterest,
                principalPaid: 0,
                interestPaid: 0,
                lateFee: 0,
                lateFeePaid: 0,
                status: "pending",
            });
        }

        await tx.loanSchedule.createMany({ data: schedules });

        // Create CashBankTransaction for disbursement (outflow)
        if (cashBankAccountId) {
            const cbAccount = await tx.cashBankAccount.findUnique({ where: { id: cashBankAccountId } });
            if (cbAccount) {
                await tx.cashBankTransaction.create({
                    data: {
                        transactionNo: `CBT-${Date.now()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
                        type: "out",
                        amount: disbursedAmount,
                        category: "pencairan_pinjaman",
                        unitType: "haji_umrah",
                        description: `Pencairan Talangan ${loanNo} — ${application.purpose || ""}`,
                        transactionDate: now,
                        cashBankAccountId,
                        createdBy: application.approvedById,
                        currentBalance: Number(cbAccount.currentBalance) - disbursedAmount,
                    },
                });

                await tx.cashBankAccount.update({
                    where: { id: cashBankAccountId },
                    data: { currentBalance: { decrement: disbursedAmount } },
                });
            }
        }

        return loan;
    });

    return result;
}
