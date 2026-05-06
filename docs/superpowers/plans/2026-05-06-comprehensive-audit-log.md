# Comprehensive Audit Log Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audit logging to ALL stock/inventory and unit transaction operations, and enhance the Audit Log page with unit-type and role-based filters so every operation across every unit is fully traceable.

**Architecture:** Insert `logAuditFromRequest()` calls (fire-and-forget, non-blocking) into 5 API routes that currently lack audit trails. Add `unitType` field to AuditLog schema for filtering. Extend the audit log API with `unitType` and `userRole` filter params. Update the audit log page UI with new filter dropdowns.

**Tech Stack:** Next.js 16 API routes, Prisma ORM, React + TanStack Table, NextAuth sessions.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `unitType` column to AuditLog model |
| `src/lib/audit-logger.ts` | Modify | Add `unitType` to AuditLogParams, pass through to create |
| `src/app/api/toko/products/[id]/stock/route.ts` | Modify | Add `logAuditFromRequest` for stock-in, stock-out, transfer, writeoff |
| `src/app/api/mobile/toko/stock-in/route.ts` | Modify | Add `logAudit` for mobile stock-in |
| `src/app/api/unit-transactions/void-request/route.ts` | Modify | Add `logAuditFromRequest` for void requests |
| `src/app/api/unit-transactions/void-approve/route.ts` | Modify | Add `logAuditFromRequest` for void approvals |
| `src/app/api/toko/movements/[id]/void/route.ts` | Modify | Add `logAuditFromRequest` for stock movement voids |
| `src/app/api/audit-logs/route.ts` | Modify | Add `unitType` and `userRole` filter params, extend search |
| `src/app/(protected)/audit-log/page.tsx` | Modify | Add Unit Type and User Role filter dropdowns |

---

## Task 1: Add `unitType` column to AuditLog schema

**Files:**
- Modify: `prisma/schema.prisma` (AuditLog model, around line 1038)

- [ ] **Step 1: Add unitType column to AuditLog model**

Add the following column after the `requestUrl` field (around line 1040):

```prisma
  // Unit context — which business unit this action belongs to
  unitType      String?   @map("unit_type")
```

- [ ] **Step 2: Create and run the migration**

Run:
```bash
npx prisma migrate dev --name add_unit_type_to_audit_log
```
Expected: Migration created and applied successfully.

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add unitType column to AuditLog schema for unit-scoped filtering"
```

---

## Task 2: Extend audit-logger.ts with unitType support

**Files:**
- Modify: `src/lib/audit-logger.ts`

- [ ] **Step 1: Add `unitType` to the `AuditLogParams` interface**

Add after line 78 (`metadata?: Record<string, any> | null;`):

```typescript
    // Unit context
    unitType?: string | null;
```

- [ ] **Step 2: Pass `unitType` through in `logAudit()`**

In the `logAudit` function (around line 135), add `unitType` to the `prisma.auditLog.create` data object, after the `metadata` field:

```typescript
                    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                    unitType: params.unitType || null,
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/audit-logger.ts
git commit -m "feat: add unitType parameter to audit logger"
```

---

## Task 3: Add audit logging to stock operations (web)

**Files:**
- Modify: `src/app/api/toko/products/[id]/stock/route.ts`

This file handles 4 operation types: `in`, `out`, `transfer`, `out_writeoff`. Add `logAuditFromRequest` after each successful operation.

- [ ] **Step 1: Add import at top of file**

Add after the existing imports (line 5):

```typescript
import { logAuditFromRequest, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";
```

- [ ] **Step 2: Add audit log for TRANSFER (after line 100, before the return)**

After the transfer return response is built (the `return NextResponse.json({` at line 97), add the audit call BEFORE the return. Insert right before `return NextResponse.json({` at line 97:

```typescript
            // Audit log
            try {
                await logAuditFromRequest(request, session, {
                    action: "UPDATE",
                    module: "Toko",
                    description: `Transfer stok ${qty} unit ${product.name} (${from === "gudang" ? "Gudang → Toko" : "Toko → Gudang"})`,
                    targetId: productId,
                    targetType: "StoreProduct",
                    oldData: { stock: effectiveStock, stockGdg: product.stockGdg, stockToko: product.stockToko },
                    newData: { stock: newStock, stockGdg: newStockGdg, stockToko: newStockToko },
                    metadata: { type: "transfer", quantity: qty, from, to, notes: notes || null },
                    unitType: product.unitType,
                });
            } catch (e) { /* audit failure must not break response */ }
```

- [ ] **Step 3: Add audit log for STOCK IN (after line 246, before the return)**

Insert right before the `return NextResponse.json({` that contains `Stok masuk berhasil` (around line 235):

```typescript
            // Audit log
            try {
                await logAuditFromRequest(request, session, {
                    action: "UPDATE",
                    module: "Toko",
                    description: `Stok masuk +${qty} unit ${product.name} (${stockLocation})${hargaBeli ? `, HPP: Rp ${Math.round(result.newCostPrice).toLocaleString()}` : ""}`,
                    targetId: productId,
                    targetType: "StoreProduct",
                    oldData: { stock: result.freshEffectiveStock, stockGdg: product.stockGdg, stockToko: product.stockToko, costPrice: Number(product.costPrice) },
                    newData: { stock: result.freshNewStock, stockGdg: result.freshStockGdg, stockToko: result.freshStockToko, costPrice: Math.round(result.newCostPrice) },
                    metadata: { type: "stock_in", quantity: qty, location: stockLocation, purchasePrice: hargaBeli || null, batchNo: result.batch.batchNo, supplierName: supplierName || null },
                    unitType: product.unitType,
                });
            } catch (e) { /* audit failure must not break response */ }
```

- [ ] **Step 4: Add audit log for STOCK OUT / WRITEOFF (after line 345, before the return)**

Insert right before the final `return NextResponse.json({` (around line 336):

```typescript
        // Audit log
        try {
            const auditAction = type === "out_writeoff" ? "DELETE" : "UPDATE";
            const auditDesc = type === "out_writeoff"
                ? `Stok keluar -${qty} unit ${product.name} (${reasonLabel(reason)}, ${stockLocation})`
                : `Pengurangan stok -${qty} unit ${product.name} (${stockLocation})`;
            await logAuditFromRequest(request, session, {
                action: auditAction,
                module: "Toko",
                description: auditDesc,
                targetId: productId,
                targetType: "StoreProduct",
                oldData: { stock: updatedProduct.freshEffectiveStock, stockGdg: product.stockGdg, stockToko: product.stockToko },
                newData: { stock: updatedProduct.freshNewStock, stockGdg: updatedProduct.freshStockGdg, stockToko: updatedProduct.freshStockToko },
                metadata: { type: type, quantity: qty, location: stockLocation, reason: movementReason, reasonNote: movementReasonNote || null },
                unitType: product.unitType,
            });
        } catch (e) { /* audit failure must not break response */ }
```

- [ ] **Step 5: Verify compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "stock/route" || echo "No errors in stock route"
```
Expected: No errors in the modified file.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/toko/products/[id]/stock/route.ts"
git commit -m "feat: add audit logging to stock operations (in, out, transfer, writeoff)"
```

---

## Task 4: Add audit logging to mobile stock-in

**Files:**
- Modify: `src/app/api/mobile/toko/stock-in/route.ts`

- [ ] **Step 1: Add import at top of file**

Add after line 3:

```typescript
import { logAudit } from "@/lib/audit-logger";
```

- [ ] **Step 2: Add audit log before the success return (around line 93)**

Insert before `return NextResponse.json({ data: result, message: "Stok masuk berhasil" });`:

```typescript
        // Audit log
        try {
            await logAudit({
                userId: parseInt(user.id),
                userName: user.name,
                userRole: user.role,
                action: "UPDATE",
                module: "Toko",
                description: `Stok masuk (Mobile) +${quantity} unit produk #${productId}${purchasePrice ? `, HPP: Rp ${purchasePrice.toLocaleString()}` : ""}`,
                targetId: productId,
                targetType: "StoreProduct",
                newData: { newStock: result.newStock, costPrice: result.newCostPrice },
                metadata: { type: "stock_in", source: "mobile", quantity, productId, purchasePrice: purchasePrice || null, batchNo: batchNo || null },
                unitType: "toko",
            });
        } catch (e) { /* audit failure must not break response */ }
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/mobile/toko/stock-in/route.ts"
git commit -m "feat: add audit logging to mobile stock-in"
```

---

## Task 5: Add audit logging to void operations

**Files:**
- Modify: `src/app/api/unit-transactions/void-request/route.ts`
- Modify: `src/app/api/unit-transactions/void-approve/route.ts`

- [ ] **Step 1: Add import to void-request**

Add after line 5 (`import { createNotification, getNotificationRecipients } from "@/lib/notifications";`):

```typescript
import { logAuditFromRequest } from "@/lib/audit-logger";
```

- [ ] **Step 2: Add audit log for StoreSale operator void (after line 252, before the return)**

Insert before the return that says `"Transaksi Toko dibatalkan oleh Operator"` (around line 249):

```typescript
                // Audit log
                try {
                    await logAuditFromRequest(request, session, {
                        action: "DELETE",
                        module: "Toko",
                        description: `VOID transaksi toko ${storeSale.saleNo} oleh Operator — ${reason}`,
                        targetId: storeSale.id,
                        targetType: "StoreSale",
                        oldData: { saleNo: storeSale.saleNo, totalAmount: Number(storeSale.totalAmount), paymentMethod: storeSale.paymentMethod },
                        metadata: { voidReason: reason, itemCount: storeSale.items.length, memberName: storeSale.member?.name || "Walk-in" },
                        unitType: storeSale.unitType || "toko",
                    });
                } catch (e) { /* audit failure must not break response */ }
```

- [ ] **Step 3: Add audit log for StoreSale void REQUEST (kasir path, after line 318, before the return)**

Insert before the return that says `"Permintaan void untuk transaksi"` (around line 318):

```typescript
                // Audit log
                try {
                    await logAuditFromRequest(request, session, {
                        action: "UPDATE",
                        module: "Toko",
                        description: `VOID REQUEST transaksi toko ${storeSale.saleNo} oleh ${session.user.name} — ${reason}`,
                        targetId: storeSale.id,
                        targetType: "StoreSale",
                        metadata: { voidReason: reason, status: "pending_approval", itemCount: storeSale.items.length },
                        unitType: storeSale.unitType || "toko",
                    });
                } catch (e) { /* audit failure must not break response */ }
```

- [ ] **Step 4: Add audit log for UnitTransaction operator void (after line 474, before the return)**

Insert before the return that says `"Permintaan Void berhasil disetujui secara otomatis"` (around line 472):

```typescript
                // Audit log
                try {
                    await logAuditFromRequest(request, session, {
                        action: "DELETE",
                        module: "Unit_Layanan",
                        description: `VOID transaksi ${transaction.transactionNo} (${transaction.unitType}) oleh Operator — ${reason}`,
                        targetId: transaction.id,
                        targetType: "UnitTransaction",
                        oldData: { transactionNo: transaction.transactionNo, amount: Number(transaction.amount), unitType: transaction.unitType },
                        metadata: { voidReason: reason, contraEntryNo: contraNo },
                        unitType: transaction.unitType,
                    });
                } catch (e) { /* audit failure must not break response */ }
```

- [ ] **Step 5: Add import to void-approve**

Add after line 5:

```typescript
import { logAuditFromRequest } from "@/lib/audit-logger";
```

- [ ] **Step 6: Add audit log for StoreSale void APPROVE (after line 289, before the return)**

Insert before the return that says `"Void Toko disetujui"` (around line 289):

```typescript
                // Audit log
                try {
                    await logAuditFromRequest(request, session, {
                        action: "DELETE",
                        module: "Toko",
                        description: `VOID APPROVE transaksi toko ${storeSale.saleNo} — ${metadata.voidPendingReason || reason || "Void disetujui"}`,
                        targetId: storeSale.id,
                        targetType: "StoreSale",
                        metadata: { approvedBy: currentUserId, itemCount: storeSale.items.length },
                        unitType: storeSale.unitType || "toko",
                    });
                } catch (e) { /* audit failure must not break response */ }
```

- [ ] **Step 7: Add audit log for UnitTransaction void APPROVE (after line 522, before the return)**

Insert before the return that says `"Void disetujui. Contra-Entry"` (around line 521):

```typescript
                // Audit log
                try {
                    await logAuditFromRequest(request, session, {
                        action: "DELETE",
                        module: "Unit_Layanan",
                        description: `VOID APPROVE transaksi ${originalTx.transactionNo} (${originalTx.unitType})`,
                        targetId: originalTx.id,
                        targetType: "UnitTransaction",
                        metadata: { contraEntryNo: contraNo, approvedBy: currentUserId },
                        unitType: originalTx.unitType,
                    });
                } catch (e) { /* audit failure must not break response */ }
```

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/unit-transactions/void-request/route.ts" "src/app/api/unit-transactions/void-approve/route.ts"
git commit -m "feat: add audit logging to void request and approval operations"
```

---

## Task 6: Add audit logging to stock movement void

**Files:**
- Modify: `src/app/api/toko/movements/[id]/void/route.ts`

- [ ] **Step 1: Check the file exists and read it**

Run:
```bash
ls "src/app/api/toko/movements/" -R
```

If `[id]/void/route.ts` exists, proceed. If not, check `src/app/api/toko/movements/*/void/route.ts` or grep for the void endpoint:

```bash
grep -r "movements.*void" src/app/api/ --include="*.ts" -l
```

- [ ] **Step 2: Add import**

Add after existing imports:

```typescript
import { logAuditFromRequest } from "@/lib/audit-logger";
```

- [ ] **Step 3: Add audit log before the success return**

Insert before the success return statement:

```typescript
        // Audit log
        try {
            await logAuditFromRequest(request, session, {
                action: "UPDATE",
                module: "Toko",
                description: `VOID mutasi stok #${movementId} — ${voidReason || "Tidak ada alasan"}`,
                targetId: movementId,
                targetType: "StoreStockMovement",
                oldData: { movementId, type: movement.type, quantity: movement.quantity, productId: movement.productId },
                metadata: { voidReason, restoredStock: true },
                unitType: movement.product?.unitType || "toko",
            });
        } catch (e) { /* audit failure must not break response */ }
```

Note: The exact field names depend on what the movement object looks like. Adjust `movement.type`, `movement.quantity`, `movement.productId`, and `movement.product?.unitType` to match the actual queried fields. Read the file first to verify.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/toko/movements/"
git commit -m "feat: add audit logging to stock movement void"
```

---

## Task 7: Extend Audit Log API with unitType and userRole filters

**Files:**
- Modify: `src/app/api/audit-logs/route.ts`

- [ ] **Step 1: Add new filter parameters**

After line 28 (`const dateTo = ...`), add:

```typescript
        const unitType = searchParams.get("unitType") || undefined;
        const userRole = searchParams.get("userRole") || undefined;
```

- [ ] **Step 2: Add filter conditions to the where clause**

After the `if (status) where.status = status;` line (around line 35), add:

```typescript
        if (unitType) where.unitType = unitType;
        if (userRole) where.userRole = userRole;
```

- [ ] **Step 3: Include unitType in the search OR clause**

Update the search OR array (around line 38) to also include unitType:

```typescript
        if (search) {
            where.OR = [
                { description: { contains: search, mode: "insensitive" } },
                { userName: { contains: search, mode: "insensitive" } },
                { ipAddress: { contains: search, mode: "insensitive" } },
                { targetType: { contains: search, mode: "insensitive" } },
                { unitType: { contains: search, mode: "insensitive" } },
            ];
        }
```

- [ ] **Step 4: Include unitType in the response data mapping**

Add `unitType` to the response mapping (around line 86, after `metadata: log.metadata,`):

```typescript
                unitType: log.unitType,
```

- [ ] **Step 5: Allow admin_sp role to access audit logs**

Change the role check on line 15 from:

```typescript
        if (userRole !== "operator") {
```

To:

```typescript
        if (userRole !== "operator" && userRole !== "admin_sp") {
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/audit-logs/route.ts
git commit -m "feat: add unitType, userRole filters and admin_sp access to audit log API"
```

---

## Task 8: Update Audit Log page UI with new filters

**Files:**
- Modify: `src/app/(protected)/audit-log/page.tsx`

- [ ] **Step 1: Add unitType and userRole to the AuditLog interface**

Add to the interface (after `metadata: string | null;` around line 37):

```typescript
    unitType: string | null;
```

- [ ] **Step 2: Add new filter state variables**

After `const [dateTo, setDateTo] = React.useState<string>("");` (around line 175), add:

```typescript
    const [filterUnitType, setFilterUnitType] = React.useState<string>("all");
    const [filterUserRole, setFilterUserRole] = React.useState<string>("all");
```

- [ ] **Step 3: Add new filters to fetchLogs params**

After `if (dateTo) params.set("dateTo", dateTo);` (around line 187), add:

```typescript
            if (filterUnitType !== "all") params.set("unitType", filterUnitType);
            if (filterUserRole !== "all") params.set("userRole", filterUserRole);
```

- [ ] **Step 4: Add new filters to useCallback dependency array**

Update the dependency array of `fetchLogs` (around line 200):

```typescript
    }, [filterModule, filterAction, filterStatus, searchQuery, dateFrom, dateTo, filterUnitType, filterUserRole]);
```

- [ ] **Step 5: Add UNIT_TYPES and ROLES constants**

After the `ACTIONS` array (around line 217), add:

```typescript
    const UNIT_TYPES = ["toko", "cuci_mobil", "barbershop", "play_station", "fitness", "coffe_latar", "resto_cafe", "resto", "laundry", "simpan_pinjam", "cafe_lsp"];
    const USER_ROLES = ["operator", "admin", "admin_sp", "admin_unit", "kasir", "anggota"];
```

- [ ] **Step 6: Add Unit Type and User Role filter dropdowns in the UI**

After the Status filter `<div>` block (the one with `filterStatus`, around line 345), add two more filter columns. Change the grid from `grid-cols-2 sm:grid-cols-4` to `grid-cols-2 sm:grid-cols-6`:

Find `<div className="grid gap-3 grid-cols-2 sm:grid-cols-4">` and change to:

```tsx
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-6">
```

After the Status filter block (the `</div>` that closes the Status select), add:

```tsx
                        <div className="space-y-1">
                            <Label className="text-xs">Unit</Label>
                            <Select value={filterUnitType} onValueChange={setFilterUnitType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Unit</SelectItem>
                                    {UNIT_TYPES.map(u => <SelectItem key={u} value={u}>{u.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Role</Label>
                            <Select value={filterUserRole} onValueChange={setFilterUserRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Role</SelectItem>
                                    {USER_ROLES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
```

- [ ] **Step 7: Add unitType column to the table**

After the `module` column definition (around line 249), add:

```tsx
        {
            accessorKey: "unitType", header: "Unit",
            cell: ({ row }) => {
                const ut = row.getValue("unitType") as string | null;
                return ut ? <Badge variant="outline" className="text-xs">{ut.replace(/_/g, " ")}</Badge> : <span className="text-muted-foreground text-xs">-</span>;
            },
        },
```

- [ ] **Step 8: Update the reset button to clear new filters**

Find the Reset Filter onClick handler (around line 358) and add the new filter resets:

```tsx
                            <Button variant="outline" size="sm" onClick={() => {
                                setFilterModule("all"); setFilterAction("all"); setFilterStatus("all");
                                setSearchQuery(""); setDateFrom(""); setDateTo("");
                                setFilterUnitType("all"); setFilterUserRole("all");
                            }}>Reset Filter</Button>
```

- [ ] **Step 9: Verify compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "audit-log/page" || echo "No errors in audit log page"
```
Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(protected)/audit-log/page.tsx"
git commit -m "feat: add unit type and user role filters to audit log page"
```

---

## Task 9: Add audit logging to unit layanan sales (cuci mobil, barbershop, dll.)

**Files:**
- Modify: `src/app/api/unit-layanan/sales/route.ts`

- [ ] **Step 1: Read the file and check if it already has logAudit**

```bash
grep -n "logAudit" "src/app/api/unit-layanan/sales/route.ts"
```

If it already has audit logging, skip this task. If not:

- [ ] **Step 2: Add import**

```typescript
import { logAuditFromRequest } from "@/lib/audit-logger";
```

- [ ] **Step 3: Add audit log after successful transaction creation**

Insert before the success return, adapting to the actual variable names in the file:

```typescript
        // Audit log
        try {
            await logAuditFromRequest(request, session, {
                action: "CREATE",
                module: "Unit_Layanan",
                description: `Transaksi ${unitType} ${transactionNo} — Rp ${Number(amount).toLocaleString()} (${paymentMethod})`,
                targetId: savedTransaction.id,
                targetType: "UnitTransaction",
                metadata: { transactionNo, unitType, paymentMethod, amount: Number(amount), memberName: memberName || "Walk-in" },
                unitType: unitType,
            });
        } catch (e) { /* audit failure must not break response */ }
```

Note: Read the file first to verify exact variable names (`savedTransaction`, `transactionNo`, `unitType`, `amount`, `paymentMethod`, `memberName`). Adjust accordingly.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/unit-layanan/sales/route.ts"
git commit -m "feat: add audit logging to unit layanan sales transactions"
```

---

## Task 10: Update mobile audit log API for new fields

**Files:**
- Modify: `src/app/api/mobile/audit-logs/route.ts`

- [ ] **Step 1: Read the file**

```bash
cat "src/app/api/mobile/audit-logs/route.ts"
```

- [ ] **Step 2: Add unitType to the response fields and add filter support**

Add `unitType` to the select fields and add `unitType` filter param similar to the web API. Also add `admin_sp` to allowed roles if not already present.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/mobile/audit-logs/route.ts"
git commit -m "feat: add unitType filter to mobile audit log API"
```

---

## Task 11: Final verification and integration test

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: Same count as before (no new errors).

- [ ] **Step 2: Manual smoke test checklist**

1. Open Audit Log page as Operator
2. Verify new "Unit" and "Role" filter dropdowns appear
3. Go to Toko → Persediaan → Stok Masuk (add stock to any product)
4. Return to Audit Log → verify the stock-in appears with correct unit type
5. Filter by unit type "toko" → verify only toko-related logs show
6. Filter by role "kasir" → verify only kasir actions show
7. Go to Persediaan → Transfer Stok → perform a transfer
8. Check Audit Log → verify transfer logged with oldData/newData
9. Go to Persediaan → Stok Keluar (writeoff) → perform a writeoff
10. Check Audit Log → verify writeoff logged with reason in description

- [ ] **Step 3: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "fix: minor adjustments from integration testing"
```
