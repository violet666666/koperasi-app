import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const targetDate = new Date('2026-04-08T00:00:00.000Z');
    
    // Temukan semua pinjaman sebelum 8 April yang memiliki bunga lebih besar dari 1% (misal 3.6%)
    const loans = await prisma.loan.findMany({
        where: {
            createdAt: { lt: targetDate },
            interestRate: { gt: 1 } // Mengambil yang 3.6%
        },
        include: {
            schedules: {
                orderBy: { installmentNo: 'asc' }
            },
            payments: true
        }
    });

    console.log(`=========================================`);
    console.log(`HASIL ANALISIS PINJAMAN SEBELUM 8 APRIL`);
    console.log(`Total pinjaman ditemukan: ${loans.length}`);
    console.log(`=========================================\n`);

    let affectedCount = 0;
    let loansWithPayments = 0;

    for (const l of loans) {
        affectedCount++;
        const pAmount = Number(l.principalAmount);
        
        // Perhitungan sistem saat ini (bunga lama)
        const oldTotalInterest = Number(l.interestAmount);
        const oldInstallment = Number(l.monthlyInstallment);

        // Perhitungan sistem baru (bunga 1%)
        const newInterestPerMonth = Math.round(pAmount * 0.01);
        const newTotalInterest = newInterestPerMonth * l.tenorMonths;
        const newTotalAmount = pAmount + newTotalInterest;
        const newMonthlyInstallment = Math.round(pAmount / l.tenorMonths) + newInterestPerMonth;

        const hasPayments = l.payments.length > 0;
        if (hasPayments) loansWithPayments++;

        console.log(`Pinjaman ID: ${l.id} | No: ${l.loanNo} | Tgl: ${l.createdAt.toISOString().split('T')[0]}`);
        console.log(`Status Pembayaran: ${hasPayments ? 'SUDAH ADA PEMBAYARAN' : 'Belum ada pembayaran'}`);
        console.log(`Pokok: Rp ${pAmount.toLocaleString('id-ID')} | Tenor: ${l.tenorMonths} bulan`);
        console.log(`Bunga Lama (${l.interestRate}%): Total Rp ${oldTotalInterest.toLocaleString('id-ID')} | Cicilan Rp ${oldInstallment.toLocaleString('id-ID')}/bln`);
        console.log(`Bunga Baru (1%): Total Rp ${newTotalInterest.toLocaleString('id-ID')} | Cicilan Rp ${newMonthlyInstallment.toLocaleString('id-ID')}/bln`);
        
        // Log perbedaan jadwal
        let paidSchedules = 0;
        for (const s of l.schedules) {
            if (s.status === 'paid' || s.status === 'partial') paidSchedules++;
        }
        console.log(`Jadwal: ${l.schedules.length} bulan (${paidSchedules} bulan sudah/sedang dibayar)\n`);
    }

    console.log(`Ringkasan:`);
    console.log(`- Total pinjaman perlu diubah: ${affectedCount}`);
    console.log(`- Pinjaman yang SUDAH memiliki transaksi pembayaran: ${loansWithPayments}`);
    console.log(`\nPENTING: Jika ada pinjaman yang sudah dibayar (schedules berstatus 'paid'), merubah total bunga secara keseluruhan membutuhkan penyesuaian porsi bunga yang sudah dibayarkan.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
