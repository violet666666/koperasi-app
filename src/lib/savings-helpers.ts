/**
 * Pure helpers for savings flows. Extracted for unit testing of business rules.
 */

export interface WithdrawalCheckInput {
  type: string;          // "deposit" | "withdrawal"
  canWithdraw: boolean;  // SavingsProduct.canWithdraw
  memberStatus: string;  // Member.status
}

/**
 * AD-ART Pasal 26: Simpanan Pokok & Wajib TIDAK boleh ditarik selama anggota
 * masih aktif. Hanya Simpanan Sukarela (canWithdraw=true) yang dapat ditarik
 * sewaktu-waktu. Dikembalikan saat anggota keluar/meninggal/bubar.
 * Pure; unit-tested. Mirror web api/savings/transactions:137.
 */
export function isWithdrawalBlocked(input: WithdrawalCheckInput): boolean {
  return input.type === "withdrawal" && !input.canWithdraw && input.memberStatus === "active";
}
