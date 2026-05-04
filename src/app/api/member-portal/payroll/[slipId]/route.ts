import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ slipId: string }>;
}

export async function GET(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { slipId } = await params;
        const id = parseInt(slipId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid slipId" }, { status: 400 });
        }

        const member = await prisma.member.findUnique({
            where: { id: session.user.memberId },
            select: { nrp: true, memberNo: true },
        });

        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        }

        const slip = await prisma.payrollSlip.findUnique({
            where: { id },
            include: { period: true },
        });

        if (!slip) {
            return NextResponse.json({ message: "Slip tidak ditemukan" }, { status: 404 });
        }

        // Verify this slip belongs to the logged-in member
        const isOwner = slip.memberId === session.user.memberId
            || slip.nrp === member.nrp
            || slip.nrp === member.memberNo;
        if (!isOwner) {
            return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
        }

        return NextResponse.json({
            data: {
                id: slip.id,
                period: {
                    id: slip.period.id,
                    periodName: slip.period.periodName,
                    periodMonth: slip.period.periodMonth,
                    periodYear: slip.period.periodYear,
                },
                nrp: slip.nrp,
                nama: slip.nama,
                pangkat: slip.pangkat,
                gajiBersih: Number(slip.gajiBersih),
                tunkin: Number(slip.tunkin),
                potTajib: Number(slip.potTajib),
                potSP: Number(slip.potSP),
                potBarang: Number(slip.potBarang),
                potSukarela: Number(slip.potSukarela),
                potKoperasiLain: Number(slip.potKoperasiLain),
                totalPotKoperasi: Number(slip.totalPotKoperasi),
                sisaGaji: Number(slip.sisaGaji),
                sisaTunkin: Number(slip.sisaTunkin),
                otherDeductions: slip.otherDeductions as Record<string, number> | null,
                jumlahPotNonBRI: Number(slip.jumlahPotNonBRI),
                jumlahPotBRI: Number(slip.jumlahPotBRI),
                terimaBersih: Number(slip.terimaBersih),
                sisaRekening: Number(slip.sisaRekening),
                bisaDiambilATM: Number(slip.bisaDiambilATM),
            },
        });
    } catch (error: unknown) {
        console.error("GET /api/member-portal/payroll/[slipId] error:", error);
        return NextResponse.json({ message: "Gagal memuat slip gaji" }, { status: 500 });
    }
}
