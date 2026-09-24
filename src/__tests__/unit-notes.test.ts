import { describe, it, expect } from "vitest";
import { buildUnitNotes, extractNoteTag, normalizePhone } from "../lib/services/unit-notes";

describe("unit-notes", () => {
    it("buildUnitNotes gabung PLAT+HP+NAMA; plat di-uppercase, phone digits-only", () => {
        expect(buildUnitNotes({ plate: "n 1234 xy", phone: "0812-3456-7890", customerName: "Budi" }))
            .toBe("[PLAT:N 1234 XY] [HP:081234567890] [NAMA:Budi]");
    });

    it("semua kosong → null; HP < 8 digit diabaikan", () => {
        expect(buildUnitNotes({})).toBeNull();
        expect(buildUnitNotes({ plate: "", phone: "12345", customerName: "  " })).toBeNull();
    });

    it("bracket di nama dibuang supaya tag tetap parseable", () => {
        const notes = buildUnitNotes({ customerName: "An[ak] Ba[ja]" })!;
        expect(notes).toBe("[NAMA:Anak Baja]");
        expect(extractNoteTag(notes, "NAMA")).toBe("Anak Baja");
    });

    it("extractNoteTag baca tiap tag; tak ada → null; kompatibel dgn notes lama plat-only", () => {
        expect(extractNoteTag("[PLAT:N 1234 XY] [HP:081234567890]", "HP")).toBe("081234567890");
        expect(extractNoteTag("[PLAT:B 9999 ZZ]", "PLAT")).toBe("B 9999 ZZ");
        expect(extractNoteTag(null, "NAMA")).toBeNull();
        expect(extractNoteTag("[PLAT:B 9999 ZZ]", "HP")).toBeNull();
    });

    it("normalizePhone buang semua non-digit", () => {
        expect(normalizePhone("+62 812-3456.7890 w/a")).toBe("6281234567890");
        expect(normalizePhone(undefined)).toBe("");
    });
});
