import { describe, it, expect } from "vitest";

// Batch & Expiry Tracking — batch sidebar removed from Cafe LSP & Resto (Mei 2026)
// Batch routes still accessible via URL, just hidden from sidebar navigation.

function flattenNavItems(nav: any[]): any[] {
    const result: any[] = [];
    for (const item of nav) {
        if (item.href) result.push(item);
        if (item.items) result.push(...flattenNavItems(item.items));
    }
    return result;
}

describe("Batch Navigation Config", () => {
    it("should NOT have batch nav entry for adminRestoNavigation (removed Mei 2026)", async () => {
        const mod = await import("@/lib/constants/navigation");
        const flat = flattenNavItems(mod.adminRestoNavigation);
        const batchEntry = flat.find((item: any) => item.href === "/resto/batch");

        expect(batchEntry).toBeUndefined();
    });

    it("should NOT have batch nav entry for adminCafeLspNavigation (removed Mei 2026)", async () => {
        const mod = await import("@/lib/constants/navigation");
        const flat = flattenNavItems(mod.adminCafeLspNavigation);
        const batchEntry = flat.find((item: any) => item.href === "/cafe-lsp/batch");

        expect(batchEntry).toBeUndefined();
    });

    it("should NOT have bahan-baku nav in adminRestoNavigation (removed Mei 2026)", async () => {
        const mod = await import("@/lib/constants/navigation");
        const flat = flattenNavItems(mod.adminRestoNavigation);
        const bahanEntry = flat.find((item: any) => item.href === "/resto/bahan-baku");

        expect(bahanEntry).toBeUndefined();
    });

    it("should NOT have bahan-baku nav in adminCafeLspNavigation (removed Mei 2026)", async () => {
        const mod = await import("@/lib/constants/navigation");
        const flat = flattenNavItems(mod.adminCafeLspNavigation);
        const bahanEntry = flat.find((item: any) => item.href === "/cafe-lsp/bahan-baku");

        expect(bahanEntry).toBeUndefined();
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

    it("should NOT have opname nav in adminCafeLspNavigation (moved to button in Persediaan)", async () => {
        const mod = await import("@/lib/constants/navigation");
        const flat = flattenNavItems(mod.adminCafeLspNavigation);
        const opnameEntry = flat.find((item: any) => item.href === "/cafe-lsp/opname");

        expect(opnameEntry).toBeUndefined();
    });

    it("adminCafeLspNavigation should have exactly 7 items in CAFE & MENU group", async () => {
        const mod = await import("@/lib/constants/navigation");
        const cafeMenuGroup = mod.adminCafeLspNavigation.find((item: any) => item.title === "CAFE & MENU");
        expect(cafeMenuGroup).toBeDefined();
        expect(cafeMenuGroup.items.length).toBe(7);
    });

    it("adminRestoNavigation should have exactly 10 items in RESTO & MENU group", async () => {
        const mod = await import("@/lib/constants/navigation");
        const restoMenuGroup = mod.adminRestoNavigation.find((item: any) => item.title === "RESTO & MENU");
        expect(restoMenuGroup).toBeDefined();
        expect(restoMenuGroup!.items.length).toBe(10);
    });

    it("adminRestoNavigation should have WEBSITE group with Website Settings entry", async () => {
        const mod = await import("@/lib/constants/navigation");
        const websiteGroup = mod.adminRestoNavigation.find((item: any) => item.title === "WEBSITE");
        expect(websiteGroup).toBeDefined();
        expect(websiteGroup!.items.length).toBe(1);
        const flat = flattenNavItems([websiteGroup]);
        const settingsEntry = flat.find((item: any) => item.href === "/resto/website-settings");
        expect(settingsEntry).toBeDefined();
    });
});
