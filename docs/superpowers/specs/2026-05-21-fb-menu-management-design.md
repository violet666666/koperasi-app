# F&B Menu Management Redesign — Cafe LSP & Resto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace retail-style product forms in Cafe LSP and Resto with an F&B-specific menu management system: category CRUD, menu type toggle, tax settings, variant grouping, and POS color coding — without affecting Toko or any other unit.

**Architecture:** New `StoreCategory` table for F&B categories. Add 5 nullable/defaulted fields to `StoreProduct`. All changes scoped via `FB_UNITS` constant (`cafe_lsp`, `resto`, `resto_cafe`, `coffe_latar`). Toko code paths are never touched.

**Tech Stack:** Next.js App Router, Prisma, shadcn/ui, TypeScript

---

## CRITICAL: Unit Isolation Rules

These rules are **non-negotiable**. Every change must obey them:

1. **`FB_UNITS` constant** — defined in `src/lib/constants/units.ts`:
   ```typescript
   export const FB_UNITS = ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"] as const;
   export type FbUnitType = (typeof FB_UNITS)[number];
   export function isFbUnit(unitType: string | null | undefined): boolean {
     return !!unitType && (FB_UNITS as readonly string[]).includes(unitType);
   }
   ```

2. **All new API logic must guard with `isFbUnit(unitType)`** — if the unit is not F&B, skip the new behavior entirely and use existing code paths.

3. **All new DB fields have safe defaults** — `NULL`, `"inclusive"`, `11.0`, or `NULL`. Toko products will have these defaults and existing code never reads them, so behavior is unchanged.

4. **No changes to sales route stock deduction** — the `isRacikan` / `trackStock` logic is already correct. F&B products have `trackStock=false` (set during the May 21 migration). Toko has `trackStock=true`. Do NOT touch the sales, split-bill, or void routes.

5. **No changes to Toko frontend pages** — `/toko/produk`, `/toko/produk/tambah`, `/toko/kasir`, etc. are untouched. Only F&B unit pages get new forms.

6. **The existing `category` string field stays** — Toko continues using `StoreProduct.category` (string). F&B units will ALSO populate `categoryId` (FK). Both fields coexist. The GET products endpoint returns whichever is appropriate based on unitType.

---

## 1. Database Changes

### 1.1 New Table: `StoreCategory`

```prisma
model StoreCategory {
  id        Int      @id @default(autoincrement())
  name      String   // Display name: "Kopi", "Makanan", "Snack"
  unitType  String   @map("unit_type") // cafe_lsp, resto, resto_cafe, coffe_latar
  sortOrder Int      @default(0) @map("sort_order")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  products StoreProduct[]

  @@unique([name, unitType])
  @@index([unitType, isActive])
  @@map("store_categories")
}
```

### 1.2 New Fields on `StoreProduct`

```prisma
model StoreProduct {
  // ... existing fields unchanged ...

  // --- NEW FIELDS (all nullable/defaulted, safe for Toko) ---

  categoryId     Int?             @map("category_id")          // FK to StoreCategory (F&B only)
  categoryRel    StoreCategory?   @relation(fields: [categoryId], references: [id])
  menuType       String?          @map("menu_type")            // "inventory" | "kitchen" | null (= inventory)
  taxType        String           @default("inclusive") @map("tax_type") // "inclusive" | "exclusive" | "none"
  taxRate        Decimal          @default(11.0) @map("tax_rate") @db.Decimal(5, 2)
  posColor       String?          @map("pos_color")            // Hex color for POS grid: "#FF5722"
  variantGroupId String?          @map("variant_group_id")     // Groups variants: "latte"

  // Existing `category` string field STAYS — Toko still uses it
}
```

**Why these defaults are safe for Toko:**
- `categoryId = null` → Toko never reads this field, uses `category` string instead
- `menuType = null` → treated as `"inventory"` only in F&B form; Toko code never checks it
- `taxType = "inclusive"` → matches current behavior (prices already include tax)
- `taxRate = 11.0` → matches current PPN
- `posColor = null` → no color badge shown when null
- `variantGroupId = null` → no grouping when null

### 1.3 Migration Strategy

Since this project uses `prisma db push` (not formal migrations), changes are applied via:
1. `prisma db push` to add columns and table (with NULL defaults)
2. Migration endpoint `/api/admin/migrate` adds ALTER TABLE statements for production NeonDB
3. No data migration needed — existing products keep all defaults

---

## 2. Category CRUD

### 2.1 API: `/api/toko/products/categories`

**Existing:** GET (list with counts) and POST (rename/delete).
**New:** Full CRUD with `StoreCategory` model for F&B units.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/toko/products/categories?unitType=cafe_lsp` | List categories (F&B: from `StoreCategory` table, Toko: from `category` string aggregate) |
| POST | `/api/toko/products/categories` | Create category (F&B: insert `StoreCategory`, Toko: auto-created via product) |
| PUT | `/api/toko/products/categories/[id]` | Update name/sortOrder (F&B only) |
| DELETE | `/api/toko/products/categories/[id]` | Delete category, set products to null (F&B only) |

**Isolation:** The new PUT/DELETE endpoints only work on `StoreCategory` records. If the unit is Toko, these endpoints return 404 or fall back to the existing string-based rename/delete.

**GET behavior:**
```
if (isFbUnit(unitType)):
  return StoreCategory.findMany({ where: { unitType, isActive: true }, orderBy: { sortOrder: 'asc' } })
else:
  return existing aggregate from StoreProduct.category string (unchanged)
```

### 2.2 Frontend: Category Management

Location: F&B admin pages (`/cafe-lsp/produk`, `/resto/produk`) get a "Kelola Kategori" button/dropdown.

Features:
- Drag-to-reorder (updates `sortOrder`)
- Add new category inline
- Rename inline
- Delete (confirms, sets products to uncategorized)
- Only visible for F&B units

---

## 3. F&B Menu Form (Tambah Menu / Edit Menu)

### 3.1 Route

New shared component at `src/components/forms/fb-menu-form.tsx` used by:
- `/cafe-lsp/produk/tambah` (new page)
- `/cafe-lsp/produk/[id]/edit` (new page)
- `/resto/produk/tambah` (new page)
- `/resto/produk/[id]/edit` (new page)

Toko pages (`/toko/produk/tambah`, `/toko/produk/[id]/edit`) remain **completely unchanged**.

### 3.2 Form Sections

**Section A: Info Menu**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Nama Menu | text | Yes | Product name |
| Kategori | dropdown | Yes | From `StoreCategory` for this unit |
| SKU | text | Yes | Auto-generated if empty |
| Deskripsi | textarea | No | New field or use existing metadata |
| Foto Menu | file upload | No | Existing `imageUrl` field |

**Section B: Jenis Menu (Toggle)**
| Option | Description |
|--------|-------------|
| Produk Inventaris | `menuType = "inventory"`, `trackStock = true`. Stock tracked, deducted on sale. |
| Menu Dapur | `menuType = "kitchen"`, `trackStock = false`. No stock deduction. Toggle "Available / 86'd" via `isActive`. |

**When "Menu Dapur" selected:**
- Hide stock fields (stockGdg, stockToko, minStock)
- Show "Status Ketersediaan" toggle: Available / 86'd (Sold Out)
- Default `isActive = true`

**When "Produk Inventaris" selected:**
- Show stock fields normally (same as current form)

**Section C: Harga & Pajak**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| HPP (Harga Pokok) | number | Yes | Manual input, existing `costPrice` |
| Harga Jual | number | Yes | Existing `sellPrice` |
| Pengaturan Pajak | dropdown | Yes | `taxType`: "Termasuk PPN" / "Belum Termasuk PPN" / "Tanpa PPN" |
| Tarif PPN (%) | number | Yes | `taxRate`, default 11%, editable |

**Section D: Varian**
| Field | Type | Notes |
|-------|------|-------|
| Grup Varian | text | `variantGroupId` — e.g. "latte" for Latte S/M/L |
| Tombol "Tambah Varian" | button | Creates another product with same variantGroupId |

Flow: User fills form for "Kopi Latte (Small)", sets variantGroupId = "latte". Clicks "Tambah Varian" → form resets with same category + variantGroupId, user enters "Kopi Latte (Medium)" etc. Each variant is a separate `StoreProduct` row.

**Section E: Tampilan POS**
| Field | Type | Notes |
|-------|------|-------|
| Warna di POS | color picker | `posColor` hex value |
| Satuan | dropdown | Existing `unit` field |

### 3.3 Form Submission

```typescript
const payload = {
  name, sku, sellPrice, costPrice, unit, imageUrl,
  unitType: currentUnitType, // cafe_lsp or resto
  category: selectedCategoryName, // string field (backward compat)
  categoryId: selectedCategoryId, // FK (F&B)
  menuType: isKitchen ? "kitchen" : "inventory",
  trackStock: isKitchen ? false : true,
  taxType: selectedTaxType,
  taxRate: selectedTaxRate,
  posColor: selectedColor || null,
  variantGroupId: variantGroup || null,
  productType: "finished",
  // Stock fields only if inventory
  ...(isInventory ? { stockToko, stockGdg, stock, minStock } : { stockToko: 0, stockGdg: 0, stock: 0, minStock: 0 }),
};
```

### 3.4 POST `/api/toko/products` Changes

**Only modify for F&B units.** The existing `nonInventoryUnits` logic becomes:

```typescript
// BEFORE (existing):
const nonInventoryUnits = ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"];
trackStock: trackStock !== undefined ? trackStock : !nonInventoryUnits.includes(unitType || ""),

// AFTER (new): accept new fields, only for F&B
if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
if (body.menuType !== undefined) updateData.menuType = body.menuType;
if (body.taxType !== undefined) updateData.taxType = body.taxType;
if (body.taxRate !== undefined) updateData.taxRate = body.taxRate;
if (body.posColor !== undefined) updateData.posColor = body.posColor || null;
if (body.variantGroupId !== undefined) updateData.variantGroupId = body.variantGroupId || null;
// trackStock logic UNCHANGED — still uses nonInventoryUnits fallback
```

### 3.5 PUT `/api/toko/products/[id]` Changes

Same pattern — accept new fields if provided:

```typescript
if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
if (body.menuType !== undefined) updateData.menuType = body.menuType;
if (body.taxType !== undefined) updateData.taxType = body.taxType;
if (body.taxRate !== undefined) updateData.taxRate = body.taxRate;
if (body.posColor !== undefined) updateData.posColor = body.posColor || null;
if (body.variantGroupId !== undefined) updateData.variantGroupId = body.variantGroupId || null;
```

---

## 4. POS Display Changes

### 4.1 Category Filter Tabs

On F&B POS pages (`/cafe-lsp/kasir`, `/resto/kasir`):
- Fetch categories from `StoreCategory` (sorted by `sortOrder`)
- Render as horizontal tabs above the product grid
- "Semua" tab shows all products
- Each tab filters by `categoryId`

**Toko POS (`/toko/kasir`):** No changes. Continues using string-based category filter.

### 4.2 Product Card/Button Colors

On F&B POS:
- Each product button/card uses `posColor` as background/border
- If `posColor` is null, use default theme color
- "86'd" badge overlay when `isActive = false` and `menuType = "kitchen"`

**Toko POS:** No changes. No color coding.

### 4.3 Variant Grouping in POS

Products with the same `variantGroupId` are visually grouped:
- Show parent name + size buttons (Small / Medium / Large)
- Each button is a separate product with its own price

---

## 5. Tax Calculation at Checkout

### 5.1 Logic (sales route only, F&B units)

In `POST /api/toko/sales` and `POST /api/toko/split-bill`, after computing `unitPrice`:

```typescript
// Only for F&B products with exclusive tax
if (isFbUnit(unitType) && product.taxType === "exclusive" && Number(product.taxRate) > 0) {
  const taxAmount = Math.round(unitPrice * Number(product.taxRate) / 100);
  // taxAmount is added ON TOP of unitPrice for the customer
  // totalAmount includes tax
  // journal entries split revenue vs tax payable if needed
}
```

**For Toko:** `taxType` is always `"inclusive"` (default), so this code path is never hit. No behavior change.

**For F&B with `inclusive` or `none`:** Same as current behavior — no extra calculation.

---

## 6. GET Products API Changes

### 6.1 `/api/toko/products` Response

Add new fields to the mapped response:

```typescript
const mapped = products.map((p) => ({
  // ... existing fields ...
  // NEW fields (always returned, null-safe for Toko):
  categoryId: p.categoryId ?? null,
  menuType: p.menuType ?? null,
  taxType: p.taxType ?? "inclusive",
  taxRate: Number(p.taxRate ?? 11.0),
  posColor: p.posColor ?? null,
  variantGroupId: p.variantGroupId ?? null,
}));
```

**Toko frontend ignores these fields** — they're null/defaults, and the Toko React components don't render them.

### 6.2 `/api/toko/products/categories` Response (F&B)

For F&B units, return `StoreCategory` records:

```typescript
if (isFbUnit(unitType)) {
  const categories = await prisma.storeCategory.findMany({
    where: { unitType, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: { where: { deletedAt: null, isActive: true } } } } },
  });
  return NextResponse.json({ data: categories.map(c => ({ id: c.id, name: c.name, count: c._count.products, sortOrder: c.sortOrder })) });
}
// else: existing string-based aggregation (Toko)
```

---

## 7. File Map

### New Files
| File | Purpose |
|------|---------|
| `src/lib/constants/units.ts` | `FB_UNITS`, `isFbUnit()` helper |
| `src/components/forms/fb-menu-form.tsx` | Shared F&B menu form component |
| `src/app/(protected)/cafe-lsp/produk/tambah/page.tsx` | Add menu page (Cafe LSP) |
| `src/app/(protected)/cafe-lsp/produk/[id]/edit/page.tsx` | Edit menu page (Cafe LSP) |
| `src/app/(protected)/resto/produk/tambah/page.tsx` | Add menu page (Resto) |
| `src/app/(protected)/resto/produk/[id]/edit/page.tsx` | Edit menu page (Resto) |

### Modified Files
| File | Change | Risk to Toko |
|------|--------|-------------|
| `prisma/schema.prisma` | Add `StoreCategory` model + 6 fields to `StoreProduct` | None (nullable/defaulted) |
| `src/app/api/toko/products/route.ts` | Accept new fields in POST, return them in GET | None (guarded) |
| `src/app/api/toko/products/[id]/route.ts` | Accept new fields in PUT, return in GET | None (guarded) |
| `src/app/api/toko/products/categories/route.ts` | Add PUT/DELETE for StoreCategory, dual-mode GET | None (isFbUnit check) |
| `src/app/api/toko/sales/route.ts` | Tax calculation for exclusive F&B items (guarded) | None (guarded by `taxType === "exclusive"` + `isFbUnit`) |
| `src/app/api/toko/split-bill/route.ts` | Same tax calculation | None (guarded) |
| `src/app/(protected)/cafe-lsp/kasir/page.tsx` | Category tabs + color cards + variant grouping | N/A (Cafe LSP only) |
| `src/app/(protected)/resto/kasir/page.tsx` | Category tabs + color cards + variant grouping | N/A (Resto only) |
| `src/app/(protected)/cafe-lsp/produk/page.tsx` | Category management UI + new fields in table | N/A (Cafe LSP only) |
| `src/app/(protected)/resto/produk/page.tsx` | Category management UI + new fields in table | N/A (Resto only) |
| `src/app/api/admin/migrate/route.ts` | Add ALTER TABLE for new columns | None (additive only) |

### Unchanged Files (Explicitly Listed — Do NOT Touch)
| File | Reason |
|------|--------|
| `src/app/api/toko/sales/route.ts` (stock deduction) | `isRacikan`/`trackStock` logic is correct |
| `src/app/api/toko/stock-tracking/opname/route.ts` | Already fixed separately |
| `src/app/(protected)/toko/**` | All Toko pages unchanged |
| `src/app/api/mobile/toko/route.ts` | Mobile POS unchanged |
| `src/app/api/toko/products/import/route.ts` | Import unchanged |
| `src/app/api/toko/products/bulk/route.ts` | Bulk actions unchanged |
| `src/app/api/unit-transactions/void-*.ts` | Void flow unchanged |

---

## 8. Migration Checklist

- [ ] Add `StoreCategory` model to `prisma/schema.prisma`
- [ ] Add 6 fields to `StoreProduct` in `prisma/schema.prisma`
- [ ] Run `prisma db push` locally
- [ ] Add ALTER TABLE statements to `/api/admin/migrate` for production
- [ ] Add `FB_UNITS` constant to `src/lib/constants/units.ts`
- [ ] Create `StoreCategory` CRUD endpoints (PUT/DELETE new, GET/POST modified)
- [ ] Modify POST/PUT products to accept new fields
- [ ] Modify GET products to return new fields
- [ ] Create F&B menu form component
- [ ] Create add/edit pages for Cafe LSP and Resto
- [ ] Update F&B POS pages (category tabs, colors, variants)
- [ ] Add tax calculation guard in sales/split-bill routes
- [ ] Test: Create F&B product → verify new fields saved
- [ ] Test: Toko product creation → verify no change in behavior
- [ ] Test: Toko sale → verify stock still decreases correctly
- [ ] Test: F&B sale with exclusive tax → verify tax added
- [ ] Deploy and run migration on production

---

## 9. Out of Scope

These were considered but explicitly excluded:
- **Modifier system redesign** — existing JSON-based system in `app_settings` works fine
- **Kitchen routing** — KDS already functional
- **Auto-recipe / ingredient deduction** — management confirmed they don't use this
- **Photo gallery** — single `imageUrl` is sufficient
- **Nutritional info** — not needed for this deployment
