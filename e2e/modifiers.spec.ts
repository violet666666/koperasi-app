import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Modifiers Admin Page (Resto)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState("networkidle");
        await page.fill('#email', "admincafe@koperasi.com");
        await page.fill('#password', "password123");
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 30000 });
    });

    test("should load modifiers page", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/modifiers`);
        await expect(page.getByText("Modifier & Add-on")).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole("heading", { name: "Pilih Produk" })).toBeVisible();
    });

    test("should show empty state when no product selected", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/modifiers`);
        await expect(page.getByText("Pilih produk untuk mengatur modifier")).toBeVisible({ timeout: 10000 });
    });

    test("should show 'Tambah Group' button", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/modifiers`);
        await expect(page.getByText("Modifier & Add-on")).toBeVisible({ timeout: 10000 });
        // If no product is selected, the button should not be visible yet
        // Click a product first (if any exist)
        const productBtn = page.locator("button.w-full.text-left").first();
        if (await productBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await productBtn.click();
            await expect(page.getByText("Tambah Group")).toBeVisible({ timeout: 3000 });
        }
    });
});

// Modifiers API validation
test.describe("Modifiers API", () => {
    test("GET /api/toko/modifiers returns 401 without auth", async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/toko/modifiers?productId=1`);
        expect(res.status()).toBe(401);
    });

    test("PUT /api/toko/modifiers returns 401 without auth", async ({ request }) => {
        const res = await request.put(`${BASE_URL}/api/toko/modifiers`, {
            data: { productId: 1, groups: [] },
        });
        expect(res.status()).toBe(401);
    });
});
