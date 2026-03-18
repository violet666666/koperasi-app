import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 
prisma.member.updateMany({ data: { city: 'Kabupaten Lumajang' } })
    .then(r => console.log('Updated ' + r.count + ' members'))
    .catch(console.error)
    .finally(() => prisma.$disconnect());
