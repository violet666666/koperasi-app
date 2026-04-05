import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/unit-transactions/void-approve
 * Admin Unit / Operator menyetujui atau menolak permintaan void.
 *
 * Jika APPROVE:
 *   1. Buat baris Contra-Entry baru di unit_transactions (nilai minus / negatif)
 *   2. Update transaksi asli: status = 'voided'
 *   3. Update ApprovalRequest: status = 'approved'
 *   → Sisa limit anggota otomatis pulih karena SUM hanya ambil status != 'voided'
 *
 * Jika REJECT:
 *   1. Update transaksi asli kembali ke: status = 'completed'
 *   2. Update ApprovalRequest: status = 'rejected'
 *
 * Body: { approvalRequestNo: string, action: 'approved' | 'rejected', notes?: string }
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Hanya Admin Unit dan Operator yang bisa approve
        const allowedRoles = ["operator", "admin", "super_admin", "admin_unit"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json(
                { message: "Anda tidak memiliki izin untuk menyetujui/menolak void." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { approvalRequestNo, action, notes } = body;

        if (!approvalRequestNo || !action) {
            return NextResponse.json(
                { message: "approvalRequestNo dan action wajib diisi" },
                { status: 400 }
            );
        }

        if (!["approved", "rejected"].includes(action)) {
            return NextResponse.json(
                { message: "action harus 'approved' atau 'rejected'" },
                { status: 400 }
            );
        }

        // Cari ApprovalRequest
        const approvalReq = await prisma.approvalRequest.findUnique({
            where: { requestNo: String(approvalRequestNo) },
        });

        if (!approvalReq) {
            return NextResponse.json(
                { message: `ApprovalRequest ${approvalRequestNo} tidak ditemukan.` },
                { status: 404 }
            );
        }

        if (approvalReq.status !== "pending") {
            return NextResponse.json(
                { message: `Request ini sudah diproses sebelumnya (status: ${approvalReq.status}).` },
                { status: 409 }
            );
        }

        // Cari transaksi asli
        const originalTx = await prisma.unitTransaction.findUnique({
            where: { id: approvalReq.referenceId },
            include: {
                member: { select: { id: true, name: true, nrp: true } },
            },
        });

        if (!originalTx) {
            return NextResponse.json(
                { message: "Transaksi asli tidak ditemukan." },
                { status: 404 }
            );
        }

        const currentUserId = parseInt(session.user.id);
        const now = new Date();

        if (action === "approved") {
            // ── CONTRA-ENTRY: Buat transaksi pembalik ──────────────────────
            const contraNo = `CE-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 5)
                .toUpperCase()}`;

            // Hash keamanan untuk contra-entry
            const hashInput = `${originalTx.member?.nrp || "UMUM"}-${-Number(originalTx.amount)}-${contraNo}-${now.toISOString()}`;
            const securityHash = crypto.createHash("sha256").update(hashInput).digest("hex");

            await prisma.$transaction([
                // 1. Buat Contra-Entry (nilai negatif sebagai jejak pembalik)
                prisma.unitTransaction.create({
                    data: {
                        transactionNo: contraNo,
                        memberId: originalTx.memberId,
                        unitType: originalTx.unitType,
                        description: `[VOID] Pembatalan ${originalTx.transactionNo} — ${originalTx.description}`,
                        amount: -Number(originalTx.amount), // NILAI NEGATIF
                        loanAmount: -Number(originalTx.loanAmount),
                        transactionDate: now,
                        paymentMethod: originalTx.paymentMethod,
                        isPaid: true,
                        paidDate: now,
                        notes: `Contra-Entry untuk void ref: ${originalTx.transactionNo}. Alasan: ${originalTx.voidReason || "-"}`,
                        status: "voided",
                        voidRef: originalTx.transactionNo,
                        voidReason: originalTx.voidReason,
                        voidedById: currentUserId,
                        voidedAt: now,
                        securityHash,
                        createdById: currentUserId,
                    },
                }),

                // 2. Update transaksi asli: status = voided
                prisma.unitTransaction.update({
                    where: { id: originalTx.id },
                    data: {
                        status: "voided",
                        voidedById: currentUserId,
                        voidedAt: now,
                    },
                }),

                // 3. Update ApprovalRequest: approved
                prisma.approvalRequest.update({
                    where: { id: approvalReq.id },
                    data: {
                        status: "approved",
                        approvedById: currentUserId,
                        approvedAt: now,
                        rejectionReason: notes || null,
                    },
                }),
            ]);

            return NextResponse.json({
                message: `Void disetujui. Contra-Entry [${contraNo}] berhasil dibuat. Limit anggota telah dipulihkan.`,
                data: {
                    originalTransactionNo: originalTx.transactionNo,
                    contraEntryNo: contraNo,
                    action: "approved",
                },
            });
        } else {
            // ── REJECTED: Kembalikan status transaksi ke 'completed' ──────
            await prisma.$transaction([
                // 1. Kembalikan status transaksi asli
                prisma.unitTransaction.update({
                    where: { id: originalTx.id },
                    data: {
                        status: "completed",
                        voidReason: null,
                        voidRequestedById: null,
                        voidRequestedAt: null,
                    },
                }),

                // 2. Update ApprovalRequest: rejected
                prisma.approvalRequest.update({
                    where: { id: approvalReq.id },
                    data: {
                        status: "rejected",
                        rejectedById: currentUserId,
                        rejectedAt: now,
                        rejectionReason: notes || "Ditolak oleh Admin Unit.",
                    },
                }),
            ]);

            return NextResponse.json({
                message: `Permintaan void ditolak. Transaksi [${originalTx.transactionNo}] kembali aktif.`,
                data: {
                    originalTransactionNo: originalTx.transactionNo,
                    action: "rejected",
                },
            });
        }
    } catch (error) {
        console.error("POST /api/unit-transactions/void-approve error:", error);
        return NextResponse.json(
            { message: "Gagal memproses persetujuan void" },
            { status: 500 }
        );
    }
}
