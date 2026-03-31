"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function processDataReset(options: {
  resetStoreData: boolean;
  resetLoanData: boolean;
  resetSavingsData: boolean;
  resetJournalData: boolean;
  resetMemberData: boolean;
}) {
  try {
    const { resetStoreData, resetLoanData, resetSavingsData, resetJournalData, resetMemberData } = options;

    if (!resetStoreData && !resetLoanData && !resetSavingsData && !resetJournalData && !resetMemberData) {
      return { success: false, error: "Tidak ada data yang dipilih untuk di-reset." };
    }

    if (resetMemberData && ( !resetLoanData || !resetSavingsData )) {
      return { success: false, error: "Harap centang Data Pinjaman dan Data Simpanan terlebih dahulu sebelum mereset Data Anggota." };
    }

    // We use Prisma Transactions to ensure atomic deletion and avoid foreign key violations.
    // Order matters for relational databases.

    const operations: any[] = [];

    // 1. Data Toko
    if (resetStoreData) {
      operations.push(prisma.storeSaleItem.deleteMany({}));
      operations.push(prisma.storeSale.deleteMany({}));
      operations.push(prisma.storeProduct.updateMany({
        data: { stock: 0, stockGdg: 0, stockToko: 0 }
      })); // Reset stock to 0 instead of deleting products might be safer? Let's delete it if user wants a clean slate.
      // Although deleting products might break other references if exists, let's just delete products as well to clean up everything.
      operations.push(prisma.storeProduct.deleteMany({}));
    }

    // 2. Data Pinjaman
    if (resetLoanData) {
      operations.push(prisma.loanPaymentAllocation.deleteMany({}));
      operations.push(prisma.loanPayment.deleteMany({}));
      operations.push(prisma.loanSchedule.deleteMany({}));
      operations.push(prisma.loan.deleteMany({}));
      operations.push(prisma.loanApplication.deleteMany({}));
    }

    // 3. Data Simpanan
    if (resetSavingsData) {
      operations.push(prisma.savingsTransaction.deleteMany({}));
      
      // Tabungan Sejahtera 
      operations.push(prisma.tabunganSejahteraHistory.deleteMany({}));
    }

    // 4. Data Jurnal Akuntansi dan Kas Bank
    if (resetJournalData) {
      // Unit Transactions
      operations.push(prisma.unitTransaction.deleteMany({}));
      
      // Receipts
      operations.push(prisma.receipt.deleteMany({}));
      
      // Kas & Bank Transactions
      operations.push(prisma.cashBankTransaction.deleteMany({}));
      
      // Journals
      operations.push(prisma.journalLine.deleteMany({}));
      operations.push(prisma.journal.deleteMany({}));

      // Approvals
      operations.push(prisma.approvalRequest.deleteMany({}));
      
      // Reset CashBank balance to 0 instead of deleting the master account
      operations.push(prisma.cashBankAccount.updateMany({
        data: { currentBalance: 0 }
      }));
    }

    // 3. Data Anggota
    if (resetMemberData) {
      // Delete SavingsAccounts linked to Member (after deleting transactions above)
      operations.push(prisma.savingsAccount.deleteMany({}));
      // Finally, delete Members
      operations.push(prisma.member.deleteMany({}));
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    // Log the audit
    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        module: "Pengaturan",
        description: `Reset Data Eksekusi. Toko: ${resetStoreData}, Pinjam: ${resetLoanData}, Simpan: ${resetSavingsData}, Jurnal: ${resetJournalData}, Anggota: ${resetMemberData}`,
        status: "success",
        userName: "System Admin",
        userRole: "admin",
      }
    });

    revalidatePath("/");

    return { 
      success: true, 
      message: "Proses Reset Data Berhasil. Silahkan import kembali data Anda." 
    };

  } catch (error: any) {
    console.error("Kesalahan Reset Data:", error);
    return { success: false, error: "Gagal me-reset data: " + error.message };
  }
}
