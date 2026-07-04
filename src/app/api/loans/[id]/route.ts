import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAuditFromRequest } from "@/lib/audit-logger";
import { applyLoanEdit, LoanEditValidationError } from "@/lib/services/loan-edit";

// Note: Import pipeline (import-update) intentionally bypasses the payment-count guard for data migration purposes.

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/loans/[id]
export async function GET(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
        if (!["operator", "admin_sp"].includes(roleName)) {
            return NextResponse.json({ message: "Hanya Operator yang dapat mengakses data pinjaman." }, { status: 403 });
        }

        const { id } = await params;
        const loan = await prisma.loan.findUnique({
            where: { id: parseInt(id) },
            include: {
                member: {
                    select: { id: true, memberNo: true, name: true, phone: true },
                },
                branch: { select: { id: true, name: true } },
                application: true,
                schedules: {
                    orderBy: { installmentNo: "asc" },
                },
                payments: {
                    where: { status: { not: "voided" } },
                    orderBy: { paymentDate: "desc" },
                    take: 10,
                },
            },
        });

        if (!loan) {
            return NextResponse.json(
                { message: "Pinjaman tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: loan });
    } catch (error) {
        console.error("GET /api/loans/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch loan" },
            { status: 500 }
        );
    }
}

// PUT /api/loans/[id] — Edit pinjaman (Operator only, no payments yet)
export async function PUT(request: Request, { params }: Params) {
    try {
        // 1. Auth — hanya Operator
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized — Silakan login terlebih dahulu." }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string"
            ? session.user.role
            : (session.user.role as any)?.name;

        if (!["operator", "admin_sp"].includes(roleName)) {
            return NextResponse.json(
                { message: "Hanya Operator yang diizinkan mengedit data pinjaman." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const loanId = parseInt(id);
        if (isNaN(loanId)) {
            return NextResponse.json({ message: "ID pinjaman tidak valid." }, { status: 400 });
        }

        // 2. Parse body
        const body = await request.json();
        const userId = Number((session.user as any).id);

        // 3. Delegate fetch → validate → recalc → $transaction to the shared helper
        //    (Fase 8b T2). applyLoanEdit throws LoanEditValidationError for the
        //    6 numeric business-rule guards (via recalcLoanFinancials) AND for
        //    status-active / date-validity / 404; we map it → HTTP 400 below.
        const { updatedLoan, changes, oldLoan, newValues, hasPayments } = await applyLoanEdit({
            loanId,
            body,
            userId,
        });

        console.log(`[LOAN-EDIT] Loan ${oldLoan.loanNo} edited by User #${userId}. Has payments: ${hasPayments}. Changes: ${changes.join(", ")}`);

        // Audit trail
        await logAuditFromRequest(request, session, {
            action: "UPDATE",
            module: "Pinjaman",
            description: `Pinjaman ${oldLoan.loanNo} edited. Changes: ${changes.join(", ")}`,
            targetId: loanId,
            targetType: "loan",
            oldData: { principalAmount: Number(oldLoan.principalAmount), tenorMonths: oldLoan.tenorMonths, interestRate: Number(oldLoan.interestRate) },
            newData: { principalAmount: newValues.principal, tenorMonths: newValues.tenor, interestRate: newValues.rate },
        });

        return NextResponse.json({
            data: updatedLoan,
            message: `Pinjaman ${oldLoan.loanNo} berhasil di-edit. Jadwal angsuran (${newValues.tenor} bulan) telah di-regenerasi.`,
            changes,
        });
    } catch (error: any) {
        // Business-rule violations from applyLoanEdit / recalcLoanFinancials → 400
        if (error instanceof LoanEditValidationError) {
            return NextResponse.json({ message: error.statusMessage }, { status: 400 });
        }

        console.error("PUT /api/loans/[id] error:", error);

        // Prisma-specific errors
        if (error?.code === "P2002") {
            return NextResponse.json(
                { message: "Konflik data unik — coba lagi atau hubungi admin." },
                { status: 409 }
            );
        }
        if (error?.code === "P2025") {
            return NextResponse.json(
                { message: "Record tidak ditemukan saat proses update." },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { message: `Gagal mengedit pinjaman: ${error?.message || "Terjadi kesalahan internal server."}` },
            { status: 500 }
        );
    }
}
