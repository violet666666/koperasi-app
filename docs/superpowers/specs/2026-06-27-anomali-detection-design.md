# Deteksi Anomali Otomatis — Design Spec

> Tanggal: 2026-06-27
> Status: Draft (menunggu review)
> Branch: `railway-migration`
> Konteks: kelanjutan dari fix SHU beban biaya (kasus Rp 620jt) + fitur pencegahan salah kategori Kas Keluar

## 1. Latar belakang & masalah

Audit SHU 2026 menemukan bahwa **3 transaksi salah kategori** (Rp 500jt "ambil kas bri", Rp 100jt "ambil tunai", Rp 20jt "pinjam SP ZULFAN" — semuanya dicatat sebagai `biaya_operasional`) menggelembungkan beban SHU sebesar Rp 620jt dan menekan SHU Bersih ke Rp 0 (seharusnya +Rp 59jt). Kasus ini baru terdeteksi setelah dianalisis manual.

Fitur pencegahan (`detectCategoryMismatch` di gerbang API) sudah mencegah anomali serupa di masa depan. Namun **tidak ada cara untuk menangkap anomali yang SUDAH ada di database** — terutama yang mendistorsi Laporan SHU & Neraca. Pengurus butuh alat untuk menelusuri dan memprioritaskan koreksi.

## 2. Tujuan

Memberi operator/pengurus **satu halaman** yang otomatis memindai transaksi & akun, menampilkan anomali kualitas data yang **mendistorsi laporan keuangan**, lengkap dengan **estimasi dampak ke SHU** agar koreksi bisa diprioritaskan.

## 3. Non-goals (di luar scope v1)

- Deteksi member-outlier / kontribusi pencilan (fase 2)
- Deteksi void-reversal yatim / phantom income (fase 2)
- Deteksi transaksi unit tanpa memberId (fase 2)
- Scheduled/cron monitoring (v1 = on-demand)
- Blocking input (sudah ditangani fitur pencegahan terpisah)
- ML / anomaly scoring probabilistik

## 4. Strategi deteksi

**Hybrid: rule-based + statistik sederhana.**
- Rule-based untuk pola dikenal (D1, D2, D4, D5) — transparan, bisa dijelaskan ke pengurus.
- Statistik sederhana (median) untuk amount outlier (D3).
- Bukan murni z-score/IQR (noisy, sulit dijelaskan), bukan ML (overkill, tidak auditable).

## 5. Detector (5 buah)

Setiap detector mengembalikan nol atau lebih `Anomaly`. Threshold konfigurable (lihat §6).

### D1 — Salah kategori expense (HIGH)
- **Trigger:** `type="out"` AND `category ∈ {biaya_operasional, beban_unit, hpp_toko, hutang_mitra}` AND `detectCategoryMismatch(type, category, description) ≠ null`.
- **estimatedShuImpact:** `= amount` (karena kategori expense ini TIDAK ada di `NON_EXPENSE_CATEGORIES` shu-calculator, seluruh nominal terhitung sebagai beban fiktif).
- **impactDirection:** `inflates_beban`.
- **suggestedAction:** `"Reklassifikasi ke {suggestedCategory}"` (memakai saran dari `detectCategoryMismatch`).
- **Reuse:** pure function `detectCategoryMismatch` dari `src/lib/services/cash-bank-category-guard.ts` — zero duplikasi.

### D2 — Saldo akun kas/bank negatif (HIGH)
- **Trigger:** `CashBankAccount.currentBalance < 0`.
- **Scope:** semua akun (bukan per-periode — saldo adalah snapshot terkini).
- **estimatedShuImpact:** `0` (distorsi Neraca, bukan baris beban SHU langsung).
- **impactDirection:** `distorts_neraca`.
- **suggestedAction:** `"Audit transaksi akun ini; saldo negatif = error/pencatatan ganda"`.
- **Konteks:** BRI balance pernah terkorupsi ke −Rp 5,9M (lihat memori `feedback-no-import-in-cashbook`).

### D3 — Transaksi amount outlier (MEDIUM)
- **Trigger:** `amount >= OUTLIER_FLOOR (Rp 50jt)` **ATAU** `amount > 10 × periodMedianAmount`.
- **periodMedianAmount:** median `amount` semua CashBankTransaction dalam periode (type in & out, di-cache, dihitung sekali per scan).
- **estimatedShuImpact:** `0` (ditandai untuk review manual — bisa legit seperti transfer Rp 500jt, atau error).
- **impactDirection:** `none`.
- **suggestedAction:** `"Review manual — nilai jauh di atas transaksi tipikal"`.
- **Pure helper:** `isOutlier(amount, median) → boolean` (unit-testable).

### D4 — Kategori tak terdaftar (MEDIUM)
- **Trigger:** `category IS NULL` **ATAU** `category ∉ KNOWN_CATEGORIES`.
- **KNOWN_CATEGORIES:** himpunan key `CASH_BANK_CATEGORIES` dari `src/lib/constants/index.ts`.
- **estimatedShuImpact:** `0` (sinyal konsistensi data — dampak SHU tidak pasti). Catatan teknis: di SQL `NULL NOT IN (...)` mengevaluasi ke NULL sehingga baris kategori-null justru **di-exclude** dari query beban kalkulator SHU; kategori tak dikenal non-null (mis. `operational`) perilakunya bergantung nilai spesifik. Karena tidak dapat diverifikasi generik, dampak di-set 0 (konservatif) — tujuannya mendorong review/normalisasi kategori, bukan mengklaim distorsi nominal.
- **impactDirection:** `none`.
- **suggestedAction:** `"Tetapkan kategori yang valid"`.
- **Pure helper:** `isKnownCategory(category) → boolean`.
- **Catatan:** kategori legacy `operational` akan ter-flag (memang tidak ada di enum Zod) — ini disengaja untuk konsistensi data.

### D5 — Transaksi besar belum dijurnal (LOW)
- **Trigger:** `type="out"` AND `amount >= UNJOURNALED_FLOOR (Rp 25jt)` AND `journalId IS NULL`.
- **estimatedShuImpact:** `0` (gap akuntansi; transaksi tetap terhitung di SHU via CB merge, tapi tidak masuk jurnal formal).
- **impactDirection:** `none`.
- **suggestedAction:** `"Verifikasi apakah perlu dijurnal"`.

### Urutan & deduplikasi
- Detectors dijalankan berurutan D1→D5. Satu transaksi bisa muncul di beberapa detector (mis. D1+D3) — **itu disengaja** (sudut pandang berbeda), bukan di-dedup. `Anomaly.id` unik per (detector + entityId) mencegah duplikat dalam detector yang sama.

## 6. Konstanta konfigurable (default)

```
OUTLIER_FLOOR        = 50_000_000   // D3 nominal mutlak
OUTLIER_MEDIAN_MULT  = 10           // D3 kelipatan median
UNJOURNALED_FLOOR    = 25_000_000   // D5
```
Didefinisikan sebagai konstanta top-level di `anomaly-detector.ts`. Bisa dinaikkan ke `SystemSetting` di fase 2 bila perlu UI konfigurasi.

## 7. Tipe data

```typescript
// src/lib/services/anomaly-detector.ts
export type DetectorId = "D1" | "D2" | "D3" | "D4" | "D5";
export type Severity = "high" | "medium" | "low";
export type ImpactDirection =
  | "inflates_beban" | "inflates_income"
  | "distorts_neraca" | "none";

export interface Anomaly {
  id: string;                  // hash stabil: `${detector}-${entityType}-${entityId}`
  detector: DetectorId;
  severity: Severity;
  title: string;               // ringkas, mis. "Salah kategori: transfer dicatat biaya operasional"
  description: string;         // detail naratif
  entityType: "cashbank_tx" | "cashbank_account";
  entityId: number;            // untuk link drill-down
  entityLabel: string;         // mis. "CBK-2026-42104 • Rp 500.000.000 • 2026-04-29"
  amount: number;              // nominal terkait (saldo untuk D2)
  estimatedShuImpact: number;  // Rp distorsi SHU (0 bila N/A)
  impactDirection: ImpactDirection;
  suggestedAction: string;
}

export interface AnomalyScanResult {
  anomalies: Anomaly[];
  summary: {
    total: number;
    bySeverity: Record<Severity, number>;
    totalShuImpact: number;     // Σ estimatedShuImpact
    period: { year: number; month: number | null };
    scannedAt: string;          // ISO timestamp
  };
}
```

## 8. Arsitektur & data flow

```
anomaly-detector.ts (PURE ENGINE)
  ├─ detectD1 miscategorizedExpense(prisma, period) → Anomaly[]
  ├─ detectD2 negativeAccountBalance(prisma)        → Anomaly[]
  ├─ detectD3 amountOutlier(prisma, period, median) → Anomaly[]
  ├─ detectD4 unknownCategory(prisma, period)       → Anomaly[]
  ├─ detectD5 largeUnjournaled(prisma, period)      → Anomaly[]
  ├─ isKnownCategory(cat) [pure]
  ├─ isOutlier(amount, median) [pure]
  └─ scanAnomalies(prisma, year, month?) → AnomalyScanResult   // orchestrator
        │
        ▼
api/reports/anomali/route.ts
  GET ?year=&month= → auth(operator) → scanAnomalies() → JSON
        │
        ▼
(laporan/anomali)/page.tsx (UI)  ← fetch via TanStack Query
```

- **Orchestrator** `scanAnomalies` menjalankan kelima detector, masing-masing dibungkus try-catch: jika satu detector melempar, ia di-skip (return `[]` untuk detector itu + log error), detector lain tetap jalan. Hasil digabung + diurutkan (HIGH → MED → LOW, lalu amount desc).
- **Median caching:** `periodMedianAmount` dihitung sekali di orchestrator, diteruskan ke D3.

## 9. API contract

**`GET /api/reports/anomali?year=2026&month=6`** (month opsional; null = setahun penuh)

- **Auth:** `operator` (manage_all) saja. 401 bila bukan operator.
- **Response 200:**
  ```json
  { "data": { "anomalies": [...], "summary": { "total": 8, "bySeverity": {"high":2,"medium":4,"low":2}, "totalShuImpact": 620000000, "period": {"year":2026,"month":null}, "scannedAt": "..." } } }
  ```
- **Response 401:** `{ "message": "Unauthorized" }`
- **Response 500:** `{ "message": "Failed to scan anomalies" }` (+ `console.error`)

## 10. UI `/laporan/anomali` (operator-only)

- **Akses:** sidebar → Laporan → "Deteksi Anomali" (operator-only). Update `src/lib/constants/navigation.ts` + route guard `src/app/(protected)/layout.tsx`.
- **Period selector:** tahun (dropdown) + bulan (opsional, "Semua bulan") — pola sama dengan `/laporan/shu`.
- **Summary cards:** Total anomali · 🔴 HIGH · 🟠 MEDIUM · 🟡 LOW · **💰 Estimasi dampak SHU (Rp)**.
- **List anomali:** di-group per severity. Tiap baris:
  - badge severity (warna) + tag detector (D1–D5)
  - judul + entity (klik → drill-down: link ke detail transaksi Kas/Bank atau akun)
  - amount · 💰 dampak SHU (bila > 0) · saran aksi
- **Filter:** severity + detector (dropdown).
- **Empty state:** "Tidak ada anomali terdeteksi untuk periode ini 🎉".
- **Behavior:** auto-fetch saat buka / ganti periode (TanStack Query). Tombol "Pindai ulang" (invalidate + refetch). Tidak ada penulisan data — read-only murni.

## 11. Testing strategy

**TDD untuk pure helper** (`src/__tests__/anomaly-detector.test.ts`):
- `isKnownCategory`: kategori enum valid → true; `operational`, `null`, typo → false.
- `isOutlier`: di bawah floor & < 10× median → false; di atas floor ATAU > 10× median → true.
- `estimatedShuImpact` mapping: D1 = amount; D2/D3/D4/D5 = 0 (lihat justifikasi §5).
- `Anomaly.id` stabilitas: input sama → id sama.
- **D1** sudah tertutup test `detectCategoryMismatch` yang ada — tidak diulang.

**DB-coupled detector** (D2/D3/D5) + API + UI: diverifikasi via halaman live `primkoppol.site` memakai Playwright setelah deploy (scan jalan, anomali muncul, drill-down bekerja, 401 tanpa login).

## 12. File yang dibuat / diubah

| Aksi | File |
|------|------|
| NEW | `src/lib/services/anomaly-detector.ts` |
| NEW | `src/app/api/reports/anomali/route.ts` |
| NEW | `src/app/(protected)/laporan/anomali/page.tsx` |
| NEW | `src/__tests__/anomaly-detector.test.ts` |
| MOD | `src/lib/constants/navigation.ts` (menu "Deteksi Anomali" operator-only) |
| MOD | `src/app/(protected)/layout.tsx` (route guard, jika perlu) |

## 13. Pertimbangan performa

- Detector memakai query terarget: `groupBy`, `findMany` dengan filter `type`/`category`/`journalId`/`amount`, `aggregate` untuk median. Bukan full-table scan.
- Volume data saat ini: ribuan CashBankTransaction/tahun — aman.
- Median dihitung sekali per scan (satu `aggregate`).

## 14. Keputusan default yang sudah diambil

- **Trigger:** on-demand (auto-fetch di halaman), bukan cron — hasil selalu mutakhir, tanpa infra background.
- **Lokasi:** `/laporan/anomali` di bawah Laporan (operator-only).
- **Threshold:** pakai default §6 (konstanta top-level, belum UI config — fase 2 bila perlu).
- **Dampak SHU:** estimasi sederhana (nominal amount), bukan simulasi ulang `calculateSystemSHU` — cukup untuk prioritisasi, murah dihitung.

## 15. Roadmap fase 2 (bukan scope ini)

- Detector member-outlier kontribusi (kekhawatiran atasan "SHU kebesaran").
- Detector void-reversal yatim / phantom income.
- Detector transaksi unit tanpa memberId.
- Threshold configurable via UI (`SystemSetting`).
- Scheduled scan harian + notifikasi.
