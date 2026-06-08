# Takeaway Surcharge — Cafe & Resto Unit

**Date:** 2026-06-09
**Status:** Approved
**Scope:** Resto & Cafe (Latar) only — `resto` / `resto_cafe` / `coffe_latar` unitTypes

---

## Overview

Add a configurable per-item surcharge (default Rp 1,000) for takeaway orders in the Resto & Cafe POS. The surcharge applies per quantity unit — e.g., 3 items total = Rp 3,000 surcharge. Dine-in orders are unaffected.

Admin can toggle the surcharge on/off and adjust the nominal amount from the existing Modifier & Add-on page (`/resto/modifiers`).

---

## Requirements

1. **Per-item surcharge** — Rp 1,000 × total quantity of items in takeaway cart
2. **Admin configurable** — toggle ON/OFF + adjustable nominal via `/resto/modifiers`
3. **Resto-only** — does NOT apply to Cafe LSP or other units
4. **Separate line display** — cart shows "Biaya Takeaway (N item): Rp X" as its own row
5. **Receipt visibility** — 80mm thermal receipt shows surcharge as separate line
6. **Report breakdown** — laporan shows surcharge separately from item revenue
7. **Transaction detail** — riwayat shows surcharge info in detail dialog
8. **Server validation** — server recomputes surcharge from config, does NOT trust client
9. **Split-bill support** — surcharge distributed proportionally across split bills
10. **Default** — Rp 1,000 per item, enabled = true

---

## Data Model

### Config Storage

**Table:** `AppSetting`
**Key:** `takeaway_surcharge_resto`

```json
{
  "enabled": true,
  "amountPerItem": 1000
}
```

Default (if no DB row exists): `{ enabled: true, amountPerItem: 1000 }`.

Uses the existing `AppSetting` model — no schema migration required. Follows the same pattern as modifier configs (`modifiers_product_{id}`).

### Transaction Storage

**`StoreSale.metadata`** (JSON field, already exists):

```json
{
  "orderType": "takeaway",
  "tableNo": "T-1",
  "takeawaySurcharge": 3000,
  "takeawaySurchargePerItem": 1000
}
```

- `takeawaySurcharge` — total surcharge for this sale (amountPerItem × totalQty)
- `takeawaySurchargePerItem` — per-item nominal (for receipt breakdown)
- Both fields are **omitted** (undefined) for dine-in orders and when surcharge is disabled

**`StoreSale.totalAmount`** — includes surcharge. Example:
- Items: 2×15,000 + 1×5,000 = 35,000
- Surcharge: 3×1,000 = 3,000
- `totalAmount` = 38,000

---

## API

### New Endpoint: `GET/PUT /api/toko/takeaway-surcharge`

**GET:**
- Reads `AppSetting` where `key = "takeaway_surcharge_resto"`
- Returns default if no row found
- RBAC: admin Resto, operator

**PUT:**
- Body: `{ enabled: boolean, amountPerItem: number }`
- Validation: `amountPerItem >= 0`, integer
- Upserts `AppSetting`
- RBAC: admin Resto, operator only (kasir cannot change)

### Modified: `POST /api/toko/sales`

After computing `totalAmount` from item subtotals:

1. Read surcharge config from `AppSetting`
2. If `body.takeawaySurcharge > 0` and config `enabled`:
   - Recompute: `totalQty × config.amountPerItem`
   - Validate matches client-sent value → 400 if mismatch
   - Add to `totalAmount`
3. Store surcharge in `StoreSale.metadata`

### Modified: `POST /api/toko/split-bill`

Same validation logic. Surcharge distributed proportionally:
- Each split bill gets `takeawaySurcharge = (billItems / totalItems) × totalSurcharge`
- Rounded to nearest integer

---

## Client-Side

### Modifier Page (`/resto/modifiers/page.tsx`)

Add config card at top of page (before modifier groups):

- Toggle switch: enabled ON/OFF
- Number input: amountPerItem (min 0, step 500, default 1000)
- Description text: "Berlaku untuk semua pesanan takeaway (T-*). Tidak berlaku untuk dine-in."
- Save button → PUT `/api/toko/takeaway-surcharge`
- On mount: GET config to populate

### POS Kasir (`/resto/kasir/page.tsx`)

**Cart calculation:**

```typescript
const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
const takeawaySurcharge = isTakeaway && config?.enabled
  ? totalQty * config.amountPerItem
  : 0;
const grandTotal = subtotal + takeawaySurcharge;
```

**Cart display:**

- Items show normal prices
- After subtotal row, show: "Biaya Takeaway (N item): Rp X"
- Grand total = subtotal + surcharge
- Only visible when `activeTable.type === "takeaway"` and config enabled

**Checkout body:**

```json
{
  "items": [...],
  "takeawaySurcharge": 3000,
  "takeawaySurchargePerItem": 1000,
  "metadata": { "orderType": "takeaway", "tableNo": "T-1" }
}
```

### Receipt (`src/lib/export-utils.ts`)

After item list, before TOTAL:

```
─────────────────────────────
Biaya Takeaway (3)       3.000
─────────────────────────────
TOTAL               38.000
```

Only shown for takeaway orders where `metadata.takeawaySurcharge > 0`.

---

## Reporting & Display

### Riwayat (`/transaksi-unit/riwayat`)

In detail dialog/expand for takeaway orders:

```
Order Type: Takeaway
Biaya Takeaway: Rp 3.000 (3 item x Rp 1.000)
```

Read from `metadata.takeawaySurcharge` and `metadata.takeawaySurchargePerItem`.

### Laporan (`/unit/resto/laporan`)

In summary/revenue section:

- "Total Pendapatan Takeaway: Rp X (termasuk surcharge Rp Y)"
- Surcharge extracted from `metadata.takeawaySurcharge` via JavaScript filter (same pattern as void filter)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/toko/takeaway-surcharge/route.ts` | **NEW** — GET/PUT config endpoint |
| `src/app/(protected)/resto/kasir/page.tsx` | Load config, compute surcharge, cart display, checkout body |
| `src/app/(protected)/resto/modifiers/page.tsx` | Add surcharge config card at top |
| `src/app/api/toko/sales/route.ts` | Validate + add surcharge to totalAmount + metadata |
| `src/app/api/toko/split-bill/route.ts` | Same validation + proportional distribution |
| `src/lib/export-utils.ts` | Receipt 80mm — surcharge line |
| `src/app/(protected)/transaksi-unit/riwayat/page.tsx` | Show surcharge in detail dialog |
| `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx` | Surcharge breakdown in report |

---

## Security

- Server recomputes surcharge from DB config — client cannot forge arbitrary amounts
- RBAC: only admin Resto + operator can modify surcharge config
- Surcharge only applies when `metadata.orderType === "takeaway"` — dine-in cannot trigger
- `isSameUnit()` used for RBAC (alias-aware: `resto_cafe`, `coffe_latar` included)
