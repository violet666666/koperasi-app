# Cafe LSP & Resto Sidebar Simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trim sidebar navigation for Cafe LSP (12→7 items) and Resto (12→10 items), change default `trackStock` to `false` for F&B units, and add HPP manual guidance in product forms.

**Architecture:** Edit navigation constants, API default values, and product form UX. No new files created — only modifications to existing files. Routes are hidden from sidebar but remain accessible via URL.

**Tech Stack:** Next.js (App Router), Prisma, TypeScript, shadcn/ui, Lucide icons

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/lib/constants/navigation.ts:1104-1179` | Trim `adminCafeLspNavigation` (remove 5 items) |
| Modify | `src/lib/constants/navigation.ts:604-683` | Trim `adminRestoNavigation` (remove 2 items) |
| Modify | `src/app/api/toko/products/route.ts:200,231` | Default `trackStock=false` for F&B units |
| Modify | `src/app/(protected)/toko/produk/tambah/page.tsx:269-271` | Add HPP tooltip text |
| Modify | `src/app/(protected)/toko/persediaan/page.tsx` | Add "Opname Stok" button (Cafe LSP only) |
| Modify | `docs/UNIT-CAFE-LSP.md` | Update feature table |
| Modify | `docs/UNIT-CAFE-RESTO.md` | Update feature table |

---

### Task 1: Trim `adminCafeLspNavigation` Sidebar (12 → 7 items)

**Files:**
- Modify: `src/lib/constants/navigation.ts:1104-1179`

- [ ] **Step 1: Replace `adminCafeLspNavigation` items array**

In `src/lib/constants/navigation.ts`, find `adminCafeLspNavigation` (around line 1104). Replace the entire `items` array inside the `CAFE & MENU` group with the 7 approved items. Remove: Order Queue, Bahan Baku, Manajemen Batch, Opname Stok.

The resulting `adminCafeLspNavigation` should be:

```typescript
export const adminCafeLspNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "CAFE & MENU",
        items: [
            {
                title: "Kasir POS", href: "/cafe-lsp/kasir", icon: Coffee,
                permission: "manage_unit_transactions",
            },
            {
                title: "Kitchen Display", href: "/cafe-lsp/kds", icon: Monitor,
                permission: "manage_unit_transactions",
            },
            {
                title: "Manajemen Menu", href: "/cafe-lsp/produk", icon: Package,
                permission: "manage_unit_transactions",
            },
            {
                title: "Promo & Diskon", href: "/cafe-lsp/marketing", icon: Tag,
                permission: "manage_unit_transactions",
            },
            {
                title: "Persediaan & Stok", href: "/cafe-lsp/persediaan", icon: Boxes,
                permission: "manage_unit_transactions",
            },
            {
                title: "Shift Kasir", href: "/cafe-lsp/shift", icon: Timer,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Penjualan", href: "/transaksi-unit/riwayat?unitType=cafe_lsp", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "LAPORAN & KEUANGAN",
        items: [
            {
                title: "Laporan Penjualan", href: "/unit/cafe-lsp/laporan", icon: BarChart2,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "PERSETUJUAN",
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: Bell,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];
```

- [ ] **Step 2: Verify navigation compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `navigation.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants/navigation.ts
git commit -m "refactor: trim Cafe LSP admin sidebar from 12 to 7 items

Remove Bahan Baku, Manajemen Batch, Opname Stok, Order Queue from
adminCafeLspNavigation sidebar. Routes remain accessible via direct URL."
```

---

### Task 2: Trim `adminRestoNavigation` Sidebar (12 → 10 items)

**Files:**
- Modify: `src/lib/constants/navigation.ts:604-683`

- [ ] **Step 1: Remove Bahan Baku and Manajemen Batch from `adminRestoNavigation`**

In `src/lib/constants/navigation.ts`, find `adminRestoNavigation` (around line 604). Remove only these two items from the `RESTO & MENU` items array:

1. The `{ title: "Bahan Baku", href: "/resto/bahan-baku", ... }` entry
2. The `{ title: "Manajemen Batch", href: "/resto/batch", ... }` entry

Keep all other items (Kasir POS, Manajemen Menu, Promo, Persediaan, Opname, Kitchen Display, Denah Meja, Modifier, Shift, Riwayat).

The resulting `items` array should have 10 entries in this order:
1. Kasir POS (`/resto/kasir`)
2. Kitchen Display (`/resto/kds`)
3. Manajemen Menu (`/resto/produk`)
4. Promo & Diskon (`/resto/marketing`)
5. Persediaan & Stok (`/resto/persediaan`)
6. Opname Stok (`/resto/opname`)
7. Denah Meja (`/resto/floor-plan`)
8. Modifier & Add-on (`/resto/modifiers`)
9. Shift Kasir (`/resto/shift`)
10. Riwayat Penjualan (`/transaksi-unit/riwayat?unitType=resto`)

- [ ] **Step 2: Verify navigation compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants/navigation.ts
git commit -m "refactor: trim Resto admin sidebar — remove Bahan Baku and Batch

Remove Bahan Baku and Manajemen Batch from adminRestoNavigation.
Routes remain accessible via direct URL."
```

---

### Task 3: Default `trackStock=false` for F&B Units (API)

**Files:**
- Modify: `src/app/api/toko/products/route.ts:200,231`

- [ ] **Step 1: Add F&B unit type list and change default in CREATE (soft-restore path)**

In `src/app/api/toko/products/route.ts`, at line ~158 where `const body = await request.json()` is, add this constant after line 158:

```typescript
const nonInventoryUnits = ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"];
```

Then at line 200, change:
```typescript
trackStock: trackStock !== undefined ? trackStock : true,
```
to:
```typescript
trackStock: trackStock !== undefined ? trackStock : !nonInventoryUnits.includes(unitType || ""),
```

- [ ] **Step 2: Change default in CREATE (new product path)**

At line 231, change:
```typescript
trackStock: trackStock !== undefined ? trackStock : true,
```
to:
```typescript
trackStock: trackStock !== undefined ? trackStock : !nonInventoryUnits.includes(unitType || ""),
```

This is the same pattern — the only difference is location (soft-restore path vs. new product creation path).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/toko/products/route.ts
git commit -m "feat: default trackStock=false for Cafe LSP and Resto units

New products in cafe_lsp, resto, resto_cafe, coffe_latar units will
default to trackStock=false, meaning stock is not deducted on checkout.
Toko and other units keep trackStock=true default."
```

---

### Task 4: Add HPP Manual Tooltip to Product Form

**Files:**
- Modify: `src/app/(protected)/toko/produk/tambah/page.tsx:269-271`

- [ ] **Step 1: Add description text under HPP label**

In `src/app/(protected)/toko/produk/tambah/page.tsx`, find the costPrice label at line 269:

```tsx
<Label htmlFor="costPrice">Harga Beli (Modal / HPP)</Label>
```

Change it to:

```tsx
<Label htmlFor="costPrice">Harga Beli (Modal / HPP)</Label>
{(isResto || unitType === "cafe_lsp") && (
    <p className="text-[10px] text-muted-foreground">Isi manual sesuai perhitungan HPP dari manajemen</p>
)}
```

This adds a small description below the label only for F&B units. The variable `isResto` is already defined at line 22 (`const isResto = ["resto_cafe", "resto", "coffe_latar"].includes(unitType)`), and `unitType` is from the session.

- [ ] **Step 2: Verify form renders**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/toko/produk/tambah/page.tsx"
git commit -m "feat: add HPP manual tooltip for Cafe LSP and Resto product forms

Show guidance text under HPP field for F&B units: 'Isi manual sesuai
perhitungan HPP dari manajemen'."
```

---

### Task 5: Add "Opname Stok" Button in Persediaan Page (Cafe LSP)

**Files:**
- Modify: `src/app/(protected)/toko/persediaan/page.tsx`

The Persediaan page (`TokoPersediaanPage`) is shared across Toko, Resto, and Cafe LSP via wrappers. We need to add a button that navigates to the opname page — but only when the user's unitType is `cafe_lsp`.

- [ ] **Step 1: Add import and opname button**

At the top of `src/app/(protected)/toko/persediaan/page.tsx`, add `ClipboardCheck` to the existing Lucide imports (it may already be imported).

Find the main component function. It already has `useSession()` available. After the existing imports, add a router import if not present:

```typescript
import { useRouter } from "next/navigation";
```

Inside the component, after existing session destructuring, add:

```typescript
const unitType = session?.user?.unitType as string || "";
const isCafeLsp = unitType === "cafe_lsp";
```

Find the `PageHeader` component at the top of the JSX. Add a button next to the header actions (or after the header) that only shows for Cafe LSP:

```tsx
{isCafeLsp && (
    <Button
        variant="outline"
        onClick={() => router.push("/cafe-lsp/opname")}
        className="gap-2"
    >
        <ClipboardCheck className="h-4 w-4" />
        Opname Stok
    </Button>
)}
```

Place it inside the `PageHeader` action area or right after the PageHeader component as a standalone button, whichever matches the existing layout pattern.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/toko/persediaan/page.tsx"
git commit -m "feat: add Opname Stok button in Persediaan page for Cafe LSP

Show an 'Opname Stok' button on the Persediaan & Stok page when the
user's unitType is cafe_lsp, since Opname was removed from sidebar."
```

---

### Task 6: Update Documentation

**Files:**
- Modify: `docs/UNIT-CAFE-LSP.md`
- Modify: `docs/UNIT-CAFE-RESTO.md`

- [ ] **Step 1: Update UNIT-CAFE-LSP.md sidebar table**

In `docs/UNIT-CAFE-LSP.md`, find the "Admin" table under "3. Role & Akses" (around line 60-73). Update it to reflect the 7-item sidebar:

```markdown
### Admin

| Fitur | Link |
|---|---|
| Kasir POS | `/cafe-lsp/kasir` |
| Kitchen Display | `/cafe-lsp/kds` |
| Manajemen Menu | `/cafe-lsp/produk` |
| Promo & Diskon | `/cafe-lsp/marketing` |
| Persediaan & Stok | `/cafe-lsp/persediaan` |
| Shift Kasir | `/cafe-lsp/shift` |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` |
```

Also update the wrapper architecture table to note that Opname is accessible via button in Persediaan page and Bahan Baku/Batch routes are hidden from sidebar.

- [ ] **Step 2: Update UNIT-CAFE-RESTO.md sidebar table**

In `docs/UNIT-CAFE-RESTO.md`, find the "Admin Resto" table under "4.2 Admin Resto" (around line 82-98). Remove the rows for "Bahan Baku" and "Manajemen Batch". Keep all other rows.

- [ ] **Step 3: Commit**

```bash
git add docs/UNIT-CAFE-LSP.md docs/UNIT-CAFE-RESTO.md
git commit -m "docs: update Cafe LSP and Resto docs for simplified sidebar

Reflect removal of Bahan Baku, Batch from Resto sidebar and full
7-item trim for Cafe LSP sidebar."
```

---

### Task 7: Migrate Existing Products (trackStock → false for F&B)

**Files:**
- No code files — SQL migration via admin endpoint

- [ ] **Step 1: Run migration to set trackStock=false for existing F&B products**

Use the existing admin migration endpoint or Prisma Studio. Execute this SQL:

```sql
UPDATE "StoreProduct"
SET "trackStock" = false
WHERE "unitType" IN ('cafe_lsp', 'resto', 'resto_cafe', 'coffe_latar')
  AND "productType" = 'finished'
  AND "trackStock" = true;
```

This can be done via:
- `npx prisma db execute --file migration.sql` (if file created)
- Or directly in Prisma Studio / NeonDB console
- Or via a one-time API call

- [ ] **Step 2: Verify migration**

Run a count query to verify:

```sql
SELECT "unitType", "trackStock", count(*)
FROM "StoreProduct"
WHERE "unitType" IN ('cafe_lsp', 'resto', 'resto_cafe', 'coffe_latar')
  AND "deletedAt" IS NULL
  AND "isActive" = true
GROUP BY "unitType", "trackStock";
```

Expected: All `finished` products should have `trackStock=false`. Only products manually set by admin should have `trackStock=true`.

- [ ] **Step 3: Commit migration file (if created)**

```bash
git add prisma/migrations/trackstock-fb-default.sql
git commit -m "migration: set trackStock=false for existing F&B products"
```

---

## Self-Review

**1. Spec coverage:**
- Sidebar Cafe LSP (7 items): Task 1 ✓
- Sidebar Resto (10 items): Task 2 ✓
- Default trackStock=false: Task 3 ✓
- HPP tooltip: Task 4 ✓
- Opname button in Persediaan: Task 5 ✓
- Doc updates: Task 6 ✓
- Existing data migration: Task 7 ✓
- Laporan HPP badge: Spec said "if costPrice=0 show badge" but current reports don't show profit columns at all — no change needed until reports add profit calculation.

**2. Placeholder scan:** No TBD/TODO found. All steps have concrete code or SQL.

**3. Type consistency:** `nonInventoryUnits` array used consistently in Task 3. Navigation items use existing icon imports. `isResto` and `unitType` variables already exist in the form component.
