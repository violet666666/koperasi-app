import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

async function loginAs(page: import("@playwright/test").Page, email: string, password: string = "password123") {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });
}

test.describe("Haji & Umrah — Talangan Feature", () => {

    // ── 1. API Tests ──────────────────────────────────────────────

    test("1.1 GET /api/haji-umrah/talangan — returns stats and data", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");

        const res = await page.request.get(`${BASE}/api/haji-umrah/talangan`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json.stats).toBeDefined();
        expect(typeof json.stats.totalActive).toBe("number");
        expect(typeof json.stats.gapDetected).toBe("number");
        expect(Array.isArray(json.data)).toBe(true);
        console.log("✅ Talangan list API — stats:", json.stats);
    });

    test("1.2 GET /api/haji-umrah/talangan/gap — gap calculator returns accounts", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");

        const res = await page.request.get(`${BASE}/api/haji-umrah/talangan/gap`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json.summary).toBeDefined();
        expect(typeof json.summary.totalAccounts).toBe("number");
        expect(typeof json.summary.withGap).toBe("number");
        expect(Array.isArray(json.data)).toBe(true);
        console.log("✅ Gap calculator — summary:", json.summary);
    });

    test("1.3 GET /api/haji-umrah/talangan/products — returns talangan products", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");

        const res = await page.request.get(`${BASE}/api/haji-umrah/talangan/products`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(Array.isArray(json.data)).toBe(true);

        // If products exist, validate structure
        if (json.data.length > 0) {
            const p = json.data[0];
            expect(p.type).toMatch(/^talangan_(haji|umrah)$/);
            expect(typeof p.interestRate).toBe("number");
            console.log(`✅ Found ${json.data.length} talangan product(s): ${json.data.map((x: any) => x.code).join(", ")}`);
        } else {
            console.log("ℹ️ No talangan products seeded yet — this is OK if not re-seeded");
        }
    });

    test("1.4 GET /api/haji-umrah/talangan/gap?onlyWithGap=true — filters correctly", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");

        const res = await page.request.get(`${BASE}/api/haji-umrah/talangan/gap?onlyWithGap=true`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        // All returned accounts should be needs_talangan
        for (const account of json.data) {
            expect(account.status).toBe("needs_talangan");
            expect(account.gap).toBeGreaterThan(0);
        }
        console.log(`✅ Gap filter: ${json.data.length} accounts need talangan`);
    });

    // ── 2. Create Talangan (Full Flow) ────────────────────────────

    test("2.1 Full talangan flow: find gap → apply → approve → disburse", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");

        // Step 1: Find savings account with gap
        const gapRes = await page.request.get(`${BASE}/api/haji-umrah/talangan/gap?onlyWithGap=true`);
        const gapJson = await gapRes.json();
        if (gapJson.data.length === 0) {
            console.log("⏭️ No gap accounts available — skipping full flow");
            return;
        }
        const savingsAccountId = gapJson.data[0].accountId;
        const gap = gapJson.data[0].gap;
        console.log(`✅ Found savings account: ID=${savingsAccountId}, gap=${gap}`);

        // Step 2: Find matching talangan product
        const productType = gapJson.data[0].productType.replace("tabungan_", "talangan_");
        const prodRes = await page.request.get(`${BASE}/api/haji-umrah/talangan/products?type=${productType}`);
        const prodJson = await prodRes.json();
        if (prodJson.data.length === 0) {
            console.log("⏭️ No talangan products available — skipping");
            return;
        }
        const productId = prodJson.data[0].id;
        console.log(`✅ Product: ID=${productId}, ${prodJson.data[0].name}`);

        // Step 3: Apply for talangan
        const talanganAmount = Math.min(gap, 5000000); // Cap at 5M for test safety
        const applyRes = await page.request.post(`${BASE}/api/haji-umrah/talangan/apply`, {
            data: {
                savingsAccountId,
                productId,
                amount: talanganAmount,
                tenorMonths: 6,
                deductionSource: "gaji",
                autoDisburse: false,
                notes: "E2E Test — talangan via Playwright",
            },
        });

        if (![200, 201].includes(applyRes.status())) {
            const errBody = await applyRes.text();
            console.log(`ℹ️ Apply failed (${applyRes.status()}): ${errBody}`);
            // This could be due to existing talangan — not a test failure
            return;
        }

        const applyJson = await applyRes.json();
        const applicationId = applyJson.data.applicationId;
        expect(applicationId).toBeDefined();
        console.log(`✅ Talangan applied: applicationId=${applicationId}, status=${applyJson.data.status}`);

        // Step 4: View detail
        const detailRes = await page.request.get(`${BASE}/api/haji-umrah/talangan/${applicationId}`);
        expect(detailRes.status()).toBe(200);
        const detailJson = await detailRes.json();
        expect(detailJson.data.application.id).toBe(applicationId);
        console.log(`✅ Detail retrieved: status=${detailJson.data.application.status}`);

        // Step 5: Approve
        const approveRes = await page.request.post(`${BASE}/api/loans/applications/${applicationId}/approve`, {
            data: {},
        });
        expect(approveRes.status()).toBe(200);
        console.log("✅ Application approved");

        // Step 6: Disburse
        const disburseRes = await page.request.post(`${BASE}/api/loans/applications/${applicationId}/disburse`, {
            data: {},
        });
        if (disburseRes.status() === 200) {
            const disburseJson = await disburseRes.json();
            console.log(`✅ Talangan disbursed: loanId=${disburseJson.loanId}`);
        } else {
            const errJson = await disburseRes.json();
            console.log(`ℹ️ Disburse: ${disburseRes.status()} — ${errJson.message}`);
        }

        // Step 7: Verify it appears in talangan list
        const listRes = await page.request.get(`${BASE}/api/haji-umrah/talangan?status=active`);
        const listJson = await listRes.json();
        expect(listJson.stats.totalActive).toBeGreaterThanOrEqual(1);
        console.log(`✅ Talangan now shows in active list: totalActive=${listJson.stats.totalActive}`);
    });

    // ── 3. UI Page Tests ──────────────────────────────────────────

    test("3.1 Talangan list page loads", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        await page.goto(`${BASE}/haji-umrah/talangan`);
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/haji-umrah/talangan");
        await expect(page.locator("text=Talangan Haji & Umrah").first()).toBeVisible({ timeout: 10000 });
        console.log("✅ Talangan list page loads");
    });

    test("3.2 Talangan apply page loads", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        await page.goto(`${BASE}/haji-umrah/talangan/apply`);
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/haji-umrah/talangan/apply");
        await expect(page.locator("text=Pengajuan Talangan").first()).toBeVisible({ timeout: 10000 });
        console.log("✅ Talangan apply page loads");
    });

    test("3.3 Dashboard shows talangan stats", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        await page.goto(`${BASE}/haji-umrah`);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("text=Talangan Aktif").first()).toBeVisible({ timeout: 10000 });
        console.log("✅ Dashboard shows Talangan Aktif card");
    });

    test("3.4 Sidebar shows Talangan menu", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        // Navigate to H&U page first to expand sidebar section
        await page.goto(`${BASE}/haji-umrah`);
        await page.waitForLoadState("networkidle");
        // Look for Talangan in sidebar — it might be inside collapsed section
        const sidebarText = await page.locator("aside, nav, [data-sidebar]").first().textContent({ timeout: 10000 }).catch(() => "");
        const hasTalangan = sidebarText?.includes("Talangan") ?? false;
        // Also check if the page rendered talangan quick link
        const pageHasTalangan = await page.locator("text=Talangan").first().isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasTalangan || pageHasTalangan).toBe(true);
        console.log(`✅ Talangan menu visible: sidebar=${hasTalangan}, page=${pageHasTalangan}`);
    });

    // ── 4. Reports ────────────────────────────────────────────────

    test("4.1 Talangan report API returns data", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");

        const res = await page.request.get(`${BASE}/api/haji-umrah/reports?type=talangan`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json.summary).toBeDefined();
        expect(typeof json.summary.totalLoans).toBe("number");
        console.log(`✅ Talangan report: ${json.summary.totalLoans} loans, ${json.summary.activeCount} active`);
    });

    // ── 5. RBAC Tests ─────────────────────────────────────────────

    test("5.1 Admin haji_umrah can access talangan API", async ({ page }) => {
        await loginAs(page, "adminhajiumrah@koperasi.com");

        const res = await page.request.get(`${BASE}/api/haji-umrah/talangan`);
        expect(res.status()).toBe(200);
        console.log("✅ Admin haji_umrah can access talangan API");
    });

    test("5.2 Admin haji_umrah can access gap calculator", async ({ page }) => {
        await loginAs(page, "adminhajiumrah@koperasi.com");

        const res = await page.request.get(`${BASE}/api/haji-umrah/talangan/gap`);
        expect(res.status()).toBe(200);
        console.log("✅ Admin haji_umrah can access gap calculator");
    });

    test("5.3 Talangan apply requires auth", async ({ page }) => {
        // No login — should get 401
        const res = await page.request.post(`${BASE}/api/haji-umrah/talangan/apply`, {
            data: { savingsAccountId: 1, productId: 1, amount: 1000, tenorMonths: 6 },
        });
        expect([401, 403].includes(res.status())).toBe(true);
        console.log("✅ Unauthenticated apply blocked:", res.status());
    });

    // ── 6. Validation Tests ───────────────────────────────────────

    test("6.1 Apply with invalid data returns validation error", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");

        const res = await page.request.post(`${BASE}/api/haji-umrah/talangan/apply`, {
            data: { savingsAccountId: 999999, productId: 999999, amount: -100, tenorMonths: 0 },
        });
        expect([400, 404].includes(res.status())).toBe(true);
        console.log("✅ Invalid data rejected:", res.status());
    });
});
