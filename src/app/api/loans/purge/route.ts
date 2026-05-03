import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/loans/purge — Delete ALL loan-related data for clean re-import.
// Deletion order respects FK constraints:
//   1. LoanPaymentAllocation (→ LoanPayment, LoanSchedule)
//   2. LoanPayment (→ Loan)
//   3. LoanSchedule (→ Loan)
//   4. Loan (→ LoanApplication)
//   5. LoanApplication
// DOES NOT delete Members, Journals, or CashBankAccounts.
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
        if (roleName !== "super_admin" && roleName !== "admin") {
            return NextResponse.json({ message: "Hanya super_admin/admin yang dapat menghapus semua data pinjaman" }, { status: 403 });
        }

        // Optional safety: require confirmation param
        const body = await request.json().catch(() => ({}));
        if (body.confirm !== "PURGE_ALL_LOANS") {
            return NextResponse.json({
                message: "Konfirmasi diperlukan. Kirim { confirm: 'PURGE_ALL_LOANS' } untuk melanjutkan.",
                counts: {
                    loanPaymentAllocations: await prisma.loanPaymentAllocation.count(),
                    loanPayments: await prisma.loanPayment.count(),
                    loanSchedules: await prisma.loanSchedule.count(),
                    loans: await prisma.loan.count(),
                    loanApplications: await prisma.loanApplication.count(),
                },
            });
        }

        // Delete in dependency order
        const allocDeleted = await prisma.loanPaymentAllocation.deleteMany({});
        const payDeleted = await prisma.loanPayment.deleteMany({});
        const schedDeleted = await prisma.loanSchedule.deleteMany({});

        // Null out journal references on loans before deleting
        await prisma.loan.updateMany({
            where: { disbursementJournalId: { not: null } },
            data: { disbursementJournalId: null, disbursementCashBankId: null },
        });
        const loanDeleted = await prisma.loan.deleteMany({});
        const appDeleted = await prisma.loanApplication.deleteMany({});

        return NextResponse.json({
            message: "Semua data pinjaman berhasil dihapus",
            deleted: {
                loanPaymentAllocations: allocDeleted.count,
                loanPayments: payDeleted.count,
                loanSchedules: schedDeleted.count,
                loans: loanDeleted.count,
                loanApplications: appDeleted.count,
            },
        });
    } catch (error: any) {
        console.error("POST /api/loans/purge error:", error);
        return NextResponse.json(
            { message: "Gagal menghapus data pinjaman: " + (error?.message || "Unknown error") },
            { status: 500 }
        );
    }
}
