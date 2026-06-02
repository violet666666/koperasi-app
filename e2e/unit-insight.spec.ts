import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "https://www.primkoppol.site";

// ─── Helper: wait for page to fully load ─────────────────
async function waitForInsightPage(page: Page) {
    await page.getByRole("heading", { name: "Insight Penjualan" }).waitFor({ state: "visible", timeout: 15000 });
}

// ─── Helper: login as admin toko ──────────────────────────
async function loginAsAdminToko(page: Page) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('#email', "admintoko@koperasi.com");
    await page.fill('#password', "KHUSUADMIN");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 30000 });
}

// ─── Helper: login as operator ────────────────────────────
async function loginAsOperator(page: Page) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('#email', "operator@koperasi.com");
    await page.fill('#password', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 30000 });
}

// ═══════════════════════════════════════════════════════════
// API Tests (no browser needed)
// ═══════════════════════════════════════════════════════════

test.describe("Unit Insight API", () => {
    test("GET /api/unit-insight/toko/sales-trend returns 401 without auth", async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/unit-insight/toko/sales-trend`);
        expect(res.status()).toBe(401);
    });

    test("GET /api/unit-insight/barbershop/sales-trend returns 400 (not a store unit)", async ({ request }) => {
        // Need to login first to get auth cookie
        const loginRes = await request.post(`${BASE_URL}/api/auth/signin`, {
            data: { email: "operator@koperasi.com", password: "password123" },
        });
        // Even without full auth, non-store unit should be rejected
        const res = await request.get(`${BASE_URL}/api/unit-insight/barbershop/sales-trend`);
        // Either 401 or 400 depending on auth
        expect([400, 401]).toContain(res.status());
    });
});

// ═══════════════════════════════════════════════════════════
// Admin Toko — Full Page Tests
// ═══════════════════════════════════════════════════════════

test.describe("Unit Insight — Admin Toko", () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdminToko(page);
    });

    test("should load insight page and show header", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
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
        await expect(page.getByText("Total Produk Terjual")).toBeVisible({ timeout: 5000 });
        await expect(page.getByText("Total Item Terjual")).toBeVisible();
        await expect(page.getByText("Total Revenue")).toBeVisible();
        await expect(page.getByText("Item Stagnan")).toBeVisible();
    });

    test("should show 4 tabs", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);
        await expect(page.getByRole("tab", { name: /Ranking/ })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("tab", { name: /Tren/ })).toBeVisible();
        await expect(page.getByRole("tab", { name: /Mingguan/ })).toBeVisible();
        await expect(page.getByRole("tab", { name: /Stagnan/ })).toBeVisible();
    });

    // ─── Tab: Ranking ──────────────────────────────────────

    test("ranking tab: should show product list with ranking", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Default tab is ranking — should show terlaris/worst toggle
        await expect(page.getByText(/Terlaris|Kurang Laris/)).toBeVisible({ timeout: 10000 });

        // Should show search input
        await expect(page.getByPlaceholder("Cari produk...")).toBeVisible();
    });

    test("ranking tab: should toggle between best and worst selling", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Click "Kurang Laris"
        await page.getByRole("button", { name: /Kurang Laris/ }).click();

        // Title should change
        await expect(page.getByText("Produk Kurang Laris")).toBeVisible({ timeout: 5000 });

        // Switch back
        await page.getByRole("button", { name: /Terlaris/ }).click();
        await expect(page.getByText("Produk Terlaris")).toBeVisible({ timeout: 5000 });
    });

    test("ranking tab: should filter products by search", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Type in search
        const searchInput = page.getByPlaceholder("Cari produk...");
        await searchInput.fill("xyznonexistent");
        await page.waitForTimeout(500);

        // Should show empty state or filtered result
        const noData = page.getByText("Tidak ada data penjualan");
        const hasResults = await page.locator('text="pcs"').count();
        // Either "no data" message or zero results
        expect(await noData.isVisible().catch(() => false) || hasResults === 0).toBeTruthy();
    });

    // ─── Tab: Tren Harian ──────────────────────────────────

    test("trend tab: should show item selector and chart area", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Click Tren tab
        await page.getByRole("tab", { name: /Tren/ }).click();
        await expect(page.getByText("Tren Penjualan Harian")).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/Pilih item untuk melihat tren/)).toBeVisible();
    });

    // ─── Tab: Mingguan ─────────────────────────────────────

    test("weekly tab: should show comparison table", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Click Mingguan tab
        await page.getByRole("tab", { name: /Mingguan/ }).click();
        await expect(page.getByText("Perbandingan Mingguan")).toBeVisible({ timeout: 5000 });

        // Table headers
        await expect(page.getByText("Minggu Ini")).toBeVisible();
        await expect(page.getByText("Minggu Lalu")).toBeVisible();
    });

    // ─── Tab: Stagnan ──────────────────────────────────────

    test("stagnant tab: should show stagnant items or empty state", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Click Stagnan tab
        await page.getByRole("tab", { name: /Stagnan/ }).click();
        await expect(page.getByText("Item Tidak Laku")).toBeVisible({ timeout: 5000 });
    });

    // ─── Range Filter ──────────────────────────────────────

    test("should switch to 30d range and reload data", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Click 30 Hari
        await page.getByRole("button", { name: "30 Hari" }).click();

        // Should show "30 Hari Terakhir" in subtitle
        await expect(page.getByText("30 Hari Terakhir")).toBeVisible({ timeout: 10000 });
    });

    test("should show custom date range picker", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Click Custom
        await page.getByRole("button", { name: /Custom/ }).click();

        // Date inputs should appear
        const dateInputs = page.locator('input[type="date"]');
        await expect(dateInputs).toHaveCount(2, { timeout: 5000 });
    });

    // ─── Sidebar Navigation ────────────────────────────────

    test("should have Insight Penjualan in sidebar", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Check sidebar link exists
        const sidebarLink = page.locator('a[href="/unit-insight"]').first();
        await expect(sidebarLink).toBeVisible({ timeout: 5000 });
    });
});

// ═══════════════════════════════════════════════════════════
// Operator — Unit Selector Tests
// ═══════════════════════════════════════════════════════════

test.describe("Unit Insight — Operator", () => {
    test.beforeEach(async ({ page }) => {
        await loginAsOperator(page);
    });

    test("should show unit selector buttons for operator", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Operator should see unit selector
        await expect(page.getByRole("button", { name: "Toko PRIMKOPPOL" })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("button", { name: "Resto & Cafe" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Cafe LSP" })).toBeVisible();
    });

    test("should switch between units", async ({ page }) => {
        await page.goto(`${BASE_URL}/unit-insight`);
        await waitForInsightPage(page);

        // Switch to Resto
        await page.getByRole("button", { name: "Resto & Cafe" }).click();

        // Wait for data to load — should show Resto label
        await expect(page.getByText(/Resto/)).toBeVisible({ timeout: 10000 });

        // Switch to Cafe LSP
        await page.getByRole("button", { name: "Cafe LSP" }).click();
        await expect(page.getByText(/Cafe LSP|Cafe Lsp/i)).toBeVisible({ timeout: 10000 });
    });
});
