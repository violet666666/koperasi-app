/**
 * Pure helpers untuk dedup income SHU: ref transaksi (saleNo/trxNo) di ekor
 * deskripsi jurnal & CashBankTransaction. Penjualan cash/QRIS menulis journal
 * 4201 DAN CB pendapatan_toko/pendapatan_unit — CB lama tidak menyimpan
 * journalId, jadi deteksi dobel dilakukan via ref di deskripsi.
 * Bukti & besaran: scripts/diagnose-shu-journal-cb-doublecount.ts
 * (Rp604.278.000 dobel di SHU 2026).
 */

/** "Penjualan toko Tunai - TK-23062026-0019" → "TK-23062026-0019";
 *  suffix bracket split-bill dibuang dulu: "… - RS-21…-0018 [SB-XYZ]" → "RS-21…-0018" */
export function extractTrailingRef(desc: string | null | undefined): string | null {
    if (!desc) return null;
    const normalized = desc.replace(/\s*\[[^\]]*\]\s*$/, "");
    const m = normalized.match(/- ([A-Za-z0-9-]+)\s*$/);
    return m ? m[1] : null;
}

/** Set ref unik dari kumpulan deskripsi; entri tanpa ref diabaikan. */
export function buildRefSet(descriptions: (string | null | undefined)[]): Set<string> {
    const set = new Set<string>();
    for (const d of descriptions) {
        const ref = extractTrailingRef(d);
        if (ref) set.add(ref);
    }
    return set;
}
