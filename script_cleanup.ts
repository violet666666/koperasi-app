const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
    console.log("Starting cleanup of 0-balance SavingsAccounts without transactions...");

    try {
        const deleted = await prisma.savingsAccount.deleteMany({
            where: {
                balance: 0,
                transactions: {
                    none: {}
                }
            }
        });
        
        console.log(`Successfully deleted ${deleted.count} empty savings accounts.`);
    } catch (error) {
        console.error("Error during cleanup:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
