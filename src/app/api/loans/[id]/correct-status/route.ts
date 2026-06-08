import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAuditFromRequest } from "@/lib/audit-logger";

/** Compact number formatter for error messages */
function formatNumber(n: number) {
    return n.toLocaleString("id-ID");
}

/**
 * POST /api/loans/[id]/correct-status
 *
 * Manual status correction for anomalous loans (operator-only).
 * Reverts a phantom LUNAS (paid_off with 0 payments) back to active
 * and corrects financial fields. Regenerates schedules.
 *
 * No CashBank/Journal reversal — phantom LUNAS had no real payments.
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // ── Auth ──────────────────────────────────────────────
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = typeof session.user.role === "string"
            ? session.user.role
            : (session.user.role as any)?.name;

        if (!["operator", "admin_sp"].includes(role)) {
            return NextResponse.json(
                { message: "Hanya Operator yang dapat melakukan koreksi status pinjaman." },
                { status: 403 }
            );
        }

        const params = await context.params;
        const loanId = parseInt(params.id);
        if (isNaN(loanId)) {
            return NextResponse.json({ message: "ID pinjaman tidak valid." }, { status: 400 });
        }

        // ── Parse body ────────────────────────────────────────
        const body = await request.json();
        const { targetStatus, reason, corrections } = body as {
            targetStatus: string;
            reason: string;
            corrections: {
                principalPaid?: number;
                interestPaid?: number;
                principalOutstanding?: number;
                interestOutstanding?: number;
            };
        };

        // ── Guards ────────────────────────────────────────────
        if (targetStatus !== "active") {
            return NextResponse.json(
                { message: "Koreksi status hanya mengizinkan perubahan ke AKTIF." },
                { status: 400 }
            );
        }

        if (!reason || reason.trim().length < 10) {
            return NextResponse.json(
                { message: "Alasan koreksi wajib diisi (minimal 10 karakter)." },
                { status: 400 }
            );
        }

        // Fetch loan with payments for validation
        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                payments: { where: { status: "completed" }, select: { id: true } },
            },
        });

        if (!loan) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan." }, { status: 404 });
        }

        if (loan.status !== "paid_off") {
            return NextResponse.json(
                { message: `Koreksi status hanya untuk pinjaman berstatus LUNAS. Status saat ini: ${loan.status}.` },
                { status: 400 }
            );
        }

        if (loan.payments.length > 0) {
            return NextResponse.json(
                { message: `Pinjaman memiliki ${loan.payments.length} pembayaran aktif. Batalkan (void) pembayaran terlebih dahulu sebelum melakukan koreksi status.` },
                { status: 400 }
            );
        }

        // ── Compute correction values ─────────────────────────
        const principalAmount = Number(loan.principalAmount);
        const interestAmount = Number(loan.interestAmount);
        const newPrincipalPaid = Math.max(0, Number(corrections?.principalPaid ?? 0));
        const newInterestPaid = Math.max(0, Number(corrections?.interestPaid ?? 0));
        const newPrincipalOutstanding = Math.max(
            0,
            corrections?.principalOutstanding != null
                ? Number(corrections.principalOutstanding)
                : principalAmount - newPrincipalPaid
        );
        const newInterestOutstanding = Math.max(
            0,
            corrections?.interestOutstanding != null
                ? Number(corrections.interestOutstanding)
                : interestAmount - newInterestPaid
        );

        // Sanitize reason to prevent log injection
        const sanitizedReason = reason.trim().replace(/[\n\r\t]/g, " ").replace(/[\x00-\x1F\x7F]/g, "");

        // Data integrity: principal paid + outstanding should equal principal amount (±1 for rounding)
        if (Math.abs((newPrincipalPaid + newPrincipalOutstanding) - principalAmount) > 1) {
            return NextResponse.json(
                { message: `Data tidak konsisten: Pokok Terbayar (${formatNumber(newPrincipalPaid)}) + Sisa Pokok (${formatNumber(newPrincipalOutstanding)}) harus sama dengan Pokok Pinjaman (${formatNumber(principalAmount)}).` },
                { status: 400 }
            );
        }
        if (Math.abs((newInterestPaid + newInterestOutstanding) - interestAmount) > 1) {
            return NextResponse.json(
                { message: `Data tidak konsisten: Bunga Terbayar + Sisa Bunga harus sama dengan Total Bunga (${formatNumber(interestAmount)}).` },
                { status: 400 }
            );
        }

        // Snapshot old data for audit
        const oldData = {
            status: loan.status,
            paidOffDate: loan.paidOffDate,
            principalPaid: Number(loan.principalPaid),
            interestPaid: Number(loan.interestPaid),
            principalOutstanding: Number(loan.principalOutstanding),
            interestOutstanding: Number(loan.interestOutstanding),
        };

        // ── Transaction ───────────────────────────────────────
        const result = await prisma.$transaction(async (tx) => {
            // Re-read inside tx for concurrency safety
            const currentLoan = await tx.loan.findUnique({
                where: { id: loanId },
                include: {
                    payments: { where: { status: "completed" }, select: { id: true } },
                },
            });

            if (!currentLoan || currentLoan.status !== "paid_off") {
                throw new Error("Status pinjaman sudah berubah. Silakan refresh halaman.");
            }

            if (currentLoan.payments.length > 0) {
                throw new Error("Terdapat pembayaran baru. Batalkan pembayaran terlebih dahulu.");
            }

            // 1. Update loan status and financials
            const updated = await tx.loan.update({
                where: { id: loanId },
                data: {
                    status: "active",
                    paidOffDate: null,
                    principalPaid: newPrincipalPaid,
                    interestPaid: newInterestPaid,
                    principalOutstanding: newPrincipalOutstanding,
                    interestOutstanding: newInterestOutstanding,
                },
            });

            // 2. Clean up any orphaned payment allocations (safety)
            await tx.loanPaymentAllocation.deleteMany({
                where: { schedule: { loanId } },
            });

            // 3. Delete existing schedules
            await tx.loanSchedule.deleteMany({
                where: { loanId },
            });

            // 4. Regenerate schedules
            const tenorMonths = currentLoan.tenorMonths;
            const schedPrincipal = Math.floor(principalAmount / tenorMonths);
            const schedInterest = Number(currentLoan.interestAmount) / tenorMonths;
            const paidInstallmentCount = schedPrincipal > 0
                ? Math.floor(newPrincipalPaid / schedPrincipal)
                : 0;

            const schedules = [];
            for (let i = 1; i <= tenorMonths; i++) {
                const isPaid = i <= paidInstallmentCount;
                // Handle last installment remainder
                const sp = i === tenorMonths
                    ? principalAmount - schedPrincipal * (tenorMonths - 1)
                    : schedPrincipal;
                const si = Math.round(
                    i === tenorMonths
                        ? Number(currentLoan.interestAmount) - Math.round(schedInterest) * (tenorMonths - 1)
                        : schedInterest
                );

                schedules.push({
                    loanId,
                    installmentNo: i,
                    dueDate: new Date(
                        currentLoan.disbursementDate.getFullYear(),
                        currentLoan.disbursementDate.getMonth() + i,
                        1
                    ),
                    principalAmount: sp,
                    interestAmount: si,
                    totalAmount: sp + si,
                    principalPaid: isPaid ? sp : 0,
                    interestPaid: isPaid ? si : 0,
                    status: isPaid ? "paid" : "pending",
                    ...(isPaid ? { paidDate: new Date() } : {}),
                });
            }

            await tx.loanSchedule.createMany({ data: schedules });

            return updated;
        }, { timeout: 30000 });

        // ── Audit ─────────────────────────────────────────────
        const newData = {
            status: result.status,
            paidOffDate: result.paidOffDate,
            principalPaid: Number(result.principalPaid),
            interestPaid: Number(result.interestPaid),
            principalOutstanding: Number(result.principalOutstanding),
            interestOutstanding: Number(result.interestOutstanding),
        };

        try {
            await logAuditFromRequest(request, session, {
                action: "UPDATE",
                module: "Pinjaman",
                description: `Koreksi status pinjaman ${loan.loanNo}: LUNAS → AKTIF. Alasan: ${sanitizedReason}`,
                targetId: loanId,
                targetType: "loan",
                oldData,
                newData,
            });
        } catch (auditError) {
            console.warn("[correct-status] Audit log failed:", auditError);
        }

        console.log(`[LOAN-CORRECT] Loan ${loan.loanNo} (${loanId}) corrected: paid_off → active by User #${session.user.id}`);

        return NextResponse.json({
            message: `Status pinjaman ${loan.loanNo} berhasil dikoreksi dari LUNAS ke AKTIF.`,
            detail: `Sisa pokok: Rp ${newPrincipalOutstanding.toLocaleString("id-ID")}. Jadwal angsuran (${loan.tenorMonths} bulan) telah di-regenerasi.`,
            data: {
                ...result,
                principalPaid: Number(result.principalPaid),
                interestPaid: Number(result.interestPaid),
                principalOutstanding: Number(result.principalOutstanding),
                interestOutstanding: Number(result.interestOutstanding),
            },
        });

    } catch (error: any) {
        console.error("[correct-status] Error:", error);
        const message = error.message || "Gagal mengoreksi status pinjaman.";
        return NextResponse.json({ message }, { status: 500 });
    }
}
