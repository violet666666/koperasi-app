import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/loans/generate-schedules
// One-time migration: generate LoanSchedule records for imported loans that don't have them.
// Marks already-paid installments based on principalPaid.
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
        if (roleName !== "operator" && roleName !== "admin" && roleName !== "super_admin") {
            return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
        }

        // Find all active loans without schedules
        const loans = await prisma.loan.findMany({
            where: {
                status: "active",
                schedules: { none: {} },
            },
            select: {
                id: true,
                loanNo: true,
                principalAmount: true,
                interestAmount: true,
                totalAmount: true,
                tenorMonths: true,
                interestRate: true,
                monthlyInstallment: true,
                principalPaid: true,
                interestPaid: true,
                disbursementDate: true,
                firstDueDate: true,
            },
        });

        if (loans.length === 0) {
            return NextResponse.json({ message: "Tidak ada pinjaman yang membutuhkan jadwal.", generated: 0 });
        }

        let generated = 0;
        const BATCH = 20;

        for (let i = 0; i < loans.length; i += BATCH) {
            const batch = loans.slice(i, i + BATCH);

            await prisma.$transaction(async (tx) => {
                for (const loan of batch) {
                    const principal = Number(loan.principalAmount);
                    const totalInterest = Number(loan.interestAmount);
                    const total = principal + totalInterest;
                    const tenor = loan.tenorMonths || 12;
                    const paidPrincipal = Number(loan.principalPaid);

                    // Calculate how many installments are already paid
                    const principalPerMonth = tenor > 0 ? Math.floor(principal / tenor) : 0;
                    const paidInstallments = principalPerMonth > 0 ? Math.round(paidPrincipal / principalPerMonth) : 0;

                    const baseDate = loan.firstDueDate || loan.disbursementDate || new Date();

                    const schedules = [];
                    for (let j = 1; j <= tenor; j++) {
                        const dueDate = new Date(baseDate);
                        dueDate.setMonth(dueDate.getMonth() + (j - 1));

                        let schedPrincipal = Math.floor(principal / tenor);
                        let schedInterest = tenor > 0 ? Math.floor(totalInterest / tenor) : 0;

                        // Rounding correction on last installment
                        if (j === tenor) {
                            const totalSchedPrincipal = Math.floor(principal / tenor) * tenor;
                            const totalSchedInterest = Math.floor(totalInterest / tenor) * tenor;
                            schedPrincipal += (principal - totalSchedPrincipal);
                            schedInterest += (totalInterest - totalSchedInterest);
                        }

                        const isPaid = j <= paidInstallments;

                        schedules.push({
                            loanId: loan.id,
                            installmentNo: j,
                            dueDate,
                            principalAmount: schedPrincipal,
                            interestAmount: schedInterest,
                            totalAmount: schedPrincipal + schedInterest,
                            principalPaid: isPaid ? schedPrincipal : 0,
                            interestPaid: isPaid ? schedInterest : 0,
                            status: isPaid ? "paid" : "pending",
                        });
                    }

                    await tx.loanSchedule.createMany({ data: schedules });
                    generated++;
                }
            }, { timeout: 60000 });
        }

        return NextResponse.json({
            message: `Berhasil generate ${generated} jadwal angsuran untuk ${loans.length} pinjaman.`,
            generated,
            total: loans.length,
        });
    } catch (error: any) {
        console.error("POST /api/loans/generate-schedules error:", error);
        return NextResponse.json(
            { message: "Gagal generate jadwal: " + (error?.message || "Unknown error") },
            { status: 500 }
        );
    }
}
