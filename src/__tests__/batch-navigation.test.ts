import { describe, it, expect } from "vitest";

// Phase 1.1: Batch & Expiry Tracking
// Navigation config tests — wrapper page existence verified via Playwright.

function flattenNavItems(nav: any[]): any[] {
    const result: any[] = [];
    for (const item of nav) {
        if (item.href) result.push(item);
        if (item.items) result.push(...flattenNavItems(item.items));
    }
    return result;
}

describe("Batch Navigation Config", () => {
    it("should have batch nav entry for adminRestoNavigation", async () => {
        const mod = await import("@/lib/constants/navigation");
        const flat = flattenNavItems(mod.adminRestoNavigation);
        const batchEntry = flat.find((item: any) => item.href === "/resto/batch");

        expect(batchEntry).toBeDefined();
        expect(batchEntry.title).toBe("Manajemen Batch");
    });

    it("should have batch nav entry for adminCafeLspNavigation", async () => {
        const mod = await import("@/lib/constants/navigation");
        const flat = flattenNavItems(mod.adminCafeLspNavigation);
        const batchEntry = flat.find((item: any) => item.href === "/cafe-lsp/batch");

        expect(batchEntry).toBeDefined();
        expect(batchEntry.title).toBe("Manajemen Batch");
    });

    it("should NOT have batch nav in kasir navigation for either unit", async () => {
        const mod = await import("@/lib/constants/navigation");
        const flatResto = flattenNavItems(mod.kasirRestoNavigation);
        const flatCafeLsp = flattenNavItems(mod.kasirCafeLspNavigation);

        expect(
            flatResto.find((item: any) => item.href?.includes("/batch"))
        ).toBeUndefined();

        expect(
            flatCafeLsp.find((item: any) => item.href?.includes("/batch"))
        ).toBeUndefined();
    });
});
