import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const member = await prisma.member.findUnique({
            where: { id: session.user.memberId },
            select: { nrp: true, memberNo: true },
        });

        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        }

        // Find all slips for this member (by memberId or NRP matching)
        const slips = await prisma.payrollSlip.findMany({
            where: {
                OR: [
                    { memberId: session.user.memberId },
                    { nrp: member.nrp || member.memberNo },
                ],
            },
            include: { period: true },
            orderBy: [{ period: { periodYear: "desc" } }, { period: { periodMonth: "desc" } }],
        });

        return NextResponse.json({
            data: slips.map(s => ({
                slipId: s.id,
                periodName: s.period.periodName,
                periodId: s.period.id,
                gajiBersih: Number(s.gajiBersih),
                totalPotKoperasi: Number(s.totalPotKoperasi),
                sisaGaji: Number(s.sisaGaji),
                terimaBersih: Number(s.terimaBersih),
                bisaDiambilATM: Number(s.bisaDiambilATM),
            })),
        });
    } catch (error: unknown) {
        console.error("GET /api/member-portal/payroll error:", error);
        return NextResponse.json({ message: "Gagal memuat data slip gaji" }, { status: 500 });
    }
}
