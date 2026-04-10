import dotenv from 'dotenv';
dotenv.config({ path: '.env.test.local' });
import { calculateSystemSHU } from './src/lib/services/shu-calculator';
import prisma from './src/lib/prisma';
async function test() {
    const res = await calculateSystemSHU(2026);
    console.log("Member Stats: ", res.memberDistribution.filter(m => m.savingsContribution > 0).slice(0, 3).map(m => ({ 
        nrp: m.memberNo, name: m.name, savings: m.savingsContribution, hasWajib: m.hasWajibAcc
    })));
}
test().catch(console.error).finally(() => prisma.$disconnect());
