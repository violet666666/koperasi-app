import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "@/app/api/mobile/middleware";

// GET /api/mobile/haji-umrah/talangan/[loanId] — Detail + schedules + payments
export async function GET(
    request: Request,
    { params }: { params: Promise<{ loanId: string }> }
) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { loanId } = await params;
        const id = parseInt(loanId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid loanId" }, { status: 400 });
        }

        // Parallel fetch: loan + application, schedules, payments
        const [loan, application, schedules, payments] = await Promise.all([
            prisma.loan.findUnique({
                where: { id },
                include: {
                    member: { select: { id: true, name: true, nrp: true, memberNo: true } },
                    linkedSavingsAccount: {
                        select: {
                            id: true,
                            accountNo: true,
                            balance: true,
                            targetAmount: true,
                            product: { select: { name: true, type: true } },
                        },
                    },
                },
            }),
            prisma.loanApplication.findUnique({
                where: { id: id }, // loan.id === application.id (unique relation)
                include: {
                    product: { select: { code: true, name: true, type: true } },
                },
            }),
            prisma.loanSchedule.findMany({
                where: { loanId: id },
                orderBy: { installmentNo: "asc" },
            }),
            prisma.loanPayment.findMany({
                where: { loanId: id },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        if (!loan || !loan.linkedSavingsAccountId) {
            return NextResponse.json({ message: "Talangan tidak ditemukan" }, { status: 404 });
        }

        const mappedSchedules = schedules.map((s) => ({
            id: s.id,
            installmentNo: s.installmentNo,
            dueDate: s.dueDate,
            principalAmount: Number(s.principalAmount),
            interestAmount: Number(s.interestAmount),
            totalAmount: Number(s.totalAmount),
            principalPaid: Number(s.principalPaid),
            interestPaid: Number(s.interestPaid),
            lateFee: Number(s.lateFee),
            lateFeePaid: Number(s.lateFeePaid),
            status: s.status,
            paidDate: s.paidDate,
        }));

        // Stats
        const totalPaid = Number(loan.principalPaid) + Number(loan.interestPaid) + Number(loan.lateFeePaid);
        const remaining = Math.max(0, Number(loan.totalAmount) - totalPaid);
        const installmentPaid = schedules.filter((s) => s.status === "paid").length;
        const installmentRemaining = schedules.filter((s) => s.status !== "paid" && s.status !== "completed").length;

        const nextPending = schedules.find((s) => s.status === "pending" || s.status === "overdue");
        const nextDueDate = nextPending?.dueDate ?? null;
        const nextDueAmount = nextPending
            ? Number(nextPending.totalAmount) + Number(nextPending.lateFee) - Number(nextPending.lateFeePaid)
            : null;

        return NextResponse.json({
            data: {
                loan: {
                    id: loan.id,
                    loanNo: loan.loanNo,
                    member: loan.member,
                    principalAmount: Number(loan.principalAmount),
                    interestAmount: Number(loan.interestAmount),
                    totalAmount: Number(loan.totalAmount),
                    adminFee: Number(loan.adminFee),
                    disbursedAmount: Number(loan.disbursedAmount),
                    tenorMonths: loan.tenorMonths,
                    interestRate: Number(loan.interestRate),
                    monthlyInstallment: Number(loan.monthlyInstallment),
                    principalPaid: Number(loan.principalPaid),
                    interestPaid: Number(loan.interestPaid),
                    principalOutstanding: Number(loan.principalOutstanding),
                    interestOutstanding: Number(loan.interestOutstanding),
                    disbursementDate: loan.disbursementDate,
                    firstDueDate: loan.firstDueDate,
                    lastDueDate: loan.lastDueDate,
                    paidOffDate: loan.paidOffDate,
                    status: loan.status,
                    productSnapshot: loan.productSnapshot,
                },
                application: application ? {
                    id: application.id,
                    applicationNo: application.applicationNo,
                    status: application.status,
                    amount: Number(application.amount),
                    tenorMonths: application.tenorMonths,
                    purpose: application.purpose,
                    notes: application.notes,
                    createdAt: application.createdAt,
                    approvedAt: application.approvedAt,
                    product: application.product,
                } : null,
                savingsAccount: loan.linkedSavingsAccount ? {
                    id: loan.linkedSavingsAccount.id,
                    accountNo: loan.linkedSavingsAccount.accountNo,
                    balance: Number(loan.linkedSavingsAccount.balance),
                    targetAmount: loan.linkedSavingsAccount.targetAmount ? Number(loan.linkedSavingsAccount.targetAmount) : null,
                    progress: loan.linkedSavingsAccount.targetAmount
                        ? Math.min(100, Math.round((Number(loan.linkedSavingsAccount.balance) / Number(loan.linkedSavingsAccount.targetAmount)) * 1000) / 10)
                        : null,
                    product: loan.linkedSavingsAccount.product,
                } : null,
                schedules: mappedSchedules,
                payments: payments.map((p) => ({
                    id: p.id,
                    paymentNo: p.paymentNo,
                    amount: Number(p.amount),
                    principalAmount: Number(p.principalPortion),
                    interestAmount: Number(p.interestPortion),
                    lateFeeAmount: Number(p.lateFeePortion),
                    paymentDate: p.paymentDate,
                    paymentMethod: p.paymentMethod,
                    notes: p.notes,
                    status: p.status,
                    createdAt: p.createdAt,
                })),
                stats: {
                    totalPaid,
                    remaining,
                    installmentPaid,
                    installmentRemaining,
                    nextDueDate,
                    nextDueAmount,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/talangan/[loanId] error:", error);
        return NextResponse.json({ message: "Failed to fetch talangan detail" }, { status: 500 });
    }
}
