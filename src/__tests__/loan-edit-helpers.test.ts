import { describe, it, expect } from "vitest";
import { buildEditPayload } from "@/lib/loan-edit-helpers";
import type { LoanEditForm, LoanEditSnapshot } from "@/lib/loan-edit-helpers";

// Snapshot loan yang dipakai semua kasus — meniru data Prisma (Decimal/Int/Date).
const baseLoan: LoanEditSnapshot = {
    principalAmount: 5_000_000,
    tenorMonths: 10,
    interestRate: 1,
    principalPaid: 1_000_000,
    interestPaid: 100_000,
    disbursementDate: "2026-04-29T00:00:00.000Z",
    firstDueDate: "2026-05-29T00:00:00.000Z",
};

// Form yang tidak ada perubahan (persis hasil openEditDialog).
const unchangedForm: LoanEditForm = {
    principalAmount: "5000000",
    tenorMonths: "10",
    interestRate: "1",
    principalPaid: "1000000",
    interestPaid: "100000",
    disbursementDate: "2026-04-29",
    firstDueDate: "2026-05-29",
};

describe("buildEditPayload — change detection Edit Pinjaman", () => {
    it("payload kosong saat tidak ada perubahan", () => {
        expect(buildEditPayload(unchangedForm, baseLoan)).toEqual({});
    });

    // ── Bug fix: dua field ini dulu TIDAK ada di guard inline → operator
    //    yang edit hanya Pokok/Bunga Terbayar kena "Tidak ada perubahan". ──
    it("menditeksi perubahan principalPaid (Pokok Terbayar)", () => {
        const form = { ...unchangedForm, principalPaid: "1500000" };
        const payload = buildEditPayload(form, baseLoan);
        expect(payload.principalPaid).toBe(1_500_000);
        expect(Object.keys(payload)).toEqual(["principalPaid"]);
    });

    it("menditeksi perubahan interestPaid (Bunga Terbayar)", () => {
        const form = { ...unchangedForm, interestPaid: "200000" };
        const payload = buildEditPayload(form, baseLoan);
        expect(payload.interestPaid).toBe(200_000);
        expect(Object.keys(payload)).toEqual(["interestPaid"]);
    });

    // ── Core fields tetap terdeteksi (regression guard) ──────────────────
    it("menditeksi perubahan tenorMonths", () => {
        const form = { ...unchangedForm, tenorMonths: "12" };
        const payload = buildEditPayload(form, baseLoan);
        expect(payload.tenorMonths).toBe(12);
    });

    it("menditeksi perubahan principalAmount", () => {
        const form = { ...unchangedForm, principalAmount: "6000000" };
        const payload = buildEditPayload(form, baseLoan);
        expect(payload.principalAmount).toBe(6_000_000);
    });

    it("menditeksi perubahan interestRate", () => {
        const form = { ...unchangedForm, interestRate: "1.5" };
        const payload = buildEditPayload(form, baseLoan);
        expect(payload.interestRate).toBe(1.5);
    });

    it("menditeksi perubahan tanggal cair", () => {
        const form = { ...unchangedForm, disbursementDate: "2026-05-01" };
        const payload = buildEditPayload(form, baseLoan);
        expect(payload.disbursementDate).toBe("2026-05-01");
    });

    it("field yang tidak diubah tidak ikut di payload", () => {
        const form = { ...unchangedForm, tenorMonths: "12" };
        const payload = buildEditPayload(form, baseLoan);
        expect(payload).not.toHaveProperty("principalPaid");
        expect(payload).not.toHaveProperty("interestPaid");
        expect(payload).not.toHaveProperty("interestRate");
    });
});
