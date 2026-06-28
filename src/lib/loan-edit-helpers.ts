/**
 * Pure change-detection untuk dialog "Edit Pinjaman".
 * Lihat test: src/__tests__/loan-edit-helpers.test.ts
 */

export interface LoanEditForm {
    principalAmount: string;
    tenorMonths: string;
    interestRate: string;
    principalPaid: string;
    interestPaid: string;
    disbursementDate: string;
    firstDueDate: string;
}

export interface LoanEditSnapshot {
    principalAmount: unknown;
    tenorMonths: unknown;
    interestRate: unknown;
    principalPaid: unknown;
    interestPaid: unknown;
    disbursementDate: unknown;
    firstDueDate: unknown;
}

/**
 * Pure change-detection untuk dialog "Edit Pinjaman".
 *
 * Mengembalikan subset field yang berubah dibanding snapshot loan saat ini.
 * Object kosong ⇒ tidak ada perubahan ⇒ pemanggil harus batal
 * (toast "Tidak ada perubahan yang terdeteksi").
 *
 * SETIAP field yang editable di dialog HARUS ada di sini. Bug 2026-06-28:
 * guard inline lama hanya cek 5 dari 7 field — principalPaid & interestPaid
 * lupa dimasukkan, sehingga operator yang edit hanya Pokok/Bunga Terbayar
 * kena blok "tidak ada perubahan" padahal API (route.ts PUT) mendukungnya.
 *
 * Ekspresi pembanding sengaja IDENTIK dengan openEditDialog (page.tsx) supaya
 * "apa yang di-seed ke form" == "apa yang dibandingkan" (konsistensi deteksi).
 */
const isoDay = (d: unknown): string =>
    d ? new Date(d as string).toISOString().split("T")[0] : "";

export function buildEditPayload(form: LoanEditForm, loan: LoanEditSnapshot): Record<string, number | string> {
    const payload: Record<string, number | string> = {};
    if (form.principalAmount !== String(Number(loan.principalAmount))) payload.principalAmount = Number(form.principalAmount);
    if (form.tenorMonths !== String(loan.tenorMonths)) payload.tenorMonths = Number(form.tenorMonths);
    if (form.interestRate !== String(Number(loan.interestRate))) payload.interestRate = Number(form.interestRate);
    if (form.principalPaid !== String(Number(loan.principalPaid))) payload.principalPaid = Number(form.principalPaid);
    if (form.interestPaid !== String(Number(loan.interestPaid))) payload.interestPaid = Number(form.interestPaid);
    if (form.disbursementDate && form.disbursementDate !== isoDay(loan.disbursementDate)) payload.disbursementDate = form.disbursementDate;
    if (form.firstDueDate && form.firstDueDate !== isoDay(loan.firstDueDate)) payload.firstDueDate = form.firstDueDate;
    return payload;
}
