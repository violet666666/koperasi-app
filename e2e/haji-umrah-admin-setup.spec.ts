import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

async function loginAs(page: import("@playwright/test").Page, email: string, password: string = "password123") {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });
}

test.describe("Haji & Umrah — Admin Account Setup", () => {

    test("Create admin haji_umrah user", async ({ page }) => {
        await loginAs(page, "operator@koperasi.com");

        const res = await page.request.post(`${BASE}/api/users`, {
            data: {
                name: "Admin Haji Umrah",
                email: "adminhajiumrah@koperasi.com",
                password: "password123",
                roleId: 16, // admin role (dynamic ID in production)
                branchId: 10,
                unitType: "haji_umrah",
                isActive: true,
            },
        });

        if (res.status() === 201) {
            const json = await res.json();
            expect(json.data.email).toBe("adminhajiumrah@koperasi.com");
            expect(json.data.unitType).toBe("haji_umrah");
            expect(json.data.role.name).toBe("admin");
            console.log("✅ Admin haji_umrah created:", json.data.email);
        } else if (res.status() === 400) {
            const json = await res.json();
            expect(json.message).toContain("sudah digunakan");
            console.log("✅ Admin haji_umrah already exists");
        } else {
            throw new Error(`Unexpected status: ${res.status()}`);
        }
    });

    test("Admin haji_umrah can login", async ({ page }) => {
        await loginAs(page, "adminhajiumrah@koperasi.com");
        expect(page.url()).toContain("/dashboard");
        console.log("✅ Admin haji_umrah login successful → /dashboard");
    });

    test("Admin haji_umrah sees HAJI & UMRAH sidebar menu", async ({ page }) => {
        await loginAs(page, "adminhajiumrah@koperasi.com");

        await expect(page.locator("text=HAJI & UMRAH").first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator("text=Dashboard H&U").first()).toBeVisible();
        console.log("✅ Sidebar shows HAJI & UMRAH navigation");
    });

    test("Admin haji_umrah can access /haji-umrah routes", async ({ page }) => {
        await loginAs(page, "adminhajiumrah@koperasi.com");

        await page.goto(`${BASE}/haji-umrah`);
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/haji-umrah");
        await expect(page.locator("text=Haji & Umrah").first()).toBeVisible({ timeout: 10000 });
        console.log("✅ Admin can access /haji-umrah — not blocked by route guard");
    });

    test("Admin haji_umrah can access API endpoints", async ({ page }) => {
        await loginAs(page, "adminhajiumrah@koperasi.com");

        const productsRes = await page.request.get(`${BASE}/api/haji-umrah/products`);
        expect(productsRes.status()).toBe(200);
        console.log("✅ Products API accessible");

        const savingsRes = await page.request.get(`${BASE}/api/haji-umrah/savings`);
        expect(savingsRes.status()).toBe(200);
        console.log("✅ Savings API accessible");

        const reportsRes = await page.request.get(`${BASE}/api/haji-umrah/reports?type=progress`);
        expect(reportsRes.status()).toBe(200);
        console.log("✅ Reports API accessible");
    });

    test("Admin haji_umrah can navigate all pages", async ({ page }) => {
        await loginAs(page, "adminhajiumrah@koperasi.com");

        for (const [path, label] of [
            ["/haji-umrah", "Haji & Umrah"],
            ["/haji-umrah/tabungan", "Tabungan Haji & Umrah"],
            ["/haji-umrah/produk", "Produk Tabungan"],
            ["/haji-umrah/laporan", "Laporan Tabungan"],
        ]) {
            await page.goto(`${BASE}${path}`);
            await page.waitForLoadState("networkidle");
            expect(page.url()).toContain(path);
            await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 10000 });
            console.log(`✅ ${path} accessible`);
        }
    });

    test("Admin haji_umrah cannot create products (operator only)", async ({ page }) => {
        await loginAs(page, "adminhajiumrah@koperasi.com");

        const res = await page.request.post(`${BASE}/api/haji-umrah/products`, {
            data: {
                code: "TEST_ADMIN",
                name: "Test Admin Create",
                type: "tabungan_haji",
                minimumAmount: 100000,
            },
        });
        expect(res.status()).toBe(403);
        console.log("✅ Admin correctly blocked from creating products (operator only)");
    });
});
