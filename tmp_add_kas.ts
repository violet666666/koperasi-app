import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding Kas Utama account...');
  
  // Find primary branch
  const branch = await prisma.branch.findFirst({ orderBy: { id: 'asc' } });
  if (!branch) {
    console.error('No branches found.');
    return;
  }
  
  const branchId = branch.id;

  // Add Kas Utama (cash type)
  const kasUtama = await prisma.cashBankAccount.upsert({
    where: { code: 'KAS-001' },
    update: {},
    create: {
      code: 'KAS-001',
      name: 'Kas Utama',
      type: 'cash',
      branchId,
      currentBalance: 0,
      isActive: true,
    }
  });
  console.log(`OK: ${kasUtama.name} (${kasUtama.code}) type=${kasUtama.type}`);

  // Verify all accounts exist
  const allAccounts = await prisma.cashBankAccount.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: 'asc' },
  });
  console.log('\nAll active cash/bank accounts:');
  allAccounts.forEach(a => console.log(`  [${a.type}] ${a.code} - ${a.name} (id=${a.id})`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
