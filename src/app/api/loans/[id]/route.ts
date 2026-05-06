import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

        // 3. Fetch loan + check eligibility
        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                _count: { select: { payments: true } },
                member: { select: { name: true, memberNo: true } },
            },
        });

        if (!loan) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan." }, { status: 404 });
        }

        if (loan.status !== "active") {
            return NextResponse.json(
                { message: `Pinjaman tidak dapat di-edit karena statusnya "${loan.status}". Hanya pinjaman aktif yang bisa di-edit.` },
                { status: 400 }
            );
        }

        if (loan._count.payments > 0) {
            return NextResponse.json(
                { message: "Pinjaman tidak dapat di-edit karena sudah memiliki riwayat pembayaran angsuran. Gunakan fitur VOID jika ingin membatalkan." },
                { status: 400 }
            );
        }

        // 4. Extract editable fields (all optional — only update what's sent)
        const newPrincipal = body.principalAmount !== undefined ? Number(body.principalAmount) : Number(loan.principalAmount);
        const newTenor = body.tenorMonths !== undefined ? Number(body.tenorMonths) : loan.tenorMonths;
        const newRate = body.interestRate !== undefined ? Number(body.interestRate) : Number(loan.interestRate);
        const newDisbursementDate = body.disbursementDate ? new Date(body.disbursementDate) : loan.disbursementDate;
        const newFirstDueDate = body.firstDueDate ? new Date(body.firstDueDate) : loan.firstDueDate;
        const newNotes = body.notes !== undefined ? body.notes : null;

        // 5. Validations
        if (newPrincipal <= 0) {
            return NextResponse.json({ message: "Pokok Pinjaman harus lebih besar dari 0." }, { status: 400 });
        }
        if (newTenor <= 0 || newTenor > 120) {
            return NextResponse.json({ message: "Tenor harus antara 1 - 120 bulan." }, { status: 400 });
        }
        if (newRate < 0 || newRate > 100) {
            return NextResponse.json({ message: "Suku Bunga harus antara 0% - 100%." }, { status: 400 });
        }
        if (isNaN(newDisbursementDate.getTime())) {
            return NextResponse.json({ message: "Tanggal Cair tidak valid." }, { status: 400 });
        }
        if (isNaN(newFirstDueDate.getTime())) {
            return NextResponse.json({ message: "Jatuh Tempo Pertama tidak valid." }, { status: 400 });
        }

        // 6. Recalculate financials (flat interest method)
        const adminFeePercent = 0.02; // 2% Potongan Resiko
        const adminFee = Math.round(newPrincipal * adminFeePercent);
        const interestPerMonth = Math.round(newPrincipal * (newRate / 100));
        const totalInterest = interestPerMonth * newTenor;
        const totalAmount = newPrincipal + totalInterest;
        const monthlyInstallment = Math.round(newPrincipal / newTenor) + interestPerMonth;
        const disbursedAmount = newPrincipal - adminFee;

        // Calculate lastDueDate from firstDueDate
        const lastDueDate = new Date(newFirstDueDate);
        lastDueDate.setMonth(lastDueDate.getMonth() + newTenor - 1);

        // 7. Atomic Transaction — update loan + regenerate schedules
        const userId = Number((session.user as any).id);

        const result = await prisma.$transaction(async (tx) => {
            // 7a. Delete old schedules
            await tx.loanSchedule.deleteMany({
                where: { loanId },
            });

            // 7b. Update loan record
            const updatedLoan = await tx.loan.update({
                where: { id: loanId },
                data: {
                    principalAmount: newPrincipal,
                    interestAmount: totalInterest,
                    totalAmount,
                    adminFee,
                    disbursedAmount,
                    tenorMonths: newTenor,
                    interestRate: newRate,
                    monthlyInstallment,
                    principalOutstanding: newPrincipal,
                    interestOutstanding: totalInterest,
                    principalPaid: 0,
                    interestPaid: 0,
                    lateFeePaid: 0,
                    disbursementDate: newDisbursementDate,
                    firstDueDate: newFirstDueDate,
                    lastDueDate,
                },
                include: {
                    member: { select: { id: true, memberNo: true, name: true } },
                    schedules: { orderBy: { installmentNo: "asc" } },
                },
            });

            // 7c. Generate new schedules
            const schedules = [];
            for (let i = 1; i <= newTenor; i++) {
                const dueDate = new Date(newFirstDueDate);
                dueDate.setMonth(dueDate.getMonth() + (i - 1));

                schedules.push({
                    loanId,
                    installmentNo: i,
                    dueDate,
                    principalAmount: Math.floor(newPrincipal / newTenor),
                    interestAmount: Math.floor(totalInterest / newTenor),
                    totalAmount: Math.floor(totalAmount / newTenor),
                    status: "pending",
                });
            }

            // Fix last installment rounding
            if (schedules.length > 0) {
                const last = schedules[schedules.length - 1];
                const installedPrincipal = Math.floor(newPrincipal / newTenor) * newTenor;
                const installedInterest = Math.floor(totalInterest / newTenor) * newTenor;
                last.principalAmount += (newPrincipal - installedPrincipal);
                last.interestAmount += (totalInterest - installedInterest);
                last.totalAmount = last.principalAmount + last.interestAmount;
            }

            await tx.loanSchedule.createMany({ data: schedules });

            // Re-fetch with schedules included
            const finalLoan = await tx.loan.findUnique({
                where: { id: loanId },
                include: {
                    member: { select: { id: true, memberNo: true, name: true } },
                    schedules: { orderBy: { installmentNo: "asc" } },
                    payments: { orderBy: { paymentDate: "desc" }, take: 10 },
                    branch: { select: { id: true, name: true } },
                    application: true,
                },
            });

            return finalLoan;
        });

        // 8. Build change summary for response
        const changes: string[] = [];
        if (body.principalAmount !== undefined) changes.push(`Pokok: ${formatRp(Number(loan.principalAmount))} → ${formatRp(newPrincipal)}`);
        if (body.tenorMonths !== undefined) changes.push(`Tenor: ${loan.tenorMonths} → ${newTenor} bulan`);
        if (body.interestRate !== undefined) changes.push(`Bunga: ${loan.interestRate}% → ${newRate}%`);
        if (body.disbursementDate) changes.push(`Tgl Cair: diperbarui`);
        if (body.firstDueDate) changes.push(`Jatuh Tempo Pertama: diperbarui`);
        if (body.notes !== undefined) changes.push(`Catatan: diperbarui`);

        console.log(`[LOAN-EDIT] Loan ${loan.loanNo} edited by User #${userId}. Changes: ${changes.join(", ")}`);

        return NextResponse.json({
            data: result,
            message: `Pinjaman ${loan.loanNo} berhasil di-edit. Jadwal angsuran (${newTenor} bulan) telah di-regenerasi.`,
            changes,
        });
    } catch (error: any) {
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

// Helper
function formatRp(n: number): string {
    return `Rp ${n.toLocaleString("id-ID")}`;
}
