import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateMemberSchema } from "@/lib/validations";
import { calculateSystemSHU } from "@/lib/services/shu-calculator";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/members/[id]
export async function GET(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const member = await prisma.member.findUnique({
            where: { id: parseInt(id), deletedAt: null },
            include: {
                branch: true,
                savingsAccounts: {
                    include: {
                        product: true,
                    },
                },
                loans: true,
                userAccount: {
                    select: { id: true, roleId: true }
                }
            },
        });

        const activeRoles = await prisma.role.findMany({ select: { id: true, name: true, displayName: true }});

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        // --- Calculate Summary Inline ---
        // NOTE: Member.tabunganWajib adalah saldo lama dari import CSV (sebelum sistem akun aktif).
        // Jika anggota sudah punya SavingsAccount tipe 'wajib', JANGAN tambahkan tabunganWajib lagi
        // untuk menghindari double-count yang menyebabkan nominal beda antara tab Simpanan dan kartu ringkasan.
        const hasWajibAccount = member.savingsAccounts.some(
            (acc) => acc.product.type === "wajib"
        );
        const tabunganWajibFallback = hasWajibAccount ? 0 : Number(member.tabunganWajib || 0);

        const totalSavings = member.savingsAccounts.reduce(
            (sum, acc) => sum + Number(acc.balance),
            0
        ) + tabunganWajibFallback;

        const savingsByType = member.savingsAccounts.map((acc) => ({
            type: acc.product.type,
            name: acc.product.name,
            balance: Number(acc.balance),
        }));
        // Hanya tampilkan baris Tabungan Wajib (legacy) jika belum ada rekening wajib resmi
        if (!hasWajibAccount && tabunganWajibFallback > 0) {
            savingsByType.push({
                type: 'wajib',
                name: 'Tabungan Wajib (Import)',
                balance: tabunganWajibFallback
            });
        }

        const activeLoans = member.loans.filter((l) => l.status === "active" || l.status === "overdue");
        const totalOutstanding = activeLoans.reduce(
            (sum, l) => sum + Number(l.principalOutstanding) + Number(l.interestOutstanding),
            0
        );
        const totalPrincipalOutstanding = activeLoans.reduce(
            (sum, l) => sum + Number(l.principalOutstanding), 0
        );
        const totalInterestOutstanding = activeLoans.reduce(
            (sum, l) => sum + Number(l.interestOutstanding), 0
        );

        // Overdue info
        const overdueLoans = member.loans.filter((l) => l.status === "overdue");
        const overdueAmount = overdueLoans.reduce(
            (sum, l) => sum + Number(l.principalOutstanding) + Number(l.interestOutstanding), 0
        );
        let overdueDays = 0;
        if (overdueLoans.length > 0) {
            const now = new Date();
            overdueLoans.forEach(l => {
                if (l.lastDueDate) {
                    const diff = Math.floor((now.getTime() - new Date(l.lastDueDate).getTime()) / (1000 * 60 * 60 * 24));
                    if (diff > overdueDays) overdueDays = diff;
                }
            });
        }

        // Next installment — find from LoanSchedule, with fallback for migration loans
        let nextInstallment = null;
        if (activeLoans.length > 0) {
            const today = new Date();
            const schedule = await prisma.loanSchedule.findFirst({
                where: {
                    loanId: { in: activeLoans.map(l => l.id) },
                    status: { in: ["pending", "partial", "overdue"] },
                    dueDate: { gte: today },
                },
                orderBy: { dueDate: "asc" },
            });
            if (schedule) {
                nextInstallment = {
                    loan_id: schedule.loanId,
                    due_date: schedule.dueDate.toISOString(),
                    amount: Number(schedule.principalAmount) + Number(schedule.interestAmount),
                };
            } else {
                // Fallback: compute from loan data when no schedule exists (migration loans)
                const primaryLoan = activeLoans[0];
                const installment = Number(primaryLoan.monthlyInstallment);
                if (installment > 0) {
                    // Next month 1st as due date
                    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                    nextInstallment = {
                        loan_id: primaryLoan.id,
                        due_date: nextMonth.toISOString(),
                        amount: installment,
                    };
                }
            }
        }

        // Estimasi SHU — real-time SSOT lookup
        let estimasi_shu = 0;
        try {
            const currentYear = new Date().getFullYear();
            const shuData = await calculateSystemSHU(currentYear);
            const myShu = shuData.memberDistribution.find(m => m.id === member.id);
            if (myShu) {
                estimasi_shu = myShu.shuAmount;
            }
        } catch (e) {
            console.error("Error calculating estimasi SHU:", e);
        }

        // Compute per-loan detail with installment info
        const loanDetails = member.loans.map((loan) => {
            const principalAmount = Number(loan.principalAmount);
            const principalPaid = Number(loan.principalPaid);
            const principalOutstanding = Number(loan.principalOutstanding);
            const interestOutstanding = Number(loan.interestOutstanding);
            const monthlyInstallment = Number(loan.monthlyInstallment);
            const tenorMonths = loan.tenorMonths;

            // Calculate installment progress
            let paidInstallments = 0;
            let remainingInstallments = tenorMonths;
            if (monthlyInstallment > 0) {
                paidInstallments = Math.round(principalPaid / (principalAmount / tenorMonths));
                remainingInstallments = Math.max(0, tenorMonths - paidInstallments);
            }
            // If loan is paid off
            if (loan.status === "paid_off") {
                paidInstallments = tenorMonths;
                remainingInstallments = 0;
            }

            const totalPaid = principalPaid + Number(loan.interestPaid);
            const totalKewajiban = principalOutstanding + interestOutstanding;
            const progressPercent = principalAmount > 0 
                ? Math.min(100, Math.round((principalPaid / principalAmount) * 100))
                : 0;

            return {
                id: loan.id,
                loanNo: loan.loanNo,
                disbursementDate: loan.disbursementDate,
                firstDueDate: loan.firstDueDate,
                lastDueDate: loan.lastDueDate,
                paidOffDate: loan.paidOffDate,
                principalAmount,
                interestRate: Number(loan.interestRate),
                tenorMonths,
                monthlyInstallment,
                principalPaid,
                interestPaid: Number(loan.interestPaid),
                totalPaid,
                principalOutstanding,
                interestOutstanding,
                totalKewajiban,
                paidInstallments,
                remainingInstallments,
                progressPercent,
                status: loan.status,
            };
        });

        // Hitung sisa limit piutang unit usaha secara real-time
        const tagihanUnitResult = await prisma.unitTransaction.aggregate({
            where: {
                memberId: member.id,
                paymentMethod: "salary_cut",
                isPaid: false,
                status: { in: ["completed", "pending_void"] },
            },
            _sum: { loanAmount: true },
        });
        const totalTagihanUnit = Number(tagihanUnitResult._sum.loanAmount || 0);
        const plafonPiutang = Number(member.plafonPiutang || 0);
        const sisaLimitUnit = plafonPiutang - totalTagihanUnit;

        return NextResponse.json({ 
            data: {
                ...member,
                loanDetails,
                summary: {
                    savings: {
                        total: totalSavings,
                        byType: savingsByType,
                    },
                    loans: {
                        activeCount: activeLoans.length,
                        totalOutstanding,
                        totalPrincipalOutstanding,
                        totalInterestOutstanding,
                        nextInstallment,
                        overdueAmount,
                        overdueDays,
                    },
                    unitPiutang: {
                        plafonPiutang,
                        totalTagihan: totalTagihanUnit,
                        sisaLimit: sisaLimitUnit,
                    },
                    netPosition: totalSavings - totalOutstanding,
                    estimasi_shu,
                }
            },
            meta: { roles: activeRoles }
        });
    } catch (error) {
        console.error("GET /api/members/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch member" },
            { status: 500 }
        );
    }
}

// GET /api/members/[id]/summary - Financial summary
export async function getSummary(memberId: number) {
    const member = await prisma.member.findUnique({
        where: { id: memberId },
        include: {
            savingsAccounts: {
                include: { product: true },
            },
            loans: {
                where: { status: "active" },
            },
        },
    });

    if (!member) return null;

    const totalSavings = member.savingsAccounts.reduce(
        (sum, acc) => sum + Number(acc.balance),
        0
    );

    const savingsByType = member.savingsAccounts.map((acc) => ({
        type: acc.product.type,
        name: acc.product.name,
        balance: Number(acc.balance),
    }));

    const activeLoans = member.loans.filter((l) => l.status === "active");
    const totalOutstanding = activeLoans.reduce(
        (sum, l) => sum + Number(l.principalOutstanding) + Number(l.interestOutstanding),
        0
    );

    return {
        memberId: member.id,
        memberNo: member.memberNo,
        name: member.name,
        savings: {
            total: totalSavings,
            byType: savingsByType,
        },
        loans: {
            activeCount: activeLoans.length,
            totalOutstanding,
        },
        netPosition: totalSavings - totalOutstanding,
    };
}

// PUT /api/members/[id]
export async function PUT(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const data = updateMemberSchema.parse(body);
        const { overrideSavings, roleId, ...memberData } = data;

        // Proteksi plafonPiutang — hanya Operator/Admin yang boleh mengubah
        const operatorRoles = ["operator", "admin", "super_admin"];
        if (memberData.plafonPiutang !== undefined && !operatorRoles.includes(session.user.role)) {
            return NextResponse.json(
                { message: "Hanya Operator yang dapat mengubah Plafon Piutang anggota." },
                { status: 403 }
            );
        }

        const member = await prisma.member.findUnique({
            where: { id: parseInt(id), deletedAt: null },
            include: { userAccount: true, savingsAccounts: { include: { product: true } } }
        });

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check for duplicate memberNo if being updated
        if (memberData.memberNo && memberData.memberNo !== member.memberNo) {
            const existing = await prisma.member.findUnique({
                where: { memberNo: memberData.memberNo },
            });
            if (existing) {
                return NextResponse.json(
                    { message: "NRP/Nomor Anggota sudah digunakan" },
                    { status: 400 }
                );
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            // Lakukan pemotongan/koreksi saldo (Override)
            if (overrideSavings && Object.keys(overrideSavings).length > 0) {
                for (const [sType, sAmount] of Object.entries(overrideSavings)) {
                    const newBal = Number(sAmount);
                    let acc = member.savingsAccounts.find(a => a.product.type === sType);

                    // FIXED: Jika rekening belum ada, auto-create rekening baru
                    if (!acc) {
                        // Cari produk simpanan sesuai tipe
                        const product = await tx.savingsProduct.findFirst({
                            where: { type: sType, isActive: true }
                        });
                        if (!product) {
                            throw new Error(`Produk simpanan tipe "${sType}" tidak ditemukan di database. Silakan buat produk simpanan terlebih dahulu di menu Master > Produk Simpanan.`);
                        }

                        // Generate nomor rekening unik
                        const prefix = sType === 'pokok' ? 'PKK' : sType === 'wajib' ? 'WJB' : 'SKR';
                        const accountNo = `${prefix}-${String(member.id).padStart(4, '0')}`;

                        // Cek apakah nomor rekening sudah ada (double-safety)
                        const existingAcc = await tx.savingsAccount.findUnique({ where: { accountNo } });
                        if (existingAcc) {
                            // Jika ternyata sudah ada (mungkin race condition), gunakan yang ada
                            acc = { ...existingAcc, product } as any;
                        } else {
                            // Buat rekening baru
                            const newAcc = await tx.savingsAccount.create({
                                data: {
                                    accountNo,
                                    memberId: member.id,
                                    productId: product.id,
                                    branchId: member.branchId,
                                    balance: 0,
                                    status: 'active',
                                    openedDate: new Date(),
                                },
                                include: { product: true }
                            });
                            acc = newAcc as any;
                        }
                    }

                    // Sekarang acc pasti ada — lakukan koreksi saldo
                    if (!acc) continue; // Safety guard (seharusnya tidak pernah terjadi)
                    const oldBal = Number(acc.balance);
                    if (oldBal !== newBal) {
                        const diff = newBal - oldBal;
                        await tx.savingsAccount.update({
                            where: { id: acc.id },
                            data: { balance: newBal }
                        });
                        // Catat history sebagai Correction
                        await tx.savingsTransaction.create({
                            data: {
                                transactionNo: `CORR-${Date.now()}-${acc.id}`,
                                accountId: acc.id,
                                memberId: member.id,
                                productId: acc.productId,
                                branchId: member.branchId,
                                type: 'correction',
                                amount: Math.abs(diff),
                                balanceBefore: oldBal,
                                balanceAfter: newBal,
                                notes: `Koreksi manual saldo Simpanan ${sType.toUpperCase()} dari Rp ${oldBal} menjadi Rp ${newBal}`,
                                transactionDate: new Date(),
                                createdById: Number(session?.user?.id) || 1,
                            }
                        });
                    }
                }
            }

            // Update user role jika terhubung dengan akun
            if (roleId && member.userAccount && member.userAccount.roleId !== roleId) {
                await tx.user.update({
                    where: { id: member.userAccount.id },
                    data: { roleId },
                });
            }

            return await tx.member.update({
                where: { id: parseInt(id) },
                data: memberData,
                include: { branch: true },
            });
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("PUT /api/members/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to update member" },
            { status: 500 }
        );
    }
}

// DELETE /api/members/[id] - Soft delete
export async function DELETE(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const member = await prisma.member.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check for active loans
        const activeLoans = await prisma.loan.count({
            where: { memberId: parseInt(id), status: "active" },
        });

        if (activeLoans > 0) {
            return NextResponse.json(
                { message: "Anggota masih memiliki pinjaman aktif" },
                { status: 400 }
            );
        }

        // Soft delete
        await prisma.member.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date(), status: "resigned" },
        });

        return NextResponse.json({ message: "Anggota berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/members/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to delete member" },
            { status: 500 }
        );
    }
}
