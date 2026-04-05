const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedCarwash() {
  const services = [
    { sku: 'CW-MTR', name: 'Cuci Motor', category: 'Motor Bebek, Matic, Sport', price: 15000 },
    { sku: 'CW-SML', name: 'Cuci Mobil Kecil (Small)', category: 'Agya, Ayla, Brio, Jazz, Yaris, City Car', price: 35000 },
    { sku: 'CW-MED', name: 'Cuci Mobil Sedang (Medium)', category: 'Avanza, Xenia, Ertiga, Mobilio, Confero', price: 40000 },
    { sku: 'CW-LRG', name: 'Cuci Mobil Besar (Large)', category: 'Innova, Fortuner, Pajero, CR-V, Santa Fe', price: 45000 },
    { sku: 'CW-XL', name: 'Cuci Mobil XL', category: 'Hiace, Elf, Alphard, Minibus', price: 50000 },
  ];

  for (const svc of services) {
    await prisma.storeProduct.upsert({
      where: { sku: svc.sku },
      update: {
        name: svc.name,
        category: svc.category,
        sellPrice: svc.price,
        unitType: 'cuci_mobil',
        isService: true
      },
      create: {
        sku: svc.sku,
        name: svc.name,
        category: svc.category,
        sellPrice: svc.price,
        costPrice: 0,
        stock: 999,
        stockToko: 999,
        stockGdg: 0,
        unitType: 'cuci_mobil',
        isService: true,
        unit: 'Jasa'
      }
    });
  }
  console.log('Seeded Carwash Services Array!');
}

seedCarwash().then(() => prisma.$disconnect()).catch(console.error);
