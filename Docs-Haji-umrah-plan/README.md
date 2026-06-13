# Haji & Umrah — Planning & Implementation Docs

> **Branch:** `railway-migration` | **Status:** Phase 1, 2B, 3, 4 COMPLETE | Phase 5 Pending
> **Design Spec:** `2026-06-10-haji-umrah-savings-only-design.md`

---

## Phase Completion Status

| # | Phase | Status | Commits | Tested |
|---|-------|--------|---------|--------|
| 1A | Data Layer (Schema + Migration + Seed) | ✅ **DONE** | `0eac197` | ✅ Prisma validate + db push |
| 1B | API Layer (6 endpoints) | ✅ **DONE** | `3c60a39` | ✅ E2E 20/20 |
| 1C | UI Layer (7 pages + layout) | ✅ **DONE** | `521bd17` | ✅ E2E 20/20 |
| 1D | Integration (Constants + Nav + Billing + Zod) | ✅ **DONE** | `7de4647` | ✅ E2E 20/20 |
| 1E | Security Fix + Bug Fix | ✅ **DONE** | `4febb77`, `15004ea` | ✅ E2E re-pass |
| 2A | Seed Products + Live E2E Test | ✅ **DONE** | `4baca42`, `a786521` | ✅ 20/20 Playwright |
| 2B | Talangan Haji/Umrah | ✅ **DONE** | See below | ✅ 14 E2E tests |
| 3 | Member Portal | ✅ **DONE** | See below | ✅ 7 E2E tests |
| 4 | Spread Bagi Hasil | ✅ **DONE** | See below | ✅ 8 E2E tests |
| 5 | Mobile App Integration | 🔲 Pending | — | — |

---

## Execution Order

| # | Document | Scope | Files |
|---|----------|-------|-------|
| 0 | `haji-umrah-planning.md` | Overview & business context | — |
| 0 | `2026-06-10-haji-umrah-savings-only-design.md` | Design spec (approved) | — |
| 1 | `2026-06-10-haji-umrah-1-data-layer.md` | Schema (8 fields) + migration + seed | 3 files |
| 2 | `2026-06-10-haji-umrah-2-api-layer.md` | 6 API endpoints | 6 files |
| 3 | `2026-06-10-haji-umrah-3-ui-layer.md` | 7 pages + layout | 8 files |
| 4 | `2026-06-10-haji-umrah-4-integration.md` | Constants + nav + billing + Zod | 7 files |

---

## Implementation Summary — 11 Juni 2026

### Commits (Phase 1 Complete)

| Commit | Message | Files |
|--------|---------|-------|
| `0eac197` | Phase 1A — data layer (schema + migration + seed) | 3 files, +50 lines |
| `3c60a39` | Phase 1B — API layer (6 endpoints) | 6 files, +867 lines |
| `521bd17` | Phase 1C — UI layer (7 pages + layout) | 7 files, +1527 lines |
| `7de4647` | Phase 1D — integration (constants + nav + billing + Zod) | 10 files, +171 lines |
| `4febb77` | Security: crypto.randomBytes for tx numbers | 2 files |
| `15004ea` | Bug fix: reports aggregate query + E2E tests | 2 files, +94 lines |
| `4baca42` | Full E2E flow test (12 steps, all passing) | 1 file, +288 lines |
| `a786521` | Lint fix: tabungan listing page | 1 file |

**Total: 26 files created/modified, ~2,900 lines added**

### Live Data Verified (via Prisma + Playwright)

```
Products:
  TH: Tabungan Haji | target: Rp 50.000.000 | fee: percent:0.5% | bank: BSI
  TU: Tabungan Umrah | target: Rp 25.000.000 | fee: percent:0.5% | bank: BSI

Account:
  HU-776-10-1715 | A'AN ANDRIONO | Tabungan Haji
  Saldo: Rp 1.000.000 | Target: Rp 50.000.000 | Progress: 2.0%

Admin Fee Revenue:
  Total: Rp 5.000 (2 transactions, 0.5% × Rp 500.000 × 2 deposits)
```

### Test Results

| Test Suite | Result |
|------------|--------|
| `next build` | ✅ Compiled successfully, 303/303 pages |
| ESLint (haji-umrah files) | ✅ 0 errors, 0 warnings |
| Vitest (unit tests) | ✅ 275/278 pass (3 pre-existing failures, 0 regression) |
| Playwright E2E (basic) | ✅ 8/8 pass |
| Playwright E2E (full flow) | ✅ 12/12 pass |
| **Total Playwright** | **✅ 20/20 pass** |

### Testing Accounts

| Email | Password | Role | Use |
|-------|----------|------|-----|
| `operator@koperasi.com` | `password123` | operator | Full access — sidebar "HAJI & UMRAH" visible |

---

## Remaining Phases

### Phase 2B: Talangan Haji/Umrah ✅ COMPLETE (13 Juni 2026)
- **Design:** Hybrid approach — reuse Loan infra 90% + H&U wrapper API + gap-aware UX
- **Data Layer:** +3 schema fields (LoanProduct.type, LoanApplication/Loan.linkedSavingsAccountId), 0 new models, +2 seed products (TLH, TLU)
- **API Layer:** 5 wrapper endpoints + talangan report type + Zod validation
- **UI Layer:** 3 pages (list+gap overview, multi-step apply form, detail+schedules) + dashboard update
- **Integration:** Navigation menu (admin + main), disburse route fix, 14 E2E tests
- **Design Spec:** `2026-06-12-talangan-haji-umrah-design.md`

### Phase 3: Member Portal ✅ COMPLETE (13 Juni 2026)
- **Design:** Dedicated view-only page (anggota lihat tabungan sendiri) — tidak ada endpoint admin yang di-reuse (RBAC berbeda: member-scoped via `session.user.memberId`)
- **Data Layer:** Extend `/api/member-portal/summary` selects — `product.targetAmount`/`linkedBankName` + account `targetAmount`/`monthlyTarget`/`maturityDate` (additive, non-breaking)
- **API Layer:** New `GET /api/member-portal/haji-umrah` — scoped to logged-in member, returns accounts + progress + deposit history + active talangan per account + summary stats
- **UI Layer:** New `/portal/haji-umrah` page (summary gradient card, per-account progress tracker, maturity countdown, collapsible deposit history, linked talangan block, empty state) + nav link + simpanan filter (H&U excluded from simpanan cards, pointer banner)
- **Integration:** `memberPortalApi.hajiUmrah()` client method, portal nav entry (Landmark icon)
- **Testing:** 7/7 E2E pass with real member data (balance=4.8M/50M, progress=10%, talangan=yes). Operator correctly blocked (memberId=null → 401). 34/34 existing H&U tests — no regression.
- **Test member:** `87011378@koperasi.local` / `87011378` (A'AN ANDRIONO, member_id 776, owns HU-776-10-1715)

### Phase 4: Spread Bagi Hasil ✅ COMPLETE (13 Juni 2026)
- **Design:** `2026-06-13-spread-bagi-hasil-design.md` — 2 new models (BagiHasilDistribution + BagiHasilItem), plain-Int cross-model FKs (immutable snapshots, 0 edits to existing models)
- **Data Layer:** +2 models, idempotent table migration, 2 Zod schemas (createBagiHasil, voidBagiHasil)
- **API Layer:** 3 endpoints — `GET/POST /api/haji-umrah/bagi-hasil` (list + dryRun preview + atomic process), `GET .../[id]` (detail+items), `POST .../[id]/void` (operator-only reversal)
- **Algorithm:** admin inputs total BSI `X` + member rate `R%` → pool = X×R% distributed proportionally to H&U balances (last item absorbs rounding), spread = X−pool → CashBook income. Spread uses **distinct category `bagi_hasil`** (NOT `pendapatan_unit`) to avoid polluting the existing admin_fee report.
- **UI Layer:** `/haji-umrah/bagi-hasil` (form + live preview + history table) + `/[id]` (detail items + void action). Nav menu added (Percent icon).
- **Member visibility:** bagi hasil auto-appears in `/portal/haji-umrah` (Phase 3 already labels SavingsTransaction `interest` → "Bagi Hasil"). Zero portal work.
- **Testing:** 8/8 E2E pass incl. real balance verification (5,300,000 → +7,000 credit → restored after void). 37/37 existing H&U tests — no regression. Build passes.
- **Safety:** all changes additive; commit-only (no push); tables created via idempotent migrate; admin_fee report untouched.

### Phase 5: Mobile App Integration (~3-5 hari)
- Mobile API endpoints `/api/mobile/haji-umrah/*`
- Mobile screens: tabungan, detail, setoran di Expo
- Push notification saat target mendekati/tercapai

---

## Known Issues & Technical Notes

| Item | Status | Detail |
|------|--------|--------|
| Produk edit (PUT) belum pakai Zod schema | Low priority | Inline validation works, bisa upgrade ke `updateHajiUmrahProductSchema` |
| Kwitansi print pakai `document.write` | Acceptable | Pola thermal yang konsisten dengan codebase existing |
| Setoran tanpa CashBankAccountId | Expected | Tidak posting ke CashBook jika tidak pilih akun kas — perlu warning UI |
| `Math.random` → `crypto.randomBytes` | ✅ Fixed | Transaction numbers sekarang 9-digit cryptographically secure |
| Formula injection Excel export | ✅ Fixed | Sanitasi leading `=+@-` characters |

---

## How to Resume

Jika session terputus karena window limit, buka folder ini dan baca plan sesuai urutan.

### Quick Check: Apa yang sudah selesai?

```bash
# Cek schema fields
npx prisma validate

# Cek API routes
ls src/app/api/haji-umrah/

# Cek UI pages
ls src/app/(protected)/haji-umrah/

# Cek constants
grep "haji_umrah" src/lib/constants/units.ts
grep "tabungan_haji" src/lib/constants/index.ts

# Run E2E tests
npx playwright test e2e/haji-umrah-full.spec.ts --reporter=line
```

---

*Diperbarui: 11 Juni 2026 | Status: Phase 1 COMPLETE — 20/20 E2E tests passing*
