# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: haji-umrah.spec.ts >> Haji & Umrah — Operator Flow >> API: GET /api/haji-umrah/reports?type=progress returns dashboard stats
- Location: e2e\haji-umrah.spec.ts:78:9

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - link "Logo PRIMKOPPOL LUMAJANG" [ref=e5] [cursor=pointer]:
          - /url: /dashboard
          - img "Logo" [ref=e7]
          - generic [ref=e8]:
            - text: PRIMKOPPOL
            - text: LUMAJANG
        - button "Tutup sidebar" [ref=e9]:
          - img
          - generic [ref=e10]: Tutup sidebar
      - navigation [ref=e12]:
        - link "Dashboard" [ref=e13] [cursor=pointer]:
          - /url: /dashboard
          - button "Dashboard" [ref=e14]:
            - img
            - generic [ref=e15]: Dashboard
        - generic [ref=e16]:
          - paragraph [ref=e17]: OPERASIONAL
          - generic [ref=e19]:
            - link "Anggota" [ref=e20] [cursor=pointer]:
              - /url: /anggota
              - button "Anggota" [ref=e21]:
                - img
                - generic [ref=e22]: Anggota
            - button [ref=e23]:
              - img
          - generic [ref=e25]:
            - link "Simpanan" [ref=e26] [cursor=pointer]:
              - /url: /simpanan
              - button "Simpanan" [ref=e27]:
                - img
                - generic [ref=e28]: Simpanan
            - button [ref=e29]:
              - img
          - generic [ref=e31]:
            - link "Pinjaman" [ref=e32] [cursor=pointer]:
              - /url: /pinjaman
              - button "Pinjaman" [ref=e33]:
                - img
                - generic [ref=e34]: Pinjaman
            - button [ref=e35]:
              - img
          - generic [ref=e37]:
            - link "Kas & Bank" [ref=e38] [cursor=pointer]:
              - /url: /kas-bank
              - button "Kas & Bank" [ref=e39]:
                - img
                - generic [ref=e40]: Kas & Bank
            - button [ref=e41]:
              - img
          - generic [ref=e43]:
            - link "Non Simpan Pinjam" [ref=e44] [cursor=pointer]:
              - /url: /non-sp
              - button "Non Simpan Pinjam" [ref=e45]:
                - img
                - generic [ref=e46]: Non Simpan Pinjam
            - button [ref=e47]:
              - img
          - generic [ref=e49]:
            - link "Transaksi Unit Layanan" [ref=e50] [cursor=pointer]:
              - /url: /transaksi-unit
              - button "Transaksi Unit Layanan" [ref=e51]:
                - img
                - generic [ref=e52]: Transaksi Unit Layanan
            - button [ref=e53]:
              - img
          - link "Kwitansi" [ref=e54] [cursor=pointer]:
            - /url: /kwitansi
            - button "Kwitansi" [ref=e55]:
              - img
              - generic [ref=e56]: Kwitansi
        - generic [ref=e57]:
          - paragraph [ref=e58]: TAGIHAN
          - generic [ref=e60]:
            - link "Tagihan Piutang" [ref=e61] [cursor=pointer]:
              - /url: /tagihan
              - button "Tagihan Piutang" [ref=e62]:
                - img
                - generic [ref=e63]: Tagihan Piutang
            - button [ref=e64]:
              - img
        - generic [ref=e65]:
          - paragraph [ref=e66]: HAJI & UMRAH
          - generic [ref=e68]:
            - link "Haji & Umrah" [ref=e69] [cursor=pointer]:
              - /url: /haji-umrah
              - button "Haji & Umrah" [ref=e70]:
                - img
                - generic [ref=e71]: Haji & Umrah
            - button [ref=e72]:
              - img
        - generic [ref=e73]:
          - paragraph [ref=e74]: AKUNTANSI
          - generic [ref=e76]:
            - link "Aset" [ref=e77] [cursor=pointer]:
              - /url: /aset
              - button "Aset" [ref=e78]:
                - img
                - generic [ref=e79]: Aset
            - button [ref=e80]:
              - img
          - generic [ref=e82]:
            - link "Jurnal" [ref=e83] [cursor=pointer]:
              - /url: /jurnal/umum
              - button "Jurnal" [ref=e84]:
                - img
                - generic [ref=e85]: Jurnal
            - button [ref=e86]:
              - img
          - generic [ref=e88]:
            - link "Laporan" [ref=e89] [cursor=pointer]:
              - /url: /laporan
              - button "Laporan" [ref=e90]:
                - img
                - generic [ref=e91]: Laporan
            - button [ref=e92]:
              - img
        - generic [ref=e93]:
          - paragraph [ref=e94]: PERIODE & SHU
          - link "Tutup Buku" [ref=e95] [cursor=pointer]:
            - /url: /periode/tutup-buku
            - button "Tutup Buku" [ref=e96]:
              - img
              - generic [ref=e97]: Tutup Buku
          - generic [ref=e99]:
            - link "Alokasi SHU" [ref=e100] [cursor=pointer]:
              - /url: /periode/shu/perhitungan
              - button "Alokasi SHU" [ref=e101]:
                - img
                - generic [ref=e102]: Alokasi SHU
            - button [ref=e103]:
              - img
        - generic [ref=e104]:
          - paragraph [ref=e105]: MANAJEMEN UNIT
          - generic [ref=e107]:
            - link "Manajemen Unit" [ref=e108] [cursor=pointer]:
              - /url: /manajemen-unit
              - button "Manajemen Unit" [ref=e109]:
                - img
                - generic [ref=e110]: Manajemen Unit
            - button [ref=e111]:
              - img
        - generic [ref=e112]:
          - paragraph [ref=e113]: KOMUNIKASI
          - link "Pengumuman" [ref=e114] [cursor=pointer]:
            - /url: /pengumuman
            - button "Pengumuman" [ref=e115]:
              - img
              - generic [ref=e116]: Pengumuman
        - generic [ref=e117]:
          - paragraph [ref=e118]: APPROVAL
          - link "Inbox Approval" [ref=e119] [cursor=pointer]:
            - /url: /approval
            - button "Inbox Approval" [ref=e120]:
              - img
              - generic [ref=e121]: Inbox Approval
          - link "Audit Log" [ref=e122] [cursor=pointer]:
            - /url: /audit-log
            - button "Audit Log" [ref=e123]:
              - img
              - generic [ref=e124]: Audit Log
        - generic [ref=e125]:
          - paragraph [ref=e126]: PENGATURAN
          - generic [ref=e128]:
            - link "Master Data" [ref=e129] [cursor=pointer]:
              - /url: /master
              - button "Master Data" [ref=e130]:
                - img
                - generic [ref=e131]: Master Data
            - button [ref=e132]:
              - img
          - link "User Management" [ref=e133] [cursor=pointer]:
            - /url: /master/users
            - button "User Management" [ref=e134]:
              - img
              - generic [ref=e135]: User Management
          - link "Profil PRIMKOPPOL" [ref=e136] [cursor=pointer]:
            - /url: /profil-koperasi
            - button "Profil PRIMKOPPOL" [ref=e137]:
              - img
              - generic [ref=e138]: Profil PRIMKOPPOL
          - link "Pengaturan" [ref=e139] [cursor=pointer]:
            - /url: /settings
            - button "Pengaturan" [ref=e140]:
              - img
              - generic [ref=e141]: Pengaturan
          - link "Profil Saya" [ref=e142] [cursor=pointer]:
            - /url: /profil
            - button "Profil Saya" [ref=e143]:
              - img
              - generic [ref=e144]: Profil Saya
      - paragraph [ref=e147]: © 2025 PRIMKOPPOL RESOR LUMAJANG
    - generic [ref=e148]:
      - banner [ref=e149]:
        - button "Tutup sidebar" [ref=e150]:
          - img
          - generic [ref=e151]: Tutup sidebar
        - navigation [ref=e152]:
          - link [ref=e153] [cursor=pointer]:
            - /url: /dashboard
            - img [ref=e154]
          - img [ref=e157]
          - generic [ref=e159]: Dashboard
        - button "Notifikasi" [ref=e160]:
          - img
          - generic [ref=e161]: Notifikasi
        - button "O(" [ref=e162]:
          - generic [ref=e164]: O(
      - main [ref=e165]:
        - generic [ref=e166]:
          - generic [ref=e167]:
            - heading "Dashboard" [level=1] [ref=e168]
            - paragraph [ref=e169]: Selamat datang kembali! Berikut ringkasan aktivitas PRIMKOPPOL RESOR LUMAJANG.
          - generic [ref=e170]:
            - generic [ref=e171] [cursor=pointer]:
              - button "Bantuan" [ref=e172]:
                - img [ref=e173]
              - generic [ref=e178]:
                - generic [ref=e179]:
                  - paragraph [ref=e180]: Total Anggota
                  - paragraph [ref=e182]: anggota aktif
                - img [ref=e184]
            - generic [ref=e189] [cursor=pointer]:
              - button "Bantuan" [ref=e190]:
                - img [ref=e191]
              - generic [ref=e196]:
                - paragraph [ref=e198]: Total Simpanan
                - img [ref=e201]
            - generic [ref=e204] [cursor=pointer]:
              - button "Bantuan" [ref=e205]:
                - img [ref=e206]
              - generic [ref=e211]:
                - paragraph [ref=e213]: Total Pinjaman Aktif
                - img [ref=e216]
            - generic [ref=e218] [cursor=pointer]:
              - button "Bantuan" [ref=e219]:
                - img [ref=e220]
              - generic [ref=e225]:
                - paragraph [ref=e227]: Potensi Bunga (1%/Bln)
                - img [ref=e230]
            - generic [ref=e233] [cursor=pointer]:
              - button "Bantuan" [ref=e234]:
                - img [ref=e235]
              - generic [ref=e240]:
                - generic [ref=e241]:
                  - paragraph [ref=e242]: Tunggakan
                  - paragraph [ref=e244]: perlu perhatian
                - img [ref=e246]
          - generic [ref=e248]:
            - generic [ref=e249] [cursor=pointer]:
              - button "Bantuan" [ref=e250]:
                - img [ref=e251]
              - generic [ref=e254]:
                - generic [ref=e256]: Simpanan Hari Ini
                - paragraph [ref=e259]: 0 transaksi
            - generic [ref=e260] [cursor=pointer]:
              - button "Bantuan" [ref=e261]:
                - img [ref=e262]
              - generic [ref=e265]:
                - generic [ref=e267]: Pencairan Hari Ini
                - paragraph [ref=e270]: 0 pencairan
            - generic [ref=e271] [cursor=pointer]:
              - button "Bantuan" [ref=e272]:
                - img [ref=e273]
              - generic [ref=e276]:
                - generic [ref=e278]: Angsuran Hari Ini
                - paragraph [ref=e281]: 0 pembayaran
          - generic [ref=e282]:
            - generic [ref=e287]:
              - generic [ref=e288]:
                - img [ref=e289]
                - text: Saldo Rekening Kas & Bank
              - generic [ref=e291]: "Total dana: ..."
            - generic [ref=e298]:
              - generic [ref=e299]:
                - generic [ref=e300]: Pendapatan per Unit Usaha
                - generic [ref=e301]: 30 hari terakhir
              - generic [ref=e303]: Memuat data...
            - generic [ref=e304]:
              - generic [ref=e305]:
                - generic [ref=e306]: Mutasi Kas Harian
                - generic [ref=e307]: Kas masuk vs kas keluar 14 hari terakhir
              - generic [ref=e308]:
                - generic [ref=e309]: Memuat data...
                - generic [ref=e310]:
                  - generic [ref=e311]: Kas Masuk
                  - generic [ref=e313]: Kas Keluar
          - generic [ref=e315]:
            - generic [ref=e316]:
              - generic [ref=e318]: Aksi Cepat
              - generic [ref=e319]:
                - link "Tambah Anggota Baru Daftarkan anggota baru ke sistem" [ref=e320] [cursor=pointer]:
                  - /url: /anggota/tambah
                  - generic [ref=e322]:
                    - img [ref=e324]
                    - generic [ref=e329]:
                      - paragraph [ref=e330]: Tambah Anggota Baru
                      - paragraph [ref=e331]: Daftarkan anggota baru ke sistem
                    - img [ref=e332]
                - link "Transaksi Simpanan Catat setoran atau penarikan" [ref=e334] [cursor=pointer]:
                  - /url: /simpanan/transaksi/tambah
                  - generic [ref=e336]:
                    - img [ref=e338]
                    - generic [ref=e341]:
                      - paragraph [ref=e342]: Transaksi Simpanan
                      - paragraph [ref=e343]: Catat setoran atau penarikan
                    - img [ref=e344]
                - link "Input Angsuran Catat pembayaran angsuran" [ref=e346] [cursor=pointer]:
                  - /url: /pinjaman/angsuran/bayar
                  - generic [ref=e348]:
                    - img [ref=e350]
                    - generic [ref=e352]:
                      - paragraph [ref=e353]: Input Angsuran
                      - paragraph [ref=e354]: Catat pembayaran angsuran
                    - img [ref=e355]
            - generic [ref=e358]:
              - generic [ref=e359]:
                - img [ref=e360]
                - text: Menunggu Persetujuan
              - link "Lihat Semua" [ref=e363] [cursor=pointer]:
                - /url: /approval
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e373] [cursor=pointer]:
    - img [ref=e374]
  - alert [ref=e377]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | // Haji & Umrah E2E tests — operator login
  4  | test.describe("Haji & Umrah — Operator Flow", () => {
> 5  |     test.beforeEach(async ({ page }) => {
     |          ^ Test timeout of 30000ms exceeded while running "beforeEach" hook.
  6  |         // Login as operator
  7  |         await page.goto("http://localhost:3000/login");
  8  |         await page.fill('#email', "operator@koperasi.com");
  9  |         await page.fill('#password', "password123");
  10 |         await page.click('button[type="submit"]');
  11 |         await page.waitForURL("**/dashboard", { timeout: 15000 });
  12 |     });
  13 | 
  14 |     test("sidebar shows HAJI & UMRAH navigation group", async ({ page }) => {
  15 |         await page.goto("http://localhost:3000/dashboard");
  16 |         // Check sidebar has Haji & Umrah group
  17 |         const sidebar = page.locator("aside, [data-sidebar]");
  18 |         await expect(sidebar).toContainText("HAJI & UMRAH", { timeout: 5000 });
  19 |     });
  20 | 
  21 |     test("dashboard page loads with stat cards", async ({ page }) => {
  22 |         await page.goto("http://localhost:3000/haji-umrah");
  23 |         await page.waitForLoadState("networkidle");
  24 | 
  25 |         // Check page title
  26 |         await expect(page.locator("h1, [data-title]").first()).toContainText("Haji & Umrah");
  27 | 
  28 |         // Check stat cards rendered (6 cards)
  29 |         const cards = page.locator("text=Total Rekening Aktif");
  30 |         await expect(cards.first()).toBeVisible({ timeout: 5000 });
  31 |     });
  32 | 
  33 |     test("produk page loads and shows product cards or empty state", async ({ page }) => {
  34 |         await page.goto("http://localhost:3000/haji-umrah/produk");
  35 |         await page.waitForLoadState("networkidle");
  36 | 
  37 |         // Should show either products or empty state
  38 |         const pageContent = page.locator("body");
  39 |         await expect(pageContent).toContainText(/Produk Tabungan|Belum ada produk/);
  40 |     });
  41 | 
  42 |     test("tabungan listing page loads", async ({ page }) => {
  43 |         await page.goto("http://localhost:3000/haji-umrah/tabungan");
  44 |         await page.waitForLoadState("networkidle");
  45 | 
  46 |         // Should show header and search
  47 |         await expect(page.locator("text=Tabungan Haji & Umrah").first()).toBeVisible({ timeout: 5000 });
  48 |         await expect(page.locator('input[placeholder*="Cari"]').first()).toBeVisible();
  49 |     });
  50 | 
  51 |     test("laporan page loads with export buttons", async ({ page }) => {
  52 |         await page.goto("http://localhost:3000/haji-umrah/laporan");
  53 |         await page.waitForLoadState("networkidle");
  54 | 
  55 |         await expect(page.locator("text=Laporan Tabungan").first()).toBeVisible({ timeout: 5000 });
  56 |         await expect(page.locator("text=Excel").first()).toBeVisible();
  57 |         await expect(page.locator("text=PDF").first()).toBeVisible();
  58 |     });
  59 | 
  60 |     test("API: GET /api/haji-umrah/products returns data", async ({ page }) => {
  61 |         const response = await page.request.get("http://localhost:3000/api/haji-umrah/products");
  62 |         expect(response.status()).toBe(200);
  63 |         const json = await response.json();
  64 |         expect(json).toHaveProperty("data");
  65 |         expect(Array.isArray(json.data)).toBe(true);
  66 |     });
  67 | 
  68 |     test("API: GET /api/haji-umrah/savings returns paginated data", async ({ page }) => {
  69 |         const response = await page.request.get("http://localhost:3000/api/haji-umrah/savings");
  70 |         expect(response.status()).toBe(200);
  71 |         const json = await response.json();
  72 |         expect(json).toHaveProperty("data");
  73 |         expect(json).toHaveProperty("meta");
  74 |         expect(json.meta).toHaveProperty("page");
  75 |         expect(json.meta).toHaveProperty("totalPages");
  76 |     });
  77 | 
  78 |     test("API: GET /api/haji-umrah/reports?type=progress returns dashboard stats", async ({ page }) => {
  79 |         const response = await page.request.get("http://localhost:3000/api/haji-umrah/reports?type=progress");
  80 |         expect(response.status()).toBe(200);
  81 |         const json = await response.json();
  82 |         expect(json).toHaveProperty("data");
  83 |         expect(json.data).toHaveProperty("totalAccounts");
  84 |         expect(json.data).toHaveProperty("totalSaldo");
  85 |         expect(json.data).toHaveProperty("totalTarget");
  86 |         expect(json.data).toHaveProperty("adminFeeRevenue");
  87 |     });
  88 | });
  89 | 
```