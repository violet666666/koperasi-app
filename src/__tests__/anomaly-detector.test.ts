import { describe, it, expect } from "vitest";
import {
    isKnownCategory, isValidCategory, isOutlier, makeAnomalyId, computeMedian,
    buildD1Anomaly, buildD2Anomaly, buildD3Anomaly, buildD4Anomaly, buildD5Anomaly,
    OUTLIER_FLOOR,
} from "@/lib/services/anomaly-detector";
import { summarizeAnomalies } from "@/lib/services/anomaly-detector";

describe("isKnownCategory", () => {
    it("true untuk kategori canonical", () => {
        expect(isKnownCategory("biaya_operasional")).toBe(true);
        expect(isKnownCategory("transfer")).toBe(true);
    });
    it("false untuk null, undefined, legacy, typo", () => {
        expect(isKnownCategory(null)).toBe(false);
        expect(isKnownCategory(undefined)).toBe(false);
        expect(isKnownCategory("operational")).toBe(false);
        expect(isKnownCategory("biaya")).toBe(false);
    });
});

describe("isValidCategory", () => {
    // D4 memakai superset (UI enum ∪ kategori sistem/legacy) sbg definisi "valid",
    // bukan CASH_BANK_CATEGORIES (13 key UI) — lihat diagnose-anomali-breakdown.ts:
    // 4.343 tx legit (pendapatan_toko dll) ditulis subsystem lain di luar enum UI.
    it("true untuk kategori canonical UI enum", () => {
        expect(isValidCategory("biaya_operasional")).toBe(true);
        expect(isValidCategory("transfer")).toBe(true);
        expect(isValidCategory("simpanan_pokok")).toBe(true);
    });
    it("true untuk kategori sistem/legacy legit (di luar UI enum)", () => {
        expect(isValidCategory("pendapatan_toko")).toBe(true);
        expect(isValidCategory("operational")).toBe(true);
        expect(isValidCategory("savings")).toBe(true);
        expect(isValidCategory("penalti_pelunasan")).toBe(true);
        expect(isValidCategory("void_penjualan_toko")).toBe(true);
        expect(isValidCategory("void_unit_transaction")).toBe(true);
        expect(isValidCategory("salary_cut_settlement")).toBe(true);
    });
    it("false untuk null, undefined, dan typo/garbage masa depan", () => {
        expect(isValidCategory(null)).toBe(false);
        expect(isValidCategory(undefined)).toBe(false);
        expect(isValidCategory("biaya_operasonal")).toBe(false); // typo dari biaya_operasional
        expect(isValidCategory("garbage_value")).toBe(false);
        expect(isValidCategory("")).toBe(false);
    });
});

describe("isOutlier", () => {
    it("true saat >= OUTLIER_FLOOR", () => {
        expect(isOutlier(OUTLIER_FLOOR)).toBe(true);
        expect(isOutlier(OUTLIER_FLOOR + 1)).toBe(true);
    });
    it("false saat di bawah floor", () => {
        expect(isOutlier(OUTLIER_FLOOR - 1)).toBe(false);
        expect(isOutlier(15_000_000)).toBe(false);
    });
});

describe("makeAnomalyId", () => {
    it("stabil & unik per detector+entity", () => {
        expect(makeAnomalyId("D1", "cashbank_tx", 42)).toBe("D1-cashbank_tx-42");
        expect(makeAnomalyId("D1", "cashbank_tx", 42)).toBe(makeAnomalyId("D1", "cashbank_tx", 42));
        expect(makeAnomalyId("D2", "cashbank_account", 42)).not.toBe(makeAnomalyId("D1", "cashbank_tx", 42));
    });
});

describe("computeMedian", () => {
    it("median ganjil & genap", () => {
        expect(computeMedian([1, 2, 3])).toBe(2);
        expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
    });
    it("0 untuk array kosong", () => {
        expect(computeMedian([])).toBe(0);
    });
});

describe("builders", () => {
    const tx = { id: 5, transactionNo: "CBK-2026-1", amount: 500_000_000, category: "biaya_operasional", description: "ambil kas bri", transactionDate: new Date("2026-04-29") };

    it("buildD1Anomaly: impact = amount, direction inflates_beban", () => {
        const a = buildD1Anomaly(tx, { suggestedCategory: "transfer" });
        expect(a.detector).toBe("D1");
        expect(a.severity).toBe("high");
        expect(a.estimatedShuImpact).toBe(500_000_000);
        expect(a.impactDirection).toBe("inflates_beban");
        expect(a.suggestedAction).toContain("Transfer");
    });
    it("buildD2Anomaly: impact = 0, direction distorts_neraca", () => {
        const a = buildD2Anomaly({ id: 9, code: "BRI", name: "Bank BRI", currentBalance: -5_000_000 });
        expect(a.detector).toBe("D2");
        expect(a.severity).toBe("high");
        expect(a.estimatedShuImpact).toBe(0);
        expect(a.impactDirection).toBe("distorts_neraca");
        expect(a.amount).toBe(5_000_000);
    });
    it("buildD4Anomaly: impact = 0 (konservatif)", () => {
        const a = buildD4Anomaly({ ...tx, category: "operational" });
        expect(a.detector).toBe("D4");
        expect(a.estimatedShuImpact).toBe(0);
        expect(a.impactDirection).toBe("none");
        expect(a.title).toContain("operational");
    });
});

describe("summarizeAnomalies", () => {
    it("menghitung total, bySeverity, dan totalShuImpact dengan benar", () => {
        const anomalies = [
            buildD1Anomaly({ id: 1, transactionNo: "A", amount: 500_000_000, category: "biaya_operasional", description: "ambil tunai", transactionDate: new Date("2026-04-29") }, { suggestedCategory: "transfer" }),
            buildD3Anomaly({ id: 2, transactionNo: "B", amount: 60_000_000, category: "beban_unit", description: "x", transactionDate: new Date("2026-05-01") }),
            buildD3Anomaly({ id: 3, transactionNo: "C", amount: 55_000_000, category: "beban_unit", description: "y", transactionDate: new Date("2026-05-02") }),
        ];
        const summary = summarizeAnomalies(anomalies, { year: 2026, month: null });
        expect(summary.total).toBe(3);
        expect(summary.bySeverity.high).toBe(1);
        expect(summary.bySeverity.medium).toBe(2);
        expect(summary.bySeverity.low).toBe(0);
        expect(summary.totalShuImpact).toBe(500_000_000); // hanya D1 berdampak
        expect(summary.period).toEqual({ year: 2026, month: null });
    });
});

describe("builders D3/D5", () => {
    const tx = { id: 7, transactionNo: "CBK-X", amount: 60_000_000, category: "beban_unit", description: "x", transactionDate: new Date("2026-05-01") };
    it("buildD3Anomaly: impact = 0, severity medium", () => {
        const a = buildD3Anomaly(tx);
        expect(a.detector).toBe("D3");
        expect(a.severity).toBe("medium");
        expect(a.estimatedShuImpact).toBe(0);
        expect(a.amount).toBe(60_000_000);
    });
    it("buildD5Anomaly: impact = 0, severity low", () => {
        const a = buildD5Anomaly(tx);
        expect(a.detector).toBe("D5");
        expect(a.severity).toBe("low");
        expect(a.estimatedShuImpact).toBe(0);
    });
});
