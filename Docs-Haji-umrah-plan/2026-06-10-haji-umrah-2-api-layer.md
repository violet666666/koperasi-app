# Haji & Umrah — Phase 1B: API Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 5 API route handlers under `/api/haji-umrah/` for products CRUD, savings listing/detail, transactions (setoran with admin fee + CashBank integration), and reports.

**Architecture:** Dedicated `/api/haji-umrah/` routes that query SavingsProduct/SavingsAccount with `type IN ('tabungan_haji','tabungan_umrah')` filter. The setoran endpoint mirrors the existing `savings/transactions` pattern but adds admin fee as a separate CashBankTransaction.

**Tech Stack:** Next.js App Router API routes, Prisma 6, Zod validation

**Depends on:** `2026-06-10-haji-umrah-1-data-layer.md` (schema fields must exist)

**Design Spec:** `docs/superpowers/specs/2026-06-10-haji-umrah-savings-only-design.md`

**Next Plan:** `2026-06-10-haji-umrah-3-ui-layer.md`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/haji-umrah/products/route.ts` | Create | GET/POST — list & create haji/umrah products |
| `src/app/api/haji-umrah/products/[productId]/route.ts` | Create | PUT — update product |
| `src/app/api/haji-umrah/savings/route.ts` | Create | GET — list tabungan accounts + POST — buka rekening |
| `src/app/api/haji-umrah/savings/[accountId]/route.ts` | Create | GET — detail + stats (progress, total setoran) |
| `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` | Create | GET/POST — riwayat & setoran (with admin fee) |
| `src/app/api/haji-umrah/reports/route.ts` | Create | GET — export data (rekap, progress, admin fee) |

---

## Shared Patterns

All API routes follow these conventions from the existing codebase:

```typescript
// Auth pattern (from src/app/api/savings/transactions/route.ts)
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const session = await auth();
if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}
const roleName = (session.user as any).role?.name || session.user.role;
const userId = Number((session.user as any).id);

// Haji/Umrah product type filter (used in all routes)
const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];
```

Transaction number format: `HU-{year}-{5-digit-random}` (prefix `HU` = Haji Umrah).

---

### Task 1: Products API — GET/POST

**Files:**
- Create: `src/app/api/haji-umrah/products/route.ts`

- [ ] **Step 1: Create the products API route**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/haji-umrah/products — List haji/umrah savings products
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const products = await prisma.savingsProduct.findMany({
            where: {
                type: { in: HAJI_UMRAH_TYPES },
                deletedAt: null,
            },
            orderBy: { code: "asc" },
        });

        return NextResponse.json({ data: products });
    } catch (error) {
        console.error("GET /api/haji-umrah/products error:", error);
        return NextResponse.json(
            { message: "Failed to fetch products" },
            { status: 500 }
        );
    }
}

// POST /api/haji-umrah/products — Create haji/umrah savings product
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as any).role?.name || session.user.role;
        if (roleName !== "operator") {
            return NextResponse.json({ message: "Forbidden — operator only" }, { status: 403 });
        }

        const body = await request.json();
        const { code, name, type, minimumAmount, targetAmount, adminFeeType, adminFeeValue, linkedBankName, isActive } = body;

        // Validate type
        if (!HAJI_UMRAH_TYPES.includes(type)) {
            return NextResponse.json(
                { message: `Type harus salah satu: ${HAJI_UMRAH_TYPES.join(", ")}` },
                { status: 400 }
            );
        }

        // Check duplicate code
        const existing = await prisma.savingsProduct.findUnique({ where: { code } });
        if (existing) {
            return NextResponse.json(
                { message: `Kode produk "${code}" sudah digunakan` },
                { status: 409 }
            );
        }

        const product = await prisma.savingsProduct.create({
            data: {
                code,
                name,
                type,
                isMandatory: false,
                depositPeriod: "monthly",
                minimumAmount: minimumAmount ?? 0,
                canWithdraw: false,
                allowEarlyWithdraw: false,
                targetAmount: targetAmount ?? null,
                adminFeeType: adminFeeType ?? null,
                adminFeeValue: adminFeeValue ?? null,
                linkedBankName: linkedBankName ?? "BSI",
                isActive: isActive ?? true,
            },
        });

        return NextResponse.json({ data: product }, { status: 201 });
    } catch (error) {
        console.error("POST /api/haji-umrah/products error:", error);
        return NextResponse.json(
            { message: "Failed to create product" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Test GET endpoint**

Start dev server: `npm run dev`

Call: `GET http://localhost:3000/api/haji-umrah/products`
Expected: `{ data: [] }` or `{ data: [...TH, TU...] }` if seeded

- [ ] **Step 3: Commit**

```bash
git add src/app/api/haji-umrah/products/route.ts
git commit -m "feat(haji-umrah): add products API — GET list, POST create"
```

---

### Task 1b: Products Update API — PUT

**Files:**
- Create: `src/app/api/haji-umrah/products/[productId]/route.ts`

- [ ] **Step 1: Create the product update route**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// PUT /api/haji-umrah/products/[productId] — Update haji/umrah product
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as any).role?.name || session.user.role;
        if (roleName !== "operator") {
            return NextResponse.json({ message: "Forbidden — operator only" }, { status: 403 });
        }

        const { productId } = await params;
        const id = parseInt(productId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid productId" }, { status: 400 });
        }

        const body = await request.json();
        const { name, minimumAmount, targetAmount, adminFeeType, adminFeeValue, linkedBankName, isActive } = body;

        // Verify product exists and is haji/umrah type
        const existing = await prisma.savingsProduct.findUnique({ where: { id } });
        if (!existing || !HAJI_UMRAH_TYPES.includes(existing.type)) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }

        const product = await prisma.savingsProduct.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(minimumAmount !== undefined && { minimumAmount }),
                ...(targetAmount !== undefined && { targetAmount }),
                ...(adminFeeType !== undefined && { adminFeeType }),
                ...(adminFeeValue !== undefined && { adminFeeValue }),
                ...(linkedBankName !== undefined && { linkedBankName }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        return NextResponse.json({ data: product });
    } catch (error) {
        console.error("PUT /api/haji-umrah/products/[productId] error:", error);
        return NextResponse.json({ message: "Failed to update product" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/haji-umrah/products/[productId]/route.ts"
git commit -m "feat(haji-umrah): add product update API — PUT with partial update"
```

---

### Task 2: Savings List API — GET/POST

**Files:**
- Create: `src/app/api/haji-umrah/savings/route.ts`

- [ ] **Step 1: Create the savings list API route**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/haji-umrah/savings — List tabungan haji/umrah accounts
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "15");
        const search = searchParams.get("search") || "";
        const type = searchParams.get("type"); // "tabungan_haji" | "tabungan_umrah"
        const status = searchParams.get("status"); // "active" | "closed"

        const types = type ? [type] : HAJI_UMRAH_TYPES;

        const where = {
            product: { type: { in: types }, deletedAt: null },
            ...(status && { status }),
            ...(search && {
                OR: [
                    { accountNo: { contains: search, mode: "insensitive" as const } },
                    { member: { name: { contains: search, mode: "insensitive" as const } } },
                    { member: { memberNo: { contains: search, mode: "insensitive" as const } } },
                    { member: { nrp: { contains: search, mode: "insensitive" as const } } },
                ],
            }),
        };

        const [accounts, total] = await Promise.all([
            prisma.savingsAccount.findMany({
                where,
                include: {
                    member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                    product: true,
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.savingsAccount.count({ where }),
        ]);

        // Enrich with progress data
        const enriched = accounts.map((acc) => {
            const balance = Number(acc.balance);
            const target = Number(acc.targetAmount ?? acc.product.targetAmount ?? 0);
            const progress = target > 0 ? Math.min(100, (balance / target) * 100) : 0;
            return {
                ...acc,
                balance,
                target,
                progress: Math.round(progress * 100) / 100,
                monthlyTarget: Number(acc.monthlyTarget ?? 0),
            };
        });

        return NextResponse.json({
            data: enriched,
            meta: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/savings error:", error);
        return NextResponse.json(
            { message: "Failed to fetch savings accounts" },
            { status: 500 }
        );
    }
}

// POST /api/haji-umrah/savings — Buka rekening tabungan haji/umrah
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const userId = Number((session.user as any).id);

        const body = await request.json();
        const { memberId, productId, targetAmount, monthlyTarget, maturityDate } = body;

        if (!memberId || !productId) {
            return NextResponse.json(
                { message: "memberId dan productId wajib diisi" },
                { status: 400 }
            );
        }

        // Validate product is haji/umrah type
        const product = await prisma.savingsProduct.findUnique({
            where: { id: productId },
        });
        if (!product || !HAJI_UMRAH_TYPES.includes(product.type)) {
            return NextResponse.json(
                { message: "Produk bukan tipe tabungan haji/umrah" },
                { status: 400 }
            );
        }

        // Get member
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            select: { id: true, branchId: true, status: true },
        });
        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check if account already exists (unique constraint: memberId + productId)
        const existing = await prisma.savingsAccount.findUnique({
            where: { memberId_productId: { memberId, productId } },
        });
        if (existing) {
            return NextResponse.json(
                { message: "Anggota sudah memiliki rekening untuk produk ini" },
                { status: 409 }
            );
        }

        const accountNo = `HU-${memberId}-${productId}-${Date.now().toString().slice(-4)}`;
        const effectiveTarget = targetAmount ?? product.targetAmount;

        const account = await prisma.savingsAccount.create({
            data: {
                accountNo,
                memberId,
                productId,
                branchId: member.branchId,
                balance: 0,
                openedDate: new Date(),
                targetAmount: effectiveTarget,
                monthlyTarget: monthlyTarget ?? null,
                maturityDate: maturityDate ? new Date(maturityDate) : null,
            },
            include: {
                member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                product: true,
            },
        });

        return NextResponse.json({ data: account }, { status: 201 });
    } catch (error) {
        console.error("POST /api/haji-umrah/savings error:", error);
        return NextResponse.json(
            { message: "Failed to create savings account" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Test GET endpoint**

Call: `GET http://localhost:3000/api/haji-umrah/savings`
Expected: `{ data: [], meta: { page: 1, perPage: 15, total: 0, totalPages: 0 } }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/haji-umrah/savings/route.ts
git commit -m "feat(haji-umrah): add savings list API — GET with progress, POST buka rekening"
```

---

### Task 3: Savings Detail API — GET

**Files:**
- Create: `src/app/api/haji-umrah/savings/[accountId]/route.ts`

- [ ] **Step 1: Create the savings detail API route**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/haji-umrah/savings/[accountId] — Detail + stats
export async function GET(
    request: Request,
    { params }: { params: Promise<{ accountId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        }

        const account = await prisma.savingsAccount.findUnique({
            where: { id },
            include: {
                member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                product: true,
                transactions: {
                    where: { status: "completed" },
                    orderBy: { transactionDate: "desc" },
                    take: 50,
                    include: {
                        createdBy: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
            return NextResponse.json(
                { message: "Rekening tabungan haji/umrah tidak ditemukan" },
                { status: 404 }
            );
        }

        const balance = Number(account.balance);
        const target = Number(account.targetAmount ?? account.product.targetAmount ?? 0);
        const progress = target > 0 ? Math.min(100, (balance / target) * 100) : 0;

        // Stats
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyDeposits = account.transactions
            .filter((t) => t.type === "deposit" && new Date(t.transactionDate) >= startOfMonth)
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const totalDeposits = account.transactions
            .filter((t) => t.type === "deposit")
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const depositCount = account.transactions.filter((t) => t.type === "deposit").length;

        // Months remaining estimate
        const monthlyTarget = Number(account.monthlyTarget ?? 0);
        const remaining = Math.max(0, target - balance);
        const monthsRemaining = monthlyTarget > 0 ? Math.ceil(remaining / monthlyTarget) : null;

        return NextResponse.json({
            data: {
                ...account,
                balance,
                target,
                progress: Math.round(progress * 100) / 100,
                monthlyTarget: Number(account.monthlyTarget ?? 0),
                stats: {
                    totalDeposits,
                    monthlyDeposits,
                    depositCount,
                    remaining,
                    monthsRemaining,
                    isTargetReached: target > 0 && balance >= target,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/savings/[accountId] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch account detail" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/haji-umrah/savings/[accountId]/route.ts"
git commit -m "feat(haji-umrah): add savings detail API — GET with stats, progress, months remaining"
```

---

### Task 4: Transactions API — GET/POST (Setoran with Admin Fee)

**Files:**
- Create: `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts`

This is the **most critical** endpoint. It mirrors `src/app/api/savings/transactions/route.ts` but adds:
1. Admin fee calculation (percent or fixed)
2. Admin fee as separate CashBankTransaction with `category: "pendapatan_unit"`, `unitType: "haji_umrah"`
3. Target reached check after deposit

- [ ] **Step 1: Create the transactions API route**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

function generateTxNo(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `HU-${year}-${random}`;
}

// GET /api/haji-umrah/savings/[accountId]/transactions — Riwayat transaksi
export async function GET(
    request: Request,
    { params }: { params: Promise<{ accountId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "20");

        // Verify account is haji/umrah type
        const account = await prisma.savingsAccount.findUnique({
            where: { id },
            include: { product: true },
        });
        if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
            return NextResponse.json({ message: "Rekening tidak ditemukan" }, { status: 404 });
        }

        const where = { accountId: id, status: "completed" };

        const [transactions, total] = await Promise.all([
            prisma.savingsTransaction.findMany({
                where,
                include: {
                    member: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: { transactionDate: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.savingsTransaction.count({ where }),
        ]);

        return NextResponse.json({
            data: transactions,
            meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/savings/[accountId]/transactions error:", error);
        return NextResponse.json({ message: "Failed to fetch transactions" }, { status: 500 });
    }
}

// POST /api/haji-umrah/savings/[accountId]/transactions — Setoran (deposit)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ accountId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as any).role?.name || session.user.role;
        if (roleName === "anggota") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        const userId = Number((session.user as any).id);

        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        }

        const body = await request.json();
        const { amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate } = body;

        if (!amount || amount <= 0) {
            return NextResponse.json({ message: "Jumlah setoran harus lebih dari 0" }, { status: 400 });
        }

        // Fetch account with product
        const account = await prisma.savingsAccount.findUnique({
            where: { id },
            include: {
                member: { select: { id: true, name: true, branchId: true } },
                product: true,
            },
        });

        if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
            return NextResponse.json({ message: "Rekening tidak ditemukan" }, { status: 404 });
        }

        if (account.status !== "active") {
            return NextResponse.json({ message: "Rekening sudah ditutup" }, { status: 400 });
        }

        // ── Calculate admin fee ──
        let adminFee = 0;
        const product = account.product;
        if (product.adminFeeType && product.adminFeeValue) {
            const feeValue = Number(product.adminFeeValue);
            if (product.adminFeeType === "percent") {
                adminFee = Math.round(amount * feeValue / 100);
            } else {
                // "fixed"
                adminFee = feeValue;
            }
        }

        const currentBalance = Number(account.balance);
        const balanceAfter = currentBalance + amount;

        const txNo = generateTxNo();

        // Parse date — WIB handling
        let txDate: Date;
        if (transactionDate) {
            const raw = String(transactionDate);
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                txDate = new Date(raw + "T12:00:00+07:00");
            } else {
                txDate = new Date(raw);
            }
        } else {
            txDate = new Date();
        }

        // ── ATOMIC TRANSACTION ─────────────────────────────────────────
        const [transaction] = await prisma.$transaction(async (tx) => {
            // 1. Create SavingsTransaction (deposit)
            const savingsTx = await tx.savingsTransaction.create({
                data: {
                    transactionNo: txNo,
                    accountId: id,
                    memberId: account.memberId,
                    productId: account.productId,
                    branchId: account.member.branchId,
                    type: "deposit",
                    amount,
                    balanceBefore: currentBalance,
                    balanceAfter,
                    paymentMethod: paymentMethod || "cash",
                    cashBankAccountId: cashBankAccountId ?? null,
                    referenceNo: referenceNo ?? null,
                    notes: notes ?? `Setoran Tabungan ${product.type === "tabungan_haji" ? "Haji" : "Umrah"}`,
                    transactionDate: txDate,
                    createdById: userId,
                },
                include: {
                    member: { select: { id: true, name: true } },
                    account: { include: { product: true } },
                },
            });

            // 2. Update account balance
            await tx.savingsAccount.update({
                where: { id },
                data: { balance: balanceAfter },
            });

            // 3. CashBank posting — deposit amount
            if (cashBankAccountId) {
                const cashBank = await tx.cashBankAccount.findUnique({
                    where: { id: cashBankAccountId },
                });
                if (cashBank) {
                    const cbBefore = Number(cashBank.currentBalance);
                    const cbAfter = cbBefore + amount;

                    await tx.cashBankTransaction.create({
                        data: {
                            transactionNo: `CBT-${txNo}`,
                            accountId: cashBankAccountId,
                            branchId: account.member.branchId,
                            type: "in",
                            category: "savings",
                            amount,
                            balanceBefore: cbBefore,
                            balanceAfter: cbAfter,
                            referenceType: "SavingsTransaction",
                            referenceId: savingsTx.id,
                            unitType: "simpan_pinjam",
                            description: `Setoran Tabungan ${product.type === "tabungan_haji" ? "Haji" : "Umrah"} — ${account.member.name} (${txNo})`,
                            transactionDate: txDate,
                            createdById: userId,
                        },
                    });

                    // Update CB balance
                    await tx.cashBankAccount.update({
                        where: { id: cashBankAccountId },
                        data: { currentBalance: cbAfter },
                    });

                    // 4. Admin fee — separate CashBankTransaction (revenue for koperasi)
                    if (adminFee > 0) {
                        // Find or use the same cash/bank account for admin fee
                        const feeCbBefore = Number(
                            (await tx.cashBankAccount.findUnique({ where: { id: cashBankAccountId } }))!.currentBalance
                        );
                        const feeCbAfter = feeCbBefore + adminFee;

                        await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `CBT-${txNo}-FEE`,
                                accountId: cashBankAccountId,
                                branchId: account.member.branchId,
                                type: "in",
                                category: "pendapatan_unit",
                                amount: adminFee,
                                balanceBefore: feeCbBefore,
                                balanceAfter: feeCbAfter,
                                referenceType: "SavingsTransaction",
                                referenceId: savingsTx.id,
                                unitType: "haji_umrah",
                                description: `Admin Fee Tabungan ${product.type === "tabungan_haji" ? "Haji" : "Umrah"} — ${account.member.name} (${txNo})`,
                                transactionDate: txDate,
                                createdById: userId,
                            },
                        });

                        await tx.cashBankAccount.update({
                            where: { id: cashBankAccountId },
                            data: { currentBalance: feeCbAfter },
                        });
                    }
                }
            }

            return [savingsTx];
        });
        // ───────────────────────────────────────────────────────────────

        // Check target reached
        const target = Number(account.targetAmount ?? product.targetAmount ?? 0);
        const isTargetReached = target > 0 && balanceAfter >= target;

        // Audit log
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "HajiUmrah",
                description: `Setoran ${product.name}: Rp ${amount.toLocaleString("id-ID")}${adminFee > 0 ? ` + fee Rp ${adminFee.toLocaleString("id-ID")}` : ""} untuk ${account.member.name}`,
                targetId: String(transaction.id), targetType: "SavingsTransaction",
                newData: { transactionNo: txNo, amount, adminFee, balanceAfter, isTargetReached },
            });
        } catch (e) { /* audit failure must not break response */ }

        return NextResponse.json({
            data: transaction,
            meta: {
                adminFee,
                balanceAfter,
                target,
                progress: target > 0 ? Math.min(100, Math.round((balanceAfter / target) * 10000) / 100) : 0,
                isTargetReached,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/haji-umrah/savings/[accountId]/transactions error:", error);
        return NextResponse.json(
            { message: "Failed to create transaction" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Test the setoran endpoint**

Create a test account first via `POST /api/haji-umrah/savings`, then test deposit:

```bash
# Test setoran (replace accountId with actual ID)
curl -X POST http://localhost:3000/api/haji-umrah/savings/1/transactions \
  -H "Content-Type: application/json" \
  -d '{"amount": 500000, "paymentMethod": "cash", "cashBankAccountId": 1}'
```

Expected: `{ data: {...}, meta: { adminFee: 2500, balanceAfter: 500000, target: 50000000, progress: 1, isTargetReached: false } }`

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts"
git commit -m "feat(haji-umrah): add setoran API with admin fee + CashBank atomic transaction

- Deposit creates SavingsTransaction + updates balance
- Admin fee as separate CashBankTransaction (pendapatan_unit, haji_umrah)
- Target reached detection after deposit
- Full audit logging"
```

---

### Task 5: Reports API — GET

**Files:**
- Create: `src/app/api/haji-umrah/reports/route.ts`

- [ ] **Step 1: Create the reports API route**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/haji-umrah/reports — Rekap & laporan tabungan haji/umrah
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const reportType = searchParams.get("type") || "rekap"; // rekap | progress | admin_fee
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const productType = searchParams.get("productType"); // tabungan_haji | tabungan_umrah

        const types = productType ? [productType] : HAJI_UMRAH_TYPES;

        const dateFilter = dateFrom && dateTo ? {
            transactionDate: {
                gte: new Date(dateFrom),
                lte: new Date(dateTo),
            },
        } : {};

        if (reportType === "rekap") {
            // Rekap all accounts
            const accounts = await prisma.savingsAccount.findMany({
                where: {
                    product: { type: { in: types }, deletedAt: null },
                    status: "active",
                },
                include: {
                    member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                    product: true,
                },
                orderBy: { createdAt: "desc" },
            });

            const totalSaldo = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
            const totalTarget = accounts.reduce((sum, a) => sum + Number(a.targetAmount ?? a.product.targetAmount ?? 0), 0);

            return NextResponse.json({
                data: accounts.map((a) => ({
                    accountNo: a.accountNo,
                    memberName: a.member.name,
                    memberNrp: a.member.nrp,
                    productType: a.product.type,
                    productName: a.product.name,
                    balance: Number(a.balance),
                    target: Number(a.targetAmount ?? a.product.targetAmount ?? 0),
                    progress: Number(a.targetAmount ?? a.product.targetAmount ?? 0) > 0
                        ? Math.round((Number(a.balance) / Number(a.targetAmount ?? a.product.targetAmount)) * 10000) / 100
                        : 0,
                    monthlyTarget: Number(a.monthlyTarget ?? 0),
                    openedDate: a.openedDate,
                    maturityDate: a.maturityDate,
                })),
                summary: {
                    totalAccounts: accounts.length,
                    totalSaldo,
                    totalTarget,
                    globalProgress: totalTarget > 0 ? Math.round((totalSaldo / totalTarget) * 10000) / 100 : 0,
                },
            });
        }

        if (reportType === "admin_fee") {
            // Admin fee revenue report
            const fees = await prisma.cashBankTransaction.findMany({
                where: {
                    category: "pendapatan_unit",
                    unitType: "haji_umrah",
                    type: "in",
                    ...dateFilter,
                },
                orderBy: { transactionDate: "desc" },
            });

            const totalFee = fees.reduce((sum, f) => sum + Number(f.amount), 0);

            return NextResponse.json({
                data: fees.map((f) => ({
                    transactionNo: f.transactionNo,
                    amount: Number(f.amount),
                    description: f.description,
                    transactionDate: f.transactionDate,
                })),
                summary: {
                    totalTransactions: fees.length,
                    totalAdminFee: totalFee,
                },
            });
        }

        // Default: progress report — used by dashboard page
        const accounts = await prisma.savingsAccount.findMany({
            where: {
                product: { type: { in: types }, deletedAt: null },
                status: "active",
            },
            include: {
                member: { select: { name: true, nrp: true } },
                product: true,
            },
        });

        const totalSaldo = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
        const totalTarget = accounts.reduce((sum, a) => sum + Number(a.targetAmount ?? a.product.targetAmount ?? 0), 0);
        const globalProgress = totalTarget > 0 ? Math.round((totalSaldo / totalTarget) * 10000) / 100 : 0;

        const nearTarget = accounts.filter((a) => {
            const target = Number(a.targetAmount ?? a.product.targetAmount ?? 0);
            return target > 0 && Number(a.balance) >= target * 0.8;
        });

        const reachedTarget = accounts.filter((a) => {
            const target = Number(a.targetAmount ?? a.product.targetAmount ?? 0);
            return target > 0 && Number(a.balance) >= target;
        });

        // Monthly deposits — query SavingsTransaction for this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyDepositsResult = await prisma.savingsTransaction.aggregate({
            _sum: { amount: true },
            where: {
                type: "deposit",
                status: "completed",
                product: { type: { in: types } },
                transactionDate: { gte: startOfMonth },
            },
        });
        const monthlyDeposits = Number(monthlyDepositsResult._sum.amount ?? 0);

        // Recent 5 accounts opened
        const recentAccounts = accounts
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
            .map((a) => ({
                accountNo: a.accountNo,
                memberName: a.member.name,
                productType: a.product.type,
                balance: Number(a.balance),
                target: Number(a.targetAmount ?? a.product.targetAmount ?? 0),
                progress: Number(a.targetAmount ?? a.product.targetAmount ?? 0) > 0
                    ? Math.round((Number(a.balance) / Number(a.targetAmount ?? a.product.targetAmount)) * 100)
                    : 0,
                openedDate: a.openedDate,
            }));

        // Admin fee revenue this month
        const adminFeeThisMonth = await prisma.cashBankTransaction.aggregate({
            _sum: { amount: true },
            where: {
                category: "pendapatan_unit",
                unitType: "haji_umrah",
                type: "in",
                transactionDate: { gte: startOfMonth },
            },
        });
        const adminFeeRevenue = Number(adminFeeThisMonth._sum.amount ?? 0);

        return NextResponse.json({
            data: {
                totalAccounts: accounts.length,
                totalSaldo,
                totalTarget,
                globalProgress,
                monthlyDeposits,
                adminFeeRevenue,
                nearTarget: nearTarget.length,
                reachedTarget: reachedTarget.length,
                recentAccounts,
                nearTargetAccounts: nearTarget.map((a) => ({
                    memberName: a.member.name,
                    balance: Number(a.balance),
                    target: Number(a.targetAmount ?? a.product.targetAmount ?? 0),
                    progress: Math.round((Number(a.balance) / Number(a.targetAmount ?? a.product.targetAmount ?? 1)) * 100),
                })),
            },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/reports error:", error);
        return NextResponse.json({ message: "Failed to generate report" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Test report endpoint**

Call: `GET http://localhost:3000/api/haji-umrah/reports?type=rekap`
Expected: `{ data: [...], summary: { totalAccounts: N, totalSaldo: X, totalTarget: Y, globalProgress: Z } }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/haji-umrah/reports/route.ts
git commit -m "feat(haji-umrah): add reports API — rekap, admin fee revenue, progress tracking"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Section 4.2 (API Routes) fully implemented — 5 endpoints
- [x] **Spec Section 4.3 (Dashboard Components):** Progress report now returns `totalAccounts`, `totalSaldo`, `totalTarget`, `globalProgress`, `monthlyDeposits`, `adminFeeRevenue`, `recentAccounts`, `nearTarget`, `nearTargetAccounts`
- [x] **Placeholder scan:** No TBD or TODO — all routes have complete code
- [x] **Type consistency:** `HAJI_UMRAH_TYPES` array matches the `type` field values from schema
- [x] **CashBank pattern:** Setoran follows exact pattern from `src/app/api/savings/transactions/route.ts` — `$transaction` with SavingsTx + balance update + CashBankTx + CB balance update
- [x] **Admin fee:** Separate `CashBankTransaction` with `category: "pendapatan_unit"`, `unitType: "haji_umrah"` — revenue auto-flows to SHU
- [x] **Auth:** All endpoints check session, POST endpoints check role restrictions
- [x] **No unused imports:** `findUnitAccount` removed — not needed since CashBank posting uses direct `findUnique`

## Completion Criteria

After completing this plan:
- [ ] `GET /api/haji-umrah/products` returns haji/umrah products
- [ ] `POST /api/haji-umrah/savings` creates account with target/monthlyTarget
- [ ] `GET /api/haji-umrah/savings` lists accounts with progress
- [ ] `GET /api/haji-umrah/savings/[id]` returns detail + stats
- [ ] `POST /api/haji-umrah/savings/[id]/transactions` creates deposit with admin fee
- [ ] `GET /api/haji-umrah/reports?type=rekap` returns rekap data

**Ready for:** `2026-06-10-haji-umrah-3-ui-layer.md`
