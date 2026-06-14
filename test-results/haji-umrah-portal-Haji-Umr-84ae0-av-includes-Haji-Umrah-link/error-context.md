# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: haji-umrah-portal.spec.ts >> Haji & Umrah — Member Portal (Phase 3) >> 3.2 Portal nav includes Haji & Umrah link
- Location: e2e\haji-umrah-portal.spec.ts:111:9

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
        - button "9+ Notifikasi" [ref=e160]:
          - img
          - generic [ref=e161]: 9+
          - generic [ref=e162]: Notifikasi
        - button "O(" [ref=e163]:
          - generic [ref=e165]: O(
      - main [ref=e166]:
        - generic [ref=e167]:
          - generic [ref=e168]:
            - heading "Dashboard" [level=1] [ref=e169]
            - paragraph [ref=e170]: Selamat datang kembali! Berikut ringkasan aktivitas PRIMKOPPOL RESOR LUMAJANG.
          - generic [ref=e171]:
            - generic [ref=e172] [cursor=pointer]:
              - button "Bantuan" [ref=e173]:
                - img [ref=e174]
              - link "Total Anggota 833 anggota aktif" [ref=e177]:
                - /url: /anggota
                - generic [ref=e180]:
                  - generic [ref=e181]:
                    - paragraph [ref=e182]: Total Anggota
                    - paragraph [ref=e183]: "833"
                    - paragraph [ref=e184]: anggota aktif
                  - img [ref=e186]
            - generic [ref=e191] [cursor=pointer]:
              - button "Bantuan" [ref=e192]:
                - img [ref=e193]
              - link "Total Simpanan Rp 9.292.054.850" [ref=e196]:
                - /url: /simpanan/rekap
                - generic [ref=e199]:
                  - generic [ref=e200]:
                    - paragraph [ref=e201]: Total Simpanan
                    - paragraph [ref=e202]: Rp 9.292.054.850
                  - img [ref=e204]
            - generic [ref=e207] [cursor=pointer]:
              - button "Bantuan" [ref=e208]:
                - img [ref=e209]
              - link "Total Pinjaman Aktif Rp 5.712.933.433" [ref=e212]:
                - /url: /laporan/rekap-pinjaman
                - generic [ref=e215]:
                  - generic [ref=e216]:
                    - paragraph [ref=e217]: Total Pinjaman Aktif
                    - paragraph [ref=e218]: Rp 5.712.933.433
                  - img [ref=e220]
            - generic [ref=e222] [cursor=pointer]:
              - button "Bantuan" [ref=e223]:
                - img [ref=e224]
              - link "Potensi Bunga (1%/Bln) Rp 75.466.700" [ref=e227]:
                - /url: /pinjaman
                - generic [ref=e230]:
                  - generic [ref=e231]:
                    - paragraph [ref=e232]: Potensi Bunga (1%/Bln)
                    - paragraph [ref=e233]: Rp 75.466.700
                  - img [ref=e235]
            - generic [ref=e238] [cursor=pointer]:
              - button "Bantuan" [ref=e239]:
                - img [ref=e240]
              - link "Tunggakan Rp 0 perlu perhatian" [ref=e243]:
                - /url: /pinjaman/jadwal
                - generic [ref=e246]:
                  - generic [ref=e247]:
                    - paragraph [ref=e248]: Tunggakan
                    - paragraph [ref=e249]: Rp 0
                    - paragraph [ref=e250]: perlu perhatian
                  - img [ref=e252]
          - generic [ref=e254]:
            - generic [ref=e255] [cursor=pointer]:
              - button "Bantuan" [ref=e256]:
                - img [ref=e257]
              - generic [ref=e260]:
                - generic [ref=e262]: Simpanan Hari Ini
                - generic [ref=e263]:
                  - paragraph [ref=e264]: Rp 3.800.000
                  - paragraph [ref=e265]: 13 transaksi
            - generic [ref=e266] [cursor=pointer]:
              - button "Bantuan" [ref=e267]:
                - img [ref=e268]
              - generic [ref=e271]:
                - generic [ref=e273]: Pencairan Hari Ini
                - generic [ref=e274]:
                  - paragraph [ref=e275]: Rp 0
                  - paragraph [ref=e276]: 0 pencairan
            - generic [ref=e277] [cursor=pointer]:
              - button "Bantuan" [ref=e278]:
                - img [ref=e279]
              - generic [ref=e282]:
                - generic [ref=e284]: Angsuran Hari Ini
                - generic [ref=e285]:
                  - paragraph [ref=e286]: Rp 0
                  - paragraph [ref=e287]: 0 pembayaran
          - generic [ref=e288]:
            - generic [ref=e290]:
              - generic [ref=e293]:
                - generic [ref=e294]:
                  - img [ref=e295]
                  - text: Saldo Rekening Kas & Bank
                - generic [ref=e297]: "Total dana: Rp 2.869.196.097"
              - generic [ref=e299]:
                - link "Bank BRI B-001 Rp 1.424.911.621" [ref=e300] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e301]:
                    - generic [ref=e302]:
                      - img [ref=e304]
                      - generic [ref=e307]:
                        - paragraph [ref=e308]: Bank BRI
                        - paragraph [ref=e309]: B-001
                    - paragraph [ref=e311]: Rp 1.424.911.621
                - link "Bank JATIM B-002 Rp 1.364.052.129" [ref=e312] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e313]:
                    - generic [ref=e314]:
                      - img [ref=e316]
                      - generic [ref=e319]:
                        - paragraph [ref=e320]: Bank JATIM
                        - paragraph [ref=e321]: B-002
                    - paragraph [ref=e323]: Rp 1.364.052.129
                - link "Bank JATIM – Dana Cadangan BNK-JATIM-CDG Rp 0" [ref=e324] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e325]:
                    - generic [ref=e326]:
                      - img [ref=e328]
                      - generic [ref=e331]:
                        - paragraph [ref=e332]: Bank JATIM – Dana Cadangan
                        - paragraph [ref=e333]: BNK-JATIM-CDG
                    - paragraph [ref=e335]: Rp 0
                - link "Bank JATIM – Cuci Mobil , Resto & Cafe LSP BNK-JATIM-CMR Rp 17.771.000" [ref=e336] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e337]:
                    - generic [ref=e338]:
                      - img [ref=e340]
                      - generic [ref=e343]:
                        - paragraph [ref=e344]: Bank JATIM – Cuci Mobil , Resto & Cafe LSP
                        - paragraph [ref=e345]: BNK-JATIM-CMR
                    - paragraph [ref=e347]: Rp 17.771.000
                - link "Bank JATIM – Fitness, Toko & Coffee Latar BNK-JATIM-FTC Rp 15.210.700" [ref=e348] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e349]:
                    - generic [ref=e350]:
                      - img [ref=e352]
                      - generic [ref=e355]:
                        - paragraph [ref=e356]: Bank JATIM – Fitness, Toko & Coffee Latar
                        - paragraph [ref=e357]: BNK-JATIM-FTC
                    - paragraph [ref=e359]: Rp 15.210.700
                - link "Bank JATIM – Dana Pegawai BNK-JATIM-PGWI Rp 0" [ref=e360] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e361]:
                    - generic [ref=e362]:
                      - img [ref=e364]
                      - generic [ref=e367]:
                        - paragraph [ref=e368]: Bank JATIM – Dana Pegawai
                        - paragraph [ref=e369]: BNK-JATIM-PGWI
                    - paragraph [ref=e371]: Rp 0
                - link "Bank JATIM – Dana Sosial BNK-JATIM-SOS Rp 0" [ref=e372] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e373]:
                    - generic [ref=e374]:
                      - img [ref=e376]
                      - generic [ref=e379]:
                        - paragraph [ref=e380]: Bank JATIM – Dana Sosial
                        - paragraph [ref=e381]: BNK-JATIM-SOS
                    - paragraph [ref=e383]: Rp 0
                - link "Kas Tunai KAS-002 Rp 126.560.336" [ref=e384] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e385]:
                    - generic [ref=e386]:
                      - img [ref=e388]
                      - generic [ref=e391]:
                        - paragraph [ref=e392]: Kas Tunai
                        - paragraph [ref=e393]: KAS-002
                    - paragraph [ref=e395]: Rp 126.560.336
                - link "Kas Tunai – Dana Cadangan KAS-JATIM-CDG Rp 0" [ref=e396] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e397]:
                    - generic [ref=e398]:
                      - img [ref=e400]
                      - generic [ref=e403]:
                        - paragraph [ref=e404]: Kas Tunai – Dana Cadangan
                        - paragraph [ref=e405]: KAS-JATIM-CDG
                    - paragraph [ref=e407]: Rp 0
                - link "Kas Tunai – Cuci Mobil , Resto & Cafe LSP KAS-JATIM-CMR Rp 23.677.200" [ref=e408] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e409]:
                    - generic [ref=e410]:
                      - img [ref=e412]
                      - generic [ref=e415]:
                        - paragraph [ref=e416]: Kas Tunai – Cuci Mobil , Resto & Cafe LSP
                        - paragraph [ref=e417]: KAS-JATIM-CMR
                    - paragraph [ref=e419]: Rp 23.677.200
                - link "Kas Tunai – Fitness, Toko & Coffee Latar KAS-JATIM-FTC -Rp 102.986.889" [ref=e420] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e421]:
                    - generic [ref=e422]:
                      - img [ref=e424]
                      - generic [ref=e427]:
                        - paragraph [ref=e428]: Kas Tunai – Fitness, Toko & Coffee Latar
                        - paragraph [ref=e429]: KAS-JATIM-FTC
                    - paragraph [ref=e431]: "-Rp 102.986.889"
                - link "Kas Tunai – Dana Pegawai KAS-JATIM-PGWI Rp 0" [ref=e432] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e433]:
                    - generic [ref=e434]:
                      - img [ref=e436]
                      - generic [ref=e439]:
                        - paragraph [ref=e440]: Kas Tunai – Dana Pegawai
                        - paragraph [ref=e441]: KAS-JATIM-PGWI
                    - paragraph [ref=e443]: Rp 0
                - link "Kas Tunai – Dana Sosial KAS-JATIM-SOS Rp 0" [ref=e444] [cursor=pointer]:
                  - /url: /kas-bank
                  - generic [ref=e445]:
                    - generic [ref=e446]:
                      - img [ref=e448]
                      - generic [ref=e451]:
                        - paragraph [ref=e452]: Kas Tunai – Dana Sosial
                        - paragraph [ref=e453]: KAS-JATIM-SOS
                    - paragraph [ref=e455]: Rp 0
            - generic [ref=e456]:
              - generic [ref=e457]:
                - generic [ref=e458]: Pendapatan per Unit Usaha
                - generic [ref=e459]: 30 hari terakhir
              - generic [ref=e461]:
                - application [ref=e465]
                - generic [ref=e481]:
                  - generic [ref=e482]:
                    - generic [ref=e485]: Toko PRIMKOPPOL
                    - generic [ref=e486]:
                      - text: Rp 94.515.500
                      - generic [ref=e487]: 62%
                  - generic [ref=e488]:
                    - generic [ref=e491]: cafe_lsp
                    - generic [ref=e492]:
                      - text: Rp 7.003.400
                      - generic [ref=e493]: 5%
                  - generic [ref=e494]:
                    - generic [ref=e497]: resto
                    - generic [ref=e498]:
                      - text: Rp 16.767.000
                      - generic [ref=e499]: 11%
                  - generic [ref=e500]:
                    - generic [ref=e503]: Cuci Mobil
                    - generic [ref=e504]:
                      - text: Rp 34.060.000
                      - generic [ref=e505]: 22%
            - generic [ref=e506]:
              - generic [ref=e507]:
                - generic [ref=e508]: Mutasi Kas Harian
                - generic [ref=e509]: Kas masuk vs kas keluar 14 hari terakhir
              - generic [ref=e510]:
                - generic [ref=e511]: Memuat data...
                - generic [ref=e512]:
                  - generic [ref=e513]: Kas Masuk
                  - generic [ref=e515]: Kas Keluar
          - generic [ref=e517]:
            - generic [ref=e518]:
              - generic [ref=e520]: Aksi Cepat
              - generic [ref=e521]:
                - link "Tambah Anggota Baru Daftarkan anggota baru ke sistem" [ref=e522] [cursor=pointer]:
                  - /url: /anggota/tambah
                  - generic [ref=e524]:
                    - img [ref=e526]
                    - generic [ref=e531]:
                      - paragraph [ref=e532]: Tambah Anggota Baru
                      - paragraph [ref=e533]: Daftarkan anggota baru ke sistem
                    - img [ref=e534]
                - link "Transaksi Simpanan Catat setoran atau penarikan" [ref=e536] [cursor=pointer]:
                  - /url: /simpanan/transaksi/tambah
                  - generic [ref=e538]:
                    - img [ref=e540]
                    - generic [ref=e543]:
                      - paragraph [ref=e544]: Transaksi Simpanan
                      - paragraph [ref=e545]: Catat setoran atau penarikan
                    - img [ref=e546]
                - link "Input Angsuran Catat pembayaran angsuran" [ref=e548] [cursor=pointer]:
                  - /url: /pinjaman/angsuran/bayar
                  - generic [ref=e550]:
                    - img [ref=e552]
                    - generic [ref=e554]:
                      - paragraph [ref=e555]: Input Angsuran
                      - paragraph [ref=e556]: Catat pembayaran angsuran
                    - img [ref=e557]
            - generic [ref=e559]:
              - generic [ref=e560]:
                - generic [ref=e561]:
                  - img [ref=e562]
                  - text: Menunggu Persetujuan
                  - generic [ref=e565]: "1"
                - link "Lihat Semua" [ref=e566] [cursor=pointer]:
                  - /url: /approval
              - generic [ref=e568]:
                - generic [ref=e569] [cursor=pointer]:
                  - generic [ref=e570]:
                    - paragraph [ref=e571]: Pembatalan Transaksi Toko [TK-20052026-0040] — 20 Mei 2026 belum bayar an Ny Wisnu
                    - generic [ref=e572]:
                      - generic [ref=e573]: Lainnya
                      - generic [ref=e574]: 20 Mei 2026
                  - generic [ref=e575]:
                    - paragraph [ref=e576]: Rp 663.000
                    - button "Buka Rincian" [ref=e577]:
                      - text: Buka Rincian
                      - img
                - generic [ref=e578] [cursor=pointer]:
                  - generic [ref=e579]:
                    - paragraph [ref=e580]: Pembatalan Transaksi Toko [TK-19052026-0045] — maaf mas bim, bukan beng beng yang 32 gram, tapi beng beng yang reguler
                    - generic [ref=e581]:
                      - generic [ref=e582]: Lainnya
                      - generic [ref=e583]: 19 Mei 2026
                  - generic [ref=e584]:
                    - paragraph [ref=e585]: Rp 3.600
                    - button "Buka Rincian" [ref=e586]:
                      - text: Buka Rincian
                      - img
                - generic [ref=e587] [cursor=pointer]:
                  - generic [ref=e588]:
                    - paragraph [ref=e589]: "Pembatalan Transaksi Toko [TK-14052026-0024] — noted: bukan qris tapi tunai"
                    - generic [ref=e590]:
                      - generic [ref=e591]: Lainnya
                      - generic [ref=e592]: 15 Mei 2026
                  - generic [ref=e593]:
                    - paragraph [ref=e594]: Rp 1.800
                    - button "Buka Rincian" [ref=e595]:
                      - text: Buka Rincian
                      - img
                - generic [ref=e596] [cursor=pointer]:
                  - generic [ref=e597]:
                    - paragraph [ref=e598]: Pembatalan Transaksi Toko [TK-13052026-0031] — TRANSAKSI ATAS NAMA PAK WISNU TGL 12/5/26 BELUM BAYAR
                    - generic [ref=e599]:
                      - generic [ref=e600]: Lainnya
                      - generic [ref=e601]: 13 Mei 2026
                  - generic [ref=e602]:
                    - paragraph [ref=e603]: Rp 129.500
                    - button "Buka Rincian" [ref=e604]:
                      - text: Buka Rincian
                      - img
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e610] [cursor=pointer]:
    - img [ref=e611]
  - alert [ref=e614]
```

# Test source

```ts
  14  | async function loginInNewContext(
  15  |     browser: Browser,
  16  |     email: string,
  17  |     password: string,
  18  | ): Promise<{ page: Page; close: () => Promise<void> }> {
  19  |     const context = await browser.newContext();
  20  |     const page = await context.newPage();
  21  |     await page.goto(`${BASE}/login`);
  22  |     await page.fill("#email", email);
  23  |     await page.fill("#password", password);
  24  |     await page.click('button[type="submit"]');
  25  |     await page.waitForURL(/\/(dashboard|portal)/, { timeout: 30000 });
  26  |     return { page, close: async () => context.close() };
  27  | }
  28  | 
  29  | // Reuse the default fixture for tests where session isolation doesn't matter.
  30  | async function loginAs(page: Page, email: string, password: string = "password123") {
  31  |     await page.goto(`${BASE}/login`);
  32  |     await page.fill("#email", email);
  33  |     await page.fill("#password", password);
  34  |     await page.click('button[type="submit"]');
  35  |     await page.waitForURL(/\/(dashboard|portal)/, { timeout: 30000 });
  36  | }
  37  | 
  38  | test.describe("Haji & Umrah — Member Portal (Phase 3)", () => {
  39  | 
  40  |     // ── 1. API RBAC ───────────────────────────────────────────────
  41  | 
  42  |     test("1.1 GET /api/member-portal/haji-umrah — 401 without login", async ({ request }) => {
  43  |         const res = await request.get(`${BASE}/api/member-portal/haji-umrah`);
  44  |         expect([401, 403].includes(res.status())).toBe(true);
  45  |         console.log("✅ Unauthenticated blocked:", res.status());
  46  |     });
  47  | 
  48  |     test("1.2 GET /api/member-portal/haji-umrah — operator (non-member) is blocked", async ({ page }) => {
  49  |         await loginAs(page, "operator@koperasi.com");
  50  |         const res = await page.request.get(`${BASE}/api/member-portal/haji-umrah`);
  51  |         // Operator has memberId=null → 401 (member-only guard).
  52  |         expect(res.status()).toBe(401);
  53  |         console.log("✅ Operator correctly blocked (no memberId):", res.status());
  54  |     });
  55  | 
  56  |     // ── 2. Member data flow (real member with H&U account) ────────
  57  | 
  58  |     test("2.1 Member API — returns H&U account with progress + talangan shape", async ({ browser }) => {
  59  |         const { page, close } = await loginInNewContext(browser, MEMBER_EMAIL, MEMBER_PASSWORD);
  60  |         try {
  61  |             const res = await page.request.get(`${BASE}/api/member-portal/haji-umrah`);
  62  |             expect(res.status()).toBe(200);
  63  |             const json = await res.json();
  64  | 
  65  |             expect(json.data.summary).toBeDefined();
  66  |             expect(typeof json.data.summary.totalBalance).toBe("number");
  67  |             expect(typeof json.data.summary.overallProgress).toBe("number");
  68  |             expect(Array.isArray(json.data.accounts)).toBe(true);
  69  | 
  70  |             // This member owns at least one H&U account (HU-776-10-1715)
  71  |             expect(json.data.accounts.length).toBeGreaterThan(0);
  72  |             const acc = json.data.accounts[0];
  73  |             expect(acc.product.type).toMatch(/^tabungan_(haji|umrah)$/);
  74  |             expect(typeof acc.balance).toBe("number");
  75  |             expect(typeof acc.target).toBe("number");
  76  |             expect(typeof acc.progress).toBe("number");
  77  |             expect(acc.progress).toBeGreaterThanOrEqual(0);
  78  |             expect(acc.progress).toBeLessThanOrEqual(100);
  79  |             expect(Array.isArray(acc.transactions)).toBe(true);
  80  |             // talangan is null or an object — never undefined
  81  |             expect(acc.talangan === null || typeof acc.talangan === "object").toBe(true);
  82  | 
  83  |             console.log(
  84  |                 `✅ Member sees ${json.data.accounts.length} H&U account(s) — ` +
  85  |                 `${acc.product.name}, balance=${acc.balance}, target=${acc.target}, progress=${acc.progress}%, ` +
  86  |                 `txs=${acc.transactions.length}, talangan=${acc.talangan ? "yes" : "none"}`,
  87  |             );
  88  |         } finally {
  89  |             await close();
  90  |         }
  91  |     });
  92  | 
  93  |     // ── 3. UI ─────────────────────────────────────────────────────
  94  | 
  95  |     test("3.1 /portal/haji-umrah renders member's account with progress bar", async ({ browser }) => {
  96  |         const { page, close } = await loginInNewContext(browser, MEMBER_EMAIL, MEMBER_PASSWORD);
  97  |         try {
  98  |             await page.goto(`${BASE}/portal/haji-umrah`);
  99  |             await page.waitForLoadState("networkidle");
  100 |             expect(page.url()).toContain("/portal/haji-umrah");
  101 |             // Page header always rendered on the success path
  102 |             await expect(page.locator("text=Tabungan Haji & Umrah").first()).toBeVisible({ timeout: 10000 });
  103 |             // Member has a Tabungan Haji → that label should render
  104 |             await expect(page.locator("text=Tabungan Haji").first()).toBeVisible({ timeout: 10000 });
  105 |             console.log("✅ Portal H&U page renders member's Tabungan Haji account");
  106 |         } finally {
  107 |             await close();
  108 |         }
  109 |     });
  110 | 
  111 |     test("3.2 Portal nav includes Haji & Umrah link", async ({ page }) => {
  112 |         await loginAs(page, "operator@koperasi.com");
  113 |         await page.goto(`${BASE}/portal/dashboard`);
> 114 |         await page.waitForLoadState("networkidle");
      |                    ^ Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
  115 |         const navText = await page.locator("nav, header").first().textContent({ timeout: 10000 }).catch(() => "");
  116 |         const bodyText = await page.locator("body").textContent().catch(() => "");
  117 |         const hasLink = (navText?.includes("Haji & Umrah") ?? false) || (bodyText?.includes("Haji & Umrah") ?? false);
  118 |         expect(hasLink).toBe(true);
  119 |         console.log("✅ Nav link 'Haji & Umrah' present in portal layout");
  120 |     });
  121 | 
  122 |     test("3.3 /portal/simpanan renders for member (no regression from H&U filter)", async ({ browser }) => {
  123 |         const { page, close } = await loginInNewContext(browser, MEMBER_EMAIL, MEMBER_PASSWORD);
  124 |         try {
  125 |             await page.goto(`${BASE}/portal/simpanan`);
  126 |             await page.waitForLoadState("networkidle");
  127 |             await expect(page.locator("text=Portofolio Simpanan").first()).toBeVisible({ timeout: 10000 });
  128 |             console.log("✅ Simpanan page renders for member (H&U filter applied, no regression)");
  129 |         } finally {
  130 |             await close();
  131 |         }
  132 |     });
  133 | 
  134 |     // ── 4. Summary route H&U fields (Layer 1) ─────────────────────
  135 | 
  136 |     test("4.1 Summary accounts carry H&U extended fields for member", async ({ browser }) => {
  137 |         const { page, close } = await loginInNewContext(browser, MEMBER_EMAIL, MEMBER_PASSWORD);
  138 |         try {
  139 |             const res = await page.request.get(`${BASE}/api/member-portal/summary`);
  140 |             expect(res.status()).toBe(200);
  141 |             const json = await res.json();
  142 |             const accounts = json.data?.savings?.accounts ?? [];
  143 |             expect(accounts.length).toBeGreaterThan(0);
  144 |             // Every account now carries the additive H&U keys (null for non-H&U products)
  145 |             for (const acc of accounts) {
  146 |                 expect(acc).toHaveProperty("targetAmount");
  147 |                 expect(acc).toHaveProperty("monthlyTarget");
  148 |             }
  149 |             // The H&U account specifically should carry a target
  150 |             const hu = accounts.find((a: { product?: { type?: string } }) => a.product?.type === "tabungan_haji" || a.product?.type === "tabungan_umrah");
  151 |             expect(hu, "member should have an H&U account in summary").toBeTruthy();
  152 |             console.log(`✅ Summary accounts carry H&U fields (targetAmount=${hu.targetAmount}, monthlyTarget=${hu.monthlyTarget})`);
  153 |         } finally {
  154 |             await close();
  155 |         }
  156 |     });
  157 | });
  158 | 
```