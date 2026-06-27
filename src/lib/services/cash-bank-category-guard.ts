/**
 * Guard kategori Kas Keluar agar operator tidak keliru mencatat transfer /
 * pencairan pinjaman sebagai "biaya operasional" — yang menggelembungkan beban
 * SHU (lihat docs/SHU-BEBAN-BIAYA-2026.md: bug Rp 620jt membuat SHU 2026 = Rp 0).
 *
 * PURE FUNCTION — tidak ada side-effect, mudah di-unit-test. Dipakai oleh:
 *  - API  POST /api/cash-bank/transactions  (gerbang server-side, semua klien)
 *  - Form web (preview warning inline sebelum submit)
 */

export type CategoryMismatchSignal = "transfer" | "pencairan_pinjaman";

export interface CategoryMismatch {
    signal: CategoryMismatchSignal;
    suggestedCategory: CategoryMismatchSignal;
    message: string;
}

// Kategori expense operasional yang DIHITUNG sbg beban SHU (tidak ada di blacklist
// NON_EXPENSE_CATEGORIES shu-calculator.ts). Salah kategori di sini = merusak SHU.
const EXPENSE_CATEGORIES_AT_RISK = new Set([
    "biaya_operasional",
    "beban_unit",
    "hpp_toko",
    "hutang_mitra",
]);

const LOAN_KEYWORDS = [
    "pinjam sp",
    "pencairan pinjaman",
    "pencairan",
    "cairkan pinjam",
    "cairkan pinjaman",
];

const TRANSFER_KEYWORDS = [
    "tarik tunai",
    "ambil tunai",
    "ambil kas",
    "tarik kas",
    "transfer",
    "pindah kas",
    "pindah bukuan",
];

const SUGGESTED_LABEL: Record<CategoryMismatchSignal, string> = {
    transfer: "Transfer Antar Kas/Bank",
    pencairan_pinjaman: "Pencairan Pinjaman",
};

/**
 * Deteksi ketidakcocokan kategori Kas Keluar.
 * Mengembalikan saran kategori bila type=out + kategori expense operasional +
 * deskripsi mengandung sinyal transfer/pencairan pinjaman. Selain itu null.
 */
export function detectCategoryMismatch(
    type: string | undefined | null,
    category: string | undefined | null,
    description: string | undefined | null,
): CategoryMismatch | null {
    if (type !== "out") return null;
    if (!category || !EXPENSE_CATEGORIES_AT_RISK.has(category)) return null;

    const desc = (description || "").toLowerCase().trim();
    if (!desc) return null;

    // Pencairan pinjaman dicek lebih dulu (lebih spesifik) sebelum transfer.
    for (const kw of LOAN_KEYWORDS) {
        if (desc.includes(kw)) {
            return {
                signal: "pencairan_pinjaman",
                suggestedCategory: "pencairan_pinjaman",
                message: `Deskripsi terdeteksi sebagai pencairan pinjaman. Gunakan kategori: ${SUGGESTED_LABEL.pencairan_pinjaman}.`,
            };
        }
    }
    for (const kw of TRANSFER_KEYWORDS) {
        if (desc.includes(kw)) {
            return {
                signal: "transfer",
                suggestedCategory: "transfer",
                message: `Deskripsi terdeteksi sebagai transfer antar kas/bank. Gunakan kategori: ${SUGGESTED_LABEL.transfer}.`,
            };
        }
    }
    return null;
}
