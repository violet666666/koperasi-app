import { test, expect } from "@playwright/test";

// Haji & Umrah E2E tests — operator login
test.describe("Haji & Umrah — Operator Flow", () => {
    test.beforeEach(async ({ page }) => {
        // Login as operator
        await page.goto("http://localhost:3000/login");
        await page.fill('#email', "operator@koperasi.com");
        await page.fill('#password', "password123");
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard", { timeout: 15000 });
    });

    test("sidebar shows HAJI & UMRAH navigation group", async ({ page }) => {
        await page.goto("http://localhost:3000/dashboard");
        // Check sidebar has Haji & Umrah group
        const sidebar = page.locator("aside, [data-sidebar]");
        await expect(sidebar).toContainText("HAJI & UMRAH", { timeout: 5000 });
    });

    test("dashboard page loads with stat cards", async ({ page }) => {
        await page.goto("http://localhost:3000/haji-umrah");
        await page.waitForLoadState("networkidle");

        // Check page title
        await expect(page.locator("h1, [data-title]").first()).toContainText("Haji & Umrah");

        // Check stat cards rendered (6 cards)
        const cards = page.locator("text=Total Rekening Aktif");
        await expect(cards.first()).toBeVisible({ timeout: 5000 });
    });

    test("produk page loads and shows product cards or empty state", async ({ page }) => {
        await page.goto("http://localhost:3000/haji-umrah/produk");
        await page.waitForLoadState("networkidle");

        // Should show either products or empty state
        const pageContent = page.locator("body");
        await expect(pageContent).toContainText(/Produk Tabungan|Belum ada produk/);
    });

    test("tabungan listing page loads", async ({ page }) => {
        await page.goto("http://localhost:3000/haji-umrah/tabungan");
        await page.waitForLoadState("networkidle");

        // Should show header and search
        await expect(page.locator("text=Tabungan Haji & Umrah").first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator('input[placeholder*="Cari"]').first()).toBeVisible();
    });

    test("laporan page loads with export buttons", async ({ page }) => {
        await page.goto("http://localhost:3000/haji-umrah/laporan");
        await page.waitForLoadState("networkidle");

        await expect(page.locator("text=Laporan Tabungan").first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator("text=Excel").first()).toBeVisible();
        await expect(page.locator("text=PDF").first()).toBeVisible();
    });

    test("API: GET /api/haji-umrah/products returns data", async ({ page }) => {
        const response = await page.request.get("http://localhost:3000/api/haji-umrah/products");
        expect(response.status()).toBe(200);
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
    });

    test("API: GET /api/haji-umrah/savings returns paginated data", async ({ page }) => {
        const response = await page.request.get("http://localhost:3000/api/haji-umrah/savings");
        expect(response.status()).toBe(200);
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(json).toHaveProperty("meta");
        expect(json.meta).toHaveProperty("page");
        expect(json.meta).toHaveProperty("totalPages");
    });

    test("API: GET /api/haji-umrah/reports?type=progress returns dashboard stats", async ({ page }) => {
        const response = await page.request.get("http://localhost:3000/api/haji-umrah/reports?type=progress");
        expect(response.status()).toBe(200);
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(json.data).toHaveProperty("totalAccounts");
        expect(json.data).toHaveProperty("totalSaldo");
        expect(json.data).toHaveProperty("totalTarget");
        expect(json.data).toHaveProperty("adminFeeRevenue");
    });
});
