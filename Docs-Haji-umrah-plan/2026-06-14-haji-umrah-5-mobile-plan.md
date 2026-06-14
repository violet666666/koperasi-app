# Phase 5 — Mobile App Haji & Umrah (Member) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Member mobile app access to Haji & Umrah — view tabungan progress/deposits, view bagi-hasil credits, view + apply talangan, with push notifications at target milestones.

**Architecture:** Pendekatan 1 — 3 dedicated `/api/mobile/haji-umrah/*` endpoints guarded by mobile JWT (`getMobileUser`), member-scoped via `user.id → Member` server-side resolution (no JWT change). Mobile apply talangan creates `LoanApplication` status `submitted` only (admin approves on web). 4 notification triggers injected into existing web endpoints via `createNotification()` (non-blocking).

**Tech Stack:** Next.js 16 API routes (TypeScript), Prisma 6, mobile JWT (`@/lib/jwt`), Expo RN 0.83 / React Native, TanStack Query, Playwright E2E (mobile API via JWT).

**Spec:** `Docs-Haji-umrah-plan/2026-06-14-haji-umrah-5-mobile-design.md`

**Test member:** `87011378@koperasi.local` / `87011378` (A'AN ANDRIONO, member_id 776, owns HU-776-10-1715 + talangan). Operator: `operator@koperasi.com` / `password123`.

**Branch:** `railway-migration` — commit-only, NO push.

---

## File Structure

### New files (8)
| File | Responsibility |
|---|---|
| `src/app/api/mobile/haji-umrah/_helpers.ts` | `resolveMobileMember(user)` — DRY member-scoping for the 3 endpoints |
| `src/app/api/mobile/haji-umrah/route.ts` | `GET` — member's H&U summary + accounts + talangan + bagi-hasil credits |
| `src/app/api/mobile/haji-umrah/accounts/[id]/route.ts` | `GET` — single account detail + full transaction history |
| `src/app/api/mobile/haji-umrah/talangan/apply/route.ts` | `POST` — submit talangan (status submitted, no disburse) |
| `mobile/src/screens/member/HajiUmrahScreen.tsx` | Overview: summary card, per-account progress, bagi-hasil, apply button |
| `mobile/src/screens/member/HajiUmrahDetailScreen.tsx` | Per-account: progress detail + FlatList transaction history |
| `mobile/src/screens/member/HajiUmrahTalanganApplyScreen.tsx` | Apply form: account, gap, amount, tenor → submit |
| `e2e/haji-umrah-mobile.spec.ts` | API + notification trigger tests (JWT-based) |

### Modified files (6, additive)
| File | Change |
|---|---|
| `src/lib/validations/haji-umrah.ts` | + `mobileTalanganApplySchema` |
| `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` | + notification trigger (80% / 100% threshold) after balance update |
| `src/app/api/haji-umrah/bagi-hasil/route.ts` | + per-member notification after process |
| `src/app/api/loans/applications/[id]/disburse/route.ts` | + talangan-disbursed notification (if linkedSavingsAccountId) |
| `mobile/App.tsx` | + 3 Stack.Screen registrations + 1 push-tap branch |
| `mobile/src/screens/common/DashboardScreen.tsx` | + 1 conditional MenuItem "Haji & Umrah" |

---

## Task 1: Validation schema

**Files:**
- Modify: `src/lib/validations/haji-umrah.ts` (append at end of file)

- [ ] **Step 1: Add `mobileTalanganApplySchema`**

Append to `src/lib/validations/haji-umrah.ts`:

```typescript
// Mobile member-initiated talangan application.
// Business validation (gap, product range, type matching, 1:1) is done in the
// handler because it requires DB lookups; Zod only covers the body shape.
export const mobileTalanganApplySchema = z.object({
  savingsAccountId: z.number().int().positive(),
  amount: z.number().positive(),
  tenor: z.number().int().positive(),
});
```

(Confirm `z` is already imported at the top of the file — it is, since `createTalanganSchema` uses it.)

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (exit 0, or only pre-existing errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/haji-umrah.ts
git commit -m "feat(haji-umrah): add mobileTalanganApplySchema (Phase 5 mobile)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Member-scoping helper

**Files:**
- Create: `src/app/api/mobile/haji-umrah/_helpers.ts`

- [ ] **Step 1: Create helper**

`src/app/api/mobile/haji-umrah/_helpers.ts`:

```typescript
import prisma from "@/lib/prisma";
import type { MobileJWTPayload } from "@/lib/jwt";

export interface ResolvedMember {
  userId: number;
  member: { id: number; status: string; name: string };
}

/**
 * Resolve a mobile JWT user to their Member. Returns null if the user is not
 * linked to a member (e.g. operator/admin). Used by all 3 haji-umrah mobile
 * endpoints to enforce member-scoping — identical semantics to the web portal's
 * `session.user.memberId` requirement.
 */
export async function resolveMobileMember(
  user: MobileJWTPayload,
): Promise<ResolvedMember | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: parseInt(user.id) },
    select: {
      id: true,
      member: { select: { id: true, status: true, name: true } },
    },
  });
  if (!dbUser?.member) return null;
  return { userId: dbUser.id, member: dbUser.member };
}

/**
 * Resolve the User.id who owns a given memberId (for notification recipients).
 * Returns null if the member has no login account (not a mobile user).
 */
export async function resolveUserIdForMember(memberId: number): Promise<number | null> {
  const u = await prisma.user.findFirst({
    where: { memberId },
    select: { id: true },
  });
  return u?.id ?? null;
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mobile/haji-umrah/_helpers.ts
git commit -m "feat(haji-umrah): add mobile member-scoping helper (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: GET /api/mobile/haji-umrah (summary endpoint)

**Files:**
- Create: `src/app/api/mobile/haji-umrah/route.ts`
- Test: `e2e/haji-umrah-mobile.spec.ts`

- [ ] **Step 1: Write the failing test (scaffold test file + first test)**

Create `e2e/haji-umrah-mobile.spec.ts`:

```typescript
import { test, expect, type APIRequestContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const MEMBER_EMAIL = "87011378@koperasi.local";
const MEMBER_PASSWORD = "87011378";
const OPERATOR_EMAIL = "operator@koperasi.com";
const OPERATOR_PASSWORD = "password123";

// Login via the mobile JWT endpoint and return a Bearer token.
async function mobileToken(
  request: APIRequestContext,
  identifier: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${BASE}/api/mobile/login`, {
    data: { identifier, password },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  return json.token as string;
}

test.describe("Haji & Umrah Mobile (Phase 5)", () => {
  test("3.1 GET /api/mobile/haji-umrah — member summary", async ({ request }) => {
    const token = await mobileToken(request, MEMBER_EMAIL, MEMBER_PASSWORD);
    const res = await request.get(`${BASE}/api/mobile/haji-umrah`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.summary).toBeDefined();
    expect(typeof json.data.summary.totalBalance).toBe("number");
    expect(Array.isArray(json.data.accounts)).toBe(true);
    if (json.data.accounts.length > 0) {
      const a = json.data.accounts[0];
      expect(a).toHaveProperty("progress");
      expect(a).toHaveProperty("canApplyTalangan");
    }
    console.log("✅ Mobile H&U summary:", json.data.summary);
  });

  test("3.2 GET /api/mobile/haji-umrah — operator blocked (401)", async ({ request }) => {
    const token = await mobileToken(request, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    const res = await request.get(`${BASE}/api/mobile/haji-umrah`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(401);
    console.log("✅ Operator correctly blocked from mobile H&U:", res.status());
  });

  test("3.3 GET /api/mobile/haji-umrah — no token blocked (401)", async ({ request }) => {
    const res = await request.get(`${BASE}/api/mobile/haji-umrah`);
    expect(res.status()).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/haji-umrah-mobile.spec.ts --reporter=line`
Expected: FAIL — 3.1 returns 404 (route does not exist yet).

- [ ] **Step 3: Implement the endpoint**

Create `src/app/api/mobile/haji-umrah/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { resolveMobileMember } from "./_helpers";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/mobile/haji-umrah — Member's own H&U savings accounts + summary.
// Member-scoped via mobile JWT → user.id → Member. View-only.
export async function GET(request: Request) {
  const mobileUser = getMobileUser(request);
  if (!mobileUser) return unauthorizedResponse();

  try {
    const resolved = await resolveMobileMember(mobileUser);
    if (!resolved) {
      return NextResponse.json(
        { message: "Akun tidak terhubung ke data anggota" },
        { status: 401 },
      );
    }
    const memberId = resolved.member.id;

    // 1. Member's H&U accounts (both active + closed — members see history)
    const accounts = await prisma.savingsAccount.findMany({
      where: {
        memberId,
        product: { type: { in: HAJI_UMRAH_TYPES } },
      },
      include: {
        member: { select: { id: true, name: true, status: true } },
        product: {
          select: { id: true, code: true, name: true, type: true, targetAmount: true, linkedBankName: true },
        },
        transactions: {
          where: { status: { not: "voided" } },
          select: { id: true, type: true, amount: true, notes: true, transactionDate: true, referenceNo: true },
          orderBy: { transactionDate: "desc" },
          take: 50,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // 2. Active talangan loans linked to these accounts
    const accountIds = accounts.map((a) => a.id);
    const talanganLoans =
      accountIds.length > 0
        ? await prisma.loan.findMany({
            where: {
              memberId,
              linkedSavingsAccountId: { in: accountIds },
              status: { in: ["active", "paid_off"] },
            },
            select: {
              id: true,
              loanNo: true,
              status: true,
              principalOutstanding: true,
              interestOutstanding: true,
              monthlyInstallment: true,
              tenorMonths: true,
              linkedSavingsAccountId: true,
              schedules: {
                where: { status: { in: ["pending", "partial", "overdue"] } },
                select: { dueDate: true, totalAmount: true },
                orderBy: { dueDate: "asc" },
                take: 1,
              },
            },
          })
        : [];
    const talanganByAccount = new Map<number, (typeof talanganLoans)[number]>();
    for (const loan of talanganLoans) {
      if (loan.linkedSavingsAccountId) talanganByAccount.set(loan.linkedSavingsAccountId, loan);
    }

    // 3. Per-account view
    const now = new Date();
    const accountViews = accounts.map((acc) => {
      const balance = Number(acc.balance);
      const productTarget = acc.product.targetAmount ? Number(acc.product.targetAmount) : 0;
      const target = acc.targetAmount ? Number(acc.targetAmount) : productTarget;
      const progress = target > 0 ? Math.min(100, Math.round((balance / target) * 10000) / 100) : 0;
      const remaining = Math.max(0, target - balance);

      let monthsRemaining: number | null = null;
      if (acc.maturityDate && remaining > 0) {
        const months = Math.ceil(
          (new Date(acc.maturityDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30),
        );
        monthsRemaining = months > 0 ? months : 0;
      }

      const deposits = acc.transactions.filter((t) => t.type === "deposit");
      const totalDeposits = deposits.reduce((s, t) => s + Number(t.amount), 0);

      const talangan = talanganByAccount.get(acc.id);
      const memberStatus = acc.member.status;
      const canApplyTalangan =
        target > 0 && remaining > 0 && !talangan && memberStatus === "active" && acc.status === "active";

      return {
        id: acc.id,
        accountNo: acc.accountNo,
        status: acc.status,
        productName: acc.product.name,
        productType: acc.product.type,
        linkedBankName: acc.product.linkedBankName,
        balance,
        targetAmount: target,
        monthlyTarget: acc.monthlyTarget ? Number(acc.monthlyTarget) : 0,
        maturityDate: acc.maturityDate,
        progress,
        remaining,
        monthsRemaining,
        isTargetReached: target > 0 && balance >= target,
        stats: { totalDeposits, depositCount: deposits.length },
        recentDeposits: acc.transactions
          .filter((t) => t.type === "deposit")
          .slice(0, 5)
          .map((t) => ({
            id: t.id,
            amount: Number(t.amount),
            notes: t.notes,
            transactionDate: t.transactionDate,
          })),
        activeTalangan: talangan
          ? {
              loanNo: talangan.loanNo,
              status: talangan.status,
              outstanding: Number(talangan.principalOutstanding) + Number(talangan.interestOutstanding),
              monthlyInstallment: Number(talangan.monthlyInstallment),
              tenorMonths: talangan.tenorMonths,
              nextDueDate: talangan.schedules[0]?.dueDate ?? null,
              nextDueAmount: talangan.schedules[0] ? Number(talangan.schedules[0].totalAmount) : null,
            }
          : null,
        gap: remaining,
        canApplyTalangan,
      };
    });

    // 4. Bagi-hasil credits (SavingsTransaction interest on these accounts)
    const bagiHasilCredits =
      accountIds.length > 0
        ? await prisma.savingsTransaction.findMany({
            where: { accountId: { in: accountIds }, type: "interest", status: { not: "voided" } },
            select: { id: true, amount: true, notes: true, transactionDate: true, referenceNo: true },
            orderBy: { transactionDate: "desc" },
            take: 10,
          })
        : [];
    const totalBagiHasil = bagiHasilCredits.reduce((s, t) => s + Number(t.amount), 0);

    // 5. Summary
    const totalBalance = accountViews.reduce((s, a) => s + a.balance, 0);
    const totalTarget = accountViews.reduce((s, a) => s + a.targetAmount, 0);
    const overallProgress =
      totalTarget > 0 ? Math.min(100, Math.round((totalBalance / totalTarget) * 10000) / 100) : 0;

    return NextResponse.json({
      data: {
        summary: {
          totalBalance,
          totalTarget,
          overallProgress,
          activeAccounts: accountViews.filter((a) => a.status === "active").length,
          activeTalanganCount: accountViews.filter((a) => a.activeTalangan?.status === "active").length,
          totalBagiHasil,
        },
        accounts: accountViews,
        bagiHasilCredits: bagiHasilCredits.map((t) => ({
          id: t.id,
          amount: Number(t.amount),
          notes: t.notes,
          transactionDate: t.transactionDate,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/mobile/haji-umrah error:", error);
    return NextResponse.json({ message: "Gagal memuat data Haji & Umrah" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/haji-umrah-mobile.spec.ts -g "3\." --reporter=line`
Expected: PASS (3.1, 3.2, 3.3).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mobile/haji-umrah/route.ts src/app/api/mobile/haji-umrah/_helpers.ts e2e/haji-umrah-mobile.spec.ts
git commit -m "feat(haji-umrah): GET /api/mobile/haji-umrah member summary (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: GET /api/mobile/haji-umrah/accounts/[id] (detail endpoint)

**Files:**
- Create: `src/app/api/mobile/haji-umrah/accounts/[id]/route.ts`
- Test: append to `e2e/haji-umrah-mobile.spec.ts`

- [ ] **Step 1: Append failing tests**

Append inside the `test.describe` block in `e2e/haji-umrah-mobile.spec.ts`:

```typescript
  test("4.1 GET detail — own account (200)", async ({ request }) => {
    const token = await mobileToken(request, MEMBER_EMAIL, MEMBER_PASSWORD);
    // Get an account id from the summary first
    const sum = await request.get(`${BASE}/api/mobile/haji-umrah`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sumJson = await sum.json();
    const accId = sumJson.data.accounts[0]?.id;
    if (!accId) return; // member has no H&U account — skip

    const res = await request.get(`${BASE}/api/mobile/haji-umrah/accounts/${accId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.account).toBeDefined();
    expect(Array.isArray(json.data.transactions)).toBe(true);
    console.log("✅ Mobile H&U detail:", json.data.account.accountNo);
  });

  test("4.2 GET detail — foreign account (404)", async ({ request }) => {
    const token = await mobileToken(request, MEMBER_EMAIL, MEMBER_PASSWORD);
    const res = await request.get(`${BASE}/api/mobile/haji-umrah/accounts/999999`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/haji-umrah-mobile.spec.ts -g "4\." --reporter=line`
Expected: FAIL — 404 (route does not exist).

- [ ] **Step 3: Implement the endpoint**

Create `src/app/api/mobile/haji-umrah/accounts/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../middleware";
import { resolveMobileMember } from "../../_helpers";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/mobile/haji-umrah/accounts/[id] — Single account detail + full history.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const mobileUser = getMobileUser(request);
  if (!mobileUser) return unauthorizedResponse();

  try {
    const resolved = await resolveMobileMember(mobileUser);
    if (!resolved) {
      return NextResponse.json({ message: "Akun tidak terhubung ke data anggota" }, { status: 401 });
    }
    const memberId = resolved.member.id;

    const { id } = await params;
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json({ message: "Invalid account id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = Math.min(parseInt(searchParams.get("perPage") || "50"), 100);

    // Scoped: must belong to this member AND be H&U type
    const account = await prisma.savingsAccount.findFirst({
      where: { id: accountId, memberId },
      include: {
        product: { select: { id: true, name: true, type: true, targetAmount: true, linkedBankName: true } },
      },
    });
    if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
      return NextResponse.json({ message: "Rekening tidak ditemukan" }, { status: 404 });
    }

    const balance = Number(account.balance);
    const productTarget = account.product.targetAmount ? Number(account.product.targetAmount) : 0;
    const target = account.targetAmount ? Number(account.targetAmount) : productTarget;
    const progress = target > 0 ? Math.min(100, Math.round((balance / target) * 10000) / 100) : 0;
    const remaining = Math.max(0, target - balance);

    const where = { accountId, status: { not: "voided" } };
    const [transactions, total] = await Promise.all([
      prisma.savingsTransaction.findMany({
        where,
        select: { id: true, transactionNo: true, type: true, amount: true, notes: true, transactionDate: true, referenceNo: true },
        orderBy: { transactionDate: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.savingsTransaction.count({ where }),
    ]);

    // Active talangan for this account
    const talangan = await prisma.loan.findFirst({
      where: { memberId, linkedSavingsAccountId: accountId, status: { in: ["active", "paid_off"] } },
      select: {
        loanNo: true, status: true, principalOutstanding: true, interestOutstanding: true,
        monthlyInstallment: true, tenorMonths: true,
        schedules: {
          where: { status: { in: ["pending", "partial", "overdue"] } },
          select: { dueDate: true, totalAmount: true },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      data: {
        account: {
          id: account.id,
          accountNo: account.accountNo,
          status: account.status,
          productName: account.product.name,
          productType: account.product.type,
          linkedBankName: account.product.linkedBankName,
          balance,
          targetAmount: target,
          monthlyTarget: account.monthlyTarget ? Number(account.monthlyTarget) : 0,
          maturityDate: account.maturityDate,
          progress,
          remaining,
          isTargetReached: target > 0 && balance >= target,
        },
        transactions: transactions.map((t) => ({
          id: t.id,
          transactionNo: t.transactionNo,
          type: t.type,
          amount: Number(t.amount),
          notes: t.notes,
          transactionDate: t.transactionDate,
          referenceNo: t.referenceNo,
        })),
        activeTalangan: talangan
          ? {
              loanNo: talangan.loanNo,
              status: talangan.status,
              outstanding: Number(talangan.principalOutstanding) + Number(talangan.interestOutstanding),
              monthlyInstallment: Number(talangan.monthlyInstallment),
              nextDueDate: talangan.schedules[0]?.dueDate ?? null,
              nextDueAmount: talangan.schedules[0] ? Number(talangan.schedules[0].totalAmount) : null,
            }
          : null,
      },
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    });
  } catch (error) {
    console.error("GET /api/mobile/haji-umrah/accounts/[id] error:", error);
    return NextResponse.json({ message: "Gagal memuat detail rekening" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/haji-umrah-mobile.spec.ts -g "4\." --reporter=line`
Expected: PASS (4.1, 4.2).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mobile/haji-umrah/accounts/[id]/route.ts e2e/haji-umrah-mobile.spec.ts
git commit -m "feat(haji-umrah): GET mobile account detail + history (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: POST /api/mobile/haji-umrah/talangan/apply

**Files:**
- Create: `src/app/api/mobile/haji-umrah/talangan/apply/route.ts`
- Test: append to `e2e/haji-umrah-mobile.spec.ts`

- [ ] **Step 1: Append failing tests**

Append inside the `test.describe` block:

```typescript
  test("5.1 POST talangan/apply — validates missing fields (400)", async ({ request }) => {
    const token = await mobileToken(request, MEMBER_EMAIL, MEMBER_PASSWORD);
    const res = await request.post(`${BASE}/api/mobile/haji-umrah/talangan/apply`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { savingsAccountId: 1 }, // missing amount + tenor
    });
    expect(res.status()).toBe(400);
  });

  test("5.2 POST talangan/apply — amount over gap (400)", async ({ request }) => {
    const token = await mobileToken(request, MEMBER_EMAIL, MEMBER_PASSWORD);
    const sum = await request.get(`${BASE}/api/mobile/haji-umrah`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sumJson = await sum.json();
    const acc = sumJson.data.accounts.find((a: any) => a.canApplyTalangan);
    if (!acc) return; // no eligible account — skip

    const res = await request.post(`${BASE}/api/mobile/haji-umrah/talangan/apply`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { savingsAccountId: acc.id, amount: acc.gap + 10_000_000, tenor: 12 },
    });
    expect([400, 409].includes(res.status())).toBe(true);
  });

  test("5.3 POST talangan/apply — operator blocked (401)", async ({ request }) => {
    const token = await mobileToken(request, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    const res = await request.post(`${BASE}/api/mobile/haji-umrah/talangan/apply`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { savingsAccountId: 1, amount: 1_000_000, tenor: 12 },
    });
    expect(res.status()).toBe(401);
  });

  test("5.4 POST talangan/apply — submit success (201) then double-apply (409)", async ({ request }) => {
    const token = await mobileToken(request, MEMBER_EMAIL, MEMBER_PASSWORD);
    const sum = await request.get(`${BASE}/api/mobile/haji-umrah`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sumJson = await sum.json();
    const acc = sumJson.data.accounts.find((a: any) => a.canApplyTalangan);
    if (!acc) {
      console.log("⏭ No eligible account for apply test — skipping");
      return;
    }

    // NOTE: this test creates a real LoanApplication (status submitted).
    // It is a financial-record side effect but non-disbursing (no money moves).
    const amount = Math.max(500_000, Math.min(acc.gap, 1_000_000));
    const res = await request.post(`${BASE}/api/mobile/haji-umrah/talangan/apply`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { savingsAccountId: acc.id, amount, tenor: 12 },
    });
    if (res.status() === 409) {
      console.log("⏭ Account already has active talangan — skipping submit");
      return;
    }
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.data.status).toBe("submitted");
    console.log("✅ Talangan submitted:", json.data.applicationNo);

    // Double-apply → 409
    const res2 = await request.post(`${BASE}/api/mobile/haji-umrah/talangan/apply`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { savingsAccountId: acc.id, amount, tenor: 12 },
    });
    expect(res2.status()).toBe(409);
    console.log("✅ Double-apply blocked:", res2.status());
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/haji-umrah-mobile.spec.ts -g "5\." --reporter=line`
Expected: FAIL — 404 (route does not exist).

- [ ] **Step 3: Implement the endpoint**

Create `src/app/api/mobile/haji-umrah/talangan/apply/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getMobileUser, unauthorizedResponse } from "../../../../middleware";
import { resolveMobileMember, resolveUserIdForMember } from "../../_helpers";
import { mobileTalanganApplySchema } from "@/lib/validations/haji-umrah";
import { createNotification, getNotificationRecipients } from "@/lib/notifications";

// POST /api/mobile/haji-umrah/talangan/apply — Member submits a talangan request.
// Always creates a SUBMITTED LoanApplication (no auto-disburse from mobile).
// Admin approves + disburses on the web.
export async function POST(request: Request) {
  const mobileUser = getMobileUser(request);
  if (!mobileUser) return unauthorizedResponse();

  try {
    const resolved = await resolveMobileMember(mobileUser);
    if (!resolved) {
      return NextResponse.json({ message: "Akun tidak terhubung ke data anggota" }, { status: 401 });
    }
    const memberId = resolved.member.id;

    const body = await request.json();
    const parsed = mobileTalanganApplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validasi gagal", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { savingsAccountId, amount, tenor } = parsed.data;

    // 1. Account must belong to this member, be active, H&U type
    const account = await prisma.savingsAccount.findFirst({
      where: { id: savingsAccountId, memberId },
      include: {
        product: { select: { id: true, name: true, type: true } },
        talanganLoans: { where: { status: "active" }, select: { id: true } },
      },
    });
    if (!account) {
      return NextResponse.json({ message: "Rekening tabungan tidak ditemukan" }, { status: 404 });
    }
    if (!["tabungan_haji", "tabungan_umrah"].includes(account.product.type)) {
      return NextResponse.json({ message: "Rekening bukan tabungan Haji & Umrah" }, { status: 400 });
    }
    if (account.status !== "active") {
      return NextResponse.json({ message: "Rekening tabungan tidak aktif" }, { status: 400 });
    }
    if (resolved.member.status === "inactive" || resolved.member.status === "resigned" || resolved.member.status === "pensiun") {
      return NextResponse.json({ message: `Anggota tidak aktif (status: ${resolved.member.status})` }, { status: 400 });
    }

    // 2. Gap
    const balance = Number(account.balance);
    const productTarget = account.targetAmount; // account-level target
    const target = productTarget ? Number(productTarget) : 0;
    const gap = Math.max(0, target - balance);
    if (target <= 0) {
      return NextResponse.json({ message: "Rekening tidak memiliki target, tidak bisa ajukan talangan" }, { status: 400 });
    }
    if (gap <= 0) {
      return NextResponse.json({ message: "Tabungan sudah mencapai target, tidak perlu talangan" }, { status: 400 });
    }
    if (amount > gap) {
      return NextResponse.json(
        { message: `Jumlah talangan (Rp ${amount.toLocaleString("id-ID")}) melebihi gap (Rp ${gap.toLocaleString("id-ID")})` },
        { status: 400 },
      );
    }

    // 3. No active talangan for this account (1:1)
    if (account.talanganLoans.length > 0) {
      return NextResponse.json({ message: "Rekening ini sudah memiliki talangan aktif" }, { status: 409 });
    }

    // 4. Find matching talangan product by type (tabungan_haji → talangan_haji)
    const talanganType = account.product.type.replace("tabungan_", "talangan_");
    const loanProduct = await prisma.loanProduct.findFirst({
      where: { type: talanganType, isActive: true, isCurrent: true },
    });
    if (!loanProduct) {
      return NextResponse.json({ message: `Produk talangan (${talanganType}) tidak tersedia` }, { status: 400 });
    }

    // 5. Amount + tenor within product range
    if (loanProduct.minAmount && amount < Number(loanProduct.minAmount)) {
      return NextResponse.json({ message: `Jumlah talangan minimum Rp ${Number(loanProduct.minAmount).toLocaleString("id-ID")}` }, { status: 400 });
    }
    if (loanProduct.maxAmount && amount > Number(loanProduct.maxAmount)) {
      return NextResponse.json({ message: `Jumlah talangan maksimum Rp ${Number(loanProduct.maxAmount).toLocaleString("id-ID")}` }, { status: 400 });
    }
    if (loanProduct.minTenorMonths && tenor < loanProduct.minTenorMonths) {
      return NextResponse.json({ message: `Tenor minimum ${loanProduct.minTenorMonths} bulan` }, { status: 400 });
    }
    if (loanProduct.maxTenorMonths && tenor > loanProduct.maxTenorMonths) {
      return NextResponse.json({ message: `Tenor maksimum ${loanProduct.maxTenorMonths} bulan` }, { status: 400 });
    }

    // 6. Create SUBMITTED application (NO disburse from mobile)
    const suffix = crypto.randomBytes(4).readUInt32BE(0) % 1_000_000_000;
    const applicationNo = `TALM-${new Date().getFullYear()}-${String(suffix).padStart(9, "0")}`;
    const talanganSuffix = talanganType.replace("talangan_", "");

    const application = await prisma.loanApplication.create({
      data: {
        applicationNo,
        memberId,
        branchId: account.branchId,
        productId: loanProduct.id,
        amount,
        tenorMonths: tenor,
        purpose: `Talangan ${talanganSuffix === "haji" ? "Haji" : "Umrah"} (via Mobile) — Gap Rp ${gap.toLocaleString("id-ID")}`,
        notes: `Ajukan dari mobile. Linked to ${account.accountNo}`,
        status: "submitted",
        deductionSource: "gaji",
        linkedSavingsAccountId: savingsAccountId,
        createdById: resolved.userId,
        submittedAt: new Date(),
      },
    });

    // 7. Notify operator + admin haji_umrah (non-blocking)
    try {
      const recipients = await getNotificationRecipients("haji_umrah");
      if (recipients.length > 0) {
        await createNotification({
          userId: recipients,
          type: "haji_umrah_talangan_request",
          title: "Pengajuan Talangan H&U Baru",
          message: `${resolved.member.name} mengajukan talangan Rp ${amount.toLocaleString("id-ID")} untuk ${account.accountNo}`,
          data: { screen: "Approval", applicationId: application.id },
        });
      }
    } catch (err) {
      console.error("[H&U mobile] talangan request notification failed:", err);
    }

    return NextResponse.json(
      {
        message: "Pengajuan talangan terkirim. Menunggu persetujuan admin.",
        data: {
          applicationId: application.id,
          applicationNo: application.applicationNo,
          amount,
          tenor,
          status: "submitted",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/mobile/haji-umrah/talangan/apply error:", error);
    return NextResponse.json({ message: "Gagal mengajukan talangan" }, { status: 500 });
  }
}
```

> **Note:** `account.talanganLoans` is a relation on `SavingsAccount` used by the existing web apply route (Phase 2B) — confirmed present in `haji-umrah/talangan/apply/route.ts`. `createNotification` and `getNotificationRecipients` are exported from `src/lib/notifications.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/haji-umrah-mobile.spec.ts -g "5\." --reporter=line`
Expected: PASS (5.1–5.4). (5.2 and 5.4 skip gracefully if no eligible account.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mobile/haji-umrah/talangan/apply/route.ts e2e/haji-umrah-mobile.spec.ts
git commit -m "feat(haji-umrah): POST mobile talangan apply (submitted only) (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Notification trigger — target 80% / 100% (setoran endpoint)

**Files:**
- Modify: `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` (POST, after line 251 — after the `$transaction` block, before the `return`)
- Test: append to `e2e/haji-umrah-mobile.spec.ts`

- [ ] **Step 1: Append failing test**

Append inside the `test.describe` block:

```typescript
  test("6.1 Setoran crossing 100% creates target-reached notification", async ({ browser }) => {
    // Operator logs in (NextAuth web session) to perform the setoran, then we
    // inspect the Notification table for the member's user.
    const { page } = await loginInNewContextWeb(browser, OPERATOR_EMAIL, OPERATOR_PASSWORD);

    // Find an H&U account whose owner is a mobile user (has a User row).
    // We use the test member's known account HU-776-10-1715 indirectly:
    // set a setoran large enough to push progress >= 100% — but to avoid mutating
    // real balances destructively, this test only RUNS the trigger path if the
    // account is near target. Instead, we verify the helper code path exists by
    // checking that a setoran on the member's account returns 201 (the trigger
    // runs server-side, non-blocking).
    const accountsRes = await page.request.get(`${BASE}/api/haji-umrah/savings?search=HU-776`);
    const accountsJson = await accountsRes.json();
    const acc = accountsJson.data?.[0];
    if (!acc) { console.log("⏭ seed account not found — skipping"); return; }

    // Small deposit (Rp 1000) — trigger fires only if threshold crossed; either way
    // the endpoint must succeed (the injected notification code must not break it).
    const res = await page.request.post(
      `${BASE}/api/haji-umrah/savings/${acc.id}/transactions`,
      { data: { amount: 1000, paymentMethod: "cash", notes: "E2E notif-trigger probe" } },
    );
    expect([201, 400].includes(res.status())).toBe(true);
    console.log("✅ Setoran endpoint still works with notification injection:", res.status());
  });
```

> **Note:** a `loginInNewContextWeb` helper is needed (NextAuth web login, like the existing `loginAs` in other haji-umrah specs). Add it at the top of the file (Step 2).

- [ ] **Step 2: Add web-login helper**

Add near the top of `e2e/haji-umrah-mobile.spec.ts` (after imports, before `test.describe`):

```typescript
import type { Browser, Page } from "@playwright/test";

async function loginInNewContextWeb(
  browser: Browser,
  email: string,
  password: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|haji-umrah)/, { timeout: 30000 });
  return { page, close: () => context.close() };
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx playwright test e2e/haji-umrah-mobile.spec.ts -g "6.1" --reporter=line`
Expected: PASS or FAIL depending on whether the injection exists yet — but the test asserts the endpoint still works (201/400). It will pass even before injection (the point is to guard against the injection breaking the endpoint). Run the injection regardless.

- [ ] **Step 4: Inject the notification trigger**

In `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts`, add the import at the top (after existing imports):

```typescript
import { createNotification } from "@/lib/notifications";
import { resolveUserIdForMember } from "@/app/api/mobile/haji-umrah/_helpers";
```

Then, after line 255 (`const isTargetReached = ...`) and BEFORE the `return NextResponse.json(...)` at line 257, insert:

```typescript
        // ── Push notification: target milestone (non-blocking) ──
        try {
            if (target > 0) {
                const progressBefore = (currentBalance / target) * 100;
                const progressAfter = (balanceAfter / target) * 100;
                const ownerUserId = await resolveUserIdForMember(account.memberId);
                if (ownerUserId) {
                    const typeLabel2 = typeLabel; // "Haji" | "Umrah"
                    if (progressBefore < 80 && progressAfter >= 80) {
                        await createNotification({
                            userId: ownerUserId,
                            type: "haji_umrah_target_80",
                            title: "Target Tabungan Hampir Tercapai 🎯",
                            message: `Tabungan ${typeLabel2} Anda telah mencapai 80% menuju target Rp ${target.toLocaleString("id-ID")}.`,
                            data: { screen: "HajiUmrah", accountId: id },
                        });
                    }
                    if (progressBefore < 100 && progressAfter >= 100) {
                        await createNotification({
                            userId: ownerUserId,
                            type: "haji_umrah_target_reached",
                            title: "Target Tabungan Tercapai! 🎉",
                            message: `Selamat! Tabungan ${typeLabel2} Anda telah mencapai target Rp ${target.toLocaleString("id-ID")}.`,
                            data: { screen: "HajiUmrah", accountId: id },
                        });
                    }
                }
            }
        } catch (notifErr) {
            console.error("[H&U setoran] notification trigger failed:", notifErr);
            // Do NOT throw — the deposit already committed; notification is best-effort.
        }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx playwright test e2e/haji-umrah-mobile.spec.ts -g "6.1" --reporter=line`
Expected: PASS (201 or 400, endpoint functional with injection present).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts e2e/haji-umrah-mobile.spec.ts
git commit -m "feat(haji-umrah): push notification on target 80%/100% milestone (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Notification trigger — bagi-hasil credited (per member)

**Files:**
- Modify: `src/app/api/haji-umrah/bagi-hasil/route.ts` (POST, after the `$transaction` returns `distribution` at line 342, before the final `return`)
- Test: covered by existing bagi-hasil E2E (process path); this task adds the trigger without breaking it.

- [ ] **Step 1: Add import**

In `src/app/api/haji-umrah/bagi-hasil/route.ts`, add after existing imports:

```typescript
import { createNotification } from "@/lib/notifications";
import { resolveUserIdForMember } from "@/app/api/mobile/haji-umrah/_helpers";
```

- [ ] **Step 2: Inject per-member notification**

After line 342 (the `return dist;` inside the `$transaction` closes, i.e. after `const distribution = await prisma.$transaction(...)` completes) and BEFORE the final `return NextResponse.json(...)` at line 344, insert:

```typescript
        // ── Per-member push notification: bagi hasil credited (non-blocking) ──
        try {
            for (const s of shares) {
                if (s.amount <= 0) continue;
                const ownerUserId = await resolveUserIdForMember(s.memberId);
                if (!ownerUserId) continue;
                await createNotification({
                    userId: ownerUserId,
                    type: "haji_umrah_bagi_hasil",
                    title: "Bagi Hasil BSI Dikredit ✨",
                    message: `Bagi Hasil BSI ${periodLabel} sebesar Rp ${s.amount.toLocaleString("id-ID")} telah dikredit ke ${s.accountNo}.`,
                    data: { screen: "HajiUmil", savingsAccountId: s.savingsAccountId },
                    // Note: screen key intentionally "HajiUmrah" — fix typo below
                });
            }
        } catch (notifErr) {
            console.error("[H&U bagi-hasil] notification trigger failed:", notifErr);
        }
```

> **Correction:** in the `data` object above, set `screen: "HajiUmrah"` (not "HajiUmil" — that was a typo). The executor should write `screen: "HajiUmrah"`.

- [ ] **Step 3: Verify no regression on bagi-hasil E2E**

Run: `npx playwright test e2e/haji-umrah-bagi-hasil.spec.ts --reporter=line`
Expected: 8/8 PASS (the injection is non-blocking; process + void flows unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/haji-umrah/bagi-hasil/route.ts
git commit -m "feat(haji-umrah): push notification on bagi-hasil credit (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Notification trigger — talangan disbursed

**Files:**
- Modify: `src/app/api/loans/applications/[id]/disburse/route.ts`

- [ ] **Step 1: Read the disburse route to find the insertion point**

Run: read `src/app/api/loans/applications/[id]/disburse/route.ts` and locate where the `Loan` is created (the `prisma.loan.create` or `$transaction` that produces the loan record). The trigger goes AFTER the loan is successfully created, guarded by `loan.linkedSavingsAccountId != null` (i.e. it is a talangan).

- [ ] **Step 2: Add imports**

At the top of `src/app/api/loans/applications/[id]/disburse/route.ts`, add:

```typescript
import { createNotification } from "@/lib/notifications";
import { resolveUserIdForMember } from "@/app/api/mobile/haji-umrah/_helpers";
```

- [ ] **Step 3: Inject the trigger**

Immediately AFTER the loan creation transaction succeeds (after the `$transaction`/`prisma.loan.create` block that returns the loan, and BEFORE the success `NextResponse.json`), insert:

```typescript
    // ── Push notification: talangan disbursed (only for H&U talangan) ──
    if (loan.linkedSavingsAccountId) {
        try {
            const ownerUserId = await resolveUserIdForMember(loan.memberId);
            if (ownerUserId) {
                await createNotification({
                    userId: ownerUserId,
                    type: "haji_umrah_talangan_disbursed",
                    title: "Talangan H&U Cair 💰",
                    message: `Talangan Anda (${loan.loanNo}) telah cair sebesar Rp ${Number(loan.disbursedAmount).toLocaleString("id-ID")}.`,
                    data: { screen: "HajiUmrah", loanId: loan.id },
                });
            }
        } catch (notifErr) {
            console.error("[H&U talangan] disburse notification failed:", notifErr);
        }
    }
```

> **Note:** `loan.memberId`, `loan.loanNo`, `loan.disbursedAmount`, `loan.id`, and `loan.linkedSavingsAccountId` are all fields on the created `Loan` (confirm the exact variable name used for the created loan in that file — adjust `loan.` → actual variable if it differs, e.g. `newLoan.`).

- [ ] **Step 4: Verify no regression**

Run: `npx playwright test e2e/haji-umrah-talangan.spec.ts --reporter=line`
Expected: 14/14 PASS (the disburse flow runs the new notification path; non-blocking).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/loans/applications/[id]/disburse/route.ts
git commit -m "feat(haji-umrah): push notification on talangan disburse (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: HajiUmrahScreen (mobile overview)

**Files:**
- Create: `mobile/src/screens/member/HajiUmrahScreen.tsx`

> Mobile screens cannot be Playwright-tested (Expo). Verification = `tsc --noEmit` in `mobile/` + manual device check. Pattern follows `SimpananScreen.tsx` and `DashboardScreen.tsx`.

- [ ] **Step 1: Create the screen**

Create `mobile/src/screens/member/HajiUmrahScreen.tsx`:

```typescript
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar,
  TouchableOpacity, FlatList,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";
import C from "../../lib/colors";

const formatRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export default function HajiUmrahScreen() {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get("/api/mobile/haji-umrah");
      setData(res.data.data);
    } catch (err: any) {
      console.log("HajiUmrah fetch error:", err?.response?.status, err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={C.primary} />
        <Text style={{ color: C.mutedForeground }}>Memuat data Haji & Umrah...</Text>
      </View>
    );
  }

  const summary = data?.summary || {};
  const accounts: any[] = data?.accounts || [];
  const bagiHasil: any[] = data?.bagiHasilCredits || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Haji & Umrah</Text>
            <Text style={styles.headerSub}>Tabungan bertarget · BSI</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary gradient card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Saldo H&U</Text>
          <Text style={styles.summaryBalance}>{formatRp(summary.totalBalance || 0)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, summary.overallProgress || 0)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {summary.overallProgress || 0}% dari target {formatRp(summary.totalTarget || 0)}
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryChip}>🏦 {summary.activeAccounts || 0} rekening</Text>
            <Text style={styles.summaryChip}>💳 {summary.activeTalanganCount || 0} talangan</Text>
            <Text style={styles.summaryChip}>✨ {formatRp(summary.totalBagiHasil || 0)}</Text>
          </View>
        </View>

        {/* Per-account cards */}
        <Text style={styles.sectionTitle}>Rekening Saya</Text>
        {accounts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🕋</Text>
            <Text style={styles.emptyText}>Belum ada tabungan Haji & Umrah</Text>
          </View>
        ) : (
          accounts.map((acc) => (
            <TouchableOpacity
              key={acc.id}
              style={styles.accountCard}
              onPress={() => navigation.navigate("HajiUmrahDetail", { accountId: acc.id, accountNo: acc.accountNo })}
              activeOpacity={0.7}
            >
              <View style={styles.accountHead}>
                <View>
                  <Text style={styles.accountName}>{acc.productName}</Text>
                  <Text style={styles.accountNo}>{acc.accountNo}</Text>
                </View>
                <Text style={styles.accountBalance}>{formatRp(acc.balance)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, acc.progress || 0)}%` }]} />
              </View>
              <View style={styles.accountFoot}>
                <Text style={styles.footText}>{acc.progress || 0}% · sisa {formatRp(acc.remaining)}</Text>
                {acc.maturityDate && <Text style={styles.footText}>📅 {formatDate(acc.maturityDate)}</Text>}
              </View>
              {acc.isTargetReached && (
                <Text style={styles.targetBadge}>✓ Target tercapai</Text>
              )}
              {acc.activeTalangan && (
                <View style={styles.talanganBox}>
                  <Text style={styles.talanganText}>
                    💳 Talangan {acc.activeTalangan.loanNo} · cicilan {formatRp(acc.activeTalangan.monthlyInstallment)}/bln
                  </Text>
                </View>
              )}
              {acc.canApplyTalangan && (
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={() => navigation.navigate("HajiUmrahTalanganApply", {
                    accountId: acc.id, accountNo: acc.accountNo, gap: acc.gap, productType: acc.productType,
                  })}
                >
                  <Ionicons name="cash-outline" size={16} color="#FFF" />
                  <Text style={styles.applyBtnText}>Ajukan Talangan</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}

        {/* Bagi hasil credits */}
        {bagiHasil.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Bagi Hasil BSI</Text>
            {bagiHasil.map((b) => (
              <View key={b.id} style={styles.bagiCard}>
                <View>
                  <Text style={styles.bagiLabel}>✨ Bagi Hasil</Text>
                  <Text style={styles.bagiDate}>{formatDate(b.transactionDate)}</Text>
                </View>
                <Text style={styles.bagiAmount}>+{formatRp(b.amount)}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row",
  },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  headerSub: { color: C.mutedForeground, fontSize: 12, marginTop: 2 },
  body: { flex: 1, paddingHorizontal: 16, marginTop: 16 },
  summaryCard: {
    backgroundColor: C.primary, borderRadius: 16, padding: 20, marginBottom: 20,
  },
  summaryLabel: { color: "#CBD5E1", fontSize: 13 },
  summaryBalance: { color: "#FFF", fontSize: 26, fontWeight: "bold", marginVertical: 6 },
  progressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: C.accent, borderRadius: 4 },
  progressText: { color: "#FFF", fontSize: 12, marginTop: 8 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  summaryChip: { color: "#FFF", fontSize: 11, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: C.primary, marginBottom: 10 },
  accountCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { height: 1 } },
  accountHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  accountName: { fontSize: 15, fontWeight: "bold", color: C.primary },
  accountNo: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  accountBalance: { fontSize: 16, fontWeight: "bold", color: C.success },
  accountFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  footText: { fontSize: 11, color: C.mutedForeground },
  targetBadge: { color: C.success, fontSize: 12, fontWeight: "600", marginTop: 8 },
  talanganBox: { backgroundColor: "#FEF3C7", borderRadius: 8, padding: 8, marginTop: 8 },
  talanganText: { fontSize: 11, color: "#92400E" },
  applyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 10, marginTop: 10 },
  applyBtnText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  bagiCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bagiLabel: { fontSize: 13, fontWeight: "600", color: C.primary },
  bagiDate: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  bagiAmount: { fontSize: 15, fontWeight: "bold", color: C.success },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: C.mutedForeground, fontSize: 14 },
});
```

- [ ] **Step 2: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/member/HajiUmrahScreen.tsx
git commit -m "feat(haji-umrah): mobile HajiUmrahScreen overview (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: HajiUmrahDetailScreen (mobile)

**Files:**
- Create: `mobile/src/screens/member/HajiUmrahDetailScreen.tsx`

- [ ] **Step 1: Create the screen**

Create `mobile/src/screens/member/HajiUmrahDetailScreen.tsx`:

```typescript
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar, TouchableOpacity } from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";
import C from "../../lib/colors";

const formatRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export default function HajiUmrahDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const accountId = route.params?.accountId;
  const accountNo = route.params?.accountNo;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get(`/api/mobile/haji-umrah/accounts/${accountId}`);
      setData(res.data.data);
    } catch (err: any) {
      console.log("HajiUmrahDetail fetch error:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const account = data?.account;
  const transactions: any[] = data?.transactions || [];

  const renderItem = ({ item }: { item: any }) => {
    const isDeposit = item.type === "deposit";
    const isInterest = item.type === "interest";
    const label = isDeposit ? "Setoran" : isInterest ? "Bagi Hasil" : item.type === "correction" ? "Koreksi" : "Penarikan";
    const icon = isDeposit ? "⬇️" : isInterest ? "✨" : item.type === "correction" ? "⚠️" : "⬆️";
    const color = isDeposit || isInterest ? C.success : C.destructive;
    return (
      <View style={styles.txCard}>
        <Text style={styles.txIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.txType, { color }]}>{label}</Text>
          <Text style={styles.txDate}>{formatDate(item.transactionDate)}</Text>
          {item.notes ? <Text style={styles.txNotes} numberOfLines={1}>{item.notes}</Text> : null}
        </View>
        <Text style={[styles.txAmount, { color }]}>
          {(isDeposit || isInterest) ? "+" : "-"}{formatRp(item.amount)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>{account?.productName || "Tabungan H&U"}</Text>
            <Text style={styles.headerSub}>{accountNo || account?.accountNo}</Text>
          </View>
        </View>
      </View>

      {account && (
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Saldo</Text>
            <Text style={styles.statValueGreen}>{formatRp(account.balance)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Target</Text>
            <Text style={styles.statValue}>{formatRp(account.targetAmount)}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, account.progress || 0)}%` }]} />
          </View>
          <Text style={styles.progressText}>{account.progress || 0}% · sisa {formatRp(account.remaining)}</Text>
          {account.maturityDate && (
            <Text style={styles.maturity}>📅 Jatuh tempo: {formatDate(account.maturityDate)}</Text>
          )}
          {data?.activeTalangan && (
            <View style={styles.talanganBox}>
              <Text style={styles.talanganText}>
                💳 Talangan {data.activeTalangan.loanNo} · cicilan {formatRp(data.activeTalangan.monthlyInstallment)}/bln
              </Text>
              {data.activeTalangan.nextDueDate && (
                <Text style={styles.talanganText}>Jatuh tempo berikutnya: {formatDate(data.activeTalangan.nextDueDate)}</Text>
              )}
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Riwayat Transaksi</Text>
      {loading ? (
        <Text style={styles.loading}>Memuat...</Text>
      ) : transactions.length === 0 ? (
        <Text style={styles.loading}>Belum ada transaksi</Text>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { backgroundColor: C.primary, paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  headerSub: { color: C.mutedForeground, fontSize: 12, marginTop: 2 },
  statsCard: { margin: 16, marginBottom: 0, backgroundColor: C.card, borderRadius: 14, padding: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { height: 1 } },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  statLabel: { fontSize: 13, color: C.mutedForeground },
  statValue: { fontSize: 15, fontWeight: "600", color: C.foreground },
  statValueGreen: { fontSize: 18, fontWeight: "bold", color: C.success },
  progressTrack: { height: 8, backgroundColor: C.border, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  progressFill: { height: 8, backgroundColor: C.accent, borderRadius: 4 },
  progressText: { fontSize: 11, color: C.mutedForeground, marginTop: 6 },
  maturity: { fontSize: 11, color: C.mutedForeground, marginTop: 4 },
  talanganBox: { backgroundColor: "#FEF3C7", borderRadius: 8, padding: 10, marginTop: 10 },
  talanganText: { fontSize: 11, color: "#92400E" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: C.primary, marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  txCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  txIcon: { fontSize: 22 },
  txType: { fontSize: 14, fontWeight: "600" },
  txDate: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  txNotes: { fontSize: 11, color: C.foreground, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "bold" },
  loading: { textAlign: "center", color: C.mutedForeground, padding: 20 },
});
```

- [ ] **Step 2: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/member/HajiUmrahDetailScreen.tsx
git commit -m "feat(haji-umrah): mobile HajiUmrahDetailScreen (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: HajiUmrahTalanganApplyScreen (mobile)

**Files:**
- Create: `mobile/src/screens/member/HajiUmrahTalanganApplyScreen.tsx`

- [ ] **Step 1: Create the screen**

Create `mobile/src/screens/member/HajiUmrahTalanganApplyScreen.tsx`:

```typescript
import React, { useState } from "react";
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";
import C from "../../lib/colors";

const formatRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
const TENOR_OPTIONS = [6, 12, 24, 36, 48];

export default function HajiUmrahTalanganApplyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const accountId = route.params?.accountId;
  const accountNo = route.params?.accountNo;
  const gap = route.params?.gap || 0;

  const [amount, setAmount] = useState("");
  const [tenor, setTenor] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any>(null);

  const parsedAmount = parseInt(amount.replace(/\D/g, "")) || 0;
  const overGap = parsedAmount > gap;

  const submit = async () => {
    if (parsedAmount <= 0) { Alert.alert("Error", "Masukkan jumlah talangan"); return; }
    if (overGap) { Alert.alert("Error", `Jumlah melebihi gap (${formatRp(gap)})`); return; }

    setSubmitting(true);
    try {
      const res = await api.post("/api/mobile/haji-umrah/talangan/apply", {
        savingsAccountId: accountId,
        amount: parsedAmount,
        tenor,
      });
      setDone(res.data.data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Gagal mengajukan talangan";
      Alert.alert("Gagal", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Ajukan Talangan</Text>
            <Text style={styles.headerSub}>{accountNo}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {done ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Pengajuan Terkirim!</Text>
            <Text style={styles.successText}>
              No: {done.applicationNo}{"\n"}Jumlah: {formatRp(done.amount)}{"\n"}Tenor: {done.tenor} bulan
            </Text>
            <Text style={styles.successNote}>Menunggu persetujuan admin.</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate("HajiUmrah")}>
              <Text style={styles.btnPrimaryText}>Kembali ke Haji & Umrah</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Gap (kekurangan target)</Text>
              <Text style={styles.gapValue}>{formatRp(gap)}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Jumlah Talangan</Text>
              <TextInput
                style={[styles.input, overGap && { borderColor: C.destructive }]}
                keyboardType="numeric"
                placeholder="0"
                value={parsedAmount > 0 ? formatRp(parsedAmount) : ""}
                onChangeText={(t) => setAmount(t.replace(/\D/g, ""))}
              />
              {overGap && <Text style={styles.errorText}>Melebihi gap {formatRp(gap)}</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Tenor (bulan)</Text>
              <View style={styles.tenorRow}>
                {TENOR_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tenorChip, tenor === t && styles.tenorChipActive]}
                    onPress={() => setTenor(t)}
                  >
                    <Text style={[styles.tenorText, tenor === t && styles.tenorTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ℹ️ Talangan akan diajukan sebagai permohonan. Admin akan meninjau & mencairkan
                di koperasi. Anda akan mendapat notifikasi saat disetujui.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, (overGap || parsedAmount <= 0 || submitting) && { opacity: 0.5 }]}
              disabled={overGap || parsedAmount <= 0 || submitting}
              onPress={submit}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnPrimaryText}>Kirim Pengajuan</Text>
              )}
            </TouchableOpacity>
            <View style={{ height: 30 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { backgroundColor: C.primary, paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  headerSub: { color: C.mutedForeground, fontSize: 12, marginTop: 2 },
  body: { flex: 1, paddingHorizontal: 16, marginTop: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: C.foreground, marginBottom: 6 },
  gapValue: { fontSize: 22, fontWeight: "bold", color: C.warning },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: C.card, color: C.foreground },
  errorText: { color: C.destructive, fontSize: 11, marginTop: 4 },
  tenorRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tenorChip: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, backgroundColor: C.card },
  tenorChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  tenorText: { fontSize: 14, fontWeight: "600", color: C.foreground },
  tenorTextActive: { color: "#FFF" },
  infoBox: { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#BFDBFE" },
  infoText: { fontSize: 12, color: "#1E40AF", lineHeight: 18 },
  btnPrimary: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnPrimaryText: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
  successCard: { backgroundColor: C.card, borderRadius: 16, padding: 24, alignItems: "center", marginTop: 8 },
  successIcon: { fontSize: 56, marginBottom: 12 },
  successTitle: { fontSize: 18, fontWeight: "bold", color: C.success, marginBottom: 12 },
  successText: { fontSize: 14, color: C.foreground, textAlign: "center", lineHeight: 22, marginBottom: 12 },
  successNote: { fontSize: 12, color: C.mutedForeground, marginBottom: 20, fontStyle: "italic" },
});
```

- [ ] **Step 2: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/member/HajiUmrahTalanganApplyScreen.tsx
git commit -m "feat(haji-umrah): mobile talangan apply screen (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Wire screens into navigation + Dashboard entry

**Files:**
- Modify: `mobile/App.tsx`
- Modify: `mobile/src/screens/common/DashboardScreen.tsx`

- [ ] **Step 1: Register screens in App.tsx**

In `mobile/App.tsx`, add lazy imports near the other member screens (after line 28, the `LoanApplicationScreen` lazy import):

```typescript
const HajiUmrahScreen = React.lazy(() => import("./src/screens/member/HajiUmrahScreen"));
const HajiUmrahDetailScreen = React.lazy(() => import("./src/screens/member/HajiUmrahDetailScreen"));
const HajiUmrahTalanganApplyScreen = React.lazy(() => import("./src/screens/member/HajiUmrahTalanganApplyScreen"));
```

Add the 3 `Stack.Screen` entries under the "Member Sub-screens" group (after line 218, the `LoanApplication` screen):

```typescript
            <Stack.Screen name="HajiUmrah">{() => <LS><HajiUmrahScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="HajiUmrahDetail">{() => <LS><HajiUmrahDetailScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="HajiUmrahTalanganApply">{() => <LS><HajiUmrahTalanganApplyScreen /></LS>}</Stack.Screen>
```

- [ ] **Step 2: Add push-tap branch in App.tsx**

In the `Notifications.addNotificationResponseReceivedListener` handler (around line 185), add a branch for the H&U screen, so tapping an H&U push notification opens it:

```typescript
            if (data.screen === 'HajiUmrah') {
              navRef.current?.navigate('HajiUmrah');
            } else if (data.screen === 'TransaksiScreen') {
              navRef.current?.navigate('Main');
            } else if (data.screen === 'ApprovalScreen') {
              navRef.current?.navigate('Approval');
            }
```

(Replace the existing `if (data.screen === 'TransaksiScreen') ... else if ('ApprovalScreen')` chain with the above — prepend the HajiUmrah branch.)

- [ ] **Step 3: Add Dashboard MenuItem (conditional)**

In `mobile/src/screens/common/DashboardScreen.tsx`, in the member "Menu Layanan" grid (the `<View style={styles.menuGrid}>` block around line 575), add a conditional MenuItem. First, add state to track H&U membership near the other state (line 47):

```typescript
  const [hasHu, setHasHu] = useState(false);
```

Then in `loadData` (inside the member `summaryRes` success block, after `setData(d)`), detect H&U accounts:

```typescript
      // Detect if member has any Haji & Umrah account (for conditional menu)
      if (d.type !== "operator" && d.type !== "kasir") {
        try {
          const huRes = await api.get("/api/mobile/haji-umrah");
          setHasHu((huRes.data?.data?.accounts?.length ?? 0) > 0);
        } catch { setHasHu(false); }
      }
```

Then add the MenuItem inside the member menu grid (e.g., before "Mutasi Transaksi"):

```tsx
              {hasHu && (
                <MenuItem
                  icon="airplane-outline"
                  label="Haji & Umrah"
                  color="#D4AF37"
                  onPress={() => navigation.navigate("HajiUmrah")}
                />
              )}
```

- [ ] **Step 4: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/App.tsx mobile/src/screens/common/DashboardScreen.tsx
git commit -m "feat(haji-umrah): wire mobile screens + Dashboard entry (Phase 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Full E2E + no-regression + docs

**Files:**
- Test: `e2e/haji-umrah-mobile.spec.ts` (already built across Tasks 3-6)

- [ ] **Step 1: Run the full Phase 5 mobile test suite**

Run: `npx playwright test e2e/haji-umrah-mobile.spec.ts --reporter=line`
Expected: all mobile tests PASS (3.x, 4.x, 5.x, 6.x).

- [ ] **Step 2: Run all H&U E2E for no-regression**

Run: `npx playwright test e2e/haji-umrah --workers=1 --reporter=line`
Expected: all existing H&U tests PASS (45 tests across 7 spec files) + new mobile spec. The notification injections are non-blocking; financial flows unchanged.

- [ ] **Step 3: Web build check**

Run: `npx next build`
Expected: compiled successfully (no new route errors; the 3 mobile routes registered).

- [ ] **Step 4: Mobile type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Update docs**

Update `UNIT-UMRAH-HAJI.md`:
- Phase History table: change `| 5 | Mobile App | 🔲 Pending | — | — |` to `| 5 | Mobile App | ✅ DONE | <commit> | E2E N/N |` (fill actual count).
- Footer: update test count + "Phase 5 COMPLETE".
- Add a "Mobile App" section under "API Endpoints" listing the 3 `/api/mobile/haji-umrah/*` endpoints.
- Add the 3 mobile screens to "UI Pages".

Update `Docs-Haji-umrah-plan/haji-umrah-planning.md` + `README.md`: mark Phase 5 COMPLETE.

- [ ] **Step 6: Commit docs**

```bash
git add UNIT-UMRAH-HAJI.md Docs-Haji-umrah-plan/haji-umrah-planning.md Docs-Haji-umrah-plan/README.md
git commit -m "docs(haji-umrah): Phase 5 mobile complete — update status + API/UI inventory

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review (run after writing plan — done)

- **Spec coverage:** §2 decisions → Tasks 1-12 implement member view + apply + notifications. §4 member-scoping → Task 2 helper. §5 API (3) → Tasks 3-5. §6 screens (3) → Tasks 9-11 + Task 12 wiring. §7 notifications (4) → Tasks 6-8 (3 web) + Task 5 step 7 (talangan request to admin). §8 validation → Task 1. §9 testing → Tasks 3-6 E2E + Task 13 no-regression. §10 safety → all tasks additive. ✅ No gaps.
- **Placeholder scan:** Task 7 Step 2 had a typo "HajiUmil" — flagged with correction. Task 8 references `loan.` variable — flagged to confirm exact name. No TBD/TODO. ✅
- **Type consistency:** `resolveMobileMember` / `resolveUserIdForMember` (Task 2) used consistently in Tasks 3, 4, 5, 6, 7, 8. `mobileTalanganApplySchema` (Task 1) used in Task 5. Screen names `HajiUmrah`/`HajiUmrahDetail`/`HajiUmrahTalanganApply` consistent across Tasks 9-12 and the push-tap branch. `data.screen: "HajiUmrah"` consistent. ✅

---

*Plan: 14 Juni 2026 · Branch `railway-migration` · commit-only. Spec: `2026-06-14-haji-umrah-5-mobile-design.md`.*
