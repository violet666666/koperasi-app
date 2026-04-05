const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding unit service packages...");

    // Carwash Packages
    const carwashPackages = [
        { name: "Motor", description: "Motor Bebek, Matic, Sport", price: 15000, sortOrder: 1 },
        { name: "Mobil Kecil (Small)", description: "Agya, Ayla, Brio, Jazz, Yaris, City Car", price: 35000, sortOrder: 2 },
        { name: "Mobil Sedang (Medium)", description: "Avanza, Xenia, Ertiga, Mobilio, Confero", price: 40000, sortOrder: 3 },
        { name: "Mobil Besar (Large)", description: "Innova, Fortuner, Pajero, CR-V, Santa Fe", price: 45000, sortOrder: 4 },
        { name: "Mobil Extra Large (XL)", description: "Hiace, Elf, Alphard, Minibus", price: 50000, sortOrder: 5 },
    ];

    for (const pkg of carwashPackages) {
        await prisma.unitServicePackage.create({
            data: { unitType: "cuci_mobil", ...pkg }
        });
    }

    // Barbershop Packages
    const barbershopPackages = [
        { name: "Potong Rambut Biasa", description: "Semua jenis potongan standar", price: 15000, sortOrder: 1 },
        { name: "Potong + Creambath", description: "Potong rambut + perawatan creambath", price: 30000, sortOrder: 2 },
        { name: "Cukur Jenggot", description: "Cukur dan rapikan jenggot", price: 10000, sortOrder: 3 },
        { name: "Potong + Pewarnaan", description: "Potong rambut + pewarnaan cat", price: 50000, sortOrder: 4 },
    ];

    for (const pkg of barbershopPackages) {
        await prisma.unitServicePackage.create({
            data: { unitType: "barbershop", ...pkg }
        });
    }

    console.log("Seed packages completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
