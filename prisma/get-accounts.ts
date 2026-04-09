import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.cashBankAccount.findMany({ select: { id:true, code:true, name:true, unitType:true, type:true } })
.then(r => { console.log(JSON.stringify(r, null, 2)); p.$disconnect(); })
.catch(e => { console.error(e); p.$disconnect(); });
