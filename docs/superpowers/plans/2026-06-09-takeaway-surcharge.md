# Takeaway Surcharge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable per-item surcharge (default Rp 1,000) for takeaway orders in the Resto & Cafe POS, displayed as a separate line in cart/receipt/report, with admin config in the Modifier page.

**Architecture:** Config stored in `AppSetting` table (key `takeaway_surcharge_resto`). Surcharge computed client-side and validated server-side. Stored in `StoreSale.metadata` JSON field. No schema migration.

**Tech Stack:** Next.js API routes, Prisma, React state, existing AppSetting model

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/api/toko/takeaway-surcharge/route.ts` | **CREATE** | GET/PUT config endpoint |
| `src/app/api/toko/sales/route.ts` | MODIFY lines ~320, ~436 | Validate + add surcharge to totalAmount + metadata |
| `src/app/api/toko/split-bill/route.ts` | MODIFY lines ~142-150, ~261-268 | Validate + distribute surcharge proportionally |
| `src/app/api/unit-transactions/route.ts` | MODIFY `mapStoreSale()` ~line 26-27 | Extract `takeawaySurcharge` from metadata for riwayat |
| `src/app/(protected)/resto/kasir/page.tsx` | MODIFY lines ~234-239, ~309-346, ~739-743 | Load config, compute surcharge, cart display, checkout body |
| `src/app/(protected)/resto/modifiers/page.tsx` | MODIFY top section | Add surcharge config card |
| `src/lib/export-utils.ts` | MODIFY `KasirReceiptData` + receipt HTML ~line 751 | Add surcharge line to receipt |
| `src/app/(protected)/transaksi-unit/riwayat/page.tsx` | MODIFY `EnrichedTransaction` type + detail dialog ~line 1050 | Show surcharge info |
| `src/app/api/unit/[slug]/laporan/route.ts` | MODIFY `aggregateStoreSales` ~line 229-244 | Extract surcharge totals from metadata |
| `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx` | MODIFY summary interface + Dine-In card ~line 1182-1211 | Show surcharge breakdown |

---

### Task 1: Create Takeaway Surcharge API Endpoint

**Files:**
- Create: `src/app/api/toko/takeaway-surcharge/route.ts`

- [ ] **Step 1: Create the API route file**

```typescript
// src/app/api/toko/takeaway-surcharge/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSameUnit } from "@/lib/unit-aliases";

export const dynamic = "force-dynamic";

const SETTING_KEY = "takeaway_surcharge_resto";
const DEFAULT_CONFIG = { enabled: true, amountPerItem: 1000 };

// GET /api/toko/takeaway-surcharge — Read surcharge config
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        const unitType = (session.user as any).unitType as string | null;
        if (!["admin", "operator"].includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        // Only resto admins/operators can access
        if (role !== "operator" && !isSameUnit(unitType, "resto")) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
        const config = setting ? JSON.parse(setting.value) : DEFAULT_CONFIG;
        return NextResponse.json({ data: config });
    } catch (error) {
        console.error("[TakeawaySurcharge] GET error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// PUT /api/toko/takeaway-surcharge — Update surcharge config
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        const unitType = (session.user as any).unitType as string | null;
        if (!["admin", "operator"].includes(role)) {
            return NextResponse.json({ message: "Forbidden — hanya admin/operator" }, { status: 403 });
        }
        if (role !== "operator" && !isSameUnit(unitType, "resto")) {
            return NextResponse.json({ message: "Forbidden — bukan admin Resto" }, { status: 403 });
        }

        const body = await request.json();
        const enabled = Boolean(body.enabled);
        const amountPerItem = Number(body.amountPerItem);

        if (isNaN(amountPerItem) || amountPerItem < 0 || !Number.isInteger(amountPerItem)) {
            return NextResponse.json({ message: "Nominal per item harus bilangan bulat >= 0" }, { status: 400 });
        }

        const config = { enabled, amountPerItem };
        await prisma.appSetting.upsert({
            where: { key: SETTING_KEY },
            update: { value: JSON.stringify(config) },
            create: { key: SETTING_KEY, value: JSON.stringify(config), label: "Biaya Takeaway Resto" },
        });

        return NextResponse.json({ data: config });
    } catch (error) {
        console.error("[TakeawaySurcharge] PUT error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /c/Users/Acer/Downloads/koperasi-app && npx tsc --noEmit src/app/api/toko/takeaway-surcharge/route.ts 2>&1 | head -20`
Expected: No errors (or only pre-existing errors in other files)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/toko/takeaway-surcharge/route.ts
git commit -m "feat(resto): add takeaway surcharge config API endpoint"
```

---

### Task 2: Modify Sales API — Validate + Apply Surcharge

**Files:**
- Modify: `src/app/api/toko/sales/route.ts` (lines ~320 after totalAmount loop, ~436 metadata)

- [ ] **Step 1: Add surcharge validation after the price computation loop**

After line 321 (`validatedItems.push(...)`) and before line 323 (`// Validate payment`), insert:

```typescript
            // ── Takeaway surcharge validation ─────────────────────────────
            let takeawaySurcharge = 0;
            let takeawaySurchargePerItem = 0;
            const isTakeaway = (metadata as Record<string, unknown>)?.orderType === "takeaway";
            if (isTakeaway && Number(body.takeawaySurcharge) > 0) {
                const surchargeSetting = await prisma.appSetting.findUnique({ where: { key: "takeaway_surcharge_resto" } });
                const surchargeConfig = surchargeSetting ? JSON.parse(surchargeSetting.value) : null;
                if (surchargeConfig?.enabled) {
                    const totalQty = validatedItems.reduce((s, vi) => s + vi.quantity, 0);
                    const expected = totalQty * surchargeConfig.amountPerItem;
                    const clientSent = Number(body.takeawaySurcharge);
                    if (clientSent !== expected) {
                        throw new Error(`Nominal biaya takeaway tidak valid (diharapkan ${expected}, dikirim ${clientSent})`);
                    }
                    takeawaySurcharge = expected;
                    takeawaySurchargePerItem = surchargeConfig.amountPerItem;
                    totalAmount += takeawaySurcharge;
                }
            }
```

- [ ] **Step 2: Store surcharge in StoreSale metadata**

At line 436, replace:
```typescript
                    metadata: metadata ? metadata : null,
```
With:
```typescript
                    metadata: metadata ? {
                        ...(typeof metadata === "object" ? metadata : {}),
                        ...(takeawaySurcharge > 0 ? { takeawaySurcharge, takeawaySurchargePerItem } : {}),
                    } : (takeawaySurcharge > 0 ? { takeawaySurcharge, takeawaySurchargePerItem } : null),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /c/Users/Acer/Downloads/koperasi-app && npx tsc --noEmit src/app/api/toko/sales/route.ts 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/toko/sales/route.ts
git commit -m "feat(resto): validate and apply takeaway surcharge in sales API"
```

---

### Task 3: Modify Split-Bill API — Proportional Surcharge Distribution

**Files:**
- Modify: `src/app/api/toko/split-bill/route.ts` (lines ~142-150 for validation, ~261-268 for metadata)

- [ ] **Step 1: Add surcharge validation after price computation loop**

After line 145 (the `validatedItems.push(...)` line closing the item loop) and before line 147 (`// Verify payment total`), insert:

```typescript
            // ── Takeaway surcharge validation ─────────────────────────────
            let takeawaySurcharge = 0;
            let takeawaySurchargePerItem = 0;
            const isTakeawayOrder = orderType === "takeaway" || (reqMetadata as Record<string, unknown>)?.orderType === "takeaway";
            if (isTakeawayOrder && Number(body.takeawaySurcharge) > 0) {
                const surchargeSetting = await prisma.appSetting.findUnique({ where: { key: "takeaway_surcharge_resto" } });
                const surchargeConfig = surchargeSetting ? JSON.parse(surchargeSetting.value) : null;
                if (surchargeConfig?.enabled) {
                    const totalQty = validatedItems.reduce((s, vi) => s + vi.quantity, 0);
                    const expected = totalQty * surchargeConfig.amountPerItem;
                    const clientSent = Number(body.takeawaySurcharge);
                    if (clientSent !== expected) {
                        throw new Error(`Nominal biaya takeaway tidak valid (diharapkan ${expected}, dikirim ${clientSent})`);
                    }
                    takeawaySurcharge = expected;
                    takeawaySurchargePerItem = surchargeConfig.amountPerItem;
                    orderTotal += takeawaySurcharge;
                }
            }
```

- [ ] **Step 2: Add surcharge to each split sale's metadata proportionally**

At line 261, where `saleMetadata` is built, after `if (payment.memberId) saleMetadata.memberId = payment.memberId;` (line 269), add:

```typescript
                // Distribute takeaway surcharge proportionally across split bills
                if (takeawaySurcharge > 0) {
                    const billQty = allocatedItems.reduce((s: number, vi: { quantity: number }) => s + vi.quantity, 0);
                    const totalQty = validatedItems.reduce((s, vi) => s + vi.quantity, 0);
                    const billSurcharge = totalQty > 0 ? Math.round((billQty / totalQty) * takeawaySurcharge) : 0;
                    if (billSurcharge > 0) {
                        saleMetadata.takeawaySurcharge = billSurcharge;
                        saleMetadata.takeawaySurchargePerItem = takeawaySurchargePerItem;
                    }
                }
```

Also add `takeawaySurcharge` to the body destructuring at line 28:
```typescript
const { items, payments, unitType, customerName, tableNo, orderType, shiftId: reqShiftId, memberId, splitGroupId: existingGroupId, metadata: reqMetadata, takeawaySurcharge: _ts } = body;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /c/Users/Acer/Downloads/koperasi-app && npx tsc --noEmit src/app/api/toko/split-bill/route.ts 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/toko/split-bill/route.ts
git commit -m "feat(resto): add proportional takeaway surcharge to split-bill"
```

---

### Task 4: Expose Surcharge in Riwayat Data Pipeline

**Files:**
- Modify: `src/app/api/unit-transactions/route.ts` (`mapStoreSale` function ~line 26-27)
- Modify: `src/app/(protected)/transaksi-unit/riwayat/page.tsx` (`EnrichedTransaction` type ~line 43-53, detail dialog ~line 1050-1057)

- [ ] **Step 1: Add `takeawaySurcharge` and `takeawaySurchargePerItem` to `mapStoreSale` return**

In `src/app/api/unit-transactions/route.ts`, after line 27 (`const tableNo = ...`), add:

```typescript
    const takeawaySurcharge = (metadataObj as Record<string, unknown>).takeawaySurcharge as number | null || null;
    const takeawaySurchargePerItem = (metadataObj as Record<string, unknown>).takeawaySurchargePerItem as number | null || null;
```

And add these fields to the return object after line 45 (`tableNo,`):

```typescript
        takeawaySurcharge,
        takeawaySurchargePerItem,
```

- [ ] **Step 2: Update `EnrichedTransaction` type in riwayat page**

In `src/app/(protected)/transaksi-unit/riwayat/page.tsx`, add to the `EnrichedTransaction` type (after line 49 `tableNo`):

```typescript
    takeawaySurcharge?: number | null;
    takeawaySurchargePerItem?: number | null;
```

- [ ] **Step 3: Show surcharge info in detail dialog**

In the detail dialog, after the orderType badge block (after line 1057 `)}`), insert:

```tsx
                                {detailTx.orderType === "takeaway" && detailTx.takeawaySurcharge != null && detailTx.takeawaySurcharge > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">Biaya Takeaway</p>
                                        <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                                            {formatCurrency(detailTx.takeawaySurcharge)}
                                            {detailTx.takeawaySurchargePerItem ? ` (${Math.round(detailTx.takeawaySurcharge / detailTx.takeawaySurchargePerItem)} item × ${formatCurrency(detailTx.takeawaySurchargePerItem)})` : ""}
                                        </Badge>
                                    </div>
                                )}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/unit-transactions/route.ts src/app/(protected)/transaksi-unit/riwayat/page.tsx
git commit -m "feat(resto): show takeaway surcharge in riwayat detail dialog"
```

---

### Task 5: Add Surcharge to Receipt (Export Utils)

**Files:**
- Modify: `src/lib/export-utils.ts` (`KasirReceiptData` interface ~line 649, receipt HTML ~line 751)

- [ ] **Step 1: Add `takeawaySurcharge` and `takeawaySurchargeQty` to `KasirReceiptData`**

In the `KasirReceiptData` interface, after `unitLabel?: string;` (line 664), add:

```typescript
    takeawaySurcharge?: number;
    takeawaySurchargeQty?: number;
```

- [ ] **Step 2: Add surcharge row in receipt HTML**

Before the TOTAL row (line 752 `<tfoot><tr class="total-row">`), insert the surcharge row:

After line 751 (`${itemRows}</tbody>`), change to:

```typescript
	${itemRows}</tbody>
	${data.takeawaySurcharge && data.takeawaySurchargeQty ? `<tbody><tr><td colspan="3" style="padding:1px 0;">Biaya Takeaway (${data.takeawaySurchargeQty})</td><td style="text-align:right;">${formatRp(data.takeawaySurcharge)}</td></tr></tbody>` : ""}
	<tfoot><tr class="total-row">
```

Note: The `<tbody>` tag on line 751 must be kept — we insert a new `<tbody>` for the surcharge row between the items `</tbody>` and `<tfoot>`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/export-utils.ts
git commit -m "feat(resto): add takeaway surcharge line to thermal receipt"
```

---

### Task 6: Modify POS Kasir — Load Config, Compute Surcharge, Cart Display, Checkout

**Files:**
- Modify: `src/app/(protected)/resto/kasir/page.tsx` (multiple sections)

- [ ] **Step 1: Add state for surcharge config**

After the existing state declarations (around line ~40s, near the component top), add:

```typescript
    const [surchargeConfig, setSurchargeConfig] = React.useState<{ enabled: boolean; amountPerItem: number } | null>(null);
```

And add a useEffect to load the config (after the existing effects):

```typescript
    // Load takeaway surcharge config
    React.useEffect(() => {
        async function loadSurchargeConfig() {
            try {
                const res = await fetch("/api/toko/takeaway-surcharge");
                if (res.ok) {
                    const json = await res.json();
                    setSurchargeConfig(json.data);
                }
            } catch { /* non-critical */ }
        }
        loadSurchargeConfig();
    }, []);
```

- [ ] **Step 2: Compute surcharge in the cart calculation block**

After line 239 (`const change = Number(paymentAmount) - subtotal;`), add:

```typescript
    const isTakeaway = activeTable?.type === "takeaway";
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const takeawaySurcharge = (isTakeaway && surchargeConfig?.enabled && totalQty > 0)
        ? totalQty * surchargeConfig.amountPerItem
        : 0;
    const grandTotal = subtotal + takeawaySurcharge;
```

Also update line 239 to use `grandTotal` instead of `subtotal`:
```typescript
    const change = Number(paymentAmount) - grandTotal;
```

- [ ] **Step 3: Update payment validation to use grandTotal**

At line 304, change:
```typescript
        if (method === "cash" && Number(paymentAmount) < subtotal) { toast.error("Pembayaran kas kurang"); return; }
```
To:
```typescript
        if (method === "cash" && Number(paymentAmount) < grandTotal) { toast.error("Pembayaran kas kurang"); return; }
```

- [ ] **Step 4: Send surcharge in checkout body**

In the body construction (after line 342, before line 343 `};`), add:

```typescript
                ...(isTakeaway && takeawaySurcharge > 0 ? { takeawaySurcharge, takeawaySurchargePerItem: surchargeConfig?.amountPerItem || 0 } : {}),
```

Also update QRIS cash received (line 346) to use `grandTotal`:
```typescript
            if (method === "qris") body.cashReceived = grandTotal;
```

And the split bill section — find where split bill sends data (around line 931-951) and add surcharge fields:

In the split bill fetch body, add alongside existing fields:
```typescript
                ...(isTakeaway && takeawaySurcharge > 0 ? { takeawaySurcharge, takeawaySurchargePerItem: surchargeConfig?.amountPerItem || 0 } : {}),
```

- [ ] **Step 5: Display surcharge line in cart**

After the subtotal display (line 743 `</div>`), insert:

```tsx
                        {takeawaySurcharge > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-orange-600 font-medium">Biaya Takeaway ({totalQty} item)</span>
                                <span className="font-bold text-orange-700">{formatCurrency(takeawaySurcharge)}</span>
                            </div>
                        )}
```

Also update the subtotal label to say "Total" when there's a surcharge:

Change line 741-742:
```tsx
                            <span className="text-sm font-semibold text-slate-500">Subtotal</span>
                            <span className="text-2xl font-black tracking-tight text-slate-800">{formatCurrency(subtotal)}</span>
```
To:
```tsx
                            <span className="text-sm font-semibold text-slate-500">{takeawaySurcharge > 0 ? "Subtotal" : "Total"}</span>
                            <span className="text-2xl font-black tracking-tight text-slate-800">{formatCurrency(subtotal)}</span>
```

And after the surcharge line, add a grand total:
```tsx
                        {takeawaySurcharge > 0 && (
                            <div className="flex justify-between items-end pt-1">
                                <span className="text-sm font-bold text-slate-600">Total</span>
                                <span className="text-2xl font-black tracking-tight text-slate-800">{formatCurrency(grandTotal)}</span>
                            </div>
                        )}
```

- [ ] **Step 6: Update receipt reprint to include surcharge**

Find the `generateKasirReceiptPDF` call (around lines ~156-176 in the reprint section of riwayat — but in kasir page, search for where `generateKasirReceiptPDF` is called after a successful payment). Add the surcharge fields to the data object:

```typescript
takeawaySurcharge: takeawaySurcharge > 0 ? takeawaySurcharge : undefined,
takeawaySurchargeQty: totalQty > 0 ? totalQty : undefined,
```

- [ ] **Step 7: Commit**

```bash
git add src/app/(protected)/resto/kasir/page.tsx
git commit -m "feat(resto): compute and display takeaway surcharge in POS cart + checkout"
```

---

### Task 7: Add Surcharge Config to Modifier Page

**Files:**
- Modify: `src/app/(protected)/resto/modifiers/page.tsx`

- [ ] **Step 1: Add state and load/save functions for surcharge config**

After existing state declarations (around line 30), add:

```typescript
    const [surchargeEnabled, setSurchargeEnabled] = React.useState(true);
    const [surchargeAmount, setSurchargeAmount] = React.useState(1000);
    const [isSavingSurcharge, setIsSavingSurcharge] = React.useState(false);
```

Add a useEffect to load surcharge config (after the products load effect):

```typescript
    // Load takeaway surcharge config
    React.useEffect(() => {
        async function loadSurcharge() {
            try {
                const res = await fetch("/api/toko/takeaway-surcharge");
                if (res.ok) {
                    const json = await res.json();
                    setSurchargeEnabled(json.data.enabled);
                    setSurchargeAmount(json.data.amountPerItem);
                }
            } catch { /* non-critical */ }
        }
        loadSurcharge();
    }, []);
```

Add the save handler:

```typescript
    const handleSaveSurcharge = async () => {
        setIsSavingSurcharge(true);
        try {
            const res = await fetch("/api/toko/takeaway-surcharge", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: surchargeEnabled, amountPerItem: surchargeAmount }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success("Pengaturan biaya takeaway disimpan!");
        } catch (error: any) {
            toast.error(error.message || "Gagal menyimpan pengaturan");
        } finally { setIsSavingSurcharge(false); }
    };
```

- [ ] **Step 2: Add surcharge config card to JSX**

In the JSX, after the `<PageHeader>` component and before the `<div className="grid grid-cols-1...">` (around line 140), insert:

```tsx
            {/* ── Takeaway Surcharge Config ──────────────────────────────── */}
            <Card className="border-orange-200 bg-orange-50/30">
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-orange-600" />
                            <h3 className="font-semibold text-sm">Biaya Tambahan Takeaway</h3>
                        </div>
                        <button
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${surchargeEnabled ? "bg-orange-500" : "bg-slate-300"}`}
                            onClick={() => setSurchargeEnabled(!surchargeEnabled)}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${surchargeEnabled ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                    </div>
                    {surchargeEnabled && (
                        <div className="flex items-center gap-3">
                            <Label className="text-xs text-slate-500 whitespace-nowrap">Nominal per item</Label>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">Rp</span>
                                <Input
                                    type="number"
                                    className="h-8 w-28 text-sm"
                                    min={0}
                                    step={500}
                                    value={surchargeAmount}
                                    onChange={e => setSurchargeAmount(Number(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    )}
                    <p className="text-[11px] text-slate-400">
                        Berlaku untuk semua pesanan takeaway (T-*). Tidak berlaku untuk dine-in.
                    </p>
                    <Button size="sm" onClick={handleSaveSurcharge} disabled={isSavingSurcharge} className="bg-orange-600 hover:bg-orange-700">
                        {isSavingSurcharge ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Simpan Pengaturan
                    </Button>
                </CardContent>
            </Card>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(protected)/resto/modifiers/page.tsx
git commit -m "feat(resto): add takeaway surcharge config card to modifiers page"
```

---

### Task 8: Add Surcharge Breakdown to Laporan

**Files:**
- Modify: `src/app/api/unit/[slug]/laporan/route.ts` (`aggregateStoreSales` ~line 229-244)
- Modify: `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx` (`LaporanSummary` interface ~line 123-144, Dine-In card ~line 1182-1211)

- [ ] **Step 1: Add surcharge aggregation to laporan API**

In `src/app/api/unit/[slug]/laporan/route.ts`, in the `aggregateStoreSales` function, add surcharge tracking.

Add to the initial accumulator object (line 244): add `takeawaySurchargeTotal: 0` field:

```typescript
}, { total: 0, count: 0, tunai: 0, qris: 0, potongGaji: 0, dineIn: 0, takeaway: 0, counter: 0, dineInCount: 0, takeawayCount: 0, counterCount: 0, takeawaySurchargeTotal: 0 });
```

And add surcharge extraction inside the reduce (after the orderType classification block, before `return acc;`):

```typescript
                // Takeaway surcharge breakdown
                const surcharge = (meta as Record<string, unknown>).takeawaySurcharge as number | null;
                if (surcharge) acc.takeawaySurchargeTotal += surcharge;
```

Also add `takeawaySurchargeTotal` to the summary response object (after `counterCount` around line 374):

```typescript
                    takeawaySurchargeTotal: usesStoreSales ? storeSaleAgg.takeawaySurchargeTotal : 0,
```

- [ ] **Step 2: Add surcharge display to laporan page**

In `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx`:

Add to `LaporanSummary` interface (after `counterCount` line ~137):
```typescript
    takeawaySurchargeTotal: number;
```

In the Dine-In vs Takeaway breakdown card (after the takeaway card `</div>` at line ~1207, before `</CardContent>`), add surcharge info:

```tsx
                            {summary.takeawaySurchargeTotal > 0 && (
                                <p className="text-[10px] text-orange-500 mt-1">
                                    Termasuk biaya takeaway: {formatCurrency(summary.takeawaySurchargeTotal)}
                                </p>
                            )}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/unit/[slug]/laporan/route.ts src/app/(protected)/unit/[unitSlug]/laporan/page.tsx
git commit -m "feat(resto): add takeaway surcharge breakdown to laporan"
```

---

### Task 9: Integration Test & Final Verification

- [ ] **Step 1: Verify the dev server starts without errors**

Run: `cd /c/Users/Acer/Downloads/koperasi-app && npm run build 2>&1 | tail -30`
Expected: Build succeeds with no TypeScript errors related to our changes

- [ ] **Step 2: Manual verification checklist**

1. Login as `adminresto@koperasi.com` / `password123`
2. Go to `/resto/modifiers` — verify surcharge config card appears, toggle works, save persists
3. Go to `/resto/kasir` — click a takeaway table (T-1)
4. Add items to cart — verify surcharge line appears with correct amount
5. Checkout with cash — verify total includes surcharge
6. Verify receipt shows "Biaya Takeaway (N): Rp X" line
7. Go to `/transaksi-unit/riwayat?unitType=resto` — verify surcharge shown in detail dialog
8. Go to `/unit/resto/laporan` — verify surcharge breakdown in Dine-In vs Takeaway card

- [ ] **Step 3: Final commit with updated docs**

```bash
git add -A
git commit -m "feat(resto): complete takeaway surcharge feature — config, POS, receipt, reports"
```

- [ ] **Step 4: Update UNIT-CAFE-RESTO.md changelog**

Add to the changelog section:
```markdown
- **9 Jun 2026** — **Takeaway surcharge feature (8 files):**
  1. New API: `GET/PUT /api/toko/takeaway-surcharge` — config stored in `AppSetting` key `takeaway_surcharge_resto`
  2. Sales API: server-side validation + recomputation of surcharge, stored in `StoreSale.metadata`
  3. Split-bill: proportional surcharge distribution across bills
  4. POS kasir: surcharge computed per-item for takeaway tables, displayed as separate cart line
  5. Modifier page: admin toggle ON/OFF + adjustable nominal
  6. Receipt 80mm: "Biaya Takeaway (N)" line before TOTAL
  7. Riwayat: surcharge info in detail dialog
  8. Laporan: surcharge breakdown in Dine-In vs Takeaway card
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Req 1 (per-item surcharge) — Tasks 2, 3, 6
- ✅ Req 2 (admin configurable) — Tasks 1, 7
- ✅ Req 3 (resto-only) — Task 1 RBAC, Task 2 `isTakeaway` check
- ✅ Req 4 (separate line display) — Task 6 cart display
- ✅ Req 5 (receipt visibility) — Task 5
- ✅ Req 6 (report breakdown) — Task 8
- ✅ Req 7 (transaction detail) — Task 4
- ✅ Req 8 (server validation) — Tasks 2, 3
- ✅ Req 9 (split-bill support) — Task 3
- ✅ Req 10 (default Rp 1,000) — Task 1 `DEFAULT_CONFIG`

**2. Placeholder scan:** No TBD/TODO/placeholders found.

**3. Type consistency:** `takeawaySurcharge: number | null`, `takeawaySurchargePerItem: number | null` used consistently across mapStoreSale (Task 4), EnrichedTransaction type (Task 4), receipt interface (Task 5), and summary interface (Task 8).
