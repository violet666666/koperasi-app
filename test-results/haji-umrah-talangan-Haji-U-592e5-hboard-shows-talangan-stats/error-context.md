# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: haji-umrah-talangan.spec.ts >> Haji & Umrah — Talangan Feature >> 3.3 Dashboard shows talangan stats
- Location: e2e\haji-umrah-talangan.spec.ts:182:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
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
          - generic [ref=e67]:
            - generic [ref=e68]:
              - link "Haji & Umrah" [ref=e69] [cursor=pointer]:
                - /url: /haji-umrah
                - button "Haji & Umrah" [ref=e70]:
                  - img
                  - generic [ref=e71]: Haji & Umrah
              - button [expanded] [ref=e72]:
                - img
            - generic [ref=e73]:
              - link "Dashboard" [ref=e74] [cursor=pointer]:
                - /url: /haji-umrah
                - button "Dashboard" [ref=e75]:
                  - generic [ref=e76]: Dashboard
              - link "Tabungan" [ref=e77] [cursor=pointer]:
                - /url: /haji-umrah/tabungan
                - button "Tabungan" [ref=e78]:
                  - generic [ref=e79]: Tabungan
              - link "Talangan" [ref=e80] [cursor=pointer]:
                - /url: /haji-umrah/talangan
                - button "Talangan" [ref=e81]:
                  - generic [ref=e82]: Talangan
              - link "Bagi Hasil" [ref=e83] [cursor=pointer]:
                - /url: /haji-umrah/bagi-hasil
                - button "Bagi Hasil" [ref=e84]:
                  - generic [ref=e85]: Bagi Hasil
              - link "Produk" [ref=e86] [cursor=pointer]:
                - /url: /haji-umrah/produk
                - button "Produk" [ref=e87]:
                  - generic [ref=e88]: Produk
              - link "Laporan" [ref=e89] [cursor=pointer]:
                - /url: /haji-umrah/laporan
                - button "Laporan" [ref=e90]:
                  - generic [ref=e91]: Laporan
        - generic [ref=e92]:
          - paragraph [ref=e93]: AKUNTANSI
          - generic [ref=e95]:
            - link "Aset" [ref=e96] [cursor=pointer]:
              - /url: /aset
              - button "Aset" [ref=e97]:
                - img
                - generic [ref=e98]: Aset
            - button [ref=e99]:
              - img
          - generic [ref=e101]:
            - link "Jurnal" [ref=e102] [cursor=pointer]:
              - /url: /jurnal/umum
              - button "Jurnal" [ref=e103]:
                - img
                - generic [ref=e104]: Jurnal
            - button [ref=e105]:
              - img
          - generic [ref=e107]:
            - link "Laporan" [ref=e108] [cursor=pointer]:
              - /url: /laporan
              - button "Laporan" [ref=e109]:
                - img
                - generic [ref=e110]: Laporan
            - button [ref=e111]:
              - img
        - generic [ref=e112]:
          - paragraph [ref=e113]: PERIODE & SHU
          - link "Tutup Buku" [ref=e114] [cursor=pointer]:
            - /url: /periode/tutup-buku
            - button "Tutup Buku" [ref=e115]:
              - img
              - generic [ref=e116]: Tutup Buku
          - generic [ref=e118]:
            - link "Alokasi SHU" [ref=e119] [cursor=pointer]:
              - /url: /periode/shu/perhitungan
              - button "Alokasi SHU" [ref=e120]:
                - img
                - generic [ref=e121]: Alokasi SHU
            - button [ref=e122]:
              - img
        - generic [ref=e123]:
          - paragraph [ref=e124]: MANAJEMEN UNIT
          - generic [ref=e126]:
            - link "Manajemen Unit" [ref=e127] [cursor=pointer]:
              - /url: /manajemen-unit
              - button "Manajemen Unit" [ref=e128]:
                - img
                - generic [ref=e129]: Manajemen Unit
            - button [ref=e130]:
              - img
        - generic [ref=e131]:
          - paragraph [ref=e132]: KOMUNIKASI
          - link "Pengumuman" [ref=e133] [cursor=pointer]:
            - /url: /pengumuman
            - button "Pengumuman" [ref=e134]:
              - img
              - generic [ref=e135]: Pengumuman
        - generic [ref=e136]:
          - paragraph [ref=e137]: APPROVAL
          - link "Inbox Approval" [ref=e138] [cursor=pointer]:
            - /url: /approval
            - button "Inbox Approval" [ref=e139]:
              - img
              - generic [ref=e140]: Inbox Approval
          - link "Audit Log" [ref=e141] [cursor=pointer]:
            - /url: /audit-log
            - button "Audit Log" [ref=e142]:
              - img
              - generic [ref=e143]: Audit Log
        - generic [ref=e144]:
          - paragraph [ref=e145]: PENGATURAN
          - generic [ref=e147]:
            - link "Master Data" [ref=e148] [cursor=pointer]:
              - /url: /master
              - button "Master Data" [ref=e149]:
                - img
                - generic [ref=e150]: Master Data
            - button [ref=e151]:
              - img
          - link "User Management" [ref=e152] [cursor=pointer]:
            - /url: /master/users
            - button "User Management" [ref=e153]:
              - img
              - generic [ref=e154]: User Management
          - link "Profil PRIMKOPPOL" [ref=e155] [cursor=pointer]:
            - /url: /profil-koperasi
            - button "Profil PRIMKOPPOL" [ref=e156]:
              - img
              - generic [ref=e157]: Profil PRIMKOPPOL
          - link "Pengaturan" [ref=e158] [cursor=pointer]:
            - /url: /settings
            - button "Pengaturan" [ref=e159]:
              - img
              - generic [ref=e160]: Pengaturan
          - link "Profil Saya" [ref=e161] [cursor=pointer]:
            - /url: /profil
            - button "Profil Saya" [ref=e162]:
              - img
              - generic [ref=e163]: Profil Saya
      - paragraph [ref=e166]: © 2025 PRIMKOPPOL RESOR LUMAJANG
    - generic [ref=e167]:
      - banner [ref=e168]:
        - button "Tutup sidebar" [ref=e169]:
          - img
          - generic [ref=e170]: Tutup sidebar
        - navigation [ref=e171]:
          - link [ref=e172] [cursor=pointer]:
            - /url: /dashboard
            - img [ref=e173]
          - img [ref=e176]
          - generic [ref=e178]: Haji-umrah
        - button "Notifikasi" [ref=e179]:
          - img
          - generic [ref=e180]: Notifikasi
        - button "O(" [ref=e181]:
          - generic [ref=e183]: O(
      - main [ref=e184]:
        - generic [ref=e185]:
          - generic [ref=e187]:
            - generic [ref=e188]:
              - heading "Haji & Umrah" [level=1] [ref=e189]
              - paragraph [ref=e190]: Tabungan Haji & Umrah — Kelola tabungan anggota untuk perjalanan suci
            - generic [ref=e192]:
              - button "Tabungan" [ref=e193]:
                - img
                - text: Tabungan
              - button "Kelola Produk" [ref=e194]
          - generic [ref=e195]:
            - generic [ref=e197]:
              - img [ref=e199]
              - generic [ref=e204]:
                - paragraph [ref=e205]: Total Rekening Aktif
                - paragraph [ref=e206]: ...
            - generic [ref=e208]:
              - img [ref=e210]
              - generic [ref=e213]:
                - paragraph [ref=e214]: Total Saldo
                - paragraph [ref=e215]: ...
            - generic [ref=e217]:
              - img [ref=e219]
              - generic [ref=e223]:
                - paragraph [ref=e224]: Target Keseluruhan
                - paragraph [ref=e225]: ...
            - generic [ref=e227]:
              - img [ref=e229]
              - generic [ref=e232]:
                - paragraph [ref=e233]: Setoran Bulan Ini
                - paragraph [ref=e234]: ...
            - generic [ref=e236]:
              - img [ref=e238]
              - generic [ref=e241]:
                - paragraph [ref=e242]: Admin Fee Bulan Ini
                - paragraph [ref=e243]: ...
            - generic [ref=e245]:
              - img [ref=e247]
              - generic [ref=e250]:
                - paragraph [ref=e251]: Mendekati Target (≥80%)
                - paragraph [ref=e252]: ...
            - generic [ref=e254]:
              - img [ref=e256]
              - generic [ref=e262]:
                - paragraph [ref=e263]: Talangan Aktif
                - paragraph [ref=e264]: ...
            - generic [ref=e266]:
              - img [ref=e268]
              - generic [ref=e272]:
                - paragraph [ref=e273]: Gap Terdeteksi
                - paragraph [ref=e274]: ...
          - generic [ref=e275]:
            - generic [ref=e277] [cursor=pointer]:
              - generic [ref=e278]:
                - img [ref=e279]
                - generic [ref=e282]:
                  - paragraph [ref=e283]: Daftar Tabungan
                  - paragraph [ref=e284]: Kelola rekening anggota
              - img [ref=e285]
            - generic [ref=e288] [cursor=pointer]:
              - generic [ref=e289]:
                - img [ref=e290]
                - generic [ref=e296]:
                  - paragraph [ref=e297]: Talangan
                  - paragraph [ref=e298]: Gap financing haji/umrah
              - img [ref=e299]
            - generic [ref=e302] [cursor=pointer]:
              - generic [ref=e303]:
                - img [ref=e304]
                - generic [ref=e307]:
                  - paragraph [ref=e308]: Laporan
                  - paragraph [ref=e309]: Export rekap & progress
              - img [ref=e310]
            - generic [ref=e313] [cursor=pointer]:
              - generic [ref=e314]:
                - img [ref=e315]
                - generic [ref=e319]:
                  - paragraph [ref=e320]: Produk
                  - paragraph [ref=e321]: Kelola produk tabungan
              - img [ref=e322]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e329] [cursor=pointer]:
    - generic [ref=e332]:
      - text: Compiling
      - generic [ref=e333]:
        - generic [ref=e334]: .
        - generic [ref=e335]: .
        - generic [ref=e336]: .
  - alert [ref=e337]
```

# Test source

```ts
  85  |             console.log("⏭️ No gap accounts available — skipping full flow");
  86  |             return;
  87  |         }
  88  |         const savingsAccountId = gapJson.data[0].accountId;
  89  |         const gap = gapJson.data[0].gap;
  90  |         console.log(`✅ Found savings account: ID=${savingsAccountId}, gap=${gap}`);
  91  | 
  92  |         // Step 2: Find matching talangan product
  93  |         const productType = gapJson.data[0].productType.replace("tabungan_", "talangan_");
  94  |         const prodRes = await page.request.get(`${BASE}/api/haji-umrah/talangan/products?type=${productType}`);
  95  |         const prodJson = await prodRes.json();
  96  |         if (prodJson.data.length === 0) {
  97  |             console.log("⏭️ No talangan products available — skipping");
  98  |             return;
  99  |         }
  100 |         const productId = prodJson.data[0].id;
  101 |         console.log(`✅ Product: ID=${productId}, ${prodJson.data[0].name}`);
  102 | 
  103 |         // Step 3: Apply for talangan
  104 |         const talanganAmount = Math.min(gap, 5000000); // Cap at 5M for test safety
  105 |         const applyRes = await page.request.post(`${BASE}/api/haji-umrah/talangan/apply`, {
  106 |             data: {
  107 |                 savingsAccountId,
  108 |                 productId,
  109 |                 amount: talanganAmount,
  110 |                 tenorMonths: 6,
  111 |                 deductionSource: "gaji",
  112 |                 autoDisburse: false,
  113 |                 notes: "E2E Test — talangan via Playwright",
  114 |             },
  115 |         });
  116 | 
  117 |         if (![200, 201].includes(applyRes.status())) {
  118 |             const errBody = await applyRes.text();
  119 |             console.log(`ℹ️ Apply failed (${applyRes.status()}): ${errBody}`);
  120 |             // This could be due to existing talangan — not a test failure
  121 |             return;
  122 |         }
  123 | 
  124 |         const applyJson = await applyRes.json();
  125 |         const applicationId = applyJson.data.applicationId;
  126 |         expect(applicationId).toBeDefined();
  127 |         console.log(`✅ Talangan applied: applicationId=${applicationId}, status=${applyJson.data.status}`);
  128 | 
  129 |         // Step 4: View detail
  130 |         const detailRes = await page.request.get(`${BASE}/api/haji-umrah/talangan/${applicationId}`);
  131 |         expect(detailRes.status()).toBe(200);
  132 |         const detailJson = await detailRes.json();
  133 |         expect(detailJson.data.application.id).toBe(applicationId);
  134 |         console.log(`✅ Detail retrieved: status=${detailJson.data.application.status}`);
  135 | 
  136 |         // Step 5: Approve
  137 |         const approveRes = await page.request.post(`${BASE}/api/loans/applications/${applicationId}/approve`, {
  138 |             data: {},
  139 |         });
  140 |         expect(approveRes.status()).toBe(200);
  141 |         console.log("✅ Application approved");
  142 | 
  143 |         // Step 6: Disburse
  144 |         const disburseRes = await page.request.post(`${BASE}/api/loans/applications/${applicationId}/disburse`, {
  145 |             data: {},
  146 |         });
  147 |         if (disburseRes.status() === 200) {
  148 |             const disburseJson = await disburseRes.json();
  149 |             console.log(`✅ Talangan disbursed: loanId=${disburseJson.loanId}`);
  150 |         } else {
  151 |             const errJson = await disburseRes.json();
  152 |             console.log(`ℹ️ Disburse: ${disburseRes.status()} — ${errJson.message}`);
  153 |         }
  154 | 
  155 |         // Step 7: Verify it appears in talangan list
  156 |         const listRes = await page.request.get(`${BASE}/api/haji-umrah/talangan?status=active`);
  157 |         const listJson = await listRes.json();
  158 |         expect(listJson.stats.totalActive).toBeGreaterThanOrEqual(1);
  159 |         console.log(`✅ Talangan now shows in active list: totalActive=${listJson.stats.totalActive}`);
  160 |     });
  161 | 
  162 |     // ── 3. UI Page Tests ──────────────────────────────────────────
  163 | 
  164 |     test("3.1 Talangan list page loads", async ({ page }) => {
  165 |         await loginAs(page, "operator@koperasi.com");
  166 |         await page.goto(`${BASE}/haji-umrah/talangan`);
  167 |         await page.waitForLoadState("networkidle");
  168 |         expect(page.url()).toContain("/haji-umrah/talangan");
  169 |         await expect(page.locator("text=Talangan Haji & Umrah").first()).toBeVisible({ timeout: 10000 });
  170 |         console.log("✅ Talangan list page loads");
  171 |     });
  172 | 
  173 |     test("3.2 Talangan apply page loads", async ({ page }) => {
  174 |         await loginAs(page, "operator@koperasi.com");
  175 |         await page.goto(`${BASE}/haji-umrah/talangan/apply`);
  176 |         await page.waitForLoadState("networkidle");
  177 |         expect(page.url()).toContain("/haji-umrah/talangan/apply");
  178 |         await expect(page.locator("text=Pengajuan Talangan").first()).toBeVisible({ timeout: 10000 });
  179 |         console.log("✅ Talangan apply page loads");
  180 |     });
  181 | 
  182 |     test("3.3 Dashboard shows talangan stats", async ({ page }) => {
  183 |         await loginAs(page, "operator@koperasi.com");
  184 |         await page.goto(`${BASE}/haji-umrah`);
> 185 |         await page.waitForLoadState("networkidle");
      |                    ^ Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
  186 |         await expect(page.locator("text=Talangan Aktif").first()).toBeVisible({ timeout: 10000 });
  187 |         console.log("✅ Dashboard shows Talangan Aktif card");
  188 |     });
  189 | 
  190 |     test("3.4 Sidebar shows Talangan menu", async ({ page }) => {
  191 |         await loginAs(page, "operator@koperasi.com");
  192 |         // Navigate to H&U page first to expand sidebar section
  193 |         await page.goto(`${BASE}/haji-umrah`);
  194 |         await page.waitForLoadState("networkidle");
  195 |         // Look for Talangan in sidebar — it might be inside collapsed section
  196 |         const sidebarText = await page.locator("aside, nav, [data-sidebar]").first().textContent({ timeout: 10000 }).catch(() => "");
  197 |         const hasTalangan = sidebarText?.includes("Talangan") ?? false;
  198 |         // Also check if the page rendered talangan quick link
  199 |         const pageHasTalangan = await page.locator("text=Talangan").first().isVisible({ timeout: 5000 }).catch(() => false);
  200 |         expect(hasTalangan || pageHasTalangan).toBe(true);
  201 |         console.log(`✅ Talangan menu visible: sidebar=${hasTalangan}, page=${pageHasTalangan}`);
  202 |     });
  203 | 
  204 |     // ── 4. Reports ────────────────────────────────────────────────
  205 | 
  206 |     test("4.1 Talangan report API returns data", async ({ page }) => {
  207 |         await loginAs(page, "operator@koperasi.com");
  208 | 
  209 |         const res = await page.request.get(`${BASE}/api/haji-umrah/reports?type=talangan`);
  210 |         expect(res.status()).toBe(200);
  211 |         const json = await res.json();
  212 |         expect(json.summary).toBeDefined();
  213 |         expect(typeof json.summary.totalLoans).toBe("number");
  214 |         console.log(`✅ Talangan report: ${json.summary.totalLoans} loans, ${json.summary.activeCount} active`);
  215 |     });
  216 | 
  217 |     // ── 5. RBAC Tests ─────────────────────────────────────────────
  218 | 
  219 |     test("5.1 Admin haji_umrah can access talangan API", async ({ page }) => {
  220 |         await loginAs(page, "adminhajiumrah@koperasi.com");
  221 | 
  222 |         const res = await page.request.get(`${BASE}/api/haji-umrah/talangan`);
  223 |         expect(res.status()).toBe(200);
  224 |         console.log("✅ Admin haji_umrah can access talangan API");
  225 |     });
  226 | 
  227 |     test("5.2 Admin haji_umrah can access gap calculator", async ({ page }) => {
  228 |         await loginAs(page, "adminhajiumrah@koperasi.com");
  229 | 
  230 |         const res = await page.request.get(`${BASE}/api/haji-umrah/talangan/gap`);
  231 |         expect(res.status()).toBe(200);
  232 |         console.log("✅ Admin haji_umrah can access gap calculator");
  233 |     });
  234 | 
  235 |     test("5.3 Talangan apply requires auth", async ({ page }) => {
  236 |         // No login — should get 401
  237 |         const res = await page.request.post(`${BASE}/api/haji-umrah/talangan/apply`, {
  238 |             data: { savingsAccountId: 1, productId: 1, amount: 1000, tenorMonths: 6 },
  239 |         });
  240 |         expect([401, 403].includes(res.status())).toBe(true);
  241 |         console.log("✅ Unauthenticated apply blocked:", res.status());
  242 |     });
  243 | 
  244 |     // ── 6. Validation Tests ───────────────────────────────────────
  245 | 
  246 |     test("6.1 Apply with invalid data returns validation error", async ({ page }) => {
  247 |         await loginAs(page, "operator@koperasi.com");
  248 | 
  249 |         const res = await page.request.post(`${BASE}/api/haji-umrah/talangan/apply`, {
  250 |             data: { savingsAccountId: 999999, productId: 999999, amount: -100, tenorMonths: 0 },
  251 |         });
  252 |         expect([400, 404].includes(res.status())).toBe(true);
  253 |         console.log("✅ Invalid data rejected:", res.status());
  254 |     });
  255 | });
  256 | 
```