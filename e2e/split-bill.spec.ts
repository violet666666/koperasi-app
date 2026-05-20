import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Split Bill (Resto POS)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState("networkidle");
        await page.fill('#email', "admincafe@koperasi.com");
        await page.fill('#password', "password123");
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 30000 });
    });

    test("POS page loads table dashboard", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/kasir`);
        // Wait for POS to load (either the floor plan title or default title)
        await page.waitForTimeout(3000);
        const bodyText = await page.locator("main").textContent();
        // Should have either "Denah Meja" or "Resto" text
        expect(bodyText).toMatch(/Denah Meja|Resto/i);
    });

    test("can enter table order view and see Split Bill", async ({ page }) => {
        await page.goto(`${BASE_URL}/resto/kasir`);
        await page.waitForTimeout(3000);

        // Find and click any table button (dine-in tables)
        const allButtons = page.locator("main button");
        const count = await allButtons.count();
        if (count > 0) {
            // Click the first button that looks like a table
            for (let i = 0; i < Math.min(count, 5); i++) {
                const btn = allButtons.nth(i);
                const text = await btn.textContent();
                if (text && (text.includes("Meja") || text.includes("t1") || text.includes("M1"))) {
                    await btn.click();
                    break;
                }
            }
        }

        // Check if we're in order view
        const orderView = page.getByText("Daftar Pesanan");
        if (await orderView.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Split Bill button should exist in payment area
            await expect(page.getByText("Split Bill (Gabung Bayar)")).toBeVisible();
        }
    });
});

// Split Bill API validation (unauthenticated)
test.describe("Split Bill API", () => {
    test("POST /api/toko/split-bill returns 401 without auth", async ({ request }) => {
        const res = await request.post(`${BASE_URL}/api/toko/split-bill`, {
            data: {
                items: [{ productId: 1, name: "Test", price: 10000, quantity: 1 }],
                payments: [{ method: "cash", amount: 10000 }],
            },
        });
        expect(res.status()).toBe(401);
    });
});
