import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/unit-transactions/void-request
 * Kasir mengajukan permintaan pembatalan (Void) ke Admin Unit.
 * Transaksi tidak dihapus — statusnya berubah ke 'pending_void' dan
 * sebuah ApprovalRequest baru dibuat untuk disetujui Admin.
 *
 * Body: { transactionNo: string, reason: string }
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { transactionNo, reason } = body;

        if (!transactionNo || !reason) {
            return NextResponse.json(
                { message: "transactionNo dan reason wajib diisi" },
                { status: 400 }
            );
        }

        // Cari transaksi
        const transaction = await prisma.unitTransaction.findUnique({
            where: { transactionNo: String(transactionNo) },
            include: {
                member: { select: { id: true, name: true, nrp: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });

        if (!transaction) {
            return NextResponse.json(
                { message: `Transaksi ${transactionNo} tidak ditemukan.` },
                { status: 404 }
            );
        }

        if (transaction.status !== "completed") {
            return NextResponse.json(
                {
                    message: `Transaksi tidak bisa diajukan void karena statusnya sudah: ${transaction.status}`,
                },
                { status: 409 }
            );
        }

        const currentUserId = parseInt(session.user.id);

        // Kasir hanya bisa void transaksi miliknya sendiri
        if (
            session.user.role === "kasir" &&
            transaction.createdById !== currentUserId
        ) {
            return NextResponse.json(
                {
                    message:
                        "Anda hanya dapat mengajukan void untuk transaksi yang Anda buat sendiri.",
                },
                { status: 403 }
            );
        }

        // Gunakan prisma.$transaction agar atomik
        const [updatedTx, approvalReq] = await prisma.$transaction([
            // 1. Update status transaksi ke pending_void
            prisma.unitTransaction.update({
                where: { id: transaction.id },
                data: {
                    status: "pending_void",
                    voidReason: reason,
                    voidRequestedById: currentUserId,
                    voidRequestedAt: new Date(),
                },
            }),

            // 2. Buat ApprovalRequest baru
            prisma.approvalRequest.create({
                data: {
                    requestNo: `VD-${Date.now()}-${Math.random()
                        .toString(36)
                        .substring(2, 5)
                        .toUpperCase()}`,
                    type: "unit_void",
                    referenceType: "unit_transaction",
                    referenceId: transaction.id,
                    branchId: 1, // Default branch
                    amount: transaction.amount,
                    description: `Pembatalan Transaksi [${transactionNo}] dari Unit ${transaction.unitType.toUpperCase()} — ${reason}`,
                    metadata: {
                        transactionNo: transaction.transactionNo,
                        unitType: transaction.unitType,
                        memberName: transaction.member?.name || "-",
                        memberNrp: transaction.member?.nrp || "-",
                        originalAmount: Number(transaction.amount),
                        kasirName: transaction.createdBy?.name || "-",
                    },
                    requestedById: currentUserId,
                    requestedAt: new Date(),
                    status: "pending",
                },
            }),
        ]);

        return NextResponse.json(
            {
                message: "Permintaan void berhasil diajukan. Menunggu persetujuan Admin Unit.",
                data: {
                    transactionNo: updatedTx.transactionNo,
                    status: updatedTx.status,
                    approvalRequestNo: approvalReq.requestNo,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/unit-transactions/void-request error:", error);
        return NextResponse.json(
            { message: "Gagal mengajukan void transaksi" },
            { status: 500 }
        );
    }
}
