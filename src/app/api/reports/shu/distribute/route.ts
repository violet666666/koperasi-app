import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateSystemSHU } from "@/lib/services/shu-calculator";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const yearNum = parseInt(body.year);
        
        if (!yearNum || isNaN(yearNum)) {
            return NextResponse.json({ error: "Tahun tidak valid" }, { status: 400 });
        }

        // 1. Cek apakah sudah pernah didistribusikan / dikunci
        let period = await prisma.shuPeriod.findUnique({
            where: { year: yearNum }
        });

        if (period && period.status !== 'calculated') {
             return NextResponse.json({ error: "SHU untuk tahun ini sudah dikunci/distribusi" }, { status: 400 });
        }

        // 2. Kalkulasi ulang state terakhir sebelum kunci
        const data = await calculateSystemSHU(yearNum, null);

        // 3. Simpan ke database dengan transaction
        const result = await prisma.$transaction(async (tx) => {
            // Upsert Period
            const upsertedPeriod = await tx.shuPeriod.upsert({
                where: { year: yearNum },
                update: {
                    status: 'distributed',
                    totalIncome: data.totalIncome,
                    totalExpense: data.totalExpense,
                    netSurplus: data.netSurplus,
                    memberDividend: data.memberDividend,
                },
                create: {
                    year: yearNum,
                    status: 'distributed',
                    totalIncome: data.totalIncome,
                    totalExpense: data.totalExpense,
                    netSurplus: data.netSurplus,
                    memberDividend: data.memberDividend,
                }
            });

            // Delete old internal distributions if recreating
            await tx.shuDistribution.deleteMany({
                 where: { periodId: upsertedPeriod.id }
            });

            // Insert member distributions
            const chunkSize = 100;
            const distributions = data.memberDistribution.map(m => ({
                periodId: upsertedPeriod.id,
                memberId: m.id,
                modalPortion: m.modalPortion,
                usahaPortion: m.usahaPortion,
                totalAmount: m.shuAmount,
                status: 'pending' // Belum fisik dicairkan
            }));

            // Prisma createMany is fine here
            await tx.shuDistribution.createMany({
                data: distributions
            });

            return upsertedPeriod;
        }, {
             timeout: 20000 // Berikan waktu longgar untuk data ratusan anggota
        });

        return NextResponse.json({ 
             message: "Distribusi SHU berhasil dibekukan", 
             data: result 
        });

    } catch (error) {
        console.error("SHU distribution error:", error);
        return NextResponse.json({ error: "Terjadi kesalahan internal" }, { status: 500 });
    }
}
