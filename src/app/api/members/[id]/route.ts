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
                if (l.maturityDate) {
                    const diff = Math.floor((now.getTime() - new Date(l.maturityDate).getTime()) / (1000 * 60 * 60 * 24));
                    if (diff > overdueDays) overdueDays = diff;
                }
            });
        }

        // Next installment — find from LoanSchedule
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
            }
        }

        // Estimasi SHU = 0 by default (will be nonzero when SHU reports run)
        const estimasi_shu = 0;

        return NextResponse.json({ 
            data: {
                ...member,
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
