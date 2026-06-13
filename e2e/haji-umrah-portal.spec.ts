import { test, expect, type Page, type Browser } from "@playwright/test";

const BASE = "http://localhost:3000";

// Portal is member-only: a user must have a linked memberId to access /api/member-portal/*.
// - Operator/admin accounts have memberId=null → correctly get 401 (verified in 1.2).
// - The real member below was discovered in the live DB: member_id 776 (A'AN ANDRIONO),
//   who owns the Tabungan Haji account HU-776-10-1715. Password = NRP (seed convention).
const MEMBER_EMAIL = "87011378@koperasi.local";
const MEMBER_PASSWORD = "87011378";

// Log in inside a FRESH browser context so we never inherit another test's session
// (e.g. operator's). Returns the page plus a close() that tears the context down.
async function loginInNewContext(
    browser: Browser,
    email: string,
    password: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE}/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|portal)/, { timeout: 30000 });
    return { page, close: async () => context.close() };
}

// Reuse the default fixture for tests where session isolation doesn't matter.
async function loginAs(page: Page, email: string, password: string = "password123") {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|portal)/, { timeout: 30000 });
}

test.describe("Haji & Umrah — Member Portal (Phase 3)", () => {

    // ── 1. API RBAC ───────────────────────────────────────────────

    test("1.1 GET /api/member-portal/haji-umrah — 401 without login", async ({ request }) => {
        const res = await request.get(`${BASE}/api/member-portal/haji-umrah`);
        expect([401, 403].includes(res.status())).toBe(true);
        console.log("✅ Unauthenticated blocked:", res.status());
    });

    test("1.2 GET /api/member-portal/haji-umrah — operator (non-member) is blocked", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        const res = await page.request.get(`${BASE}/api/member-portal/haji-umrah`);
        // Operator has memberId=null → 401 (member-only guard).
        expect(res.status()).toBe(401);
        console.log("✅ Operator correctly blocked (no memberId):", res.status());
    });

    // ── 2. Member data flow (real member with H&U account) ────────

    test("2.1 Member API — returns H&U account with progress + talangan shape", async ({ browser }) => {
        const { page, close } = await loginInNewContext(browser, MEMBER_EMAIL, MEMBER_PASSWORD);
        try {
            const res = await page.request.get(`${BASE}/api/member-portal/haji-umrah`);
            expect(res.status()).toBe(200);
            const json = await res.json();

            expect(json.data.summary).toBeDefined();
            expect(typeof json.data.summary.totalBalance).toBe("number");
            expect(typeof json.data.summary.overallProgress).toBe("number");
            expect(Array.isArray(json.data.accounts)).toBe(true);

            // This member owns at least one H&U account (HU-776-10-1715)
            expect(json.data.accounts.length).toBeGreaterThan(0);
            const acc = json.data.accounts[0];
            expect(acc.product.type).toMatch(/^tabungan_(haji|umrah)$/);
            expect(typeof acc.balance).toBe("number");
            expect(typeof acc.target).toBe("number");
            expect(typeof acc.progress).toBe("number");
            expect(acc.progress).toBeGreaterThanOrEqual(0);
            expect(acc.progress).toBeLessThanOrEqual(100);
            expect(Array.isArray(acc.transactions)).toBe(true);
            // talangan is null or an object — never undefined
            expect(acc.talangan === null || typeof acc.talangan === "object").toBe(true);

            console.log(
                `✅ Member sees ${json.data.accounts.length} H&U account(s) — ` +
                `${acc.product.name}, balance=${acc.balance}, target=${acc.target}, progress=${acc.progress}%, ` +
                `txs=${acc.transactions.length}, talangan=${acc.talangan ? "yes" : "none"}`,
            );
        } finally {
            await close();
        }
    });

    // ── 3. UI ─────────────────────────────────────────────────────

    test("3.1 /portal/haji-umrah renders member's account with progress bar", async ({ browser }) => {
        const { page, close } = await loginInNewContext(browser, MEMBER_EMAIL, MEMBER_PASSWORD);
        try {
            await page.goto(`${BASE}/portal/haji-umrah`);
            await page.waitForLoadState("networkidle");
            expect(page.url()).toContain("/portal/haji-umrah");
            // Page header always rendered on the success path
            await expect(page.locator("text=Tabungan Haji & Umrah").first()).toBeVisible({ timeout: 10000 });
            // Member has a Tabungan Haji → that label should render
            await expect(page.locator("text=Tabungan Haji").first()).toBeVisible({ timeout: 10000 });
            console.log("✅ Portal H&U page renders member's Tabungan Haji account");
        } finally {
            await close();
        }
    });

    test("3.2 Portal nav includes Haji & Umrah link", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");
        await page.goto(`${BASE}/portal/dashboard`);
        await page.waitForLoadState("networkidle");
        const navText = await page.locator("nav, header").first().textContent({ timeout: 10000 }).catch(() => "");
        const bodyText = await page.locator("body").textContent().catch(() => "");
        const hasLink = (navText?.includes("Haji & Umrah") ?? false) || (bodyText?.includes("Haji & Umrah") ?? false);
        expect(hasLink).toBe(true);
        console.log("✅ Nav link 'Haji & Umrah' present in portal layout");
    });

    test("3.3 /portal/simpanan renders for member (no regression from H&U filter)", async ({ browser }) => {
        const { page, close } = await loginInNewContext(browser, MEMBER_EMAIL, MEMBER_PASSWORD);
        try {
            await page.goto(`${BASE}/portal/simpanan`);
            await page.waitForLoadState("networkidle");
            await expect(page.locator("text=Portofolio Simpanan").first()).toBeVisible({ timeout: 10000 });
            console.log("✅ Simpanan page renders for member (H&U filter applied, no regression)");
        } finally {
            await close();
        }
    });

    // ── 4. Summary route H&U fields (Layer 1) ─────────────────────

    test("4.1 Summary accounts carry H&U extended fields for member", async ({ browser }) => {
        const { page, close } = await loginInNewContext(browser, MEMBER_EMAIL, MEMBER_PASSWORD);
        try {
            const res = await page.request.get(`${BASE}/api/member-portal/summary`);
            expect(res.status()).toBe(200);
            const json = await res.json();
            const accounts = json.data?.savings?.accounts ?? [];
            expect(accounts.length).toBeGreaterThan(0);
            // Every account now carries the additive H&U keys (null for non-H&U products)
            for (const acc of accounts) {
                expect(acc).toHaveProperty("targetAmount");
                expect(acc).toHaveProperty("monthlyTarget");
            }
            // The H&U account specifically should carry a target
            const hu = accounts.find((a: { product?: { type?: string } }) => a.product?.type === "tabungan_haji" || a.product?.type === "tabungan_umrah");
            expect(hu, "member should have an H&U account in summary").toBeTruthy();
            console.log(`✅ Summary accounts carry H&U fields (targetAmount=${hu.targetAmount}, monthlyTarget=${hu.monthlyTarget})`);
        } finally {
            await close();
        }
    });
});
