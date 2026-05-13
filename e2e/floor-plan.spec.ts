import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

// Floor Plan Editor — Resto Admin E2E
test.describe("Floor Plan Editor (Resto)", () => {
    test.beforeEach(async ({ page }) => {
        // Login as admin resto
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState("networkidle");
        await page.fill('#email', "admincafe@koperasi.com");
        await page.fill('#password', "password123");
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 30000 });
    });

    test("should navigate to floor plan editor page", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/floor-plan`);
        await expect(page.getByText("Denah Meja (Floor Plan)")).toBeVisible({ timeout: 10000 });
    });

    test("should display default floor plan tables on load", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/floor-plan`);
        await expect(page.getByText("Denah Meja (Floor Plan)")).toBeVisible({ timeout: 10000 });
        // Should show at least some default tables
        await expect(page.getByText("Daftar Meja")).toBeVisible();
        const tableItems = page.locator("div.p-3.rounded-lg.border");
        const count = await tableItems.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test("should add a new table", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/floor-plan`);
        await expect(page.getByText("Denah Meja (Floor Plan)")).toBeVisible({ timeout: 10000 });

        const initialCount = await page.locator("div.p-3.rounded-lg.border").count();

        await page.getByRole("button", { name: /Tambah Meja/ }).click();

        const newCount = await page.locator("div.p-3.rounded-lg.border").count();
        expect(newCount).toBe(initialCount + 1);
    });

    test("should save floor plan and show success toast", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/floor-plan`);
        await expect(page.getByText("Denah Meja (Floor Plan)")).toBeVisible({ timeout: 10000 });

        // Add a table to make dirty
        await page.getByRole("button", { name: /Tambah Meja/ }).click();

        // Save
        await page.getByRole("button", { name: /^Simpan$/ }).click();

        // Should show success toast
        await expect(page.getByText("Denah meja berhasil disimpan")).toBeVisible({ timeout: 5000 });
    });

    test("should remove a table", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/floor-plan`);
        await expect(page.getByText("Denah Meja (Floor Plan)")).toBeVisible({ timeout: 10000 });

        const initialCount = await page.locator("div.p-3.rounded-lg.border").count();

        // Click trash icon on first table
        await page.locator("div.p-3.rounded-lg.border").first().locator("button.text-red-500").click();

        const newCount = await page.locator("div.p-3.rounded-lg.border").count();
        expect(newCount).toBe(initialCount - 1);
    });
});

// POS loads dynamic floor plan tables
test.describe("POS Floor Plan Integration", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        await page.fill('#email', "admincafe@koperasi.com");
        await page.fill('#password', "password123");
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 30000 });
    });

    test("POS kasir page loads and shows table grid", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/kasir`);
        await expect(page.getByText("Denah Meja (Dine In)")).toBeVisible({ timeout: 10000 });
        // Should show table buttons
        const tableButtons = page.locator("button.h-24.rounded-2xl");
        await expect(tableButtons).toHaveCount(12, { timeout: 5000 });
    });
});

// Navigation contains Floor Plan entry for admin
test.describe("Floor Plan Navigation", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        await page.fill('#email', "admincafe@koperasi.com");
        await page.fill('#password', "password123");
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 30000 });
    });

    test("Denah Meja link exists in sidebar for admin resto", async ({ page }) => {
        // Navigate to a resto page first
        await page.goto(`${BASE_URL}/resto/kasir`);
        await expect(page.getByText("Resto & Coffe Latar POS")).toBeVisible({ timeout: 10000 });

        // Check sidebar for "Denah Meja" link
        const sidebarLink = page.locator("aside").getByText("Denah Meja");
        await expect(sidebarLink).toBeVisible({ timeout: 5000 });

        // Click it
        await sidebarLink.click();
        await expect(page.getByText("Denah Meja (Floor Plan)")).toBeVisible({ timeout: 10000 });
    });
});
