import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ periodId: string }>;
}

export async function GET(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { periodId } = await params;
        const id = parseInt(periodId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid periodId" }, { status: 400 });
        }

        const period = await prisma.payrollPeriod.findUnique({
            where: { id },
            include: {
                createdBy: { select: { name: true } },
                slips: {
                    orderBy: { nama: "asc" },
                    include: {
                        member: { select: { id: true, name: true, nrp: true } },
                    },
                },
            },
        });

        if (!period) {
            return NextResponse.json({ message: "Periode tidak ditemukan" }, { status: 404 });
        }

        return NextResponse.json({
            data: {
                period: {
                    id: period.id,
                    periodName: period.periodName,
                    periodMonth: period.periodMonth,
                    periodYear: period.periodYear,
                    sourceFile: period.sourceFile,
                    sourceType: period.sourceType,
                    status: period.status,
                    totalMembers: period.totalMembers,
                    totalGaji: Number(period.totalGaji),
                    totalPotongan: Number(period.totalPotongan),
                    createdByName: period.createdBy?.name,
                    createdAt: period.createdAt,
                },
                slips: period.slips.map(s => ({
                    id: s.id,
                    nrp: s.nrp,
                    nama: s.nama,
                    pangkat: s.pangkat,
                    gajiBersih: Number(s.gajiBersih),
                    tunkin: Number(s.tunkin),
                    potTajib: Number(s.potTajib),
                    potSP: Number(s.potSP),
                    potBarang: Number(s.potBarang),
                    potSukarela: Number(s.potSukarela),
                    potKoperasiLain: Number(s.potKoperasiLain),
                    totalPotKoperasi: Number(s.totalPotKoperasi),
                    sisaGaji: Number(s.sisaGaji),
                    sisaTunkin: Number(s.sisaTunkin),
                    otherDeductions: s.otherDeductions,
                    jumlahPotNonBRI: Number(s.jumlahPotNonBRI),
                    jumlahPotBRI: Number(s.jumlahPotBRI),
                    terimaBersih: Number(s.terimaBersih),
                    sisaRekening: Number(s.sisaRekening),
                    bisaDiambilATM: Number(s.bisaDiambilATM),
                    memberId: s.memberId,
                    memberName: s.member?.name,
                })),
            },
        });
    } catch (error: unknown) {
        console.error("GET /api/payroll/[periodId] error:", error);
        return NextResponse.json({ message: "Gagal memuat detail periode" }, { status: 500 });
    }
}
