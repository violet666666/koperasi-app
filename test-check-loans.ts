import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres";

const prisma = new PrismaClient();

async function main() {
    const targetDate = new Date('2026-04-08T00:00:00.000Z'); // Adjust time zone if necessary
    
    const loans = await prisma.loan.findMany({
        orderBy: { id: "desc" },
        take: 5
    });
    console.log("Recent loans:", loans.map(l => ({id: l.id, rate: l.interestRate, date: l.createdAt})));

    console.log(`Found ${loans.length} loans created before April 8th with 3.6% interest rate.`);
    
    let activeNoPayments = 0;
    let activeWithPayments = 0;
    let paidOff = 0;
    let schedulePaidStatusCount = { pending: 0, paid: 0, overdue: 0, partial: 0 };
    
    for (const loan of loans) {
        if (loan.status === 'paid_off') paidOff++;
        else if (loan.payments.length === 0) activeNoPayments++;
        else activeWithPayments++;
        
        for (const schedule of loan.schedules) {
            schedulePaidStatusCount[schedule.status] = (schedulePaidStatusCount[schedule.status] || 0) + 1;
        }
    }

    console.log(`Status breakdown:`);
    console.log(`- Active with NO payments made: ${activeNoPayments}`);
    console.log(`- Active with SOME payments made: ${activeWithPayments}`);
    console.log(`- Paid off: ${paidOff}`);
    console.log(`Schedule breakdown:`, schedulePaidStatusCount);
    
    // Pick the first one as a sample
    if (loans.length > 0) {
        console.log("\nSample Loan (ID: " + loans[0].id + "):");
        console.log(`- Principal: ${loans[0].principalAmount}`);
        console.log(`- Interst Rate: ${loans[0].interestRate}% (${loans[0].interestMethod})`);
        console.log(`- Tenor: ${loans[0].tenorMonths} months`);
        console.log(`- Monthly Installment: ${loans[0].monthlyInstallment}`);
        console.log(`- Total Amount: ${loans[0].totalAmount}`);
        console.log(`- Schedules length: ${loans[0].schedules.length}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
