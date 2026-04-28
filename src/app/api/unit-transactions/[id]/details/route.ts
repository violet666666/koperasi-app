import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

/**
 * PATCH /api/unit-transactions/[id]/details
 * Update plat nomor, keterangan, dan/atau tanggal transaksi.
 * Body: { vehiclePlate?: string, description?: string, transactionDate?: string }
 *
 * Hanya Admin Unit (unit sendiri) atau Operator yang bisa akses.
 * Tidak bisa edit transaksi yang sudah voided.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userRole = (session.user as any).role ?? session.user.role;
        const userUnitType = (session.user as any).unitType;
        const isOperator = userRole === "operator" || session.user.permissions?.includes("manage_all");
        const isAdmin = userRole === "admin";

        if (!isAdmin && !isOperator) {
            return NextResponse.json({ message: "Hanya Admin Unit atau Operator yang dapat mengubah detail transaksi" }, { status: 403 });
        }

        const resolvedParams = await params;
        const txId = Number(resolvedParams.id);
        if (isNaN(txId)) {
            return NextResponse.json({ message: "ID transaksi tidak valid" }, { status: 400 });
        }

        const body = await request.json();
        const { vehiclePlate, description, transactionDate } = body;

        if (vehiclePlate === undefined && description === undefined && transactionDate === undefined) {
            return NextResponse.json({ message: "Tidak ada data yang akan diubah" }, { status: 400 });
        }

        // Validate transactionDate format
        if (transactionDate !== undefined) {
            const parsed = new Date(transactionDate);
            if (isNaN(parsed.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
                return NextResponse.json({ message: "Format tanggal tidak valid. Gunakan YYYY-MM-DD" }, { status: 400 });
            }
        }

        // Ambil transaksi
        const tx = await prisma.unitTransaction.findUnique({
            where: { id: txId },
            select: { id: true, transactionNo: true, unitType: true, status: true, notes: true, description: true, transactionDate: true },
        });

        if (!tx) {
            return NextResponse.json({ message: "Transaksi tidak ditemukan" }, { status: 404 });
        }

        // Admin hanya bisa edit transaksi di unitnya sendiri
        if (isAdmin && !isOperator && userUnitType && tx.unitType !== userUnitType) {
            return NextResponse.json({ message: "Anda hanya dapat mengedit transaksi di unit Anda sendiri" }, { status: 403 });
        }

        if (tx.status === "voided") {
            return NextResponse.json({ message: "Tidak dapat mengubah transaksi yang sudah dibatalkan" }, { status: 400 });
        }

        // Build update data
        const updateData: Record<string, unknown> = {};

        // Update plat nomor: disimpan di field `notes` dengan format [PLAT:xxx]
        if (vehiclePlate !== undefined) {
            const existingNotes = tx.notes || "";
            // Remove existing [PLAT:...] tag
            const notesWithoutPlat = existingNotes.replace(/\[PLAT:[^\]]*\]/gi, "").trim();
            const newPlat = vehiclePlate.trim();
            updateData.notes = newPlat
                ? (notesWithoutPlat ? `${notesWithoutPlat} [PLAT:${newPlat}]` : `[PLAT:${newPlat}]`)
                : notesWithoutPlat;
        }

        // Update keterangan
        if (description !== undefined) {
            updateData.description = description.trim();
        }

        // Update tanggal transaksi — sync ke CashBankTransaction juga
        if (transactionDate !== undefined) {
            updateData.transactionDate = new Date(transactionDate);
        }

        // Run update + sync CashBankTransaction in transaction
        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.unitTransaction.update({
                where: { id: txId },
                data: updateData,
                select: { id: true, transactionNo: true, notes: true, description: true, transactionDate: true },
            });

            // Sync date to related CashBankTransaction
            if (transactionDate !== undefined) {
                await tx.cashBankTransaction.updateMany({
                    where: {
                        referenceType: 'unit_transaction',
                        referenceId: txId,
                    },
                    data: { transactionDate: new Date(transactionDate) },
                });
            }

            return result;
        });

        // Audit log
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            const changes: string[] = [];
            if (vehiclePlate !== undefined) changes.push('plat');
            if (description !== undefined) changes.push('keterangan');
            if (transactionDate !== undefined) changes.push('tanggal');
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "UPDATE", module: "Unit_Layanan",
                description: `Edit Detail: Transaksi ${tx.transactionNo} — ${changes.join(', ')} diperbarui`,
                targetId: String(txId), targetType: "UnitTransaction",
                oldData: { notes: tx.notes, description: tx.description, transactionDate: tx.transactionDate },
                newData: updateData,
            });
        } catch (e) { /* audit failure tidak blocking */ }

        return NextResponse.json({
            data: updated,
            message: `Detail transaksi ${tx.transactionNo} berhasil diperbarui`,
        });

    } catch (error) {
        console.error("PATCH /api/unit-transactions/[id]/details error:", error);
        return NextResponse.json({ message: "Gagal memperbarui detail transaksi" }, { status: 500 });
    }
}
