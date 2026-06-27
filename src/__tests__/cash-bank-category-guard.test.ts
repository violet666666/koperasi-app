import { describe, it, expect } from "vitest";
import { detectCategoryMismatch } from "@/lib/services/cash-bank-category-guard";

describe("detectCategoryMismatch — guard kategori Kas Keluar agar tidak menggelembungkan SHU", () => {
    // ── Hanya trigger pada combo berbahaya: type=out + kategori expense operasional ──
    it("null untuk biaya_operasional normal (tanpa sinyal transfer/pinjaman)", () => {
        expect(detectCategoryMismatch("out", "biaya_operasional", "pembayaran honor pengurus")).toBeNull();
        expect(detectCategoryMismatch("out", "biaya_operasional", "pemasangan CCTV unit toko")).toBeNull();
    });

    it("null saat type='in' (bukan kas keluar)", () => {
        expect(detectCategoryMismatch("in", "biaya_operasional", "tarik tunai")).toBeNull();
    });

    it("null saat kategori BUKAN expense operasional (tidak merusak SHU beban)", () => {
        expect(detectCategoryMismatch("out", "transfer", "tarik tunai")).toBeNull();
        expect(detectCategoryMismatch("out", "lainnya", "ambil tunai")).toBeNull();
        expect(detectCategoryMismatch("out", "pencairan_pinjaman", "pinjam sp")).toBeNull();
    });

    it("null untuk deskripsi kosong/undefined", () => {
        expect(detectCategoryMismatch("out", "biaya_operasional", "")).toBeNull();
        expect(detectCategoryMismatch("out", "biaya_operasional", undefined)).toBeNull();
        expect(detectCategoryMismatch("out", "biaya_operasional", null)).toBeNull();
    });

    // ── Sinyal TRANSFER (kasus bug Rp 500jt & Rp 100jt) ──
    it("deteksi 'ambil kas bri' sebagai transfer (bug Rp 500jt)", () => {
        const r = detectCategoryMismatch("out", "biaya_operasional", "ambil kas bri");
        expect(r).not.toBeNull();
        expect(r!.suggestedCategory).toBe("transfer");
    });

    it("deteksi 'ambil tunai' sebagai transfer (bug Rp 100jt)", () => {
        const r = detectCategoryMismatch("out", "biaya_operasional", "ambil tunai");
        expect(r!.suggestedCategory).toBe("transfer");
    });

    it("deteksi 'tarik tunai dr bank jatim' sebagai transfer", () => {
        const r = detectCategoryMismatch("out", "biaya_operasional", "tarik tunai dr bank jatim");
        expect(r!.suggestedCategory).toBe("transfer");
    });

    it("deteksi kata 'transfer' sebagai transfer", () => {
        const r = detectCategoryMismatch("out", "biaya_operasional", "transfer ke kas cabang");
        expect(r!.suggestedCategory).toBe("transfer");
    });

    it("deteksi 'pindah kas' sebagai transfer", () => {
        const r = detectCategoryMismatch("out", "biaya_operasional", "pindah kas ke bri");
        expect(r!.suggestedCategory).toBe("transfer");
    });

    it("case-insensitive", () => {
        const r = detectCategoryMismatch("out", "biaya_operasional", "AMBIL KAS BRI");
        expect(r!.suggestedCategory).toBe("transfer");
    });

    // ── Sinyal PENCAIRAN PINJAMAN (kasus bug Rp 20jt) ──
    it("deteksi 'pinjam SP ZULFAN WASIS' sebagai pencairan_pinjaman (bug Rp 20jt)", () => {
        const r = detectCategoryMismatch("out", "biaya_operasional", "pinjam SP ZULFAN WASIS");
        expect(r).not.toBeNull();
        expect(r!.suggestedCategory).toBe("pencairan_pinjaman");
    });

    it("deteksi 'pencairan pinjaman' sebagai pencairan_pinjaman", () => {
        const r = detectCategoryMismatch("out", "biaya_operasional", "pencairan pinjaman member baru");
        expect(r!.suggestedCategory).toBe("pencairan_pinjaman");
    });

    // ── Juga flag kategori expense operasional LAIN yang bisa disalahgunakan ──
    it("flag beban_unit + sinyal transfer", () => {
        const r = detectCategoryMismatch("out", "beban_unit", "ambil tunai");
        expect(r!.suggestedCategory).toBe("transfer");
    });

    it("flag hpp_toko + sinyal pencairan", () => {
        const r = detectCategoryMismatch("out", "hpp_toko", "pencairan pinjaman");
        expect(r!.suggestedCategory).toBe("pencairan_pinjaman");
    });

    // ── Pesan human-readable ──
    it("mengembalikan pesan yang menyebut kategori saranan", () => {
        const r = detectCategoryMismatch("out", "biaya_operasional", "ambil kas bri");
        expect(r!.message).toContain("Transfer");
    });
});
