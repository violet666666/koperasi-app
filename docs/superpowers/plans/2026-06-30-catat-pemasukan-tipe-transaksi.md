# "Catat Pemasukan" Bertipe + Fix SHU Per-Unit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Form "Catat Pemasukan" mendapat "Jenis Pemasukan" (Transaksi Customer / Operasional); "Transaksi Customer" create `UnitTransaction` (+ CB `pendapatan_unit`) agar masuk riwayat + SHU per-unit + jasa anggota; dan re-include CB income non-mirror ke `unitBreakdown` (fix regresi Task 5).

**Architecture:** Pure helper `resolveIncomeMode()` (teruji unit-test) → dipakai route `/api/unit/[slug]/operational-income` utk branch (customer=UT+CB mirror ala `unit-layanan/sales`; operasional=CB operational). Fix `shu-calculator.ts` tambah query CB income non-mirror + merge ke `unitRevenueMap`. Form tambah field Jenis + Anggota opsional (reuse pola member-picker kasir).

**Tech Stack:** Next.js 16 / React 19 / Prisma 6 / Vitest.

## Global Constraints

- **Branch `railway-migration` AUTO-DEPLOY ke prod.** Task 1 (SHU fix) mengubah angka SHU per-unit produksi (operational income kembali muncul). Jalankan diagnostic vs prod LOKAL sebelum commit. Konfirmasi user sebelum push.
- **Filter void StoreSale:** JANGAN pakai `NOT: { metadata: { path: ["isVoided"], equals: true } }` di Prisma (JSON NULL bug). (Tidak relevan di task ini kecuali menyentuh query StoreSale — task ini utamanya sentuh CB & UT.)
- **Mirror POS categories** = `pendapatan_unit`, `pendapatan_toko`. Kategori ini di-exclude dr `unitBreakdown` revenue (sudah terwakili via StoreSale/UnitTransaction).
- **"Transaksi Customer" WAJIB create `UnitTransaction`** (bukan hanya CB) — itulah yg membuatnya masuk riwayat + SHU per-unit + jasa anggota. `memberId` opsional (walk-in boleh null).
- **`@/` alias** utk `src/`. TDD: RED→GREEN. `npx vitest run <path>`.
- **Pre-existing failing tests (BUKAN regresi):** `split-bill`, `batch-navigation`, `floor-plan`, `queue-system`.
- **Spec:** `docs/superpowers/specs/2026-06-30-catat-pemasukan-tipe-transaksi-design.md`.
- **Reference file utk pola UT+CB:** `src/app/api/unit-layanan/sales/route.ts` (generateTxNo baris 27-40, create UT baris 149-163, create CB pendapatan_unit baris 178-193). **Reference member-picker:** `src/app/(protected)/unit/[unitSlug]/kasir/page.tsx` (state `selectedMember` + lookup anggota).

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `src/lib/services/operational-income-helpers.ts` (NEW) | Pure helper `resolveIncomeMode(jenis, memberId)` + types. |
| `src/__tests__/operational-income-helpers.test.ts` (NEW) | Unit-test `resolveIncomeMode`. |
| `src/lib/services/shu-calculator.ts` (MODIFY) | `unitBreakdown`: tambah query CB income non-mirror + merge. |
| `src/app/api/unit/[slug]/operational-income/route.ts` (MODIFY) | Branch `jenis`: customer → UT+CB pendapatan_unit; operasional → current. |
| `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx` (MODIFY) | Dialog income: field Jenis + Anggota opsional. |
| `scripts/diagnose-shu-unit-revenue-duplikasi.ts` (EXISTS) | Verifikasi before/after SHU fix. |

---

## Task 1: Fix SHU `unitBreakdown` — re-include CB income non-mirror

**Files:**
- Modify: `src/lib/services/shu-calculator.ts` (section `unitBreakdown`, ~baris 430-545)
- Verify: `scripts/diagnose-shu-unit-revenue-duplikasi.ts`

**Interfaces:**
- Produces: `unitBreakdown[*].revenue` kini mencakup CB income non-mirror (kategori `operational`, `jasa_pinjaman`, `dana_resiko`, `penalti_pelunasan`, dll) — selain mirror POS.

**Catatan:** Task ini memperbaiki regresi dari fix sebelumnya (`af1ae28` yg menghapus SEMUA CB income). Verifikasi via diagnostic (kalkulator DB-coupled, tidak di-unit-test — pola repo).

- [ ] **Step 1: Tambah konstanta MIRROR_INCOME_CATEGORIES**

Di `src/lib/services/shu-calculator.ts`, dekat konstanta `VOID_CATEGORIES` (atas file, ~baris 35), tambahkan:
```ts
// Kategori CB income yg adalah MIRROR dari StoreSale/UnitTransaction (sudah terwakili di revenue).
// Harus di-exclude dari unitBreakdown revenue supaya tidak dobel-hitung.
const MIRROR_INCOME_CATEGORIES = ["pendapatan_unit", "pendapatan_toko"];
```

- [ ] **Step 2: Tambah query non-mirror income ke Promise.all**

Temukan blok `const [storeSalesRaw, unitTxByUnit, expenseByUnit, unitTxByMethod] = await Promise.all([ ... ]);` (~baris 430). Tambahkan elemen ke-5 (query CB income non-mirror) DAN ubah destructuring. Hasil akhir Promise.all menjadi 5 elemen:
```ts
    const [storeSalesRaw, unitTxByUnit, expenseByUnit, unitTxByMethod, nonMirrorIncomeByUnit] = await Promise.all([
        prisma.storeSale.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            select: { unitType: true, totalAmount: true, paymentMethod: true, metadata: true },
        }),
        prisma.unitTransaction.groupBy({
            by: ['unitType'],
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed" },
            _sum: { amount: true }, _count: true,
        }),
        prisma.cashBankTransaction.groupBy({
            by: ['unitType'],
            where: { transactionDate: { gte: startDate, lte: endDate }, type: "out", category: { notIn: NON_EXPENSE_CATEGORIES } },
            _sum: { amount: true }, _count: true,
        }),
        prisma.unitTransaction.groupBy({
            by: ['unitType', 'paymentMethod'],
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed" },
            _sum: { amount: true }, _count: true,
        }),
        // CB income NON-MIRROR (operational, jasa_pinjaman, dana_resiko, dll) — masuk revenue per unit.
        // EXCLUDE mirror POS + NON_INCOME + VOID supaya tidak dobel dgn StoreSale/UnitTransaction.
        prisma.cashBankTransaction.groupBy({
            by: ['unitType'],
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "in",
                journalId: null,
                category: { notIn: [...NON_INCOME_CATEGORIES, ...VOID_CATEGORIES, ...MIRROR_INCOME_CATEGORIES] },
            },
            _sum: { amount: true }, _count: true,
        }),
    ]);
```

- [ ] **Step 3: Merge nonMirrorIncomeByUnit ke unitRevenueMap**

Temukan blok revenue merge (komentar `// Revenue per unit: StoreSale ... + UnitTransaction ...`). Setelah loop `unitTxByUnit` (sebelum comment penutup), tambahkan merge:
```ts
    // Merge CB income NON-MIRROR per canonical unit (operational dll — restore fix Task 5 yg terlalu radikal).
    // Mirror POS (pendapatan_unit/pendapatan_toko) sengaja di-exclude (sudah via StoreSale/UT di atas).
    for (const i of nonMirrorIncomeByUnit) {
        const ut = i.unitType || "_operasional";
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
        unitRevenueMap[ut].revenue += toNum(i._sum.amount);
        unitRevenueMap[ut].txCount += i._count;
    }
```

- [ ] **Step 4: tsc + test no regressions**

Run: `npx tsc --noEmit`
Expected: no new errors in shu-calculator.ts (4 pre-existing di `api/mobile/toko/shifts` + `prisma/seed-*` diabaikan).

Run: `npm run test`
Expected: pass selain pre-existing (split-bill, batch-navigation, floor-plan, queue-system).

- [ ] **Step 5: Diagnostic before/after vs prod**

Run: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-unit-revenue-duplikasi.ts`
Expected: Section [A] kini menunjukkan CB-income non-mirror (operational) terhitung; mirror (pendapatan_unit/pendapatan_toko) tetap tidak dobel. (Catatan: diagnostic ini mengukur sumber data; konfirmasi angka `unitBreakdown` aktual via Task 5 manual/API.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/shu-calculator.ts
git commit -m "fix(shu): re-include non-mirror CB income in unitBreakdown (restore operational)"
```

---

## Task 2: Pure helper `resolveIncomeMode`

**Files:**
- Create: `src/lib/services/operational-income-helpers.ts`
- Test: `src/__tests__/operational-income-helpers.test.ts`

**Interfaces:**
- Produces: `resolveIncomeMode(jenis: string | null | undefined, memberId: number | string | null | undefined): IncomeMode` where `IncomeMode = { createsUnitTransaction: boolean; cbCategory: "operational" | "pendapatan_unit"; memberId: number | null }`.

- [ ] **Step 1: Write the failing test**

Buat `src/__tests__/operational-income-helpers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveIncomeMode } from "@/lib/services/operational-income-helpers";

describe("resolveIncomeMode", () => {
  it("jenis 'customer' → create UT + cbCategory pendapatan_unit", () => {
    const m = resolveIncomeMode("customer", null);
    expect(m.createsUnitTransaction).toBe(true);
    expect(m.cbCategory).toBe("pendapatan_unit");
    expect(m.memberId).toBeNull();
  });
  it("jenis 'customer' + memberId → memberId diparse ke number", () => {
    expect(resolveIncomeMode("customer", "123").memberId).toBe(123);
    expect(resolveIncomeMode("customer", 456).memberId).toBe(456);
  });
  it("jenis 'operasional' → tidak create UT, cbCategory operational, memberId null", () => {
    const m = resolveIncomeMode("operasional", "123");
    expect(m.createsUnitTransaction).toBe(false);
    expect(m.cbCategory).toBe("operational");
    expect(m.memberId).toBeNull();
  });
  it("default (undefined/null/invalid) → operasional", () => {
    expect(resolveIncomeMode(undefined, null).createsUnitTransaction).toBe(false);
    expect(resolveIncomeMode(null, null).cbCategory).toBe("operational");
    expect(resolveIncomeMode("hacked", null).cbCategory).toBe("operational");
    expect(resolveIncomeMode("", null).cbCategory).toBe("operational");
  });
  it("memberId invalid (NaN) → null", () => {
    expect(resolveIncomeMode("customer", "abc").memberId).toBeNull();
    expect(resolveIncomeMode("customer", NaN).memberId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/operational-income-helpers.test.ts`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 3: Write minimal implementation**

Buat `src/lib/services/operational-income-helpers.ts`:
```ts
export type IncomeJenis = "operasional" | "customer";

export interface IncomeMode {
  createsUnitTransaction: boolean;
  cbCategory: "operational" | "pendapatan_unit";
  memberId: number | null;
}

/**
 * Tentukan mode penulisan income berdasar jenis input form "Catat Pemasukan".
 * - "customer": create UnitTransaction (+ CB pendapatan_unit mirror) → flow ke riwayat + SHU per-unit + jasa anggota.
 * - "operasional" (default): CB operational saja (sewa/dll).
 */
export function resolveIncomeMode(
  jenis: string | null | undefined,
  memberId: number | string | null | undefined,
): IncomeMode {
  if (jenis === "customer") {
    const n = Number(memberId);
    return {
      createsUnitTransaction: true,
      cbCategory: "pendapatan_unit",
      memberId: memberId !== null && memberId !== undefined && !Number.isNaN(n) ? n : null,
    };
  }
  return { createsUnitTransaction: false, cbCategory: "operational", memberId: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/operational-income-helpers.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/operational-income-helpers.ts src/__tests__/operational-income-helpers.test.ts
git commit -m "feat(income): add resolveIncomeMode pure helper for Catat Pemasukan jenis"
```

---

## Task 3: API branch — operational-income route (Transaksi Customer → UT+CB)

**Files:**
- Modify: `src/app/api/unit/[slug]/operational-income/route.ts`

**Interfaces:**
- Consumes: `resolveIncomeMode` dari Task 2; `findUnitAccount` dari `@/lib/cash-bank`; pola generateTxNo + create UT/CB dari `src/app/api/unit-layanan/sales/route.ts`.
- Produces: POST menerima field tambahan `jenis` ("customer"|"operasional") + `memberId` (opsional). Customer → create `UnitTransaction` + (cash/qris) CB `pendapatan_unit` + increment kas. Operasional → current behavior.

- [ ] **Step 1: Tambah import + baca field jenis/memberId**

Di `src/app/api/unit/[slug]/operational-income/route.ts`:
- Tambah import atas file:
```ts
import { resolveIncomeMode } from "@/lib/services/operational-income-helpers";
```
- Tambah deklarasi variabel (se deklarasi `let amount` ~baris 44):
```ts
        let jenis: string = "operasional";
        let memberId: string | null = null;
```
- Di blok `multipart/form-data` (setelah `paymentMethod` di-parse, ~baris 58), tambahkan:
```ts
            const j = String(formData.get("jenis") || "operasional");
            if (j === "customer" || j === "operasional") jenis = j;
            memberId = (formData.get("memberId") as string | null) || null;
```
- Di blok `else` (JSON body, ~baris 94), tambahkan:
```ts
            jenis = body.jenis === "customer" ? "customer" : "operasional";
            memberId = body.memberId ?? null;
```

- [ ] **Step 2: Resolve mode + validasi memberId**

Setelah validasi `amount`/`description` (~baris 102), tambahkan:
```ts
        const mode = resolveIncomeMode(jenis, memberId);
        if (mode.memberId) {
            const memberExists = await prisma.member.findUnique({ where: { id: mode.memberId }, select: { id: true } });
            if (!memberExists) {
                return NextResponse.json({ message: "Anggota tidak ditemukan." }, { status: 404 });
            }
        }
```

- [ ] **Step 3: Branch — Transaksi Customer (create UT + CB pendapatan_unit)**

Ganti seluruh blok `const cashTx = await prisma.$transaction(async (tx) => { ... });` (~baris 120-151) dengan branch berikut. Untuk customer, reuse pola `unit-layanan/sales` (generate transactionNo, create UT, create CB pendapatan_unit + increment kas utk cash/qris):
```ts
        const result = await prisma.$transaction(async (tx) => {
            if (mode.createsUnitTransaction) {
                // === TRANSAKSI CUSTOMER: create UnitTransaction (+ CB pendapatan_unit utk cash/qris) ===
                const abbr = unitType.substring(0, 2).toUpperCase(); // sederhana; bisa pakai UNIT_ABBR_TX
                const d = txDate;
                const dd = String(d.getDate()).padStart(2, "0");
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const y = d.getFullYear();
                const startOfTxDay = new Date(y, d.getMonth(), d.getDate());
                const countToday = await tx.unitTransaction.count({
                    where: { unitType, transactionDate: { gte: startOfTxDay } },
                });
                const utNo = `${abbr}${dd}${mm}${y}${String(countToday + 1).padStart(4, "0")}`;
                const utNotes = receiptImagePath
                    ? `[Transaksi Customer - Catat Pemasukan]||RECEIPT:${receiptImagePath}`
                    : `[Transaksi Customer - Catat Pemasukan]`;

                const unitTx = await tx.unitTransaction.create({
                    data: {
                        transactionNo: utNo,
                        memberId: mode.memberId,
                        unitType,
                        description: description,
                        amount: nominalAmount,
                        transactionDate: txDate,
                        paymentMethod,
                        isPaid: true,
                        paidDate: txDate,
                        notes: utNotes,
                        createdById: currentUserId,
                    },
                });

                // Cash increment + CB pendapatan_unit (mirror ala unit-layanan/sales) — HANYA utk cash/qris.
                // "lainnya" = non-kas, tidak sentuh saldo kas.
                let cbTxNo: string | null = null;
                if (paymentMethod === "cash" || paymentMethod === "qris") {
                    const accountType = paymentMethod === "cash" ? "cash" : "bank";
                    const targetAccount = await findUnitAccount(tx, unitType, accountType);
                    if (targetAccount) {
                        const updatedAccount = await tx.cashBankAccount.update({
                            where: { id: targetAccount.id },
                            data: { currentBalance: { increment: nominalAmount } },
                        });
                        const balanceBefore = Number(updatedAccount.currentBalance) - nominalAmount;
                        const created = await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `UL-${paymentMethod === "cash" ? "KAS" : "BNK"}-${Date.now().toString(36).toUpperCase()}`,
                                accountId: targetAccount.id,
                                branchId,
                                type: "in",
                                category: "pendapatan_unit",
                                amount: nominalAmount,
                                balanceBefore,
                                balanceAfter: Number(updatedAccount.currentBalance),
                                unitType,
                                paymentMethod,
                                description: `Pendapatan ${unitType} ${paymentMethod === "cash" ? "Tunai" : "QRIS"} - ${utNo}`,
                                transactionDate: txDate,
                                createdById: currentUserId,
                            },
                        });
                        cbTxNo = created.transactionNo;
                    }
                }
                return { kind: "customer" as const, transactionNo: utNo, cbTxNo, amount: nominalAmount, memberId: mode.memberId };
            }

            // === PEMASUKAN OPERASIONAL (current behavior) ===
            const cashAccount = await findUnitAccount(tx, unitType, "cash");
            if (!cashAccount) throw new Error("Tidak ditemukan akun kas aktif untuk unit ini.");
            const updatedAccount = await tx.cashBankAccount.update({
                where: { id: cashAccount.id },
                data: { currentBalance: { increment: nominalAmount } },
            });
            const balanceBefore = Number(updatedAccount.currentBalance) - nominalAmount;
            const created = await tx.cashBankTransaction.create({
                data: {
                    transactionNo,
                    accountId: cashAccount.id,
                    branchId,
                    type: "in",
                    category: "operational",
                    amount: nominalAmount,
                    balanceBefore,
                    balanceAfter: Number(updatedAccount.currentBalance),
                    unitType,
                    paymentMethod,
                    description: descWithMeta,
                    transactionDate: txDate,
                    createdById: currentUserId,
                },
            });
            return { kind: "operasional" as const, transactionNo: created.transactionNo, cbTxNo: null, amount: nominalAmount, newBalance: Number(created.balanceAfter), memberId: null };
        });

        return NextResponse.json({
            message: result.kind === "customer"
                ? "Transaksi customer berhasil dicatat."
                : "Pemasukan operasional berhasil dicatat.",
            data: {
                transactionNo: result.transactionNo,
                amount: nominalAmount,
                newBalance: (result as any).newBalance,
                receiptImagePath,
                description,
                paymentMethod,
                jenis: result.kind,
                memberId: result.memberId,
            },
        }, { status: 201 });
```
(Pertahankan blok `catch` error 500 yang ada.)

- [ ] **Step 4: tsc + test**

Run: `npx tsc --noEmit`
Expected: no new errors in route.ts (hati-hati: variabel `transactionNo` & `descWithMeta` di-computed sebelum `$transaction` — pastikan tetap dipakai di branch operasional; branch customer pakai `utNo` sendiri).

Run: `npx vitest run src/__tests__/operational-income-helpers.test.ts`
Expected: PASS (regresi-check import).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/unit/[slug]/operational-income/route.ts
git commit -m "feat(income): Transaksi Customer creates UnitTransaction (+CB mirror) in operational-income"
```

---

## Task 4: Form UI — field Jenis + Anggota opsional

**Files:**
- Modify: `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx` (dialog income ~baris 2132-2249, handler `handleSaveIncome` ~baris 414, `OPS_PAYMENT_METHODS` ~baris 102)

**Interfaces:**
- Consumes: pola member-picker dari `src/app/(protected)/unit/[unitSlug]/kasir/page.tsx` (state `selectedMember` + lookup anggota).
- Produces: dialog mengirim `jenis` + `memberId` (opsional) saat submit.

**Catatan:** UI tidak di-unit-test (pola repo). Verifikasi via tsc + manual (Task 5).

- [ ] **Step 1: Tambah state jenis + selectedMember**

Di komponen, dekat state income lainnya (sekitar definisi `showIncomeDialog`), tambahkan:
```ts
    const [incomeJenis, setIncomeJenis] = useState<"operasional" | "customer">("operasional");
    const [incomeMemberId, setIncomeMemberId] = useState<number | null>(null);
```
(Jika `useState` belum di-import, import dari `react` — kemungkinan sudah.)

- [ ] **Step 2: Reset state saat dialog buka/tutup**

Di handler `handleOpenAddIncome` (yg set `showIncomeDialog=true`), tambahkan reset:
```ts
        setIncomeJenis("operasional");
        setIncomeMemberId(null);
```

- [ ] **Step 3: Tambah field Jenis + Anggota di dialog**

Di JSX dialog income (sebelum field "Nominal Pemasukan", ~baris 2149), tambahkan:
```tsx
                                {/* Jenis Pemasukan */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Jenis Pemasukan</label>
                                    <Select value={incomeJenis} onValueChange={(v) => setIncomeJenis(v as "operasional" | "customer")}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="operasional">Pemasukan Operasional (sewa/dll)</SelectItem>
                                            <SelectItem value="customer">Transaksi Customer (penjualan)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {incomeJenis === "customer" && (
                                        <p className="text-xs text-muted-foreground">
                                            Dicut sbg UnitTransaction → masuk riwayat transaksi + SHU per-unit + poin jasa anggota.
                                        </p>
                                    )}
                                </div>
                                {/* Anggota (opsional, hanya saat Transaksi Customer) */}
                                {incomeJenis === "customer" && (
                                    <MemberPickerField
                                        value={incomeMemberId}
                                        onChange={setIncomeMemberId}
                                    />
                                )}
```
Implement `MemberPickerField` dgn reuse pola member-picker dari `src/app/(protected)/unit/[unitSlug]/kasir/page.tsx` (baca file itu; tiru state `selectedMember` + search anggota via API members + tampilkan nama/NRP; izinkan kosong = walk-in). Bisa inline sbg komponen kecil di file ini atau import. Label: "Anggota (opsional — kosongkan jika walk-in)".

- [ ] **Step 4: Submit membawa jenis + memberId**

Di `handleSaveIncome` (~baris 414-435), tambahkan ke FormData sebelum POST:
```ts
        formData.set("jenis", incomeJenis);
        if (incomeJenis === "customer" && incomeMemberId) {
            formData.set("memberId", String(incomeMemberId));
        }
```

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit`
Expected: no new errors. (Jika `MemberPickerField` perlu adapter, pastikan typed.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/unit/[unitSlug]/laporan/page.tsx"
git commit -m "feat(income): add Jenis Pemasukan + optional member to Catat Pemasukan dialog"
```

---

## Task 5: Final verification

**Files:** — (verification)

- [ ] **Step 1: Full test + lint**

Run: `npm run test && npm run lint`
Expected: tests pass (kecuali pre-existing); lint no new errors in feature files.

- [ ] **Step 2: Diagnostic SHU fix (Task 1) vs prod**

Run: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-unit-revenue-duplikasi.ts`
Expected: operational income kembali terhitung; mirror tetap exclude.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success (317+ pages). Jika gagal hanya krn 4 pre-existing tsc errors, catat pre-existing.

- [ ] **Step 4: Manual verification (post-deploy) — UT/opsional via Playwright atau user**

Login operator di primkoppol.site → buka halaman Laporan unit (mis. cafe-lsp) → "Catat Pemasukan":
- Pilih "Transaksi Customer" + isi Anggota + nominal → simpan.
- Cek: (a) muncul di Riwayat Transaksi unit; (b) baris unit di SHU per-unit naik; (c) poin jasa anggota di SHU naik (cek via detail anggota atau distribusi SHU).
- Pilih "Pemasukan Operasional" → simpan → cek: muncul di SHU per-unit unit (via re-include fix); tidak di riwayat (sebagai UT).

- [ ] **Step 5: Update changelog + memory**

Append section ke `SHU-BUG-AND-UPDATE.md` (format: tanggal, fitur Catat Pemasukan bertipe, fix SHU re-include non-mirror, bukti). Update memori `shu-pendapatan-dobel-hitung-2026.md` (status: SHU per-unit regresi FIXED; sisa memberRatio/totalIncome/COGS masih open).

- [ ] **Step 6: Commit docs**

```bash
git add SHU-BUG-AND-UPDATE.md
git commit -m "docs(income): document Catat Pemasukan jenis + SHU non-mirror re-include"
```

---

## Self-Review (post-write)

**Spec coverage:**
- Spec §5.1 form Jenis + Anggota opsional → Task 4 ✓
- Spec §5.2 API branch (customer→UT+CB pendapatan_unit, operasional→current) → Task 3 ✓
- Spec §5.3 re-include non-mirror CB income → Task 1 ✓
- Spec §2 tujuan (memberId opsional walk-in) → Task 2 helper + Task 3/4 ✓
- Spec §7 testing → Task 2 (unit helper) + Task 1/5 (diagnostic) + Task 5 (manual) ✓
- Spec §12 open questions: transactionNo prefix reuse UNIT_ABBR (Task 3 pakai substring prefix — catatan: bisa ditingkatkan ke UNIT_ABBR_TX); "lainnya" customer = skip increment (Task 3); helper extraction (Task 2 helper `resolveIncomeMode`, sisanya inline). ✓

**Placeholder scan:** tidak ada TBD/TODO. Task 4 `MemberPickerField` mereferensi pola konkret di `unit/[unitSlug]/kasir/page.tsx` (reference file existing, bukan placeholder).

**Type consistency:**
- `IncomeMode` (Task 2) = `{ createsUnitTransaction, cbCategory: "operational"|"pendapatan_unit", memberId: number|null }` → dipakai Task 3 (`mode.createsUnitTransaction`, `mode.cbCategory` implisit via branch, `mode.memberId`). ✓
- `resolveIncomeMode(jenis, memberId)` signature konsisten Task 2 ↔ Task 3. ✓

**Catatan risiko:** Task 3 mengubah `$transaction` route existing — implementer harus hati-hati mempertahankan branch operasional (= current behavior) & error handling. Task 1 mengubah angka SHU prod (operational kembali) — diagnostic before/after wajib.
