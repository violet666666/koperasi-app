import { describe, it, expect } from "vitest";
import { extractTrailingRef, buildRefSet } from "../lib/shu-ref-helpers";

describe("extractTrailingRef", () => {
    it("menangkap ref di akhir deskripsi (web + mobile + unit-layanan)", () => {
        expect(extractTrailingRef("Penjualan toko Tunai - TK-23062026-0019")).toBe("TK-23062026-0019");
        expect(extractTrailingRef("Pendapatan cuci_mobil (Mobile) Tunai - CUC-MNMU9IQN")).toBe("CUC-MNMU9IQN");
        expect(extractTrailingRef("Split Bill resto (qris) - RS-21072026-0018")).toBe("RS-21072026-0018");
        expect(extractTrailingRef("Split Bill resto (qris) - RS-21072026-0018 [SB-MNM1Q2]")).toBe("RS-21072026-0018");
        expect(extractTrailingRef("Pendapatan barbershop - CM140420260012")).toBe("CM140420260012");
    });

    it("null untuk deskripsi tanpa ref / null / undefined", () => {
        expect(extractTrailingRef("Setoran tunai harian")).toBeNull();
        expect(extractTrailingRef("Pendapatan toko bulan Januari -")).toBeNull();
        expect(extractTrailingRef(null)).toBeNull();
        expect(extractTrailingRef(undefined)).toBeNull();
    });
});

describe("buildRefSet", () => {
    it("mengumpulkan ref unik dan mengabaikan entri tanpa ref", () => {
        const set = buildRefSet(["A - TK-1", "B - TK-1", null, "tanpa ref", "C - RS-2"]);
        expect([...set].sort()).toEqual(["RS-2", "TK-1"]);
    });

    it("set kosong dari input kosong", () => {
        expect(buildRefSet([]).size).toBe(0);
        expect(buildRefSet([null, "", "no ref"]).size).toBe(0);
    });
});
