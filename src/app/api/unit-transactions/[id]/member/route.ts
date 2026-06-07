import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";
import { isSameUnit } from "@/lib/unit-aliases";

// PATCH /api/unit-transactions/[id]/member
// Izinkan Admin Unit atau Operator untuk mengassign/update memberId pada transaksi
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

        // Only Admin atau Operator yang bisa edit memberId
        if (!isAdmin && !isOperator) {
            return NextResponse.json({ message: "Hanya Admin Unit atau Operator yang dapat mengubah data anggota transaksi" }, { status: 403 });
        }

        const resolvedParams = await params;
        const txId = Number(resolvedParams.id);
        if (isNaN(txId)) {
            return NextResponse.json({ message: "ID transaksi tidak valid" }, { status: 400 });
        }

        const body = await request.json();
        const { memberId } = body;

        if (!memberId) {
            return NextResponse.json({ message: "memberId diperlukan" }, { status: 400 });
        }

        // ── KONDISI KHUSUS TOKO (StoreSale) vs JASA (UnitTransaction) ──
        // Jika txId >= 1000000, maka ini adalah StoreSale (lihat GET /api/unit-transactions)
        const isStoreSale = txId >= 1000000;
        const realId = isStoreSale ? txId - 1000000 : txId;

        // Ambil transaksi & verifikasi unit jika admin (bukan operator)
        let tx;
        if (isStoreSale) {
            const ss = await prisma.storeSale.findUnique({
                where: { id: realId },
                select: { id: true, saleNo: true, unitType: true, memberId: true, metadata: true },
            });
            if (ss) {
                const metadataObj = typeof ss.metadata === "string" ? JSON.parse(ss.metadata) : ss.metadata || {};
                tx = { ...ss, transactionNo: ss.saleNo, status: metadataObj.isVoided ? "voided" : "completed" };
            }
        } else {
            tx = await prisma.unitTransaction.findUnique({
                where: { id: realId },
                select: { id: true, transactionNo: true, unitType: true, memberId: true, status: true },
            });
        }

        if (!tx) {
            return NextResponse.json({ message: "Transaksi tidak ditemukan" }, { status: 404 });
        }

        // Admin hanya bisa edit transaksi di unitnya sendiri
        if (isAdmin && !isOperator && userUnitType && !isSameUnit(tx.unitType, userUnitType)) {
            return NextResponse.json({ message: "Anda hanya dapat mengedit transaksi di unit Anda sendiri" }, { status: 403 });
        }

        // Tidak bisa edit transaksi yang sudah di-void
        if (tx.status === "voided") {
            return NextResponse.json({ message: "Tidak dapat mengubah transaksi yang sudah dibatalkan (voided)" }, { status: 400 });
        }

        // Verifikasi member ada
        const member = await prisma.member.findUnique({
            where: { id: Number(memberId) },
            select: { id: true, name: true, nrp: true },
        });

        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        }

        // Update memberId
        let updatedTx;
        if (isStoreSale) {
             const updated = await prisma.storeSale.update({
                  where: { id: realId },
                  data: { memberId: member.id },
                  select: { id: true, saleNo: true, memberId: true },
             });
             updatedTx = { ...updated, transactionNo: updated.saleNo };
        } else {
             updatedTx = await prisma.unitTransaction.update({
                  where: { id: realId },
                  data: { memberId: member.id },
                  select: { id: true, transactionNo: true, memberId: true },
             });
        }

        // Audit log
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "UPDATE", module: "Unit_Layanan",
                description: `Edit Member: Transaksi ${tx.transactionNo} dikaitkan ke ${member.name} (NRP: ${member.nrp || "-"})`,
                targetId: String(txId), targetType: "UnitTransaction",
                oldData: { memberId: tx.memberId },
                newData: { memberId: member.id, memberName: member.name },
            });
        } catch (e) { /* audit failure must not break response */ }

        return NextResponse.json({
            data: { transactionNo: tx.transactionNo, memberId: updatedTx.memberId, memberName: member.name },
            message: `Anggota ${member.name} berhasil dikaitkan ke transaksi ${tx.transactionNo}`,
        });

    } catch (error) {
        console.error("PATCH /api/unit-transactions/[id]/member error:", error);
        return NextResponse.json({ message: "Gagal mengupdate data anggota" }, { status: 500 });
    }
}
