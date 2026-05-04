import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const periods = await prisma.payrollPeriod.findMany({
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
            include: {
                createdBy: { select: { name: true } },
                _count: { select: { slips: true } },
            },
        });

        return NextResponse.json({
            data: periods.map(p => ({
                id: p.id,
                periodName: p.periodName,
                periodMonth: p.periodMonth,
                periodYear: p.periodYear,
                sourceFile: p.sourceFile,
                sourceType: p.sourceType,
                status: p.status,
                totalMembers: p.totalMembers,
                totalGaji: Number(p.totalGaji),
                totalPotongan: Number(p.totalPotongan),
                createdByName: p.createdBy?.name,
                createdAt: p.createdAt,
                slipCount: p._count.slips,
            })),
        });
    } catch (error: unknown) {
        console.error("GET /api/payroll error:", error);
        return NextResponse.json({ message: "Gagal memuat data payroll" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as { name: string })?.name;
        if (roleName !== "admin" && roleName !== "super_admin") {
            return NextResponse.json({ message: "Hanya admin yang dapat menghapus data gaji" }, { status: 403 });
        }
        const { periodId } = await request.json();
        if (!periodId) {
            return NextResponse.json({ message: "periodId wajib" }, { status: 400 });
        }

        // Fetch period info before deletion for audit trail
        const period = await prisma.payrollPeriod.findUnique({
            where: { id: periodId },
            select: { periodName: true, totalMembers: true },
        });

        await prisma.payrollPeriod.delete({ where: { id: periodId } });

        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "DELETE", module: "Payroll",
                description: `Hapus periode gaji ${period?.periodName || periodId}: ${period?.totalMembers || 0} anggota`,
                oldData: { periodId, periodName: period?.periodName },
            });
        } catch (e) { /* non-blocking */ }

        return NextResponse.json({ message: "Periode gaji berhasil dihapus" });
    } catch (error: unknown) {
        console.error("DELETE /api/payroll error:", error);
        return NextResponse.json({ message: "Gagal menghapus periode gaji" }, { status: 500 });
    }
}
