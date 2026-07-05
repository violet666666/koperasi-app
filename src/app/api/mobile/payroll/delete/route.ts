import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../middleware";

/**
 * POST /api/mobile/payroll/delete  (mobile-friendly POST instead of DELETE-with-body)
 * Mobile parity of web DELETE /api/payroll (Fase 8c T3). Operator-only.
 *
 * Body (JSON): { periodId }. Cascades slips via FK.
 * sisaGaji is NOT reset on delete — parity with web (pre-existing web bug, flagged
 * separately; do NOT fix here).
 * P2025 (record not found) → 404 (more precise than web's generic 500).
 */
export async function POST(request: Request) {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "operator") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { periodId } = await request.json();
        if (!periodId || isNaN(parseInt(periodId))) {
            return NextResponse.json({ message: "periodId wajib dan harus berupa angka" }, { status: 400 });
        }
        const id = parseInt(periodId);

        // Fetch period info before deletion for the audit trail.
        const period = await prisma.payrollPeriod.findUnique({
            where: { id },
            select: { periodName: true, totalMembers: true },
        });

        await prisma.payrollPeriod.delete({ where: { id } });
        // Slips cascade via FK. sisaGaji intentionally NOT reset (web parity).

        await prisma.auditLog.create({
            data: {
                action: "DELETE",
                module: "Payroll",
                description: `Hapus periode gaji ${period?.periodName || id}: ${period?.totalMembers || 0} anggota`,
                userId: Number(user.id),
                userName: user.name,
                userRole: user.role,
                status: "success",
                oldData: JSON.stringify({ periodId: id, periodName: period?.periodName }),
            },
        }).catch(() => { /* audit failure non-blocking */ });

        return NextResponse.json({ message: "Periode gaji berhasil dihapus" });
    } catch (error: unknown) {
        // P2025 = Prisma "record not found" on delete.
        if ((error as { code?: string })?.code === "P2025") {
            return NextResponse.json({ message: "Periode tidak ditemukan" }, { status: 404 });
        }
        console.error("POST /api/mobile/payroll/delete error:", error);
        return NextResponse.json({ message: "Gagal menghapus periode gaji" }, { status: 500 });
    }
}
