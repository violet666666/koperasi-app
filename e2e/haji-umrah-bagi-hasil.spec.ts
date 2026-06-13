import { test, expect, type Page, type Browser } from "@playwright/test";

const BASE = "http://localhost:3000";
const MEMBER_EMAIL = "87011378@koperasi.local";
const MEMBER_PASSWORD = "87011378"; // A'AN ANDRIONO (member_id 776, owns HU-776-10-1715)

async function loginAs(page: Page, email: string, password: string = "password123") {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|portal)/, { timeout: 30000 });
}

async function loginInNewContext(browser: Browser, email: string, password: string) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE}/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|portal)/, { timeout: 30000 });
    return { page, close: () => context.close() };
}

// Member's total H&U balance via the member-portal endpoint (real proof of credit/reversal)
async function memberHuBalance(browser: Browser): Promise<number> {
    const { page, close } = await loginInNewContext(browser, MEMBER_EMAIL, MEMBER_PASSWORD);
    try {
        const res = await page.request.get(`${BASE}/api/member-portal/haji-umrah`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        return json.data.summary.totalBalance as number;
    } finally {
        await close();
    }
}

test.describe("Haji & Umrah — Spread Bagi Hasil (Phase 4)", () => {

    // ── 1. List + auth ────────────────────────────────────────────

    test("1.1 GET /api/haji-umrah/bagi-hasil — list + summary (operator)", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        const res = await page.request.get(`${BASE}/api/haji-umrah/bagi-hasil`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json.summary).toBeDefined();
        expect(typeof json.summary.totalDistributions).toBe("number");
        expect(Array.isArray(json.data)).toBe(true);
        console.log(`✅ Bagi hasil list: ${json.summary.totalDistributions} distributions`);
    });

    // ── 2. Preview (dryRun) — no data mutation ────────────────────

    test("2.1 POST dryRun=true — preview shape, no mutation", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        const res = await page.request.post(`${BASE}/api/haji-umrah/bagi-hasil`, {
            data: {
                periodLabel: "TEST PREVIEW Jun 2026",
                periodStart: "2026-06-01",
                periodEnd: "2026-06-30",
                totalBsiAmount: 1000000,
                memberRate: 70,
                cashBankAccountId: null,
                dryRun: true,
            },
        });
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json.dryRun).toBe(true);
        expect(json.summary.memberPool).toBe(700000); // 70% of 1M
        expect(json.summary.spread).toBe(300000); // 30%
        expect(json.summary.memberCount).toBeGreaterThan(0);
        expect(Array.isArray(json.items)).toBe(true);
        // Sum of item amounts must equal memberPool (rounding absorbed by last item)
        const sumItems = json.items.reduce((s: number, it: { amount: number }) => s + it.amount, 0);
        expect(sumItems).toBe(json.summary.memberPool);
        console.log(`✅ Preview: ${json.summary.memberCount} members, pool=${json.summary.memberPool}, spread=${json.summary.spread}, sum(items)=${sumItems}`);
    });

    // ── 3. Full process + void with real balance verification ─────

    test("3.1 Process → verify member balance up → void → balance restored", async ({ page, browser }) => {
        // 3 fresh-context member logins + process + void exceeds the default 30s timeout
        test.setTimeout(90000);
        await loginAs(page, "operator@koperasi.com");

        // Pick a cash bank account for spread landing
        const cbRes = await page.request.get(`${BASE}/api/cash-bank/accounts`);
        expect(cbRes.status()).toBe(200);
        const cbJson = await cbRes.json();
        const cashBankAccountId = cbJson.data?.[0]?.id;
        expect(cashBankAccountId, "need at least one cash/bank account").toBeTruthy();

        const balanceBefore = await memberHuBalance(browser);
        console.log(`✅ Member H&U balance BEFORE: ${balanceBefore}`);

        // Process a SMALL distribution (Rp 10.000) — minimal real impact, voided right after
        const processRes = await page.request.post(`${BASE}/api/haji-umrah/bagi-hasil`, {
            data: {
                periodLabel: "E2E TEST Bagi Hasil",
                periodStart: "2026-06-01",
                periodEnd: "2026-06-30",
                totalBsiAmount: 10000,
                memberRate: 70,
                cashBankAccountId,
                notes: "E2E self-cleaning test — will be voided",
                dryRun: false,
            },
        });
        expect(processRes.status()).toBe(201);
        const processJson = await processRes.json();
        const distId = processJson.data.id;
        const distributionNo = processJson.data.distributionNo;
        expect(distId).toBeDefined();
        console.log(`✅ Processed ${distributionNo}: pool=${processJson.data.memberPool}, spread=${processJson.data.spread}`);

        // Member balance must have increased (they received a credit)
        const balanceAfter = await memberHuBalance(browser);
        expect(balanceAfter).toBeGreaterThan(balanceBefore);
        console.log(`✅ Member H&U balance AFTER process: ${balanceAfter} (Δ +${balanceAfter - balanceBefore})`);

        // Detail shows processed + items
        const detailRes = await page.request.get(`${BASE}/api/haji-umrah/bagi-hasil/${distId}`);
        expect(detailRes.status()).toBe(200);
        const detailJson = await detailRes.json();
        expect(detailJson.data.status).toBe("processed");
        expect(detailJson.data.items.length).toBeGreaterThan(0);

        // VOID (operator)
        const voidRes = await page.request.post(`${BASE}/api/haji-umrah/bagi-hasil/${distId}/void`, {
            data: { voidReason: "E2E test cleanup" },
        });
        expect(voidRes.status()).toBe(200);
        const voidJson = await voidRes.json();
        expect(voidJson.data.status).toBe("voided");
        console.log(`✅ Voided ${distributionNo}: reversed ${voidJson.data.reversedItems} items`);

        // Member balance must be restored to original
        const balanceAfterVoid = await memberHuBalance(browser);
        expect(balanceAfterVoid).toBe(balanceBefore);
        console.log(`✅ Member H&U balance AFTER void: ${balanceAfterVoid} (restored to original ✓)`);

        // Detail now shows voided
        const detailRes2 = await page.request.get(`${BASE}/api/haji-umrah/bagi-hasil/${distId}`);
        const detailJson2 = await detailRes2.json();
        expect(detailJson2.data.status).toBe("voided");
    });

    // ── 4. RBAC ───────────────────────────────────────────────────

    test("4.1 Admin haji_umrah can preview but CANNOT void", async ({ page }) => {
        await loginAs(page, "adminhajiumrah@koperasi.com");

        // Admin can preview (dryRun)
        const previewRes = await page.request.post(`${BASE}/api/haji-umrah/bagi-hasil`, {
            data: {
                periodLabel: "RBAC preview test",
                periodStart: "2026-06-01",
                periodEnd: "2026-06-30",
                totalBsiAmount: 50000,
                memberRate: 70,
                dryRun: true,
            },
        });
        expect(previewRes.status()).toBe(200);
        console.log("✅ Admin haji_umrah can preview (dryRun)");

        // Admin CANNOT void (operator only) — use a fake id; expect 403 not 404/500
        const voidRes = await page.request.post(`${BASE}/api/haji-umrah/bagi-hasil/999999/void`, {
            data: { voidReason: "should be blocked" },
        });
        expect(voidRes.status()).toBe(403);
        console.log("✅ Admin haji_umrah correctly blocked from void:", voidRes.status());
    });

    test("4.2 Unauthenticated blocked", async ({ request }) => {
        const res = await request.get(`${BASE}/api/haji-umrah/bagi-hasil`);
        expect([401, 403].includes(res.status())).toBe(true);
        console.log("✅ Unauthenticated blocked:", res.status());
    });

    // ── 5. UI ─────────────────────────────────────────────────────

    test("5.1 /haji-umrah/bagi-hasil page loads", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        await page.goto(`${BASE}/haji-umrah/bagi-hasil`);
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/haji-umrah/bagi-hasil");
        await expect(page.locator("text=Spread Bagi Hasil BSI").first()).toBeVisible({ timeout: 10000 });
        console.log("✅ Bagi hasil page loads");
    });

    test("5.2 Sidebar shows Bagi Hasil menu", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        await page.goto(`${BASE}/haji-umrah`);
        await page.waitForLoadState("networkidle");
        const sidebarText = await page.locator("aside, nav, [data-sidebar]").first().textContent({ timeout: 10000 }).catch(() => "");
        expect(sidebarText?.includes("Bagi Hasil") ?? false).toBe(true);
        console.log("✅ Bagi Hasil in sidebar");
    });

    // ── 6. Reports ────────────────────────────────────────────────

    test("6.1 GET reports?type=bagi_hasil", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        const res = await page.request.get(`${BASE}/api/haji-umrah/reports?type=bagi_hasil`);
        expect(res.status()).toBe(200);
        const json = await res.json();
        expect(json.summary).toBeDefined();
        expect(typeof json.summary.totalDistributions).toBe("number");
        console.log(`✅ Bagi hasil report: ${json.summary.totalDistributions} distributions, spread=${json.summary.totalSpread}`);
    });
});
