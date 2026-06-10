# Haji & Umrah — Phase 1D: Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up constants (units, product types, navigation), route guards (layout.tsx), billing integration (generate + settlement), Zod validation schemas, and SHU verification so the Haji & Umrah module is fully accessible and integrated with existing systems.

**Architecture:** Modify 5 existing files + create 1 new file — add `haji_umrah` to UNIT_TYPES, extend navigation with new sidebar group, add route guard access for admin/kasir roles, extend billing generate AND settlement for `savings_account` source type, create dedicated Zod validation schemas, verify SHU calculator covers `haji_umrah` unitType.

**Tech Stack:** TypeScript, Zod, Next.js App Router, Prisma 6

**Depends on:** All 3 prior plans (data layer, API layer, UI layer)

**Design Spec:** `docs/superpowers/specs/2026-06-10-haji-umrah-savings-only-design.md`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/constants/units.ts` | Modify | Add `haji_umrah` unit type |
| `src/lib/constants/index.ts` | Modify | Add product types for haji/umrah |
| `src/lib/constants/navigation.ts` | Modify | Add sidebar navigation group |
| `src/app/(protected)/layout.tsx` | Modify | Add route guard access |
| `src/lib/validations/haji-umrah.ts` | Create | Dedicated Zod schemas for haji/umrah |
| `src/app/api/billing/generate/route.ts` | Modify | Add `savings_account` source to generate |
| `src/app/api/billing/[periodId]/process/route.ts` | Modify | Add `savings_account` handler to settlement |

---

### Task 1: Add `haji_umrah` to Unit Constants

**Files:**
- Modify: `src/lib/constants/units.ts:10-20`

- [ ] **Step 1: Add `haji_umrah` entry to UNIT_TYPES**

After the `laundry` entry (line 19), add:

```typescript
  haji_umrah:  { label: "Haji & Umrah",      slug: "haji-umrah",   category: "service", icon: "Landmark" },
```

The full `UNIT_TYPES` should now look like:

```typescript
export const UNIT_TYPES: Record<string, UnitConfig> = {
  toko:        { label: "Toko PRIMKOPPOL",  slug: "toko",         category: "store",   icon: "Store" },
  cafe_lsp:    { label: "Cafe LSP",         slug: "cafe-lsp",     category: "store",   icon: "Coffee" },
  resto:       { label: "Resto & Cafe",     slug: "resto",        category: "store",   icon: "UtensilsCrossed" },
  cuci_mobil:  { label: "Cuci Mobil & Motor", slug: "cuci-mobil", category: "service", icon: "Car" },
  barbershop:  { label: "Barbershop",       slug: "barbershop",   category: "service", icon: "Scissors" },
  fitness:     { label: "Fitness",          slug: "fitness",      category: "service", icon: "Dumbbell" },
  playstation: { label: "Play Station",     slug: "playstation",  category: "service", icon: "Gamepad2" },
  fotocopy:    { label: "Fotocopy",         slug: "fotocopy",     category: "service", icon: "Printer" },
  laundry:     { label: "Laundry",          slug: "laundry",      category: "service", icon: "Shirt" },
  haji_umrah:  { label: "Haji & Umrah",     slug: "haji-umrah",   category: "service", icon: "Landmark" },
};
```

Note: Using `category: "service"` since it's not a store/POS unit. Icon `Landmark` from Lucide fits the Islamic banking/haji theme.

- [ ] **Step 2: Commit**

```bash
git add src/lib/constants/units.ts
git commit -m "feat(haji-umrah): add haji_umrah unit type to UNIT_TYPES constants"
```

---

### Task 2: Add Product Type Labels

**Files:**
- Modify: `src/lib/constants/index.ts:184-189`

- [ ] **Step 1: Extend SAVINGS_PRODUCT_TYPES with haji/umrah entries**

Change from:

```typescript
export const SAVINGS_PRODUCT_TYPES = {
    pokok: { label: "Simpanan Pokok" },
    wajib: { label: "Simpanan Wajib" },
    sukarela: { label: "Simpanan Sukarela" },
    lainnya: { label: "Lainnya" },
} as const;
```

To:

```typescript
export const SAVINGS_PRODUCT_TYPES = {
    pokok: { label: "Simpanan Pokok" },
    wajib: { label: "Simpanan Wajib" },
    sukarela: { label: "Simpanan Sukarela" },
    lainnya: { label: "Lainnya" },
    tabungan_haji: { label: "Tabungan Haji" },
    tabungan_umrah: { label: "Tabungan Umrah" },
} as const;
```

- [ ] **Step 2: Extend createSavingsProductSchema type enum in validations**

Modify `src/lib/validations/index.ts:35`:

Change from:
```typescript
type: z.enum(["pokok", "wajib", "sukarela", "lainnya"]),
```

To:
```typescript
type: z.enum(["pokok", "wajib", "sukarela", "lainnya", "tabungan_haji", "tabungan_umrah"]),
```

Also add the new optional fields to the schema (after `isActive` line 41):

```typescript
    // Haji/Umrah specific fields
    targetAmount: z.number().nonnegative().nullable().optional(),
    adminFeeType: z.enum(["percent", "fixed"]).nullable().optional(),
    adminFeeValue: z.number().nonnegative().nullable().optional(),
    linkedBankName: z.string().max(100).nullable().optional(),
    allowEarlyWithdraw: z.boolean().default(true),
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants/index.ts src/lib/validations/index.ts
git commit -m "feat(haji-umrah): extend SAVINGS_PRODUCT_TYPES and Zod schema for haji/umrah types"
```

---

### Task 2b: Create Dedicated Zod Validation Schemas

**Files:**
- Create: `src/lib/validations/haji-umrah.ts`

These schemas are used by the API routes in Plan 2 for proper request validation instead of manual `if (!memberId)` checks.

- [ ] **Step 1: Create the validation file**

```typescript
import { z } from "zod";

// Schema for creating a haji/umrah savings account (POST /api/haji-umrah/savings)
export const createHajiUmrahAccountSchema = z.object({
    memberId: z.number().int().positive("Anggota wajib dipilih"),
    productId: z.number().int().positive("Produk wajib dipilih"),
    targetAmount: z.number().nonnegative().optional().nullable(),
    monthlyTarget: z.number().nonnegative().optional().nullable(),
    maturityDate: z.string().optional().nullable(),
});

export type CreateHajiUmrahAccountInput = z.infer<typeof createHajiUmrahAccountSchema>;

// Schema for creating a setoran/deposit (POST /api/haji-umrah/savings/[accountId]/transactions)
export const createHajiUmrahSetoranSchema = z.object({
    amount: z.number().positive("Jumlah setoran harus lebih dari 0"),
    paymentMethod: z.enum(["cash", "bank_transfer"]).default("cash"),
    cashBankAccountId: z.number().int().positive().optional().nullable(),
    referenceNo: z.string().max(50).optional().nullable(),
    notes: z.string().optional().nullable(),
    transactionDate: z.string().optional(),
});

export type CreateHajiUmrahSetoranInput = z.infer<typeof createHajiUmrahSetoranSchema>;

// Schema for creating/updating a haji/umrah product
export const createHajiUmrahProductSchema = z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(255),
    type: z.enum(["tabungan_haji", "tabungan_umrah"]),
    minimumAmount: z.number().nonnegative().default(0),
    targetAmount: z.number().nonnegative().nullable().optional(),
    adminFeeType: z.enum(["percent", "fixed"]).nullable().optional(),
    adminFeeValue: z.number().nonnegative().nullable().optional(),
    linkedBankName: z.string().max(100).nullable().optional(),
    isActive: z.boolean().default(true),
});

export type CreateHajiUmrahProductInput = z.infer<typeof createHajiUmrahProductSchema>;

export const updateHajiUmrahProductSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    minimumAmount: z.number().nonnegative().optional(),
    targetAmount: z.number().nonnegative().nullable().optional(),
    adminFeeType: z.enum(["percent", "fixed"]).nullable().optional(),
    adminFeeValue: z.number().nonnegative().nullable().optional(),
    linkedBankName: z.string().max(100).nullable().optional(),
    isActive: z.boolean().optional(),
});

export type UpdateHajiUmrahProductInput = z.infer<typeof updateHajiUmrahProductSchema>;
```

- [ ] **Step 2: Update Plan 2 API routes to use these schemas (apply during execution)**

When implementing Plan 2, update the following files to import and use these schemas:

| Plan 2 File | Schema to Import |
|---|---|
| `api/haji-umrah/savings/route.ts` (POST) | `createHajiUmrahAccountSchema` — replace manual validation |
| `api/haji-umrah/savings/[accountId]/transactions/route.ts` (POST) | `createHajiUmrahSetoranSchema` — replace manual validation |
| `api/haji-umrah/products/route.ts` (POST) | `createHajiUmrahProductSchema` — replace inline validation |
| `api/haji-umrah/products/[productId]/route.ts` (PUT) | `updateHajiUmrahProductSchema` — replace inline validation |

Example replacement in `savings/route.ts` POST:
```typescript
// Before (Plan 2 original):
const { memberId, productId, ...rest } = body;
if (!memberId || !productId) { ... }

// After (using schema):
const data = createHajiUmrahAccountSchema.parse(body);
// data.memberId and data.productId are now validated
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/haji-umrah.ts
git commit -m "feat(haji-umrah): add dedicated Zod validation schemas for account, setoran, and product"
```

---

### Task 3: Add Navigation Sidebar Group

**Files:**
- Modify: `src/lib/constants/navigation.ts`

- [ ] **Step 1: Add `Landmark` to lucide-react imports**

Add `Landmark` to the import list at line 4-53 (alongside other icons like `Coffee`, `Banknote`, etc.):

```typescript
import {
    // ... existing imports ...
    Landmark,
} from "lucide-react";
```

- [ ] **Step 2: Add navigation group after the TAGIHAN section (around line 158)**

After the `TAGIHAN` section, add a new navigation group:

```typescript
    {
        title: "HAJI & UMRAH",
        roles: ["operator"],
        items: [
            {
                title: "Haji & Umrah", href: "/haji-umrah", icon: Landmark,
                permission: "manage_all",
                children: [
                    { title: "Dashboard", href: "/haji-umrah" },
                    { title: "Tabungan", href: "/haji-umrah/tabungan" },
                    { title: "Produk", href: "/haji-umrah/produk" },
                    { title: "Laporan", href: "/haji-umrah/laporan" },
                ],
            },
        ],
    },
```

This places the Haji & Umrah menu in the sidebar, visible only to operators initially. Admin access can be added later via the route guard in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants/navigation.ts
git commit -m "feat(haji-umrah): add Haji & Umrah navigation group to sidebar"
```

---

### Task 4: Add Route Guard Access

**Files:**
- Modify: `src/app/(protected)/layout.tsx:21-58`

- [ ] **Step 1: Add `haji_umrah` to ADMIN_ALLOWED_ROUTES**

In the `ADMIN_ALLOWED_ROUTES` object (line 36), add a new entry:

```typescript
    haji_umrah: [
        "/haji-umrah", "/unit", "/transaksi-unit",
        "/kwitansi", "/approval",
    ],
```

This allows an admin user with `unitType: "haji_umrah"` to access the `/haji-umrah/*` routes plus common unit routes.

- [ ] **Step 2: Commit**

```bash
git add "src/app/(protected)/layout.tsx"
git commit -m "feat(haji-umrah): add route guard access for haji_umrah admin role"
```

---

### Task 5: Extend Billing Generate for `savings_account` Source

**Files:**
- Modify: `src/app/api/billing/generate/route.ts:86-176`

This is the most sensitive integration change. We add a **Source 3** that scans SavingsAccount with haji/umrah products and monthlyTarget > 0.

- [ ] **Step 1: Add `savings_account` source type to billing generate**

After the `gapStoreSales` loop (line 176) and before the `if (items.length === 0)` check (line 178), add Source 3:

```typescript
    // Source 3: Haji/Umrah savings accounts with monthly target
    // Scan SavingsAccount where product is haji/umrah type, has monthlyTarget, and is active.
    const hajiUmrahAccounts = await prisma.savingsAccount.findMany({
      where: {
        status: "active",
        monthlyTarget: { not: null },
        product: {
          type: { in: ["tabungan_haji", "tabungan_umrah"] },
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        memberId: true,
        monthlyTarget: true,
        product: { select: { type: true, name: true } },
        member: { select: { name: true, nrp: true } },
      },
    });

    for (const sa of hajiUmrahAccounts) {
      if (!sa.memberId) continue;
      const typeLabel = sa.product.type === "tabungan_haji" ? "Haji" : "Umrah";
      items.push({
        memberId: sa.memberId,
        memberName: sa.member?.name ?? "Unknown",
        memberNrp: sa.member?.nrp ?? null,
        unitType: "haji_umrah",
        transactionId: sa.id,
        transactionSource: "savings_account",
        description: `Setoran Tabungan ${typeLabel} - ${sa.member?.name ?? "Unknown"}`,
        amount: Number(sa.monthlyTarget),
      });
    }
```

- [ ] **Step 2: Also update the comment on BillingItem schema**

In `prisma/schema.prisma` line 1464, update the comment:

```prisma
  transactionSource String?   @map("transaction_source")   // "unit_transaction" | "store_sale" | "savings_account"
```

- [ ] **Step 3: Test billing generate**

Call: `POST http://localhost:3000/api/billing/generate`
Expected: If there are active haji/umrah accounts with monthlyTarget, the response includes `savings_account` source items. If none exist yet, existing unit_transaction/store_sale items still work as before.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/billing/generate/route.ts prisma/schema.prisma
git commit -m "feat(haji-umrah): extend billing generate with savings_account source type

- Source 3: scans SavingsAccount with haji/umrah products and monthlyTarget
- Creates BillingItem with transactionSource: 'savings_account'
- Backward compatible — existing unit_transaction and store_sale sources unchanged"
```

---

### Task 5b: Add `savings_account` Handler to Billing Settlement

**Files:**
- Modify: `src/app/api/billing/[periodId]/process/route.ts`

This is **critical** — without it, billing items with `transactionSource: "savings_account"` will be settled (CashBank updated, items marked paid) but the `SavingsTransaction` deposit and `SavingsAccount.balance` update will **never** happen. The member's tabungan balance won't reflect the salary deduction.

- [ ] **Step 1: Add `savings_account` branch to the settlement for-loop**

In `src/app/api/billing/[periodId]/process/route.ts`, find the `for (const item of itemsToSettle)` loop (line 67). After the `else if (item.transactionSource === "store_sale" ...)` block (ending at line 108), add a new `else if` branch:

```typescript
        } else if (item.transactionSource === "savings_account" && item.transactionId) {
          // Haji/Umrah savings: create SavingsTransaction (deposit) + update account balance
          const savingsAccount = await tx.savingsAccount.findUnique({
            where: { id: item.transactionId },
            include: { product: true },
          });
          if (savingsAccount && savingsAccount.status === "active") {
            const amount = Number(item.amount);
            const balanceBefore = Number(savingsAccount.balance);
            const balanceAfter = balanceBefore + amount;

            // Generate transaction number
            const year = new Date().getFullYear();
            const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
            const txNo = `HU-${year}-${random}`;

            const typeLabel = savingsAccount.product.type === "tabungan_haji" ? "Haji" : "Umrah";

            await tx.savingsTransaction.create({
              data: {
                transactionNo: txNo,
                accountId: savingsAccount.id,
                memberId: item.memberId,
                productId: savingsAccount.productId,
                branchId: savingsAccount.branchId,
                type: "deposit",
                amount,
                balanceBefore,
                balanceAfter,
                paymentMethod: "salary_cut",
                notes: `Potongan Gaji Tabungan ${typeLabel} — ${period.periodLabel}`,
                transactionDate: new Date(),
                createdById: userId,
              },
            });

            await tx.savingsAccount.update({
              where: { id: savingsAccount.id },
              data: { balance: balanceAfter },
            });
          }
        }
```

The full for-loop section should now have three branches:
1. `unit_transaction` → marks UnitTransaction as paid + settles linked StoreSale
2. `store_sale` → marks StoreSale as settled via metadata
3. **`savings_account`** → creates SavingsTransaction deposit + updates SavingsAccount.balance

- [ ] **Step 2: Test billing settlement end-to-end**

1. Create a haji/umrah account with `monthlyTarget` set
2. Generate billing period (`POST /api/billing/generate`)
3. Verify the billing item appears with `transactionSource: "savings_account"`
4. Process the billing period (`POST /api/billing/[periodId]/process`)
5. Check that the SavingsAccount balance increased by the monthlyTarget amount
6. Check that a SavingsTransaction was created with type "deposit" and paymentMethod "salary_cut"

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/billing/[periodId]/process/route.ts"
git commit -m "feat(haji-umrah): add savings_account handler to billing settlement

- Creates SavingsTransaction (deposit) per settled haji/umrah billing item
- Updates SavingsAccount.balance atomically
- paymentMethod: salary_cut to distinguish from manual deposits
- Backward compatible — existing unit_transaction and store_sale handlers unchanged"
```

---

### Task 6: Verify SHU Calculator Coverage

**Files:**
- Verify: `src/lib/services/shu-calculator.ts`

- [ ] **Step 1: Verify `haji_umrah` unitType is covered**

The SHU calculator uses `CashBankTransaction.groupBy(['unitType'])` for income queries. Since the setoran API creates admin fee CashBankTransactions with `unitType: "haji_umrah"` and `category: "pendapatan_unit"`, these will automatically be grouped under the `haji_umrah` key in the SHU income breakdown.

No code changes needed — verify by checking that:
1. The `groupBy(['unitType'])` query does NOT filter by a fixed list of unitTypes
2. The income query includes `type: "in"` and `category` filters that allow `pendapatan_unit` through

The existing SHU income query (around line 466) uses:
```typescript
groupBy(['unitType'])
where: { type: "in", journalId: null, ... }
```

This will automatically pick up `haji_umrah` because it groups by ALL unitType values. ✅

- [ ] **Step 2: Document SHU coverage**

No commit needed — this is a verification step. The admin fee revenue from haji/umrah will appear in SHU under `haji_umrah` unitType key, alongside other units like `toko`, `resto`, etc.

---

## Self-Review Checklist

- [x] **Spec coverage Section 5.2 (Billing Generate):** savings_account source added to billing generate
- [x] **Spec coverage Section 5.2 (Billing Settlement):** savings_account handler added to process route — creates SavingsTransaction + updates balance
- [x] **Spec coverage Section 4.1 (Navigation):** sidebar group added for operator
- [x] **Spec file #18:** `src/lib/validations/haji-umrah.ts` created with 4 Zod schemas (account, setoran, product create, product update)
- [x] **Spec typo fixed:** `setoron` → `setoran` in design spec line 231
- [x] **Placeholder scan:** No TBD or TODO — all code is complete
- [x] **Type consistency:** `haji_umrah` unitType string matches across units.ts, billing generate, billing settlement, CashBank transactions, and SHU calculator
- [x] **Route guard:** Admin with `unitType: "haji_umrah"` can access `/haji-umrah/*` routes
- [x] **Backward compatibility:** All changes are additive — no existing behavior modified
- [x] **Billing safety:** Source 3 only fires if there are active accounts with monthlyTarget set
- [x] **Billing settlement safety:** savings_account branch only fires for items with matching source type

## Completion Criteria

After completing this plan:
- [ ] `haji_umrah` appears in `UNIT_TYPES`
- [ ] `tabungan_haji` / `tabungan_umrah` appear in `SAVINGS_PRODUCT_TYPES`
- [ ] `src/lib/validations/haji-umrah.ts` exists with 4 Zod schemas
- [ ] Sidebar shows "HAJI & UMRAH" group for operator
- [ ] Admin with `haji_umrah` unitType can access `/haji-umrah/*`
- [ ] Billing generate includes `savings_account` source items
- [ ] Billing settlement creates SavingsTransaction + updates balance for `savings_account` items
- [ ] SHU calculator auto-includes `haji_umrah` revenue

---

## Full Feature Checklist (All 4 Plans)

After completing all 4 plans:

- [ ] **Data Layer:** Schema has 8 new nullable fields, migration endpoint works, seed data includes TH/TU
- [ ] **API Layer:** 6 API endpoints functional — products (GET/POST/PUT), savings list/detail, transactions with admin fee, reports
- [ ] **UI Layer:** 7 pages render — dashboard (6 stat cards + target alert), tabungan list (buka rekening dialog) /detail (kwitansi print) /setoran, produk CRUD, laporan with export
- [ ] **Integration:** Navigation, route guards, billing (generate + settlement), Zod schemas, SHU — all wired up
- [ ] **End-to-end test:** Operator can create product → open account → make deposit → see progress → billing generate → billing settle → balance updated → export report → print kwitansi
