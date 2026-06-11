import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

// ── Helper: login as operator and get cookies ──
async function loginAsOperator(page: import("@playwright/test").Page) {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', "operator@koperasi.com");
    await page.fill('#password', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });
}

test.describe("Haji & Umrah — Full E2E Flow", () => {

    // ── Step 1: Seed products via API ──
    test("Step 1: Create Tabungan Haji product", async ({ page }) => {
        await loginAsOperator(page);

        const res = await page.request.post(`${BASE}/api/haji-umrah/products`, {
            data: {
                code: "TH",
                name: "Tabungan Haji",
                type: "tabungan_haji",
                minimumAmount: 100000,
                targetAmount: 50000000,
                adminFeeType: "percent",
                adminFeeValue: 0.5,
                linkedBankName: "BSI",
            },
        });
        expect([200, 201, 409].includes(res.status())).toBe(true);
        if (res.status() === 201) {
            const json = await res.json();
            expect(json.data.code).toBe("TH");
            expect(json.data.targetAmount).toBe("50000000");
            console.log("✅ TH created:", json.data.id);
        } else if (res.status() === 409) {
            console.log("✅ TH already exists (409)");
        }
    });

    test("Step 2: Create Tabungan Umrah product", async ({ page }) => {
        await loginAsOperator(page);

        const res = await page.request.post(`${BASE}/api/haji-umrah/products`, {
            data: {
                code: "TU",
                name: "Tabungan Umrah",
                type: "tabungan_umrah",
                minimumAmount: 50000,
                targetAmount: 25000000,
                adminFeeType: "percent",
                adminFeeValue: 0.5,
                linkedBankName: "BSI",
            },
        });
        expect([200, 201, 409].includes(res.status())).toBe(true);
        if (res.status() === 201) {
            const json = await res.json();
            expect(json.data.code).toBe("TU");
            console.log("✅ TU created:", json.data.id);
        } else if (res.status() === 409) {
            console.log("✅ TU already exists (409)");
        }
    });

    // ── Step 3: Verify products listed ──
    test("Step 3: Products API returns TH and TU", async ({ page }) => {
        await loginAsOperator(page);

        const res = await page.request.get(`${BASE}/api/haji-umrah/products`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json.data.length).toBeGreaterThanOrEqual(2);
        const codes = json.data.map((p: { code: string }) => p.code);
        expect(codes).toContain("TH");
        expect(codes).toContain("TU");
        console.log("✅ Products:", codes);
    });

    // ── Step 4: Open a savings account ──
    test("Step 4: Open savings account via API", async ({ page }) => {
        await loginAsOperator(page);

        // Get first available member
        const membersRes = await page.request.get(`${BASE}/api/members?perPage=5`);
        expect(membersRes.status()).toBe(200);
        const membersJson = await membersRes.json();
        expect(membersJson.data.length).toBeGreaterThan(0);
        const member = membersJson.data[0];
        console.log("Using member:", member.name, `(id: ${member.id})`);

        // Get TH product ID
        const productsRes = await page.request.get(`${BASE}/api/haji-umrah/products`);
        const productsJson = await productsRes.json();
        const thProduct = productsJson.data.find((p: { code: string }) => p.code === "TH");
        expect(thProduct).toBeDefined();

        // Try to create account (may already exist due to unique constraint)
        const accountRes = await page.request.post(`${BASE}/api/haji-umrah/savings`, {
            data: {
                memberId: member.id,
                productId: thProduct.id,
                monthlyTarget: 500000,
            },
        });

        if (accountRes.status() === 201) {
            const json = await accountRes.json();
            expect(json.data.accountNo).toContain("HU-");
            expect(json.data.targetAmount).toBe("50000000");
            console.log("✅ Account created:", json.data.accountNo);
        } else if (accountRes.status() === 409) {
            console.log("✅ Account already exists for this member+product (409)");
        } else {
            const json = await accountRes.json();
            console.log("Account response:", accountRes.status(), json.message);
        }
    });

    // ── Step 5: Verify savings list ──
    test("Step 5: Savings list returns accounts with progress", async ({ page }) => {
        await loginAsOperator(page);

        const res = await page.request.get(`${BASE}/api/haji-umrah/savings`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json).toHaveProperty("data");
        expect(json).toHaveProperty("meta");
        expect(json.meta).toHaveProperty("totalPages");
        console.log("✅ Savings accounts:", json.data.length, "| Total:", json.meta.total);

        if (json.data.length > 0) {
            const acc = json.data[0];
            expect(acc).toHaveProperty("progress");
            expect(acc).toHaveProperty("target");
            expect(acc).toHaveProperty("balance");
            console.log("Sample account:", acc.accountNo, "Progress:", acc.progress + "%");
        }
    });

    // ── Step 6: Make a deposit (setoran) ──
    test("Step 6: Make deposit via transactions API", async ({ page }) => {
        await loginAsOperator(page);

        // Get first savings account
        const savingsRes = await page.request.get(`${BASE}/api/haji-umrah/savings`);
        const savingsJson = await savingsRes.json();
        if (savingsJson.data.length === 0) {
            console.log("⚠️ No savings accounts to test deposit — skipping");
            return;
        }
        const accountId = savingsJson.data[0].id;

        // Get a cash/bank account
        const cbRes = await page.request.get(`${BASE}/api/cash-bank/accounts`);
        expect(cbRes.status()).toBe(200);
        const cbJson = await cbRes.json();
        expect(cbJson.data.length).toBeGreaterThan(0);
        const cbAccountId = cbJson.data[0].id;

        // Make deposit
        const depositRes = await page.request.post(
            `${BASE}/api/haji-umrah/savings/${accountId}/transactions`,
            {
                data: {
                    amount: 500000,
                    paymentMethod: "cash",
                    cashBankAccountId: cbAccountId,
                    notes: "Test setoran E2E",
                },
            }
        );

        expect(depositRes.status()).toBe(201);
        const json = await depositRes.json();
        expect(json).toHaveProperty("data");
        expect(json).toHaveProperty("meta");
        expect(json.meta).toHaveProperty("adminFee");
        expect(json.meta).toHaveProperty("balanceAfter");
        expect(json.meta).toHaveProperty("progress");
        console.log("✅ Deposit success! Balance:", json.meta.balanceAfter,
            "Admin fee:", json.meta.adminFee,
            "Progress:", json.meta.progress + "%");
    });

    // ── Step 7: Verify account detail ──
    test("Step 7: Account detail has stats and transactions", async ({ page }) => {
        await loginAsOperator(page);

        const savingsRes = await page.request.get(`${BASE}/api/haji-umrah/savings`);
        const savingsJson = await savingsRes.json();
        if (savingsJson.data.length === 0) return;

        const accountId = savingsRes.status() === 200 ? savingsJson.data[0].id : null;
        if (!accountId) return;

        const detailRes = await page.request.get(`${BASE}/api/haji-umrah/savings/${accountId}`);
        expect(detailRes.status()).toBe(200);
        const json = await detailRes.json();

        expect(json.data).toHaveProperty("stats");
        expect(json.data.stats).toHaveProperty("totalDeposits");
        expect(json.data.stats).toHaveProperty("monthlyDeposits");
        expect(json.data.stats).toHaveProperty("depositCount");
        expect(json.data.stats).toHaveProperty("remaining");
        expect(json.data.stats).toHaveProperty("isTargetReached");
        expect(json.data).toHaveProperty("transactions");
        expect(Array.isArray(json.data.transactions)).toBe(true);
        console.log("✅ Detail: deposits:", json.data.stats.depositCount,
            "total:", json.data.stats.totalDeposits,
            "remaining:", json.data.stats.remaining);
    });

    // ── Step 8: Reports API returns data ──
    test("Step 8: Reports API returns rekap and progress data", async ({ page }) => {
        await loginAsOperator(page);

        // Rekap report
        const rekapRes = await page.request.get(`${BASE}/api/haji-umrah/reports?type=rekap`);
        expect(rekapRes.status()).toBe(200);
        const rekapJson = await rekapRes.json();
        expect(rekapJson).toHaveProperty("data");
        expect(rekapJson).toHaveProperty("summary");
        expect(rekapJson.summary).toHaveProperty("totalAccounts");
        expect(rekapJson.summary).toHaveProperty("totalSaldo");
        console.log("✅ Rekap:", rekapJson.summary.totalAccounts, "accounts, saldo:", rekapJson.summary.totalSaldo);

        // Progress report
        const progressRes = await page.request.get(`${BASE}/api/haji-umrah/reports?type=progress`);
        expect(progressRes.status()).toBe(200);
        const progressJson = await progressRes.json();
        expect(progressJson.data).toHaveProperty("totalAccounts");
        expect(progressJson.data).toHaveProperty("adminFeeRevenue");
        console.log("✅ Progress: accounts:", progressJson.data.totalAccounts,
            "admin fee revenue:", progressJson.data.adminFeeRevenue);
    });

    // ── Step 9: UI pages render correctly ──
    test("Step 9: Dashboard page renders with live data", async ({ page }) => {
        await loginAsOperator(page);
        await page.goto(`${BASE}/haji-umrah`);
        await page.waitForLoadState("networkidle");

        await expect(page.locator("text=Total Rekening Aktif").first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator("text=Admin Fee Bulan Ini").first()).toBeVisible();
        console.log("✅ Dashboard renders with stat cards");
    });

    test("Step 10: Tabungan listing shows accounts with progress bars", async ({ page }) => {
        await loginAsOperator(page);
        await page.goto(`${BASE}/haji-umrah/tabungan`);
        await page.waitForLoadState("networkidle");

        await expect(page.locator("text=Tabungan Haji & Umrah").first()).toBeVisible({ timeout: 10000 });

        // If accounts exist, should see account numbers
        const savingsRes = await page.request.get(`${BASE}/api/haji-umrah/savings`);
        const savingsJson = await savingsRes.json();
        if (savingsJson.data.length > 0) {
            await expect(page.locator("text=HU-").first()).toBeVisible({ timeout: 5000 });
            console.log("✅ Tabungan listing shows", savingsJson.data.length, "accounts");
        }
    });

    test("Step 11: Produk page shows TH and TU cards", async ({ page }) => {
        await loginAsOperator(page);
        await page.goto(`${BASE}/haji-umrah/produk`);
        await page.waitForLoadState("networkidle");

        await expect(page.locator("text=Tabungan Haji").first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator("text=Tabungan Umrah").first()).toBeVisible();
        await expect(page.locator("text=BSI").first()).toBeVisible();
        console.log("✅ Produk page shows TH + TU cards with BSI");
    });

    test("Step 12: Laporan page renders with export buttons", async ({ page }) => {
        await loginAsOperator(page);
        await page.goto(`${BASE}/haji-umrah/laporan`);
        await page.waitForLoadState("networkidle");

        await expect(page.locator("text=Laporan Tabungan").first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator("button:has-text('Excel')").first()).toBeVisible();
        await expect(page.locator("button:has-text('PDF')").first()).toBeVisible();
        console.log("✅ Laporan page with Excel + PDF export");
    });
});
