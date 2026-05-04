import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ periodId: string; slipId: string }>;
}

export async function GET(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { periodId, slipId } = await params;
        const id = parseInt(slipId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid slipId" }, { status: 400 });
        }

        const slip = await prisma.payrollSlip.findUnique({
            where: { id },
            include: {
                period: true,
                member: { select: { id: true, name: true, nrp: true } },
            },
        });

        if (!slip) {
            return NextResponse.json({ message: "Slip tidak ditemukan" }, { status: 404 });
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
                memberId: slip.memberId,
            },
        });
    } catch (error: unknown) {
        console.error("GET /api/payroll/[periodId]/slip/[slipId] error:", error);
        return NextResponse.json({ message: "Gagal memuat slip" }, { status: 500 });
    }
}
