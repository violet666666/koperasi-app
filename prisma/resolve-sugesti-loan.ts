import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.prod.local" });

const prisma = new PrismaClient();

async function main() {
    const loanNo = "LN-SP-mnf9ky60-0013";

    console.log(`\n🔍 Mencari Pinjaman ${loanNo}...`);
    const loan = await prisma.loan.findUnique({
        where: { loanNo },
        include: {
            member: true,
            schedules: {
                where: { status: { in: ["pending", "partial", "overdue"] } },
                orderBy: { installmentNo: "asc" }
            }
        }
    });

    if (!loan) {
        console.error(`❌ Pinjaman ${loanNo} tidak ditemukan di database!`);
        console.error(`Pastikan Anda menjalankan script ini di database yang benar (Production).`);
        return;
    }

    if (loan.status === "paid_off") {
        console.log(`✅ Pinjaman ${loanNo} sudah dalam status Lunas.`);
        return;
    }

    const principalOut = Number(loan.principalOutstanding);
    const interestOut = Number(loan.interestOutstanding);
    const paymentAmount = principalOut + interestOut;

    console.log(`👤 Anggota: ${loan.member.name}`);
    console.log(`💰 Sisa Pokok: Rp ${principalOut.toLocaleString("id-ID")}`);
    console.log(`📉 Sisa Bunga: Rp ${interestOut.toLocaleString("id-ID")}`);
    console.log(`📝 Total Tagihan yang Dihapuskan (Dibukukan): Rp ${paymentAmount.toLocaleString("id-ID")}`);

    console.log(`\n⚙️  Melunaskan Pinjaman tanpa mengubah Saldo Buku Kas...`);

    const admin = await prisma.user.findFirst();
    if (!admin) {
        console.error("Tidak ada user sama sekali untuk jadi createdBy");
        return;
    }

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Alokasikan pembayaran ke jadwal yang tersisa
            let remainingAmount = paymentAmount;
            let totalPrincipal = 0;
            let totalInterest = 0;
            let totalLateFee = 0;

            const allocations = [];

            for (const schedule of loan.schedules) {
                if (remainingAmount <= 0) break;

                const principalDue = Number(schedule.principalAmount) - Number(schedule.principalPaid);
                const interestDue = Number(schedule.interestAmount) - Number(schedule.interestPaid);
                const lateFeeDue = Number(schedule.lateFee) - Number(schedule.lateFeePaid);
                const totalDue = principalDue + interestDue + lateFeeDue;

                if (totalDue <= 0) continue;

                const payAmount = Math.min(remainingAmount, totalDue);

                let lateFeePay = Math.min(payAmount, lateFeeDue);
                let interestPay = Math.min(payAmount - lateFeePay, interestDue);
                let principalPay = payAmount - lateFeePay - interestPay;

                allocations.push({
                    scheduleId: schedule.id,
                    principalAmount: principalPay,
                    interestAmount: interestPay,
                    lateFeeAmount: lateFeePay,
                });

                totalPrincipal += principalPay;
                totalInterest += interestPay;
                totalLateFee += lateFeePay;
                remainingAmount -= payAmount;
            }

            // 2. Buat Catatan Pembayaran Pinjaman
            const paymentNo = `PAY-MANUAL-${Date.now()}`;
            const payment = await tx.loanPayment.create({
                data: {
                    paymentNo,
                    loanId: loan.id,
                    memberId: loan.memberId,
                    branchId: loan.branchId,
                    amount: paymentAmount,
                    principalPortion: totalPrincipal,
                    interestPortion: totalInterest,
                    lateFeePortion: totalLateFee,
                    paymentMethod: "bank_transfer",
                    referenceNo: "SINKRON-KAS-EXCEL",
                    notes: "Pelunasan manual - dana sudah masuk di Buku Kas BANK JATIM",
                    paymentDate: new Date("2024-12-09"), // Sesuai tanggal di excel jika memungkinkan, atau tanggal saat ini
                    createdById: admin.id, // User ID System
                    allocations: {
                        create: allocations
                    }
                }
            });

            // 3. Update Status Jadwal (Schedules)
            for (const alloc of allocations) {
                const schedule = loan.schedules.find(s => s.id === alloc.scheduleId)!;
                const newPrincipalPaid = Number(schedule.principalPaid) + alloc.principalAmount;
                const newInterestPaid = Number(schedule.interestPaid) + alloc.interestAmount;
                const newLateFeePaid = Number(schedule.lateFeePaid) + alloc.lateFeeAmount;
                const totalPaid = newPrincipalPaid + newInterestPaid + newLateFeePaid;
                const totalDue = Number(schedule.principalAmount) + Number(schedule.interestAmount) + Number(schedule.lateFee);

                await tx.loanSchedule.update({
                    where: { id: alloc.scheduleId },
                    data: {
                        principalPaid: newPrincipalPaid,
                        interestPaid: newInterestPaid,
                        lateFeePaid: newLateFeePaid,
                        status: totalPaid >= totalDue ? "paid" : "partial",
                        paidDate: totalPaid >= totalDue ? payment.paymentDate : null,
                    }
                });
            }

            // 4. Update Status Pinjaman Utama Menjadi Lunas
            await tx.loan.update({
                where: { id: loan.id },
                data: {
                    principalPaid: { increment: totalPrincipal },
                    interestPaid: { increment: totalInterest },
                    lateFeePaid: { increment: totalLateFee },
                    principalOutstanding: { decrement: totalPrincipal },
                    interestOutstanding: { decrement: totalInterest },
                    status: "paid_off",
                    paidOffDate: payment.paymentDate
                }
            });
        });

        console.log(`\n🎉 SUKSES! Pinjaman ${loanNo} telah lunas dan jadwal/saldo diperbarui.`);
        console.log(`Data Kas & Bank Anda dijamin tidak terdampak (tidak terduplikasi).`);
    } catch (error) {
        console.error(`❌ Terjadi kesalahan saat memproses data:`, error);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
