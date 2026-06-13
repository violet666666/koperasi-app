import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/haji-umrah/talangan/[applicationId] — Detail talangan
export async function GET(
    request: Request,
    { params }: { params: Promise<{ applicationId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { applicationId } = await params;
        const id = parseInt(applicationId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid application ID" }, { status: 400 });
        }

        // Find the application with linked data
        const application = await prisma.loanApplication.findUnique({
            where: { id },
            include: {
                member: { select: { id: true, name: true, nrp: true } },
                branch: { select: { id: true, name: true } },
                product: { select: { id: true, code: true, name: true, type: true, interestRate: true, interestMethod: true } },
                createdBy: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } },
                linkedSavingsAccount: {
                    select: {
                        id: true,
                        accountNo: true,
                        balance: true,
                        targetAmount: true,
                        product: { select: { name: true, type: true } },
                    },
                },
                loan: {
                    include: {
                        schedules: { orderBy: { installmentNo: "asc" } },
                        payments: {
                            include: {
                                allocations: { orderBy: { scheduleId: "asc" } },
                            },
                            orderBy: { createdAt: "desc" },
                        },
                    },
                },
            },
        });

        if (!application) {
            return NextResponse.json({ message: "Pengajuan talangan tidak ditemukan" }, { status: 404 });
        }

        // Verify this is a talangan (linked to a savings account)
        if (!application.linkedSavingsAccountId) {
            return NextResponse.json({ message: "Bukan pengajuan talangan" }, { status: 400 });
        }

        const loan = application.loan;

        // Build response
        const response: Record<string, unknown> = {
            application: {
                id: application.id,
                applicationNo: application.applicationNo,
                status: application.status,
                amount: Number(application.amount),
                tenorMonths: application.tenorMonths,
                purpose: application.purpose,
                notes: application.notes,
                deductionSource: application.deductionSource,
                createdAt: application.createdAt,
                submittedAt: application.submittedAt,
                approvedAt: application.approvedAt,
                rejectedAt: application.rejectedAt,
                rejectionReason: application.rejectionReason,
                member: application.member,
                branch: application.branch,
                product: {
                    ...application.product,
                    interestRate: application.product.interestRate ? Number(application.product.interestRate) : null,
                },
                createdBy: application.createdBy,
                approvedBy: application.approvedBy,
            },
            savingsAccount: application.linkedSavingsAccount ? {
                ...application.linkedSavingsAccount,
                balance: Number(application.linkedSavingsAccount.balance),
                targetAmount: application.linkedSavingsAccount.targetAmount ? Number(application.linkedSavingsAccount.targetAmount) : null,
                progress: application.linkedSavingsAccount.targetAmount
                    ? Math.min(100, Math.round((Number(application.linkedSavingsAccount.balance) / Number(application.linkedSavingsAccount.targetAmount)) * 1000) / 10)
                    : null,
            } : null,
        };

        // Add loan data if disbursed
        if (loan) {
            response.loan = {
                id: loan.id,
                loanNo: loan.loanNo,
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
            };

            response.schedules = loan.schedules.map((s) => ({
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

            response.payments = loan.payments.map((p) => ({
                id: p.id,
                paymentNo: p.paymentNo,
                amount: Number(p.amount),
                principalAmount: Number(p.principalAmount),
                interestAmount: Number(p.interestAmount),
                lateFeeAmount: Number(p.lateFeeAmount),
                paymentDate: p.paymentDate,
                paymentMethod: p.paymentMethod,
                notes: p.notes,
                status: p.status,
                createdAt: p.createdAt,
            }));

            // Summary stats
            response.stats = {
                totalPaid: Number(loan.principalPaid) + Number(loan.interestPaid) + Number(loan.lateFeePaid),
                remainingTotal: Number(loan.principalOutstanding) + Number(loan.interestOutstanding),
                paidInstallments: loan.schedules.filter((s) => s.status === "paid").length,
                totalInstallments: loan.schedules.length,
                nextDue: loan.schedules.find((s) => s.status === "pending")?.dueDate || null,
            };
        }

        return NextResponse.json({ data: response });
    } catch (error) {
        console.error("GET /api/haji-umrah/talangan/[applicationId] error:", error);
        return NextResponse.json({ message: "Failed to fetch talangan detail" }, { status: 500 });
    }
}
