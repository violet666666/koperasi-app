import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test.local" });
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const targetDate = new Date('2026-04-08T00:00:00.000Z');
    const NEW_RATE = 1; // 1% per bulan

    // 1. Temukan semua pinjaman sebelum 8 April yang bukan 0% & bukan 1%
    const loans = await prisma.loan.findMany({
        where: {
            createdAt: { lt: targetDate },
            interestRate: { not: new Prisma.Decimal(NEW_RATE) },
            status: "active",
        },
        include: {
            schedules: { orderBy: { installmentNo: "asc" } },
            payments: true,
        },
    });

    console.log(`\n================================================`);
    console.log(`SCRIPT PERBAIKAN BUNGA PINJAMAN -> 1% FLAT`);
    console.log(`Target: Pinjaman aktif sebelum ${targetDate.toISOString().split('T')[0]}`);
    console.log(`Total pinjaman ditemukan: ${loans.length}`);
    console.log(`================================================\n`);

    if (loans.length === 0) {
        console.log("✅ Tidak ada pinjaman yang perlu diperbaiki. Semua sudah 1% atau tidak ada.");

        // Cek juga apakah ada data pinjaman sama sekali
        const allLoansCount = await prisma.loan.count();
        console.log(`(Total pinjaman di database: ${allLoansCount})`);

        if (allLoansCount === 0) {
            console.log(`\n⚠️  Database ini tidak memiliki pinjaman aktif sama sekali.`);
            console.log(`   Pastikan Anda terkoneksi ke database PRODUCTION yang benar.\n`);
        }
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const loan of loans) {
        try {
            const principalAmount = Number(loan.principalAmount);
            const tenorMonths = loan.tenorMonths;
            const oldRate = Number(loan.interestRate);

            // Hitung ulang dengan bunga 1% flat
            const newInterestPerMonth = Math.round(principalAmount * 0.01);
            const newTotalInterest = newInterestPerMonth * tenorMonths;
            const newTotalAmount = principalAmount + newTotalInterest;
            const newMonthlyInstallment = Math.round(principalAmount / tenorMonths) + newInterestPerMonth;

            console.log(`📝 Loan #${loan.id} (${loan.loanNo}):`);
            console.log(`   Pokok: Rp ${principalAmount.toLocaleString('id-ID')}, Tenor: ${tenorMonths} bulan`);
            console.log(`   Bunga Lama: ${oldRate}% -> Bunga Baru: ${NEW_RATE}%`);
            console.log(`   Total Bunga: ${Number(loan.interestAmount).toLocaleString('id-ID')} -> ${newTotalInterest.toLocaleString('id-ID')}`);
            console.log(`   Cicilan/bln: ${Number(loan.monthlyInstallment).toLocaleString('id-ID')} -> ${newMonthlyInstallment.toLocaleString('id-ID')}`);

            // Check safety: tidak boleh ada pembayaran
            if (loan.payments.length > 0) {
                console.log(`   ❌ DILEWATI: Sudah ada ${loan.payments.length} pembayaran!`);
                errorCount++;
                continue;
            }

            await prisma.$transaction(async (tx) => {
                // 1. Update Loan
                await tx.loan.update({
                    where: { id: loan.id },
                    data: {
                        interestRate: NEW_RATE,
                        interestAmount: newTotalInterest,
                        totalAmount: newTotalAmount,
                        monthlyInstallment: newMonthlyInstallment,
                        interestOutstanding: newTotalInterest,
                    },
                });

                // 2. Update semua Schedules
                const principalPerMonth = Math.floor(principalAmount / tenorMonths);
                const newInterestPerSchedule = Math.floor(newTotalInterest / tenorMonths);

                for (let i = 0; i < loan.schedules.length; i++) {
                    const schedule = loan.schedules[i];
                    const isLast = i === loan.schedules.length - 1;

                    let schedPrincipal = principalPerMonth;
                    let schedInterest = newInterestPerSchedule;

                    // Fix rounding pada cicilan terakhir
                    if (isLast) {
                        const totalPrevPrincipal = principalPerMonth * (tenorMonths - 1);
                        schedPrincipal = principalAmount - totalPrevPrincipal;
                        
                        const totalPrevInterest = newInterestPerSchedule * (tenorMonths - 1);
                        schedInterest = newTotalInterest - totalPrevInterest;
                    }

                    await tx.loanSchedule.update({
                        where: { id: schedule.id },
                        data: {
                            interestAmount: schedInterest,
                            totalAmount: schedPrincipal + schedInterest,
                        },
                    });
                }
            });

            console.log(`   ✅ BERHASIL diperbaiki!`);
            successCount++;
        } catch (err) {
            console.error(`   ❌ GAGAL: ${(err as any).message}`);
            errorCount++;
        }
    }

    console.log(`\n================================================`);
    console.log(`HASIL EKSEKUSI:`);
    console.log(`  ✅ Berhasil: ${successCount}`);
    console.log(`  ❌ Gagal/Dilewati: ${errorCount}`);
    console.log(`================================================\n`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
