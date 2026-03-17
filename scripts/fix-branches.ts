import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting database branch consolidation...");

    try {
        // 1. Find or create the Lumajang Branch
        let lumajangBranch = await prisma.branch.findFirst({
            where: {
                OR: [
                    { code: "LMJ" },
                    { name: { contains: "Lumajang" } }
                ]
            }
        });

        if (!lumajangBranch) {
            console.log("Lumajang branch not found. Creating a new one...");
            lumajangBranch = await prisma.branch.create({
                data: {
                    code: "LMJ",
                    name: "Primkoppol Lumajang",
                    address: "Jl. Alun-Alun Barat No. 10, Lumajang",
                    phone: "0334-551003",
                    email: "lumajang@koperasi.com",
                    isHeadOffice: true,
                    isActive: true,
                }
            });
        } else {
            console.log(`Updating existing Lumajang branch (ID: ${lumajangBranch.id}) to be Head Office...`);
            lumajangBranch = await prisma.branch.update({
                where: { id: lumajangBranch.id },
                data: {
                    name: "Primkoppol Lumajang",
                    isHeadOffice: true,
                    isActive: true,
                }
            });
        }

        const lumajangBranchId = lumajangBranch.id;
        console.log(`✅ Using Lumajang Branch ID: ${lumajangBranchId}`);

        // 2. Update all Members
        console.log("🔄 Updating all members to Lumajang...");
        const updateMembers = await prisma.member.updateMany({
            data: {
                branchId: lumajangBranchId,
                city: "Kabupaten Lumajang",
                province: "Jawa Timur",
            }
        });
        console.log(`   Updated ${updateMembers.count} members.`);

        // 3. Update all Users
        console.log("🔄 Updating all users to Lumajang...");
        const updateUsers = await prisma.user.updateMany({
            where: {
                branchId: { not: null }
            },
            data: {
                branchId: lumajangBranchId,
            }
        });
        console.log(`   Updated ${updateUsers.count} users.`);

        // 4. Update Financial Records
        console.log("🔄 Updating all financial records...");
        
        const countSA = await prisma.savingsAccount.updateMany({ data: { branchId: lumajangBranchId } });
        console.log(`   Updated ${countSA.count} Savings Accounts`);
        
        const countST = await prisma.savingsTransaction.updateMany({ data: { branchId: lumajangBranchId } });
        console.log(`   Updated ${countST.count} Savings Transactions`);

        const countLA = await prisma.loanApplication.updateMany({ data: { branchId: lumajangBranchId } });
        console.log(`   Updated ${countLA.count} Loan Applications`);

        const countL = await prisma.loan.updateMany({ data: { branchId: lumajangBranchId } });
        console.log(`   Updated ${countL.count} Loans`);

        const countLP = await prisma.loanPayment.updateMany({ data: { branchId: lumajangBranchId } });
        console.log(`   Updated ${countLP.count} Loan Payments`);

        const countCBA = await prisma.cashBankAccount.updateMany({ data: { branchId: lumajangBranchId } });
        console.log(`   Updated ${countCBA.count} Cash Bank Accounts`);

        const countCBT = await prisma.cashBankTransaction.updateMany({ data: { branchId: lumajangBranchId } });
        console.log(`   Updated ${countCBT.count} Cash Bank Transactions`);

        const countJournals = await prisma.journal.updateMany({ data: { branchId: lumajangBranchId } });
        console.log(`   Updated ${countJournals.count} Journals`);

        const countApproval = await prisma.approvalRequest.updateMany({ data: { branchId: lumajangBranchId } });
        console.log(`   Updated ${countApproval.count} Approval Requests`);

        // 5. Delete all other branches
        console.log("🗑️ Deleting all other branches...");
        const deleteBranches = await prisma.branch.deleteMany({
            where: {
                id: { not: lumajangBranchId }
            }
        });
        console.log(`   Deleted ${deleteBranches.count} branches.`);

        console.log("🎉 Database migration completed successfully!");

    } catch (error) {
        console.error("❌ Migration failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
