import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { updateMemberSchema } from "@/lib/validations";

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
            },
        });

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        // --- Calculate Summary Inline ---
        const totalSavings = member.savingsAccounts.reduce(
            (sum, acc) => sum + Number(acc.balance),
            0
        ) + Number(member.tabunganWajib || 0);

        const savingsByType = member.savingsAccounts.map((acc) => ({
            type: acc.product.type,
            name: acc.product.name,
            balance: Number(acc.balance),
        }));
        if (Number(member.tabunganWajib || 0) > 0) {
            savingsByType.push({
                type: 'wajib',
                name: 'Tabungan Wajib',
                balance: Number(member.tabunganWajib)
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

        // Estimasi SHU — real-time calculation with minimum floor
        let estimasi_shu = 0;
        try {
            const currentYear = new Date().getFullYear();
            const yearStart = new Date(currentYear, 0, 1);
            const yearEnd = new Date(currentYear, 11, 31);

            // Get journal net income for current year
            const journalLines = await prisma.journalLine.findMany({
                where: {
                    journal: {
                        transactionDate: { gte: yearStart, lte: yearEnd },
                        isPosted: true,
                    },
                },
                include: { account: { select: { type: true } } },
            });

            let totalIncome = 0, totalExpense = 0;
            for (const line of journalLines) {
                const debit = Number(line.debit);
                const credit = Number(line.credit);
                if (line.account.type === "income") totalIncome += (credit - debit);
                else if (line.account.type === "expense") totalExpense += (debit - credit);
            }
            const netIncome = totalIncome - totalExpense;

            // Get all active members savings + loan totals for proportional calc
            const allMembers = await prisma.member.findMany({
                where: { status: "active", deletedAt: null },
                select: {
                    id: true,
                    tabunganWajib: true,
                    savingsAccounts: {
                        where: { status: "active" },
                        include: { product: { select: { type: true } } },
                    },
                    loans: {
                        where: { status: { in: ["active", "overdue", "paid_off"] } },
                        select: { principalPaid: true },
                    },
                },
            });

            let totalSavingsAll = 0, totalLoanAll = 0;
            let thisMemberSavings = 0, thisMemberLoan = 0;

            for (const m of allMembers) {
                // Include ALL savings types (pokok, wajib, sukarela) + tabunganWajib
                const sav = m.savingsAccounts
                    .reduce((s, sa) => s + Number(sa.balance), 0) + Number(m.tabunganWajib || 0);
                const loan = m.loans.reduce((s, l) => s + Number(l.principalPaid), 0);
                totalSavingsAll += sav;
                totalLoanAll += loan;
                if (m.id === member.id) {
                    thisMemberSavings = sav;
                    thisMemberLoan = loan;
                }
            }

            if (netIncome > 0) {
                // Use actual journal-based calculation
                const memberNetIncome = Math.round(netIncome * 0.8);
                const jasaSimpananPool = Math.round((memberNetIncome * 25) / 100);
                const jasaUsahaPool = Math.round((memberNetIncome * 25) / 100);

                const savShare = totalSavingsAll > 0 ? Math.round((thisMemberSavings / totalSavingsAll) * jasaSimpananPool) : 0;
                const loanShare = totalLoanAll > 0 ? Math.round((thisMemberLoan / totalLoanAll) * jasaUsahaPool) : 0;
                estimasi_shu = savShare + loanShare;
            } else {
                // Fallback: estimate based on minimum 6% annual return on savings capital
                // This ensures members with savings always see a non-zero SHU estimation
                const estimatedReturnRate = 0.06; // 6% annual
                const estimatedTotalReturn = totalSavingsAll * estimatedReturnRate;
                const jasaSimpananPool = Math.round(estimatedTotalReturn * 0.25); // 25% to Jasa Modal
                
                const savShare = totalSavingsAll > 0 
                    ? Math.round((thisMemberSavings / totalSavingsAll) * jasaSimpananPool) 
                    : 0;
                estimasi_shu = savShare;
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
                    netPosition: totalSavings - totalOutstanding,
                    estimasi_shu,
                }
            } 
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
        const { id } = await params;
        const body = await request.json();
        const data = updateMemberSchema.parse(body);

        const member = await prisma.member.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check for duplicate memberNo if being updated
        if (data.memberNo && data.memberNo !== member.memberNo) {
            const existing = await prisma.member.findUnique({
                where: { memberNo: data.memberNo },
            });
            if (existing) {
                return NextResponse.json(
                    { message: "NRP sudah digunakan" },
                    { status: 400 }
                );
            }
        }

        const updated = await prisma.member.update({
            where: { id: parseInt(id) },
            data,
            include: { branch: true },
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
