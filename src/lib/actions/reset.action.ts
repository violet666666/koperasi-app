"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export async function processDataReset(options: {
  resetStoreData: boolean;
  resetLoanData: boolean;
  resetSavingsData: boolean;
  resetJournalData: boolean;
  resetMemberData: boolean;
  resetTunkinData?: boolean;
  resetGajiData?: boolean;
  resetKasBankData?: boolean;
}) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized. Silakan login kembali." };
    }
    const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
    if (roleName !== "operator" && roleName !== "admin") {
      return { success: false, error: "Akses ditolak. Hanya admin/operator yang dapat reset data." };
    }

    const { resetStoreData, resetLoanData, resetSavingsData, resetJournalData, resetMemberData, resetTunkinData, resetGajiData, resetKasBankData } = options;

    if (!resetStoreData && !resetLoanData && !resetSavingsData && !resetJournalData && !resetMemberData && !resetTunkinData && !resetGajiData && !resetKasBankData) {
      return { success: false, error: "Tidak ada data yang dipilih untuk di-reset." };
    }

    if (resetMemberData && ( !resetLoanData || !resetSavingsData )) {
      return { success: false, error: "Harap centang Data Pinjaman dan Data Simpanan terlebih dahulu sebelum mereset Data Anggota." };
    }

    const operations: any[] = [];

    // Phase 1: Null out FK references to prevent constraint violations
    // Loans reference Journals and CashBankAccounts — null them before deleting either side
    if (resetLoanData) {
      operations.push(prisma.loan.updateMany({
        where: { disbursementJournalId: { not: null } },
        data: { disbursementJournalId: null, disbursementCashBankId: null },
      }));
      operations.push(prisma.loanPayment.updateMany({
        where: { journalId: { not: null } },
        data: { journalId: null },
      }));
    }

    // StoreSales reference Journals — null before deleting journals
    if (resetJournalData && !resetStoreData) {
      operations.push(prisma.storeSale.updateMany({
        where: { journalId: { not: null } },
        data: { journalId: null },
      }));
    }

    // CashBankTransactions reference Journals — null before deleting journals
    if (resetJournalData && !resetKasBankData) {
      operations.push(prisma.cashBankTransaction.updateMany({
        where: { journalId: { not: null } },
        data: { journalId: null },
      }));
    }

    // Loans & SavingsTransactions reference Journals — null if only journals being reset
    if (resetJournalData && !resetLoanData) {
      operations.push(prisma.loan.updateMany({
        where: { disbursementJournalId: { not: null } },
        data: { disbursementJournalId: null, disbursementCashBankId: null },
      }));
      operations.push(prisma.loanPayment.updateMany({
        where: { journalId: { not: null } },
        data: { journalId: null },
      }));
    }
    if (resetJournalData && !resetSavingsData) {
      operations.push(prisma.savingsTransaction.updateMany({
        where: { journalId: { not: null } },
        data: { journalId: null },
      }));
    }

    // Users reference Members — null before deleting members
    if (resetMemberData) {
      operations.push(prisma.user.updateMany({
        where: { memberId: { not: null } },
        data: { memberId: null },
      }));
    }

    // Phase 2: Delete data in dependency order

    // 1. Data Toko
    if (resetStoreData) {
      operations.push(prisma.storeSaleItem.deleteMany({}));
      operations.push(prisma.storeSale.deleteMany({}));
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
      operations.push(prisma.tabunganSejahteraHistory.deleteMany({}));
      // Reset savings account balances to 0 (accounts kept if members not deleted)
      operations.push(prisma.savingsAccount.updateMany({
        data: { balance: 0 }
      }));
    }

    // 4. Data Jurnal Akuntansi
    if (resetJournalData) {
      operations.push(prisma.unitTransaction.deleteMany({}));
      operations.push(prisma.receipt.deleteMany({}));
      operations.push(prisma.journalLine.deleteMany({}));
      operations.push(prisma.journal.deleteMany({}));
      operations.push(prisma.approvalRequest.deleteMany({}));
    }

    // 5. Data Kas Bank
    if (resetKasBankData) {
      operations.push(prisma.cashBankTransaction.deleteMany({}));
      operations.push(prisma.cashBankAccount.updateMany({
        data: { currentBalance: 0 }
      }));
    }

    // 6. Data Anggota
    if (resetMemberData) {
      operations.push(prisma.savingsAccount.deleteMany({}));
      operations.push(prisma.member.deleteMany({}));
    }

    // 7. Data Tunkin & Gaji (Partial Member updates)
    if (resetTunkinData && !resetMemberData) {
        operations.push(prisma.member.updateMany({
            where: { deletedAt: null },
            data: { tunlesKinerja: 0 }
        }));
    }

    if (resetGajiData && !resetMemberData) {
        operations.push(prisma.member.updateMany({
            where: { deletedAt: null },
            data: { salary: 0 }
        }));
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    // Log the audit
    const auditUserName = session.user.name || session.user.email || "Unknown";
    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        module: "Pengaturan",
        description: `Reset Data Eksekusi. Toko: ${resetStoreData}, Pinjam: ${resetLoanData}, Simpan: ${resetSavingsData}, Jurnal: ${resetJournalData}, Anggota: ${resetMemberData}, KasBank: ${resetKasBankData}, Tunkin: ${resetTunkinData}, Gaji: ${resetGajiData}`,
        status: "success",
        userName: auditUserName,
        userRole: roleName || "unknown",
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
