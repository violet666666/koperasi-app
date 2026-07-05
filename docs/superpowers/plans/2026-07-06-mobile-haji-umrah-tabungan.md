# Fase 9a.1 — Mobile Haji/Umrah Tabungan Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile staff (operator + admin `haji_umrah`) can list H&U savings accounts, view detail, make a setoran (atomic deposit), and open a rekening — full parity with web tabungan flows.

**Architecture:** DRY-extract the web setoran `$transaction` + buka-rekening create into shared helpers (`src/lib/services/haji-umrah-savings.ts`) that web + mobile both call (Fase 8b/8c pattern). Web refactor is behavior-preserving (byte-identical, opus-reviewed). New mobile routes under `/api/mobile/haji-umrah/*` (JWT auth). 4 mobile screens + nav.

**Tech Stack:** Next.js route handlers, Prisma 6, `crypto.randomBytes`, Expo 55 / RN 0.83, react-hook-form.

**Spec:** `docs/superpowers/specs/2026-07-06-mobile-haji-umrah-tabungan-design.md`

## Global Constraints (verbatim from spec)

- **Web setoran + buka-rekening refactors are BEHAVIOR-PRESERVING (byte-identical).** The `$transaction` (SavingsTransaction → SavingsAccount.balance → CashBankTransaction deposit [category `savings`, unitType `simpan_pinjam`] → optional CashBankTransaction fee [category `pendapatan_unit`, unitType `haji_umrah`] → CashBankAccount updates) moves VERBATIM to `processHajiUmrahDeposit`. Preserve the pre-existing unitType inconsistency (deposit `simpan_pinjam` / fee `haji_umrah`) — do NOT "fix" it.
- **TxnNo = `crypto.randomBytes`** — `HU-{year}-{9-digit}` (SavingsTransaction), `CBT-{txNo}` / `CBT-{txNo}-FEE` (CashBank). Never `Math.random`.
- **Atomicity:** setoran is one `$transaction` (saldo + CashBook integrity). Buka-rekening is a plain `create` (balance 0, no CashBook).
- **RBAC:** reads (list/detail/products) = any auth staff. Writes (setoran/buka-rekening) = `operator` OR (`admin` AND `unitType === "haji_umrah"`). `anggota` excluded from setoran.
- **Response shapes byte-identical to web** counterparts.
- **No tarik/withdrawal** (web has none).
- **DRY:** `processHajiUmrahDeposit` + `createHajiUmrahAccount` + `HAJI_UMRAH_TYPES` + `generateTxNo` live in `src/lib/services/haji-umrah-savings.ts`. Web + mobile import.
- `log.*` only in mobile screens; `console.error` only in server routes.
- **branch** = `railway-migration` (API auto-deploys on push; screens ship via EAS build #6).

---

### Task 1: `processHajiUmrahDeposit` + `createHajiUmrahAccount` shared helpers

**File:** `src/lib/services/haji-umrah-savings.ts` (new). No unit test (DB-bound `$transaction` — the opus behavior-preservation audit in T2 is the guard, same as Fase 8c T1).

**Interfaces:**
- Produces: `HAJI_UMRAH_TYPES`, `HajiUmrahSavingsError`, `processHajiUmrahDeposit`, `createHajiUmrahAccount` (consumed by T2 web routes + T4 mobile routes).

- [ ] **Step 1: Create the helper module with constants + typed error + txNo generator**

Create `src/lib/services/haji-umrah-savings.ts`:
```ts
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";

/** H&U savings product types. */
export const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

/**
 * Typed Error carrying an HTTP status code, so routes can map helper failures
 * back to the exact status/message the original web routes returned.
 */
export class HajiUmrahSavingsError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
        super(message);
        this.name = "HajiUmrahSavingsError";
        this.statusCode = statusCode;
    }
}

/** Cryptographically-secure SavingsTransaction number: HU-{year}-{9-digit}. */
function generateTxNo(): string {
    const year = new Date().getFullYear();
    const random = randomBytes(4).readUInt32BE(0) % 1_000_000_000;
    return `HU-${year}-${random.toString().padStart(9, "0")}`;
}
```

- [ ] **Step 2: Implement `processHajiUmrahDeposit` — VERBATIM move of web setoran money-core**

Source of truth: `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` lines 92-266 (body parse → validations → adminFee → $transaction → meta). Move the logic VERBATIM into the helper. The helper owns: amount validation, account+product load (404 if not found/not H&U), active check (400 if closed), adminFee calc, `generateTxNo`, WIB date parse, the `$transaction` (lines 149-250), and meta computation (lines 253-265).

```ts
export interface DepositInput {
    accountId: number;
    amount: number;
    paymentMethod?: string;
    cashBankAccountId?: number | null;
    referenceNo?: string | null;
    notes?: string | null;
    transactionDate?: string;
    userId: number;
}

export interface DepositResult {
    transaction: any; // SavingsTransaction with member + account.product includes
    meta: { adminFee: number; balanceAfter: number; target: number; progress: number; isTargetReached: boolean };
}

export async function processHajiUmrahDeposit(input: DepositInput): Promise<DepositResult> {
    const { accountId: id, amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate, userId } = input;

    if (!amount || amount <= 0) {
        throw new HajiUmrahSavingsError(400, "Jumlah setoran harus lebih dari 0");
    }

    // Fetch account with product — VERBATIM from web lines 100-114
    const account = await prisma.savingsAccount.findUnique({
        where: { id },
        include: { member: { select: { id: true, name: true, branchId: true } }, product: true },
    });
    if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
        throw new HajiUmrahSavingsError(404, "Rekening tidak ditemukan");
    }
    if (account.status !== "active") {
        throw new HajiUmrahSavingsError(400, "Rekening sudah ditutup");
    }

    // ── Calculate admin fee — VERBATIM web lines 117-126 ──
    let adminFee = 0;
    const product = account.product;
    if (product.adminFeeType && product.adminFeeValue) {
        const feeValue = Number(product.adminFeeValue);
        adminFee = product.adminFeeType === "percent" ? Math.round(amount * feeValue / 100) : feeValue;
    }

    const currentBalance = Number(account.balance);
    const balanceAfter = currentBalance + amount;
    const txNo = generateTxNo();

    // Parse date — WIB handling, VERBATIM web lines 134-144
    let txDate: Date;
    if (transactionDate) {
        const raw = String(transactionDate);
        txDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + "T12:00:00+07:00") : new Date(raw);
    } else {
        txDate = new Date();
    }
    const typeLabel = product.type === "tabungan_haji" ? "Haji" : "Umrah";

    // ── ATOMIC TRANSACTION — VERBATIM web lines 149-250 ──
    // (SavingsTransaction create → SavingsAccount.balance → CashBankTransaction deposit
    //  [category savings, unitType simpan_pinjam] → optional CashBankTransaction fee
    //  [category pendapatan_unit, unitType haji_umrah] → CashBankAccount updates)
    // Copy the ENTIRE $transaction callback body verbatim from the web route, including:
    //  - savingsTx create with all 15 fields (transactionNo: txNo, accountId: id, memberId, productId,
    //    branchId: account.member.branchId, type: "deposit", amount, balanceBefore: currentBalance,
    //    balanceAfter, paymentMethod: paymentMethod || "cash", cashBankAccountId: cashBankAccountId ?? null,
    //    referenceNo: referenceNo ?? null, notes: notes ?? `Setoran Tabungan ${typeLabel}`,
    //    transactionDate: txDate, createdById: userId) + include member/account.product
    //  - tx.savingsAccount.update balance
    //  - if cashBankAccountId: load cashBank, cbBefore/cbAfter, create CBT-{txNo} (category "savings",
    //    unitType "simpan_pinjam", referenceType "SavingsTransaction", referenceId: savingsTx.id),
    //    update CB balance; if adminFee>0: re-load CB, create CBT-{txNo}-FEE (category "pendapatan_unit",
    //    unitType "haji_umrah"), update CB balance.
    // Return [savingsTx] from the callback.
    const [transaction] = await prisma.$transaction(async (tx) => {
        // ... verbatim body from web route lines 151-249 ...
        return [savingsTx];
    });

    // Meta — VERBATIM web lines 253-265
    const target = Number(account.targetAmount ?? product.targetAmount ?? 0);
    const isTargetReached = target > 0 && balanceAfter >= target;
    return {
        transaction,
        meta: {
            adminFee,
            balanceAfter,
            target,
            progress: target > 0 ? Math.min(100, Math.round((balanceAfter / target) * 10000) / 100) : 0,
            isTargetReached,
        },
    };
}
```
**Implementer note:** open the web route file, copy the `$transaction` callback body (lines 151-249) verbatim into the helper — every field, category, unitType, balanceBefore/After, description string must match exactly. This is money-critical; the T2 opus review verifies byte-identity.

- [ ] **Step 3: Implement `createHajiUmrahAccount` — VERBATIM move of web buka-rekening**

Source: `src/app/api/haji-umrah/savings/route.ts` lines 91-156.
```ts
export interface CreateAccountInput {
    memberId: number;
    productId: number;
    targetAmount?: any;
    monthlyTarget?: any;
    maturityDate?: string;
}

export async function createHajiUmrahAccount(input: CreateAccountInput) {
    const { memberId, productId, targetAmount, monthlyTarget, maturityDate } = input;
    if (!memberId || !productId) {
        throw new HajiUmrahSavingsError(400, "memberId dan productId wajib diisi");
    }
    // VERBATIM web lines 102-133: validate product (H&U type, 400), member (404), duplicate (409)
    const product = await prisma.savingsProduct.findUnique({ where: { id: productId } });
    if (!product || !HAJI_UMRAH_TYPES.includes(product.type)) {
        throw new HajiUmrahSavingsError(400, "Produk bukan tipe tabungan haji/umrah");
    }
    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, branchId: true, status: true } });
    if (!member) throw new HajiUmrahSavingsError(404, "Anggota tidak ditemukan");

    const existing = await prisma.savingsAccount.findUnique({ where: { memberId_productId: { memberId, productId } } });
    if (existing) throw new HajiUmrahSavingsError(409, "Anggota sudah memiliki rekening untuk produk ini");

    // VERBATIM web lines 135-154: accountNo + create
    const accountNo = `HU-${memberId}-${productId}-${Date.now().toString().slice(-4)}`;
    const effectiveTarget = targetAmount ?? product.targetAmount;
    return prisma.savingsAccount.create({
        data: {
            accountNo, memberId, productId, branchId: member.branchId, balance: 0,
            openedDate: new Date(), targetAmount: effectiveTarget,
            monthlyTarget: monthlyTarget ?? null,
            maturityDate: maturityDate ? new Date(maturityDate) : null,
        },
        include: { member: { select: { id: true, memberNo: true, name: true, nrp: true } }, product: true },
    });
}
```

- [ ] **Step 4: tsc** — `npx tsc --noEmit` → no new errors in `haji-umrah-savings.ts`.

- [ ] **Step 5: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/lib/services/haji-umrah-savings.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(haji-umrah): processHajiUmrahDeposit + createHajiUmrahAccount shared helpers (Fase 9a.1 T1)"
```

---

### Task 2: Web route refactor (HIGHEST RISK — behavior-preserving)

**Files:**
- Modify: `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` (POST setoran → call helper; GET unchanged; remove `generateTxNo` + local `HAJI_UMRAH_TYPES`, import from helper).
- Modify: `src/app/api/haji-umrah/savings/route.ts` (POST buka-rekening → call helper; GET unchanged; remove local `HAJI_UMRAH_TYPES`, import from helper).

**Interfaces:**
- Consumes: `processHajiUmrahDeposit`, `createHajiUmrahAccount`, `HajiUmrahSavingsError`, `HAJI_UMRAH_TYPES` from T1.

- [ ] **Step 1: Refactor the setoran POST** — replace the inline money logic (body parse → validations → $transaction → response, web lines 92-266) with a helper call. Auth (session + anggota-403 + userId) + params parse + response wrapping STAY. The helper owns the money logic + throws `HajiUmrahSavingsError` for 400/404; the route catches it → status.

```ts
// POST /api/haji-umrah/savings/[accountId]/transactions
export async function POST(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const roleName = (session.user as Record<string, unknown>).role?.name || (session.user as Record<string, unknown>).role;
        if (roleName === "anggota") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        const userId = Number((session.user as Record<string, unknown>).id);

        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });

        const body = await request.json();
        const { amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate } = body;

        const result = await processHajiUmrahDeposit({
            accountId: id, amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate, userId,
        });
        return NextResponse.json({ data: result.transaction, meta: result.meta }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof HajiUmrahSavingsError) {
            return NextResponse.json({ message: error.message }, { status: error.statusCode });
        }
        console.error("POST /api/haji-umrah/savings/[accountId]/transactions error:", error);
        return NextResponse.json({ message: "Failed to create transaction" }, { status: 500 });
    }
}
```
Imports at top: `import { HAJI_UMRAH_TYPES, HajiUmrahSavingsError, processHajiUmrahDeposit } from "@/lib/services/haji-umrah-savings";`. Remove the local `HAJI_UMRAH_TYPES` const (line 6) + `generateTxNo` (lines 8-12) — the GET handler still uses `HAJI_UMRAH_TYPES` (now imported). Remove now-unused `import { randomBytes } from "crypto"`.

- [ ] **Step 2: Refactor the buka-rekening POST** (`savings/route.ts`) — replace inline (lines 91-156) with helper call.
```ts
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const body = await request.json();
        const { memberId, productId, targetAmount, monthlyTarget, maturityDate } = body;
        const account = await createHajiUmrahAccount({ memberId, productId, targetAmount, monthlyTarget, maturityDate });
        return NextResponse.json({ data: account }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof HajiUmrahSavingsError) {
            return NextResponse.json({ message: error.message }, { status: error.statusCode });
        }
        console.error("POST /api/haji-umrah/savings error:", error);
        return NextResponse.json({ message: "Failed to create savings account" }, { status: 500 });
    }
}
```
Imports: `import { HAJI_UMRAH_TYPES, HajiUmrahSavingsError, createHajiUmrahAccount } from "@/lib/services/haji-umrah-savings";`. Remove local `HAJI_UMRAH_TYPES` (line 5) — GET still uses it (imported). Remove `import prisma` ONLY if GET no longer uses it (GET does use prisma — keep it).

- [ ] **Step 3: Verify behavior unchanged** — diff the helper's logic + the routes' responses vs the old inline. The web H&U deposit flow + buka-rekening must work unchanged. (Opus review in the final step verifies byte-identity.)

- [ ] **Step 4: tsc** — `npx tsc --noEmit` → no new errors.

- [ ] **Step 5: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add "src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts" src/app/api/haji-umrah/savings/route.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "refactor(haji-umrah): web setoran + buka-rekening use shared helpers (Fase 9a.1 T2)"
```

---

### Task 3: Mobile read routes (list + detail + products)

**Files:**
- Create: `src/app/api/mobile/haji-umrah/savings/route.ts` (GET list).
- Create: `src/app/api/mobile/haji-umrah/savings/[accountId]/route.ts` (GET detail).
- Create: `src/app/api/mobile/haji-umrah/products/route.ts` (GET list).

**Interfaces:**
- Consumes: `HAJI_UMRAH_TYPES` from T1. `getMobileUser`/`unauthorizedResponse` from `../middleware` (or `../../middleware` for the `[accountId]` depth — verify depth per route).

- [ ] **Step 1: GET list `/api/mobile/haji-umrah/savings`** — VERBATIM mirror of web `GET /api/haji-umrah/savings` (lines 8-81), swapping `auth()` session for `getMobileUser`. Gate: any auth (no role check — reads). Response `{ data: enriched[], meta }` byte-identical. Use `import { getMobileUser, unauthorizedResponse } from "../../middleware";` + `import { HAJI_UMRAH_TYPES } from "@/lib/services/haji-umrah-savings";`.

- [ ] **Step 2: GET detail `/api/mobile/haji-umrah/savings/[accountId]`** — VERBATIM mirror of web `GET /api/haji-umrah/savings/[accountId]` (read that file; it returns `{ data: {...account, balance, target, progress, monthlyTarget, stats: {totalDeposits, monthlyDeposits, depositCount, remaining, monthsRemaining, isTargetReached}, transactions (last 50)} }`). Swap auth for `getMobileUser`. `params: Promise<{ accountId: string }>` + `await params`. Depth: `../../../middleware` (3 levels: `[accountId]`→`savings`→`haji-umrah`→`mobile`).

- [ ] **Step 3: GET products `/api/mobile/haji-umrah/products`** — mirror web `GET /api/haji-umrah/products` (returns `{ data: SavingsProduct[] }` where type ∈ HAJI_UMRAH_TYPES, deletedAt null, ordered by code). Swap auth. Depth: `../../middleware`.

- [ ] **Step 4: tsc** — no new errors. Verify `await params` + middleware import depth.

- [ ] **Step 5: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add "src/app/api/mobile/haji-umrah/savings/route.ts" "src/app/api/mobile/haji-umrah/savings/[accountId]/route.ts" "src/app/api/mobile/haji-umrah/products/route.ts"
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): GET haji-umrah savings list/detail + products (Fase 9a.1 T3)"
```

---

### Task 4: Mobile write routes (setoran + buka-rekening)

**Files:**
- Create: `src/app/api/mobile/haji-umrah/savings/[accountId]/transactions/route.ts` (POST setoran).
- Create: `src/app/api/mobile/haji-umrah/savings/[accountId]/create/route.ts` (POST buka-rekening — note: nested under `[accountId]` would conflict; place buka-rekening at `src/app/api/mobile/haji-umrah/savings/open/route.ts` POST instead, to avoid path collision with the `[accountId]` segment).

**Interfaces:**
- Consumes: `processHajiUmrahDeposit`, `createHajiUmrahAccount`, `HajiUmrahSavingsError` from T1. `getMobileUserWithScope`, `unauthorizedResponse` from middleware.

- [ ] **Step 1: POST setoran `/api/mobile/haji-umrah/savings/[accountId]/transactions`** — gate operator OR admin haji_umrah; call `processHajiUmrahDeposit`. Mirror the web POST response shape (`{ data, meta }` 201). Audit + RBAC:
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../../../middleware";
import { processHajiUmrahDeposit, HajiUmrahSavingsError } from "@/lib/services/haji-umrah-savings";

export async function POST(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();
    // operator OR (admin AND unitType haji_umrah)
    const allowed = user.role === "operator" || (user.role === "admin" && user.unitType === "haji_umrah");
    if (!allowed) return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });

    try {
        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        const { amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate } = await request.json();
        const result = await processHajiUmrahDeposit({ accountId: id, amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate, userId: Number(user.id) });

        await prisma.auditLog.create({ data: {
            action: "CREATE", module: "Haji-Umrah",
            description: `Setoran H&U rekening ${id}: ${amount}`,
            userId: Number(user.id), userName: user.name, userRole: user.role, status: "success",
            newData: JSON.stringify({ accountId: id, amount, txnNo: result.transaction.transactionNo }),
        }}).catch(() => {});

        return NextResponse.json({ data: result.transaction, meta: result.meta }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof HajiUmrahSavingsError) return NextResponse.json({ message: error.message }, { status: error.statusCode });
        console.error("POST /api/mobile/haji-umrah/savings/[accountId]/transactions error:", error);
        return NextResponse.json({ message: "Failed to create transaction" }, { status: 500 });
    }
}
```
Verify middleware import depth (`../../../../middleware` from `savings/[accountId]/transactions/`): up transactions→[accountId]→savings→haji-umrah→mobile = 4 levels → `../../../../middleware`. Confirm by counting against a sibling route.

- [ ] **Step 2: POST buka-rekening `/api/mobile/haji-umrah/savings/open`** — gate operator OR admin haji_umrah; call `createHajiUmrahAccount`. (Placed at `/savings/open`, NOT `/savings` POST, to avoid the `[accountId]` dynamic segment colliding at the `/savings/*` level — `/savings/route.ts` GET list + `/savings/[accountId]/route.ts` GET detail already occupy `/savings` + `/savings/[id]`; a `/savings` POST + `/savings/[accountId]` GET coexist fine, but to keep the create endpoint's path unambiguous for the mobile client, `/savings/open` is clearest. The mobile screen posts to `/api/mobile/haji-umrah/savings/open`.)
```ts
// src/app/api/mobile/haji-umrah/savings/open/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../../middleware";
import { createHajiUmrahAccount, HajiUmrahSavingsError } from "@/lib/services/haji-umrah-savings";

export async function POST(request: Request) {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();
    const allowed = user.role === "operator" || (user.role === "admin" && user.unitType === "haji_umrah");
    if (!allowed) return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });

    try {
        const { memberId, productId, targetAmount, monthlyTarget, maturityDate } = await request.json();
        const account = await createHajiUmrahAccount({ memberId, productId, targetAmount, monthlyTarget, maturityDate });

        await prisma.auditLog.create({ data: {
            action: "CREATE", module: "Haji-Umrah",
            description: `Buka rekening H&U ${account.accountNo} (member ${memberId})`,
            userId: Number(user.id), userName: user.name, userRole: user.role, status: "success",
            newData: JSON.stringify({ accountId: account.id, accountNo: account.accountNo }),
        }}).catch(() => {});

        return NextResponse.json({ data: account }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof HajiUmrahSavingsError) return NextResponse.json({ message: error.message }, { status: error.statusCode });
        console.error("POST /api/mobile/haji-umrah/savings/open error:", error);
        return NextResponse.json({ message: "Failed to create savings account" }, { status: 500 });
    }
}
```
Depth `../../../middleware` from `savings/open/`: up open→savings→haji-umrah→mobile = 3 → `../../../middleware`. Confirm.

- [ ] **Step 3: tsc** — no new errors. Verify middleware depths + `await params`.

- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add "src/app/api/mobile/haji-umrah/savings/[accountId]/transactions/route.ts" "src/app/api/mobile/haji-umrah/savings/open/route.ts"
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): POST haji-umrah setoran + buka-rekening (Fase 9a.1 T4)"
```

---

### Task 5: `HajiUmrahScreen` (account list) + dashboard nav entry

**Files:**
- Create: `mobile/src/screens/operator/HajiUmrahScreen.tsx`.
- Modify: `mobile/src/screens/common/DashboardScreen.tsx` (add "Haji & Umrah" menu entry, gate operator/admin/admin_sp).

**Interfaces:**
- Consumes: GET `/api/mobile/haji-umrah/savings` response `{ data: [{ id, accountNo, balance, target, progress, monthlyTarget, status, member:{name,memberNo,nrp}, product:{name,type} }], meta }`.

- [ ] **Step 1: Read the field contract** — open `src/app/api/mobile/haji-umrah/savings/route.ts` (T3 output) + confirm the exact `enriched[]` shape the list returns. The screen MUST read those field names exactly (Fase 6 lesson). Reference `GajiPeriodeScreen.tsx` for the flatlist + header + FAB + refresh pattern, and `AsetListScreen.tsx` for the operator-gated FAB.

- [ ] **Step 2: Implement `HajiUmrahScreen`** — FlatList of accounts (member name, product badge Haji/Umrah from `product.type`, `balance` vs `target`, progress bar from `progress`). Search input + type filter chips (Semua/Haji/Umrah → `?type=`). FAB "+ Buka Rekening" → `navigation.navigate("HajiUmrahBukaRekening")`, gate `canManage` (operator OR admin haji_umrah — read `unitType` from userData if present). Tap row → `navigation.navigate("HajiUmrahDetail", { accountId: item.id })`. Pull-to-refresh. `log.*` only.

- [ ] **Step 3: Add dashboard menu entry** — in `DashboardScreen.tsx`, add a "Haji & Umrah" button (Landmark/airplane icon) → `navigation.navigate("HajiUmrah")`, gated `userRole === "operator" || userRole === "admin" || userRole === "admin_sp"` (mirror existing menu items' gating).

- [ ] **Step 4: tsc** (`cd mobile && npx tsc --noEmit`) → no new errors. Grep `console.*` → 0 in the new screen.

- [ ] **Step 5: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/HajiUmrahScreen.tsx mobile/src/screens/common/DashboardScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): HajiUmrahScreen account list + dashboard nav (Fase 9a.1 T5)"
```

---

### Task 6: `HajiUmrahDetailScreen` + `HajiUmrahSetoranScreen`

**Files:**
- Create: `mobile/src/screens/operator/HajiUmrahDetailScreen.tsx`.
- Create: `mobile/src/screens/operator/HajiUmrahSetoranScreen.tsx`.

**Interfaces:**
- Consumes: GET `/api/mobile/haji-umrah/savings/[accountId]` (detail: account + stats + transactions). POST `/api/mobile/haji-umrah/savings/[accountId]/transactions` (setoran: `{ amount, paymentMethod, cashBankAccountId?, referenceNo?, notes?, transactionDate? }` → `{ data, meta: { adminFee, balanceAfter, target, progress, isTargetReached } }`).
- Needs: a cash-bank account list for the setoran form picker — reuse existing `GET /api/mobile/kas-bank` (Fase 4c scoped it) or `GET /api/mobile/buku-kas`. Confirm the existing endpoint + its response shape before wiring the picker.

- [ ] **Step 1: Read field contracts** — open T3 detail route + T4 setoran route; confirm exact field names. Confirm the cash-bank accounts endpoint for the picker.

- [ ] **Step 2: Implement `HajiUmrahDetailScreen`** — header card (balance/target/progress bar/maturity countdown/monthly target) + stats row (total deposits, monthly, deposit count, remaining, months remaining) + transaction history FlatList (amount, type badge, date, adminFee if any, paymentMethod). "Setoran" button (gate `canManage`) → `navigation.navigate("HajiUmrahSetoran", { accountId })`. Pull-to-refresh. `log.*` only.

- [ ] **Step 3: Implement `HajiUmrahSetoranScreen`** — form: amount (required >0), paymentMethod (Tunai/QRIS/Lainnya → `cash`/`qris`/`lainnya`), cashBankAccount picker (optional; if none selected, `cashBankAccountId` omitted → no CashBook post — show a warning "Setoran tanpa akun kas tidak tercatat di kas/bank"), referenceNo, notes, transactionDate (default today, YYYY-MM-DD). Submit → POST setoran → success Alert (`Saldo: {meta.balanceAfter}, Progress: {meta.progress}%` + `isTargetReached` celebration if true) → `navigation.goBack()`. Surface 400/409/404 via `error.response.data.message`. Reference `PayrollImportScreen.tsx` form style + `AsetFormScreen.tsx` for the operator-gated form pattern. `log.*` only.

- [ ] **Step 4: tsc** → no new errors. Grep `console.*` → 0.

- [ ] **Step 5: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/HajiUmrahDetailScreen.tsx mobile/src/screens/operator/HajiUmrahSetoranScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): HajiUmrah detail + setoran screens (Fase 9a.1 T6)"
```

---

### Task 7: `HajiUmrahBukaRekeningScreen` + App.tsx wiring

**Files:**
- Create: `mobile/src/screens/operator/HajiUmrahBukaRekeningScreen.tsx`.
- Modify: `mobile/App.tsx` (register 4 routes: `HajiUmrah`, `HajiUmrahDetail`, `HajiUmrahSetoran`, `HajiUmrahBukaRekening`).

**Interfaces:**
- Consumes: GET `/api/mobile/haji-umrah/products` (product picker). Existing mobile members list API (member picker — confirm endpoint, likely `GET /api/mobile/members`). POST `/api/mobile/haji-umrah/savings/open` (`{ memberId, productId, targetAmount?, monthlyTarget?, maturityDate? }` → `{ data: account }` 201 / 409).

- [ ] **Step 1: Confirm the members list endpoint + response shape** for the member picker (reuse — do not build new). Confirm products endpoint shape (T3).

- [ ] **Step 2: Implement `HajiUmrahBukaRekeningScreen`** — form: member picker (searchable — name/NRP, reuse existing members API), product picker (from GET products, H&U types only — show name + type), targetAmount (number, default from product.targetAmount), monthlyTarget (number, optional), maturityDate (date, optional). Submit → POST `/api/mobile/haji-umrah/savings/open` → success Alert (`Rekening {data.accountNo} dibuka`) → `navigation.goBack()`. Surface 409 duplicate. Reference `AsetFormScreen.tsx` for create-form pattern. `log.*` only.

- [ ] **Step 3: Wire 4 routes in `App.tsx`** — lazy imports + Stack.Screen entries. Route names byte-identical to the `navigation.navigate(...)` calls: `HajiUmrah`, `HajiUmrahDetail`, `HajiUmrahSetoran`, `HajiUmrahBukaRekening`. Place near other operator screens.

- [ ] **Step 4: tsc** (`cd mobile && npx tsc --noEmit`) → no new errors. Grep `console.*` → 0 in the new screen.

- [ ] **Step 5: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/HajiUmrahBukaRekeningScreen.tsx mobile/App.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): HajiUmrah buka-rekening screen + App.tsx wiring (Fase 9a.1 T7)"
```

---

## After T1–T7 → final opus review + push
1. Final opus review — **#1 check: web setoran + buka-rekening behavior-preservation** (response shapes byte-identical, web H&U flows unchanged) + the `$transaction` moved verbatim (categories/unitTypes/balanceBefore-After exact) + mobile operator/admin-haji_umrah gate + screen↔route field contracts (Fase 6 lesson) + crypto txnNo.
2. Full test suite (`npm test`) — expect baseline (no new unit tests — money logic is DB-bound, audited via the opus review).
3. `finishing-a-development-branch`: push `railway-migration` (deploys web refactor + 5 mobile routes). Screens ship via EAS build #6.

## Notes for the final whole-branch review
- **Web behavior-preservation (#1):** setoran + buka-rekening responses byte-identical; the `$transaction` (SavingsTransaction fields, `savings`/`simpan_pinjam` deposit, `pendapatan_unit`/`haji_umrah` fee, CBT-{txNo}/CBT-{txNo}-FEE, balance updates) moved VERBATIM.
- Mobile RBAC: reads any auth staff; writes operator OR admin `unitType==="haji_umrah"`; anggota excluded from setoran.
- Screen↔route field contracts clean (Fase 6 lesson held).
- CashBank unitType inconsistency (deposit `simpan_pinjam` / fee `haji_umrah`) preserved verbatim — NOT fixed.
- crypto txnNo (`HU-{year}-{9}`, `CBT-{...}`); no `Math.random`.
- No raw `console.*` in screens; `console.error` only in routes; audit non-blocking.
- Confirm middleware import depths (`../` count) per route; `await params` on dynamic routes.
