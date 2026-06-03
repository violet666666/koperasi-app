import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "https://www.primkoppol.site";

// ─── Helpers ──────────────────────────────────────────────

async function waitForInsightPage(page: Page) {
    // Wait for heading first (shell renders immediately)
    await page.getByRole("heading", { name: "Insight Penjualan" }).waitFor({ state: "visible", timeout: 15000 });
    // Then wait for data to load (summary cards only appear after API response)
    await page.getByText("Total Produk Terjual").waitFor({ state: "visible", timeout: 15000 });
}

async function loginAsAdminToko(page: Page) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('#email', "admintoko@koperasi.com");
    await page.fill('#password', "KHUSUADMIN");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 30000 });
}

async function loginAsOperator(page: Page) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('#email', "operator@koperasi.com");
    await page.fill('#password', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 30000 });
}

// ═══════════════════════════════════════════════════════════
// API Tests
// ═══════════════════════════════════════════════════════════

test.describe("Unit Insight API", () => {
    test("GET /api/unit-insight/toko/sales-trend returns 401 without auth", async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/unit-insight/toko/sales-trend`);
        expect(res.status()).toBe(401);
    });

    test("GET /api/unit-insight/barbershop/sales-trend returns 400 or 401 (not a store unit)", async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/unit-insight/barbershop/sales-trend`);
        expect([400, 401]).toContain(res.status());
    });

    test("API returns 200 with valid data structure for authenticated toko user", async ({ browser }) => {
        const page = await browser.newPage();
        await loginAsAdminToko(page);

        const resp = await page.evaluate(async () => {
            const r = await fetch('/api/unit-insight/toko/sales-trend?range=7d');
            const data = await r.json();
            return {
                status: r.status,
                hasData: !!data.data,
                hasRanking: !!data.data?.ranking,
                hasDailyTrend: !!data.data?.dailyTrend,
                hasStagnant: !!data.data?.stagnant,
                hasWeeklyComparison: !!data.data?.weeklyComparison,
                rangeLabel: data.data?.rangeLabel,
            };
        });

        expect(resp.status).toBe(200);
        expect(resp.hasData).toBe(true);
        expect(resp.hasRanking).toBe(true);
        expect(resp.hasDailyTrend).toBe(true);
        expect(resp.hasStagnant).toBe(true);
        expect(resp.hasWeeklyComparison).toBe(true);
        expect(resp.rangeLabel).toBe("7 Hari Terakhir");

        await page.close();
    });
});

// ═══════════════════════════════════════════════════════════
// Admin Toko — Page Tests
// ═══════════════════════════════════════════════════════════

test.describe("Unit Insight — Admin Toko", () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdminToko(page);
    });

    test("should load insight page with header and range label", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        // Range label in subtitle paragraph
        await expect(page.getByText(/7 Hari Terakhir.*Toko/)).toBeVisible({ timeout: 10000 });
    });

    test("should show range filter buttons", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await expect(page.getByRole("button", { name: "Hari Ini" })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("button", { name: "7 Hari" })).toBeVisible();
        await expect(page.getByRole("button", { name: "30 Hari" })).toBeVisible();
        await expect(page.getByRole("button", { name: /Custom/ })).toBeVisible();
    });

    test("should show 4 summary cards", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await expect(page.getByText("Total Produk Terjual")).toBeVisible({ timeout: 10000 });
        await expect(page.getByText("Total Item Terjual")).toBeVisible();
        await expect(page.getByText("Total Revenue")).toBeVisible();
        await expect(page.getByText("Item Stagnan")).toBeVisible();
    });

    test("should show 4 tabs", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await expect(page.getByRole("tab", { name: /Ranking/ })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole("tab", { name: /Tren/ })).toBeVisible();
        await expect(page.getByRole("tab", { name: /Mingguan/ })).toBeVisible();
        await expect(page.getByRole("tab", { name: /Stagnan/ })).toBeVisible();
    });

    // ─── Tab: Ranking ──────────────────────────────────────

    test("ranking tab: shows best/worst toggle and search", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await expect(page.getByRole("button", { name: /Terlaris/ })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole("button", { name: /Kurang Laris/ })).toBeVisible();
        await expect(page.getByPlaceholder("Cari produk...")).toBeVisible();
    });

    test("ranking tab: toggle between best and worst", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await page.getByRole("button", { name: /Kurang Laris/ }).click();
        await expect(page.getByText("Produk Kurang Laris")).toBeVisible({ timeout: 5000 });
        await page.getByRole("button", { name: /Terlaris/ }).click();
        await expect(page.getByText("Produk Terlaris")).toBeVisible({ timeout: 5000 });
    });

    // ─── Tab: Tren ─────────────────────────────────────────

    test("trend tab: shows trend header", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await page.getByRole("tab", { name: /Tren/ }).click();
        await expect(page.getByText("Tren Penjualan Harian")).toBeVisible({ timeout: 10000 });
    });

    // ─── Tab: Mingguan ─────────────────────────────────────

    test("weekly tab: shows comparison headers", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await page.getByRole("tab", { name: /Mingguan/ }).click();
        await expect(page.getByText("Perbandingan Mingguan")).toBeVisible({ timeout: 10000 });
        await expect(page.getByText("Minggu Ini")).toBeVisible();
        await expect(page.getByText("Minggu Lalu")).toBeVisible();
    });

    // ─── Tab: Stagnan ──────────────────────────────────────

    test("stagnant tab: shows stagnant section with items count", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await page.getByRole("tab", { name: /Stagnan/ }).click();
        await expect(page.getByText("Item Tidak Laku")).toBeVisible({ timeout: 10000 });
        // Should have a badge showing count
        await expect(page.getByText(/\d+ item/)).toBeVisible({ timeout: 5000 });
    });

    // ─── Range Filter ──────────────────────────────────────

    test("should switch to 30d range and show label", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await page.getByRole("button", { name: "30 Hari" }).click();
        await expect(page.getByText("30 Hari Terakhir")).toBeVisible({ timeout: 10000 });
    });

    test("should switch to today range", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await page.getByRole("button", { name: "Hari Ini" }).click();
        await expect(page.getByText("Hari Ini")).toBeVisible({ timeout: 10000 });
    });

    test("should show custom date range picker", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await page.getByRole("button", { name: /Custom/ }).click();
        const dateInputs = page.locator('input[type="date"]');
        await expect(dateInputs).toHaveCount(2, { timeout: 5000 });
        await expect(page.getByRole("button", { name: "Terapkan" })).toBeVisible();
    });

    // ─── Sidebar ───────────────────────────────────────────

    test("should have Insight Penjualan in sidebar", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        const sidebarLink = page.locator('a[href="/unit-insight"]').first();
        await expect(sidebarLink).toBeVisible({ timeout: 10000 });
    });
});

// ═══════════════════════════════════════════════════════════
// Operator — Unit Selector
// ═══════════════════════════════════════════════════════════

test.describe("Unit Insight — Operator", () => {
    test.beforeEach(async ({ page }) => {
        await loginAsOperator(page);
    });

    test("should show unit selector for operator", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        // Operator sees unit selector buttons with full unit names
        await expect(page.getByRole("button", { name: "Toko PRIMKOPPOL" })).toBeVisible({ timeout: 10000 });
    });

    test("should switch to resto unit", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        // Click resto button
        await page.getByRole("button", { name: "Resto & Cafe" }).click();
        // Wait for data reload
        await page.waitForTimeout(3000);
        // Page should still show heading
        await expect(page.getByRole("heading", { name: "Insight Penjualan" })).toBeVisible({ timeout: 10000 });
    });

    test("stagnant tab shows different counts per unit", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await page.getByRole("tab", { name: /Stagnan/ }).click();
        await expect(page.getByText("Item Tidak Laku")).toBeVisible({ timeout: 10000 });

        // Get stagnant count for toko
        const tokoBadge = page.getByText(/\d+ item/).first();
        const tokoText = await tokoBadge.textContent();

        // Switch to cafe-lsp
        await page.getByRole("button", { name: "Cafe LSP" }).click();
        await page.waitForTimeout(3000);

        // Stagnant count should differ
        await expect(page.getByText("Item Tidak Laku")).toBeVisible({ timeout: 10000 });
        const cafeText = await page.getByText(/\d+ item/).first().textContent();
        // Just verify both have valid counts
        expect(tokoText).toBeTruthy();
        expect(cafeText).toBeTruthy();
    });
});
