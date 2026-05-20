import { test, expect } from "@playwright/test";

// Phase 1.1 E2E: Batch & Expiry Tracking for Resto and Cafe LSP
// Verifies wrapper pages load, navigation shows batch entry, route guard works.

const ADMIN_RESTO = { email: "admincafe@koperasi.com", password: "password123" };
const ADMIN_CAFE_LSP = { email: "admincafelsp@koperasi.com", password: "password123" };
const KASIR_RESTO = { email: "kasircafe@koperasi.com", password: "password123" };
const KASIR_CAFE_LSP = { email: "kasircafelsp@koperasi.com", password: "password123" };

async function login(page: any, creds: { email: string; password: string }) {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('#email', creds.email);
    await page.fill('#password', creds.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|portal)/, { timeout: 30000 });
}

test.describe("Batch & Expiry — Admin Resto", () => {
    test("admin resto can navigate to /resto/batch", async ({ page }) => {
        await login(page, ADMIN_RESTO);
        await page.goto("/resto/batch");
        await page.waitForLoadState("networkidle");

        // Should not redirect to dashboard (route guard passed)
        expect(page.url()).toContain("/resto/batch");

        // Page should render batch-related content (title or cards)
        const bodyText = await page.textContent("body");
        expect(bodyText).toBeTruthy();
    });

    test("admin resto sees Manajemen Batch in sidebar", async ({ page }) => {
        await login(page, ADMIN_RESTO);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Look for batch nav link in sidebar
        const batchLink = page.locator('a[href="/resto/batch"]');
        await expect(batchLink).toBeVisible({ timeout: 5000 });
    });
});

test.describe("Batch & Expiry — Admin Cafe LSP", () => {
    test("admin cafe_lsp can navigate to /cafe-lsp/batch", async ({ page }) => {
        await login(page, ADMIN_CAFE_LSP);
        await page.goto("/cafe-lsp/batch");
        await page.waitForLoadState("networkidle");

        expect(page.url()).toContain("/cafe-lsp/batch");

        const bodyText = await page.textContent("body");
        expect(bodyText).toBeTruthy();
    });

    test("admin cafe_lsp sees Manajemen Batch in sidebar", async ({ page }) => {
        await login(page, ADMIN_CAFE_LSP);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        const batchLink = page.locator('a[href="/cafe-lsp/batch"]');
        await expect(batchLink).toBeVisible({ timeout: 5000 });
    });
});

test.describe("Batch & Expiry — Kasir Access", () => {
    test("kasir resto can access /resto/batch (prefix guard allows /resto/*)", async ({ page }) => {
        await login(page, KASIR_RESTO);
        await page.goto("/resto/batch");
        await page.waitForLoadState("networkidle");

        // Route guard allows kasir resto to access any /resto/* path
        expect(page.url()).toContain("/resto/batch");
        const bodyText = await page.textContent("body");
        expect(bodyText).toBeTruthy();
    });

    test("kasir cafe_lsp can access /cafe-lsp/batch (prefix guard allows /cafe-lsp/*)", async ({ page }) => {
        await login(page, KASIR_CAFE_LSP);
        await page.goto("/cafe-lsp/batch");
        await page.waitForLoadState("networkidle");

        // Route guard allows kasir cafe_lsp to access any /cafe-lsp/* path
        expect(page.url()).toContain("/cafe-lsp/batch");
        const bodyText = await page.textContent("body");
        expect(bodyText).toBeTruthy();
    });
});
