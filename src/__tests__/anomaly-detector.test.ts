import { describe, it, expect } from "vitest";
import {
    isKnownCategory, isOutlier, makeAnomalyId, computeMedian,
    buildD1Anomaly, buildD2Anomaly, buildD4Anomaly,
    OUTLIER_FLOOR, OUTLIER_MEDIAN_MULT,
} from "@/lib/services/anomaly-detector";

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

describe("isOutlier", () => {
    it("true saat >= OUTLIER_FLOOR", () => {
        expect(isOutlier(OUTLIER_FLOOR, 1_000_000)).toBe(true);
        expect(isOutlier(OUTLIER_FLOOR + 1, 0)).toBe(true);
    });
    it("true saat > OUTLIER_MEDIAN_MULT × median (di bawah floor)", () => {
        expect(isOutlier(15_000_000, 1_000_000)).toBe(true); // 15× median
    });
    it("false saat kecil & dekat median", () => {
        expect(isOutlier(1_500_000, 1_000_000)).toBe(false);
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
