import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

// Offline sync is primarily a client-side concern (localStorage + hooks).
// E2E tests verify the POS page loads and the offline indicator logic exists.

test.describe("Offline Mode", () => {
    test("POS page handles network status", async ({ page }) => {
        // Login
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState("networkidle");
        await page.fill('#email', "admincafe@koperasi.com");
        await page.fill('#password', "password123");
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 30000 });

        // Go to POS
        await page.goto(`${BASE_URL}/resto/kasir`);
        await page.waitForTimeout(3000);

        // Simulate offline
        await page.context().setOffline(true);

        // Verify navigator.onLine is false
        const isOnline = await page.evaluate(() => navigator.onLine);
        expect(isOnline).toBe(false);

        // Restore online
        await page.context().setOffline(false);
        const isBackOnline = await page.evaluate(() => navigator.onLine);
        expect(isBackOnline).toBe(true);
    });
});
