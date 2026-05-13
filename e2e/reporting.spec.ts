import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Reporting Dashboard (Resto)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState("networkidle");
        await page.fill('#email', "admincafe@koperasi.com");
        await page.fill('#password', "password123");
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 30000 });
    });

    test("should load reporting page with summary cards", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/laporan`);
        await expect(page.getByText("Laporan Penjualan Resto")).toBeVisible({ timeout: 15000 });
        // Should show summary card labels
        await expect(page.getByText("Total Pendapatan")).toBeVisible({ timeout: 5000 });
    });

    test("should show date range filter", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/laporan`);
        await expect(page.getByText("Laporan Penjualan Resto")).toBeVisible({ timeout: 15000 });
        // Date inputs should exist
        const dateInputs = page.locator('input[type="date"]');
        await expect(dateInputs).toHaveCount(2, { timeout: 3000 });
    });

    test("should show Export CSV button", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/laporan`);
        await expect(page.getByText("Laporan Penjualan Resto")).toBeVisible({ timeout: 15000 });
        await expect(page.getByText("Export CSV")).toBeVisible();
    });

    test("should show top products section", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/laporan`);
        await expect(page.getByText("Laporan Penjualan Resto")).toBeVisible({ timeout: 15000 });
        await expect(page.getByText("Menu Terlaris", { exact: true })).toBeVisible();
    });
});

// Sales Summary API validation
test.describe("Sales Summary API", () => {
    test("GET /api/toko/reports/sales-summary returns 401 without auth", async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/toko/reports/sales-summary?unitType=resto`);
        expect(res.status()).toBe(401);
    });
});
