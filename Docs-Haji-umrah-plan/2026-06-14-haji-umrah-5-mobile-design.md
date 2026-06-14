# Design Spec — Phase 5: Mobile App Haji & Umrah (Member)

> **Status:** Design APPROVED (14 Juni 2026) — siap untuk implementation plan
> **Branch:** `railway-migration` | **Tanggal:** 14 Juni 2026
> **Pendahatan dari:** Phase 1 (Tabungan), 2B (Talangan), 3 (Member Portal), 4 (Bagi Hasil)
> **Constraint:** Tidak mengganggu unit lain maupun production. Semua perubahan additive & commit-only (no push).

---

## 1. Konteks & Tujuan

Unit Haji & Umrah sudah lengkap di **web** (Phase 1+2B+3+4: tabungan, talangan, member portal, bagi hasil — 45 E2E pass). Satu-satunya fase tersisa adalah **Phase 5: Mobile App Integration**. Spec ini mendefinisikan bagaimana anggota mengakses fitur H&U dari aplikasi mobile (Expo RN).

**Tujuan:** Anggota bisa melihat progress tabungan H&U, riwayat setoran, kredit bagi hasil, status talangan, dan mengajukan talangan baru — semuanya dari mobile app, dengan notifikasi push otomatis saat milestone tercapai.

---

## 2. Keputusan (dari brainstorming)

| Aspek | Keputusan | Alasan |
|---|---|---|
| **Scope role** | Member only | Mobile app bersifat consumer-facing; flow operator finansial = pekerjaan meja (web) |
| **Tabungan & Bagi Hasil** | View-only | Mirror Phase 3 portal |
| **Talangan** | View + ajukan (request) | Ikuti pola `LoanApplicationScreen` yang sudah ada; admin approve/disburse di web |
| **Notifikasi push** | Include sekarang | Infra lengkap (`createNotification` + Expo Push); manfaat tinggi untuk tabungan bertarget |
| **Navigasi** | Entry dari Dashboard (MenuItem) | Bottom nav tetap 4 tab; H&U = pushed screen |
| **Pendekatan arsitektur** | **Pendekatan 1** — endpoint `/api/mobile/haji-umrah/*` dedicated, resolve `user.id → Member` server-side | Match pola 47 endpoint mobile existing; nol ubah JWT; nol re-login paksa; nol disrupsi unit lain |

### Mengapa bukan Pendekatan 2 atau 3
- **Pendekatan 2** (extend `savings-accounts`/`loans`): mencampur tanggung jawab H&U (progress, maturity, gap, bagi hasil) ke endpoint/screen yang melayani simpanan/pinjaman reguler → berisiko ganggu unit lain. Ditolak.
- **Pendekatan 3** (tambah `memberId` ke JWT schema): bersih jangka panjang tapi memaksa semua user mobile re-login (token 30-hari existing tidak punya `memberId`). Disrupsi production. Ditolak.

---

## 3. Arsitektur

```
Mobile (Expo RN)                          Web API (Next.js)
┌──────────────────────────┐              ┌─────────────────────────────────┐
│ DashboardScreen          │              │ /api/mobile/haji-umrah (GET)     │ ← NEW
│  └ MenuItem "Haji & Umrah"│──navigate──▶│ /api/mobile/haji-umrah/          │
│                          │              │   accounts/[id] (GET)            │ ← NEW
│ HajiUmrahScreen ─────────│──GET────────│ /api/mobile/haji-umrah/          │
│ HajiUmrahDetailScreen ───│──GET detail─│   talangan/apply (POST)          │ ← NEW
│ HajiUmrahTalanganApply ──│──POST───────│                                  │
└──────────────────────────┘              └─────────────────────────────────┘
                                                    │ (resolve user.id → Member)
                                         ┌──────────▼──────────────────────────────────┐
                                         │ Web endpoints yang sudah ada (phase 1-4):    │
                                         │  setoran / bagi-hasil / disburse             │
                                         │  → inject createNotification() (try/catch)   │
                                         └─────────────────────────────────────────────┘
```

**Prinsip kunci:** Mobile hanya **baca** + **ajukan talangan (request)**. Semua mutasi finansial (setoran, disburse, process bagi hasil) tetap di web. Mobile apply talangan hanya membuat `LoanApplication` status `submitted` → admin approve/disburse di web.

---

## 4. Member-Scoping & RBAC

Mobile JWT (`MobileJWTPayload`) membawa `id` (user.id), `email`, `role`, `nrp` — **tidak membawa `memberId`**. Resolusi dilakukan server-side per-request:

```typescript
const user = getMobileUser(request);          // { id, role, ... } dari JWT
if (!user) return unauthorizedResponse();

const dbUser = await prisma.user.findUnique({
  where: { id: parseInt(user.id) },
  select: {
    id: true,
    member: { select: { id: true, status: true, name: true } },
  },
});
if (!dbUser?.member) {
  return NextResponse.json(
    { message: "Akun tidak terhubung ke data anggota" },
    { status: 401 }
  );
}
const memberId = dbUser.member.id;            // ← semua query scoped memberId ini
```

**Aturan RBAC:**
- Semua query H&U di-scope `memberId === dbUser.member.id` (member-scoped, identik semantik dengan web portal `session.user.memberId`).
- Operator/admin (memberId null) → 401. Endpoint mobile H&U sengaja member-only.
- Akses rekening member lain → 404 (scoping mencegah otomatis; tidak ada leak).

---

## 5. API Endpoints (3 file baru)

Semua di-guard `getMobileUser()` dari `api/mobile/middleware.ts`, lalu resolve memberId (§4).

### 5.1 `GET /api/mobile/haji-umrah`

Payload utama. Shape **mirror** web portal `/api/member-portal/haji-umrah` untuk konsistensi.

```jsonc
{
  "summary": {
    "totalBalance": 5300000,
    "totalTarget": 50000000,
    "overallProgress": 10.6,
    "activeAccounts": 1,
    "activeTalanganCount": 1,
    "totalBagiHasil": 7000
  },
  "accounts": [
    {
      "id": 10,
      "accountNo": "HU-776-10-1715",
      "productName": "Tabungan Haji",
      "productType": "tabungan_haji",
      "linkedBankName": "BSI",
      "balance": 5300000,
      "targetAmount": 50000000,
      "monthlyTarget": 2000000,
      "maturityDate": "2030-05-01T00:00:00.000Z",
      "progress": 10.6,
      "remaining": 44700000,
      "monthsRemaining": 24,
      "isTargetReached": false,
      "recentDeposits": [ /* 5 SavingsTransaction terakhir (type deposit) */ ],
      "activeTalangan": {
        "loanNo": "TLH-...",
        "outstanding": 5000000,
        "monthlyInstallment": 250000,
        "nextDueDate": "2026-07-01"
      } | null,
      "gap": 44700000,
      "canApplyTalangan": true
    }
  ],
  "bagiHasilCredits": [ /* 10 SavingsTransaction interest terbaru di akun H&U member */ ]
}
```

**Catatan `canApplyTalangan`:** `gap > 0 && activeTalangan === null && member.status === "active"`. Dipakai Dashboard/HajiUmrahScreen untuk tampilkan/sembunyikan tombol "Ajukan Talangan".

### 5.2 `GET /api/mobile/haji-umrah/accounts/[id]`

Detail satu rekening + riwayat setoran lengkap (untuk FlatList `HajiUmrahDetailScreen`).

- Scoped: `where: { id, memberId }` (404 jika bukan milik member).
- Response: field rekening + `progress`, `transactions[]` (paginated SavingsTransaction deposit/interest, urut desc), `activeTalangan` detail.

### 5.3 `POST /api/mobile/haji-umrah/talangan/apply`

Submit pengajuan talangan. **Tidak auto-disburse** (selalu `submitted`).

**Body:**
```jsonc
{
  "savingsAccountId": 10,
  "amount": 5000000,
  "tenor": 24
}
```

**Validasi** (mirror web `/api/haji-umrah/talangan/apply`, member-scoped):
1. `savingsAccountId` milik `memberId` & `status === "active"`
2. `member.status` bukan `inactive`/`resigned`/`pensiun`
3. Type matching: `tabungan_haji ↔ talangan_haji`, `tabungan_umrah ↔ talangan_umrah` (derive produk dari tipe akun)
4. `amount <= gap` (targetAmount − balance)
5. `amount` & `tenor` dalam range produk talangan
6. Tidak ada talangan aktif untuk rekening ini (1:1) → jika ada, **409**

**Aksi:**
```typescript
await prisma.loanApplication.create({
  data: {
    applicationNo: `APP-${year}-${crypto9}`,   // crypto.randomBytes, bukan Math.random
    memberId,
    productId: talanganProduct.id,
    amount,
    tenor,
    status: "submitted",
    linkedSavingsAccountId: savingsAccountId,
    submittedById: parseInt(user.id),
  },
});
// Notifikasi ke operator/admin haji_umrah (non-blocking)
// operatorAndAdminHajiUmrahIds = getNotificationRecipients("haji_umrah")
//   (helper di src/lib/notifications.ts — return operator + admin by unitType)
try {
  await createNotification({
    userId: operatorAndAdminHajiUmrahIds,
    type: "haji_umrah_talangan_request",
    title: "Pengajuan Talangan H&U Baru",
    message: `${member.name} mengajukan talangan ${formatRp(amount)} untuk ${accountNo}`,
    data: { screen: "Approval" },
  });
} catch {}
```

**Response 201:**
```jsonc
{ "message": "Pengajuan talangan terkirim", "data": { "applicationNo", "amount", "tenor", "status": "submitted" } }
```

Admin menyelesaikan approve + disburse di **web** via endpoint existing (`/api/loans/applications/[id]/approve` → `/disburse`).

---

## 6. Mobile Screens (3 file baru + 2 diubah)

### 6.1 `screens/member/HajiUmrahScreen.tsx` (route `HajiUmrah`)
- Header gradient (pola `SimpananScreen`): "Haji & Umrah"
- Summary card: total saldo, total target, progress bar keseluruhan, jumlah rekening aktif
- Per-account card: nama produk, `accountNo`, progress bar (`balance/targetAmount`), saldo, maturity countdown, status talangan aktif (jika ada), tombol **"Ajukan Talangan"** (jika `canApplyTalangan`)
- Section "Bagi Hasil BSI": list kredit terbaru (label "Bagi Hasil" untuk type `interest`)
- Empty state: "Belum ada tabungan H&U"
- Pull-to-refresh (`RefreshControl`), pola identik `SimpananScreen`
- Tap card → `navigate("HajiUmrahDetail", { accountId })`

### 6.2 `screens/member/HajiUmrahDetailScreen.tsx` (route `HajiUmrahDetail`)
- Progress detail (saldo, target, sisa, bulan tersisa, maturity)
- FlatList riwayat setoran lengkap (pola `SimpananScreen`: card per transaksi, ikon setoran/bagi hasil, saldo setelah)
- Talangan aktif block (jika ada): loanNo, outstanding, cicilan bulanan, jatuh tempo berikutnya

### 6.3 `screens/member/HajiUmrahTalanganApplyScreen.tsx` (route `HajiUmrahTalanganApply`)
- Form: pilih rekening (prefilled dari param/navigation), tampil gap & produk talangan (auto dari tipe akun), input `amount`, pilih `tenor`
- Validasi client-side (amount ≤ gap, ≥ min produk)
- Konfirmasi dialog → POST apply → state sukses "Pengajuan terkirim. Menunggu persetujuan admin." → tombol "Kembali"
- Error handling: tampilkan pesan dari API (termasuk 409 double-apply)

### File diubah (minimal, additive)
- **`mobile/App.tsx`** — daftarkan 3 `Stack.Screen` baru (lazy-loaded via `React.lazy`, pola identik `LoanApplication`). Tambah 1 branch di push-tap handler (~line 185): `data.screen === 'HajiUmrah'` → `navRef.navigate('HajiUmrah')`.
- **`mobile/src/screens/common/DashboardScreen.tsx`** — tambah 1 `MenuItem` "Haji & Umrah" (icon `airplane-outline`, color emas `#D4AF37`) di member "Menu Layanan" grid → `navigate("HajiUmrah")`. **Conditional:** hanya render jika member punya ≥1 rekening H&U (flag dari `/api/mobile/summary` atau `/api/mobile/haji-umrah`). Jika tidak ada, menu tidak tampil (hindari menu kosong / dead-end).

**Bottom nav: tidak berubah** (4 tab: Beranda/Transaksi/Pinjaman/Profil).

---

## 7. Push Notification Triggers (4 event, non-blocking)

Semua via `createNotification({ userId, type, title, message, data, push: true })` dari `src/lib/notifications.ts` (insert Notification row + Expo Push delivery fire-and-forget). Di-inject di endpoint web existing, **di dalam `try/catch`** — logika finansial identik, hanya tambah side-effect.

| # | Event | Lokasi trigger | Penerima | Pesan | `data` |
|---|---|---|---|---|---|
| 1 | Target mendekati ≥80% | `haji-umrah/savings/[accountId]/transactions` POST (setelah update saldo) | `memberId` owner akun | "Tabungan {productName} Anda telah mencapai 80% menuju target" | `{ screen: "HajiUmrah", accountId }` |
| 2 | Target tercapai 100% | sama (setelah setoran) | `memberId` owner akun | "Selamat! Tabungan {productName} telah mencapai target 🎉" | `{ screen: "HajiUmrah", accountId }` |
| 3 | Bagi hasil dikredit | `haji-umrah/bagi-hasil` POST (per item saat proses) | `memberId` per item | "Bagi Hasil BSI {periodLabel} sebesar {amount} dikredit ke {accountNo}" | `{ screen: "HajiUmrah" }` |
| 4 | Talangan cair | `loans/applications/[id]/disburse` (hanya jika `linkedSavingsAccountId` set) | `memberId` loan | "Talangan H&U Anda telah cair sebesar {amount}" | `{ screen: "HajiUmrah" }` |

### Deteksi crossing threshold (event 1 & 2)
Hitung dari `balanceBefore` vs `balanceAfter` relatif `targetAmount`:
- Event 1 (≥80%): fire **hanya jika** `progressBefore < 80% && progressAfter >= 80%` (anti re-fire setiap setoran berikutnya)
- Event 2 (100%): fire **hanya jika** `progressBefore < 100% && progressAfter >= 100%`

```typescript
// di setoran endpoint, setelah dapat balanceBefore & balanceAfter:
try {
  const progressBefore = (balanceBefore / targetAmount) * 100;
  const progressAfter = (balanceAfter / targetAmount) * 100;
  if (progressBefore < 80 && progressAfter >= 80) {
    await createNotification({ userId: ownerUserId, type: "haji_umrah_target_80", ... });
  }
  if (progressBefore < 100 && progressAfter >= 100) {
    await createNotification({ userId: ownerUserId, type: "haji_umrah_target_reached", ... });
  }
} catch (err) {
  console.error("[H&U] Notification trigger failed:", err);
  // TIDAK throw — transaksi finansial sudah commit, notifikasi bersifat best-effort
}
```

**Catatan `ownerUserId`:** `createNotification` butuh `userId` (bukan memberId). Resolusi: `member.userId` (relasi Member → User). Ambil saat handler sudah punya account (include `member` → `user`). **Guard:** jika `member.userId === null` → skip (anggota tersebut tidak punya akun login mobile, tidak ada device untuk menerima push). Notifikasi hanya relevan untuk anggota yang punya User + fcmToken terdaftar.

---

## 8. Validasi & Error Handling

- **Zod** (`src/lib/validations/haji-umrah.ts`): tambah `mobileTalanganApplySchema`:
  ```typescript
  export const mobileTalanganApplySchema = z.object({
    savingsAccountId: z.number().int().positive(),
    amount: z.number().positive(),
    tenor: z.number().int().positive(),
  });
  ```
  (Validasi bisnis — gap, range produk, type matching, 1:1 — dilakukan di handler, bukan Zod, karena butuh query DB.)
- **Kode error:** 401 (token invalid / bukan member), 400 (body invalid), 403 (—), 404 (rekening tidak milik member), 409 (sudah ada talangan aktif untuk rekening), 500 (catch-all + `console.error`).
- Semua endpoint: `try/catch` + JSON message, pola identik endpoint mobile lain.

---

## 9. Testing Strategy

### 9.1 API (Playwright `request` + JWT)
File: `e2e/haji-umrah-mobile.spec.ts`

```typescript
// Helper: login member via /api/mobile/login, dapat token
async function mobileToken(request, email, password) {
  const res = await request.post(`${BASE}/api/mobile/login`, { data: { identifier: email, password } });
  return (await res.json()).token;
}
// Set header Authorization: Bearer <token> untuk page.request
```

Cakupan:
- `1.x` GET `/api/mobile/haji-umrah` — member: summary + accounts terisi; operator: 401
- `2.x` GET detail rekening milik member → 200; rekening member lain → 404
- `3.x` POST talangan/apply — sukses (201, status submitted); validasi (amount > gap → 400); double-apply → 409; rekening bukan milik → 404
- `4.x` RBAC — tanpa token → 401; token operator → 401

### 9.2 Notifikasi
- Trigger event 1 (≥80%) & 2 (100%): login operator, POST setoran ke akun member hingga cross threshold, verify `prisma.notification.findMany({ where: { userId: ownerUserId, type: "haji_umrah_target_*" } })` ada row.
- Anti re-fire: setoran berikutnya di atas threshold → tidak ada row baru.

### 9.3 No-regression
- 45 test H&U web existing tetap pass (perubahan endpoint web hanya additive notification, logika finansial identik).
- E2E suite H&U lain tidak terdampak.

### 9.4 UI screen
- Tidak bisa Playwright-test Expo → verifikasi: (a) type-check `tsc --noEmit` di `mobile/`, (b) manual di emulator/device.
- Fokus automasi di API layer (logika bisnis); UI = manual.

### Akun test
`87011378@koperasi.local` / `87011378` — A'AN ANDRIONO (member_id 776, punya HU-776-10-1715 + talangan). Sama dengan Phase 3/4.

---

## 10. Safety — Compliance Constraint

> Constraint user: "pastikan semua implementasi ini tidak mengganggu unit lainnya serta production jika bisa, implementasikan dengan hati-hati"

| Constraint | Cara dipenuhi |
|---|---|
| Tidak ganggu unit lain | 3 endpoint mobile + 3 screen = **file baru**. Hanya 2 file mobile existing disentuh: `App.tsx` (+3 screen registration + 1 push-tap branch), `DashboardScreen.tsx` (+1 MenuItem conditional). Nol perubahan ke endpoint/screen/komponen unit lain (toko, resto, simpanan reguler, dll). |
| Tidak ganggu production | Endpoint web hanya dapat **trigger notifikasi additive** (`createNotification` di `try/catch`, logika finansial identik). **Tidak ada tabel/kolom Prisma baru** → **tidak perlu migrate**. Commit-only, no push — production jalan di build lama sampai push eksplisit. |
| Implementasi hati-hati | Member-scoped ketat (memberId dari server, bukan client). Apply talangan = request only (tidak ada disburse dari mobile). Semua mutasi finansial tetap di web. Notifikasi non-blocking (best-effort). |

---

## 11. File Inventory

### Baru (8 file)
1. `src/app/api/mobile/haji-umrah/route.ts` — GET summary + accounts + bagi hasil
2. `src/app/api/mobile/haji-umrah/accounts/[id]/route.ts` — GET detail + riwayat
3. `src/app/api/mobile/haji-umrah/talangan/apply/route.ts` — POST submit
4. `mobile/src/screens/member/HajiUmrahScreen.tsx` — overview
5. `mobile/src/screens/member/HajiUmrahDetailScreen.tsx` — detail per rekening
6. `mobile/src/screens/member/HajiUmrahTalanganApplyScreen.tsx` — form pengajuan
7. `e2e/haji-umrah-mobile.spec.ts` — API + notifikasi tests
8. `Docs-Haji-umrah-plan/2026-06-14-haji-umrah-5-mobile-design.md` — spec ini

### Diubah (6 file, minimal/additive)
1. `mobile/App.tsx` — +3 `Stack.Screen` + 1 push-tap branch
2. `mobile/src/screens/common/DashboardScreen.tsx` — +1 MenuItem (conditional, member dengan rekening H&U)
3. `src/lib/validations/haji-umrah.ts` — +`mobileTalanganApplySchema`
4. `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` — +trigger notifikasi 80%/100%
5. `src/app/api/haji-umrah/bagi-hasil/route.ts` — +trigger notifikasi per-member saat process
6. `src/app/api/loans/applications/[id]/disburse/route.ts` — +trigger notifikasi talangan cair (jika `linkedSavingsAccountId`)

---

## 12. Out of Scope (Future)

- **Operator/admin flow di mobile** (setoran, process bagi hasil, approve talangan dari mobile) — sengaja di-defer; tetap di web.
- **Auto-disburse talangan dari mobile** — sengaja tidak; mobile apply selalu `submitted`.
- **Notifikasi saat anggota MELAKUKAN setoran sendiri** — N/A (anggota tidak setor sendiri; admin yang input setoran di web).
- **Offline mode / cache** — tidak; mobile app sudah online-first via TanStack Query.

---

## 13. Implementasi Plan (sub-tahap)

Akan dirinci oleh **writing-plans skill** setelah spec ini di-approve user. Estimasi urutan:
1. **API layer** — 3 endpoint mobile + member-scoping helper
2. **Validasi** — `mobileTalanganApplySchema`
3. **Notifikasi triggers** — inject di 3 endpoint web existing
4. **Mobile screens** — 3 screen + Dashboard MenuItem + App.tsx registration
5. **Testing** — `haji-umrah-mobile.spec.ts` + no-regression

---

*Diperbarui: 14 Juni 2026 | Phase 5 Mobile design APPROVED. Branch `railway-migration`, commit-only.*
