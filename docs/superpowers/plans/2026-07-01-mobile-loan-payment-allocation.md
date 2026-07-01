# Mobile loan-payment FIFO Allocation Port — Implementation Plan (Fase 2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the mobile `loan-payment` route to allocate each payment across `LoanSchedule` rows via FIFO (matching the web route), creating `PaymentAllocation` records, updating schedules, and posting CashBank entries atomically — fixing the broken schedule tracking for every mobile loan payment.

**Architecture:** Extract the FIFO allocation algorithm to a pure, unit-tested helper (`allocatePayment`). The route becomes orchestration: fetch loan+schedules → call helper → atomic `$transaction(callback)` that creates `LoanPayment` (with `allocations`), updates each schedule, updates loan totals, and posts CashBank. Mobile auth (`getMobileUser`) and the existing request/response contract are preserved so `LoanPaymentScreen` keeps working unchanged.

**Tech Stack:** Next.js 16 route handler, Prisma 6 (`$transaction` interactive callback), TypeScript, Vitest + happy-dom (pure helper), `crypto.randomBytes` (txn numbers).

## Global Constraints

- **Branch:** `railway-migration` — **auto-deploys to prod (primkoppol.site) on push.** Commit freely; push only when ready.
- **Do NOT stage non-mine files:** `.claude/settings.local.json`, `mobile/app.json` — leave untouched.
- **Transaction numbers MUST use `crypto.randomBytes()`** — never `Math.random()` (security scanner CRITICAL). NOTE: the shared helper `buildCashBankTransactionData` defaults to `Math.random` for `transactionNo` — therefore this route MUST pass an explicit `transactionNo` (crypto) to it. Fixing the helper's own default is Fase 4, out of scope here.
- **Preserve the mobile API contract:** request body `{ loanId, amount, notes, cashBankAccountId, isEarlySettlement }` and response `{ message, data: { newPrincipalOutstanding, newInterestOutstanding, status } }` must stay byte-compatible (the `LoanPaymentScreen` UI depends on them).
- **Pure helper = TDD; route = typecheck + diagnostic** (repo has no DB integration-test harness for routes).
- **Decimal coercion:** Prisma `Decimal` fields (`principalOutstanding`, `principalPaid`, etc.) must be `Number()`-coerced before any math or before passing to the pure helper.
- **Pre-existing failing tests are NOT regressions:** `split-bill`, `batch-navigation`, `floor-plan`/`queue-system`.
- **Pre-existing tsc errors are NOT regressions:** `api/mobile/toko/shifts/[id]`, `prisma/seed-kas-bank-jatim.ts`, `prisma/seed-uat.ts`.
- **Run tests:** `npx vitest run <file>` / `npm run test`. **Typecheck:** `npx tsc --noEmit`.

---

### Task 1: Pure helper `allocatePayment` (TDD)

**Files:**
- Create: `src/lib/loan-payment-helpers.ts`
- Test: `src/__tests__/loan-payment-helpers.test.ts`

**Interfaces:**
- Produces: `allocatePayment(schedules, amount, isEarlySettlement)` + types `ScheduleInput`/`Allocation`/`AllocationResult` — consumed by Task 2.

- [ ] **Step 1: Write the failing test**

`src/__tests__/loan-payment-helpers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { allocatePayment, type ScheduleInput } from "@/lib/loan-payment-helpers";

function sched(over: Partial<ScheduleInput> & { id: number }): ScheduleInput {
  return {
    id: over.id,
    installmentNo: over.installNo ?? over.id,
    principalAmount: over.principalAmount ?? 1_000_000,
    principalPaid: over.principalPaid ?? 0,
    interestAmount: over.interestAmount ?? 200_000,
    interestPaid: over.interestPaid ?? 0,
    lateFee: over.lateFee ?? 0,
    lateFeePaid: over.lateFeePaid ?? 0,
  };
}

describe("allocatePayment", () => {
  it("allocates a full single-schedule regular payment (interest before principal)", () => {
    const r = allocatePayment([sched({ id: 1 })], 1_200_000, false);
    expect(r.allocations).toHaveLength(1);
    expect(r.allocations[0]).toMatchObject({ scheduleId: 1, principalAmount: 1_000_000, interestAmount: 200_000, lateFeeAmount: 0 });
    expect(r.totalPrincipal).toBe(1_000_000);
    expect(r.totalInterest).toBe(200_000);
    expect(r.totalLateFee).toBe(0);
  });

  it("allocates a partial payment — does not over-allocate", () => {
    const r = allocatePayment([sched({ id: 1 })], 500_000, false);
    // 500k → pays interest (200k) first, then 300k principal
    expect(r.allocations[0]).toMatchObject({ scheduleId: 1, interestAmount: 200_000, principalAmount: 300_000 });
    expect(r.totalPrincipal + r.totalInterest + r.totalLateFee).toBe(500_000);
  });

  it("spills across schedules FIFO when amount exceeds schedule 1", () => {
    const r = allocatePayment([sched({ id: 1 }), sched({ id: 2 })], 1_500_000, false);
    // schedule 1 due 1.2M (paid fully), 300k spills to schedule 2 (interest 200k + principal 100k)
    expect(r.allocations).toHaveLength(2);
    expect(r.allocations[0].scheduleId).toBe(1);
    expect(r.allocations[1].scheduleId).toBe(2);
    expect(r.allocations[1]).toMatchObject({ interestAmount: 200_000, principalAmount: 100_000 });
    expect(r.totalPrincipal + r.totalInterest).toBe(1_500_000);
  });

  it("early settlement zeroes interest — principal only", () => {
    const r = allocatePayment([sched({ id: 1 })], 1_000_000, true);
    expect(r.allocations[0]).toMatchObject({ principalAmount: 1_000_000, interestAmount: 0 });
    expect(r.totalInterest).toBe(0);
  });

  it("pays late fee before interest and principal", () => {
    const r = allocatePayment([sched({ id: 1, lateFee: 50_000 })], 100_000, false);
    // 100k → late fee 50k first, then interest 50k (of 200k due)
    expect(r.allocations[0]).toMatchObject({ lateFeeAmount: 50_000, interestAmount: 50_000, principalAmount: 0 });
    expect(r.totalLateFee).toBe(50_000);
  });

  it("handles already-partially-paid schedule — only remaining due", () => {
    const r = allocatePayment([sched({ id: 1, principalPaid: 600_000, interestPaid: 150_000 })], 450_000, false);
    // remaining due: principal 400k + interest 50k = 450k → paid fully
    expect(r.allocations[0]).toMatchObject({ principalAmount: 400_000, interestAmount: 50_000 });
  });

  it("returns empty allocations when no schedules", () => {
    const r = allocatePayment([], 500_000, false);
    expect(r.allocations).toEqual([]);
    expect(r.totalPrincipal).toBe(0);
  });

  it("never over-allocates beyond amount (multi-schedule, amount < total due)", () => {
    const r = allocatePayment([sched({ id: 1 }), sched({ id: 2 }), sched({ id: 3 })], 1_000_000, false);
    expect(r.totalPrincipal + r.totalInterest + r.totalLateFee).toBeLessThanOrEqual(1_000_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/loan-payment-helpers.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/loan-payment-helpers"`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/loan-payment-helpers.ts`:
```ts
/**
 * Pure helpers for loan payment allocation. Extracted from the (web) loan-payment
 * flow for unit testing. Matches the algorithm in src/app/api/loans/[id]/payments/route.ts.
 */

export interface ScheduleInput {
  id: number;
  installmentNo: number;
  principalAmount: number;
  principalPaid: number;
  interestAmount: number;
  interestPaid: number;
  lateFee: number;
  lateFeePaid: number;
}

export interface Allocation {
  scheduleId: number;
  principalAmount: number;
  interestAmount: number;
  lateFeeAmount: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  totalPrincipal: number;
  totalInterest: number;
  totalLateFee: number;
}

/**
 * FIFO allocation across schedules (asc installmentNo).
 * Per schedule, order of payment: late fee → interest → principal.
 * Early settlement zeroes interest (policy: only principal + penalty).
 *
 * `schedules` MUST already be filtered (pending/partial/overdue) + sorted by
 * installmentNo asc by the caller. Pure; unit-tested.
 */
export function allocatePayment(
  schedules: ScheduleInput[],
  amount: number,
  isEarlySettlement: boolean,
): AllocationResult {
  let remaining = amount;
  const allocations: Allocation[] = [];
  let totalPrincipal = 0;
  let totalInterest = 0;
  let totalLateFee = 0;

  for (const s of schedules) {
    if (remaining <= 0) break;

    const principalDue = s.principalAmount - s.principalPaid;
    const interestDue = s.interestAmount - s.interestPaid;
    const lateFeeDue = s.lateFee - s.lateFeePaid;
    const effectiveInterestDue = isEarlySettlement ? 0 : interestDue;
    const totalDue = principalDue + effectiveInterestDue + lateFeeDue;
    if (totalDue <= 0) continue;

    const payAmount = Math.min(remaining, totalDue);
    const lateFeePay = Math.min(payAmount, lateFeeDue);
    const interestPay = Math.min(payAmount - lateFeePay, effectiveInterestDue);
    const principalPay = payAmount - lateFeePay - interestPay;

    allocations.push({
      scheduleId: s.id,
      principalAmount: principalPay,
      interestAmount: interestPay,
      lateFeeAmount: lateFeePay,
    });
    totalPrincipal += principalPay;
    totalInterest += interestPay;
    totalLateFee += lateFeePay;
    remaining -= payAmount;
  }

  return { allocations, totalPrincipal, totalInterest, totalLateFee };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/loan-payment-helpers.test.ts`
Expected: PASS — 8/8.

- [ ] **Step 5: Commit**

```bash
git add src/lib/loan-payment-helpers.ts src/__tests__/loan-payment-helpers.test.ts
git commit -m "feat(loan): add allocatePayment pure FIFO helper + tests"
```

---

### Task 2: Rewrite mobile `loan-payment` POST (atomic, with allocation)

**Files:**
- Modify: `src/app/api/mobile/loan-payment/route.ts` (POST handler only; leave GET untouched)

**Interfaces:**
- Consumes: `allocatePayment` from Task 1; `buildCashBankTransactionData` from `@/lib/kas-bank-loan-helpers` (pass explicit `transactionNo`); `crypto` from node.
- Produces: same request/response contract; internally now writes `PaymentAllocation` + updates `LoanSchedule`.

- [ ] **Step 1: Update imports (top of file)**

Replace the existing import block (lines 1-5) with:
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";
import { buildCashBankTransactionData } from "@/lib/kas-bank-loan-helpers";
import { allocatePayment } from "@/lib/loan-payment-helpers";
```

- [ ] **Step 2: Add two small helpers above `POST`** (after the GET function, before `POST`):
```ts
// Collision-safe payment number — crypto (repo rule: never Math.random for txn numbers).
async function generateMobilePaymentNo(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
        const random = crypto.randomBytes(4).readUInt32BE(0) % 1_000_000;
        const paymentNo = `PAY-M-${year}-${random.toString().padStart(6, "0")}`;
        const exists = await tx.loanPayment.findUnique({ where: { paymentNo }, select: { id: true } });
        if (!exists) return paymentNo;
    }
    return `PAY-M-${year}-${Date.now().toString().slice(-8)}`;
}

// Explicit crypto CB transactionNo — avoids buildCashBankTransactionData's Math.random default.
function mobileCbTxNo(base: string): string {
    const rand = crypto.randomBytes(4).readUInt32BE(0) % 1_000_000;
    return `${base}-${rand.toString().padStart(6, "0")}`;
}
```

- [ ] **Step 3: Replace the entire POST handler** (from `// POST /api/mobile/loan-payment` through the end of the file) with:
```ts
// POST /api/mobile/loan-payment — Record a loan installment or early settlement payment.
// Unified FIFO allocation (matches web api/loans/[id]/payments): creates PaymentAllocation
// records, updates each LoanSchedule, updates loan totals, posts CashBank — all atomic.
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { loanId, amount, notes, cashBankAccountId, isEarlySettlement } = body;

        if (!loanId || !amount) {
            return NextResponse.json({ message: "loanId dan amount wajib diisi" }, { status: 400 });
        }
        const numAmount = Number(amount);
        if (numAmount <= 0) {
            return NextResponse.json({ message: "Jumlah harus lebih dari 0" }, { status: 400 });
        }

        const loan = await prisma.loan.findUnique({
            where: { id: Number(loanId) },
            include: {
                member: { select: { id: true, name: true, memberNo: true } },
                application: { select: { product: { select: { name: true } } } },
                schedules: {
                    where: { status: { in: ["pending", "partial", "overdue"] } },
                    orderBy: { installmentNo: "asc" },
                },
            },
        });

        if (!loan || !["active", "overdue"].includes(loan.status)) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan atau sudah lunas" }, { status: 404 });
        }

        const principalOut = Number(loan.principalOutstanding);
        const interestOut = Number(loan.interestOutstanding);

        // ── Early-settlement penalty (same formula as web + old mobile branch) ──
        let earlySettlementFee = 0;
        if (isEarlySettlement) {
            const principalAmount = Number(loan.principalAmount);
            const interestRate = Number(loan.interestRate || 1);
            const monthlyInterest = Math.round(principalAmount * (interestRate / 100));
            const penaltyMultiplier = loan.tenorMonths <= 24 ? 1 : 2;
            earlySettlementFee = monthlyInterest * penaltyMultiplier;
            const expectedTotal = principalOut + earlySettlementFee;
            if (Math.abs(numAmount - expectedTotal) > 100) {
                return NextResponse.json({
                    message: `Jumlah pelunasan tidak sesuai. Harus ${expectedTotal.toLocaleString("id-ID")} (Pokok: ${principalOut.toLocaleString("id-ID")} + Penalti: ${earlySettlementFee.toLocaleString("id-ID")})`,
                }, { status: 400 });
            }
        }

        const allocationAmount = isEarlySettlement ? numAmount - earlySettlementFee : numAmount;

        // ── Pure FIFO allocation ──
        const scheduleInputs = loan.schedules.map((s) => ({
            id: s.id,
            installmentNo: s.installmentNo,
            principalAmount: Number(s.principalAmount),
            principalPaid: Number(s.principalPaid),
            interestAmount: Number(s.interestAmount),
            interestPaid: Number(s.interestPaid),
            lateFee: Number(s.lateFee),
            lateFeePaid: Number(s.lateFeePaid),
        }));
        const { allocations, totalPrincipal, totalInterest, totalLateFee } = allocatePayment(
            scheduleInputs,
            allocationAmount,
            Boolean(isEarlySettlement),
        );

        const today = new Date();

        // ── ATOMIC TRANSACTION ──
        const result = await prisma.$transaction(async (tx) => {
            const paymentNo = await generateMobilePaymentNo(tx);

            // 1. LoanPayment + PaymentAllocation records
            const payment = await tx.loanPayment.create({
                data: {
                    paymentNo,
                    loanId: loan.id,
                    memberId: loan.memberId,
                    branchId: loan.branchId,
                    amount: numAmount,
                    principalPortion: totalPrincipal,
                    interestPortion: totalInterest,
                    lateFeePortion: totalLateFee,
                    earlySettlementFee,
                    paymentType: isEarlySettlement ? "early_settlement" : "installment",
                    paymentMethod: null,
                    cashBankAccountId: cashBankAccountId ? Number(cashBankAccountId) : null,
                    notes: notes || (isEarlySettlement ? "Pelunasan Dipercepat via mobile" : "Angsuran via mobile"),
                    paymentDate: today,
                    createdById: Number(user.id),
                    allocations: { create: allocations },
                },
            });

            // 2. Update each schedule per allocation
            for (const alloc of allocations) {
                const s = loan.schedules.find((x) => x.id === alloc.scheduleId)!;
                const newPrincipalPaid = Number(s.principalPaid) + alloc.principalAmount;
                const newInterestPaid = Number(s.interestPaid) + alloc.interestAmount;
                const newLateFeePaid = Number(s.lateFeePaid) + alloc.lateFeeAmount;
                const totalPaid = newPrincipalPaid + newInterestPaid + newLateFeePaid;
                const totalScheduleDue = Number(s.principalAmount) + Number(s.interestAmount) + Number(s.lateFee);
                const isFullyPaid = isEarlySettlement
                    ? newPrincipalPaid >= Number(s.principalAmount)
                    : totalPaid >= totalScheduleDue;
                await tx.loanSchedule.update({
                    where: { id: alloc.scheduleId },
                    data: {
                        principalPaid: newPrincipalPaid,
                        interestPaid: newInterestPaid,
                        lateFeePaid: newLateFeePaid,
                        status: isFullyPaid ? "paid" : "partial",
                        paidDate: isFullyPaid ? today : null,
                    },
                });
            }

            // 3. Early-settlement: mark unallocated pending schedules as paid
            if (isEarlySettlement) {
                const allocatedIds = new Set(allocations.map((a) => a.scheduleId));
                for (const s of loan.schedules) {
                    if (!allocatedIds.has(s.id)) {
                        await tx.loanSchedule.update({
                            where: { id: s.id },
                            data: { status: "paid", paidDate: today },
                        });
                    }
                }
            }

            // 4. Update loan totals
            const updateData: Record<string, any> = {
                principalPaid: { increment: totalPrincipal },
                interestPaid: { increment: totalInterest },
                lateFeePaid: { increment: totalLateFee },
                principalOutstanding: { decrement: totalPrincipal },
                interestOutstanding: { decrement: totalInterest },
            };
            let finalStatus = loan.status;
            if (isEarlySettlement) {
                updateData.principalOutstanding = 0;
                updateData.interestOutstanding = 0;
                updateData.status = "paid_off";
                updateData.paidOffDate = today;
                finalStatus = "paid_off";
            }
            await tx.loan.update({ where: { id: loan.id }, data: updateData });

            // 5. Regular: check fully paid
            if (!isEarlySettlement) {
                const updated = await tx.loan.findUnique({
                    where: { id: loan.id },
                    select: { principalOutstanding: true, interestOutstanding: true, status: true },
                });
                if (updated && Number(updated.principalOutstanding) <= 0 && Number(updated.interestOutstanding) <= 0) {
                    await tx.loan.update({ where: { id: loan.id }, data: { status: "paid_off", paidOffDate: today } });
                    finalStatus = "paid_off";
                } else {
                    finalStatus = (updated?.status as string) || loan.status;
                }
            }

            // 6. Cash/Bank posts (if account selected)
            if (cashBankAccountId) {
                const cashAccount = await tx.cashBankAccount.findFirst({
                    where: { id: Number(cashBankAccountId), isActive: true },
                });
                if (!cashAccount) throw new Error("Akun kas/bank tidak ditemukan atau tidak aktif");

                let bal = Number(cashAccount.currentBalance);
                const memberLabel = `${loan.member.name} (${loan.member.memberNo})`;
                const settlementLabel = isEarlySettlement ? " [PELUNASAN]" : "";

                if (totalPrincipal > 0) {
                    const before = bal; bal += totalPrincipal;
                    await tx.cashBankTransaction.create({
                        data: buildCashBankTransactionData({
                            accountId: cashAccount.id, branchId: loan.branchId, type: "in",
                            category: "angsuran_pokok", amount: totalPrincipal,
                            balanceBefore: before, balanceAfter: bal,
                            description: `Angsuran Pokok ${loan.loanNo}${settlementLabel} — ${memberLabel}`,
                            transactionDate: today, createdById: Number(user.id),
                            referenceType: "LoanPayment", referenceId: payment.id,
                            unitType: "simpan_pinjam", memberId: loan.memberId,
                            transactionNo: mobileCbTxNo(`CBM-${paymentNo}-P`),
                        }),
                    });
                }
                if (totalInterest > 0) {
                    const before = bal; bal += totalInterest;
                    await tx.cashBankTransaction.create({
                        data: buildCashBankTransactionData({
                            accountId: cashAccount.id, branchId: loan.branchId, type: "in",
                            category: "jasa_pinjaman", amount: totalInterest,
                            balanceBefore: before, balanceAfter: bal,
                            description: `Jasa/Bunga ${loan.loanNo}${settlementLabel} — ${memberLabel}`,
                            transactionDate: today, createdById: Number(user.id),
                            referenceType: "LoanPayment", referenceId: payment.id,
                            unitType: "simpan_pinjam", memberId: loan.memberId,
                            transactionNo: mobileCbTxNo(`CBM-${paymentNo}-I`),
                        }),
                    });
                }
                if (isEarlySettlement && earlySettlementFee > 0) {
                    const before = bal; bal += earlySettlementFee;
                    await tx.cashBankTransaction.create({
                        data: buildCashBankTransactionData({
                            accountId: cashAccount.id, branchId: loan.branchId, type: "in",
                            category: "penalti_pelunasan", amount: earlySettlementFee,
                            balanceBefore: before, balanceAfter: bal,
                            description: `Penalti Pelunasan ${loan.loanNo} — ${memberLabel}`,
                            transactionDate: today, createdById: Number(user.id),
                            referenceType: "LoanPayment", referenceId: payment.id,
                            unitType: "simpan_pinjam", memberId: loan.memberId,
                            transactionNo: mobileCbTxNo(`CBM-${paymentNo}-ES`),
                        }),
                    });
                }
                await tx.cashBankAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: bal } });
            }

            return {
                payment,
                finalStatus,
                newPrincipalOutstanding: isEarlySettlement ? 0 : principalOut - totalPrincipal,
                newInterestOutstanding: isEarlySettlement ? 0 : interestOut - totalInterest,
            };
        }, { timeout: 30000 });

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "CREATE",
            module: "Pinjaman",
            description: `${isEarlySettlement ? "PELUNASAN DIPERCEPAT" : "Angsuran"} Rp ${numAmount.toLocaleString("id-ID")} untuk ${loan.loanNo} (${loan.member.name}) via mobile`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: result.finalStatus === "paid_off"
                ? (isEarlySettlement ? "Pinjaman LUNAS! 🎉 (Pelunasan Dipercepat)" : "Pinjaman LUNAS! 🎉")
                : "Angsuran berhasil dicatat",
            data: {
                newPrincipalOutstanding: result.newPrincipalOutstanding,
                newInterestOutstanding: result.newInterestOutstanding,
                status: result.finalStatus,
            },
        });
    } catch (error) {
        console.error("POST /api/mobile/loan-payment error:", error);
        const detail = error instanceof Error ? error.message : "Gagal memproses angsuran";
        return NextResponse.json({ message: `Gagal memproses angsuran: ${detail}` }, { status: 500 });
    }
}
```

- [ ] **Step 4: Verify typecheck + tests**

Run: `npx tsc --noEmit` → no NEW errors (pre-existing in `api/mobile/toko/shifts/[id]` + `prisma/seed-*.ts` OK). Watch for: `loan.member.memberNo` exists (added to select), `PaymentAllocation` model relation name is `allocations` on `LoanPayment` (confirm via web route which uses `allocations: { create }`), `paymentMethod: null` is allowed (nullable).
Run: `npx vitest run src/__tests__/loan-payment-helpers.test.ts` → 8/8 (helper unchanged).
Run: `npm run test` → only the 3 pre-existing failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mobile/loan-payment/route.ts
git commit -m "fix(mobile-loan-payment): FIFO allocation + PaymentAllocation (atomic, match web)"
```

---

### Task 3 (optional): Diagnostic — PaymentAllocation gap vs prod

**Files:**
- Create: `scripts/diagnose-mobile-loan-payment-allocation.ts`

- [ ] **Step 1: Write the diagnostic**
```ts
// scripts/diagnose-mobile-loan-payment-allocation.ts
// Read-only vs prod Neon. Proves the bug: mobile payments (PAY-M-*) historically
// have ZERO PaymentAllocation records (pre-fix). After fix, new mobile payments create them.
// Jalankan: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-loan-payment-allocation.ts
import prisma from "../src/lib/prisma";

async function main() {
  const mobilePayments = await prisma.loanPayment.findMany({
    where: { paymentNo: { startsWith: "PAY-M-" } },
    select: { id: true, paymentNo: true, paymentType: true, createdAt: true, _count: { select: { allocations: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const total = mobilePayments.length;
  const withAlloc = mobilePayments.filter((p) => p._count.allocations > 0).length;
  const withoutAlloc = total - withAlloc;
  console.log(`=== Mobile loan payments (PAY-M-*) — last ${total} ===`);
  console.log(`with PaymentAllocation   : ${withAlloc}`);
  console.log(`WITHOUT PaymentAllocation : ${withoutAlloc}  ← pre-fix bug (historical, not retroactive)`);
  console.log(`\nSample (newest 5):`);
  for (const p of mobilePayments.slice(0, 5)) {
    console.log(`  ${p.paymentNo}  ${p.paymentType}  allocs=${p._count.allocations}  ${p.createdAt.toISOString().slice(0, 10)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it (read-only vs prod)**
Run: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-loan-payment-allocation.ts`
Expected (BEFORE deploy of Task 2): most/all `PAY-M-*` payments have 0 allocations (proves the bug). After deploy + a new mobile payment: that new payment has allocations.

- [ ] **Step 3: Commit**
```bash
git add scripts/diagnose-mobile-loan-payment-allocation.ts
git commit -m "docs(diag): mobile loan-payment PaymentAllocation gap vs prod"
```

---

## Self-Review (controller notes)

- **Spec coverage:** helper (Task 1) + route rewrite (Task 2) + diagnostic (Task 3) — all spec sections mapped. Both branches unified; contract preserved; crypto txn numbers; CB referenceType/memberId/unitType.
- **Type consistency:** `AllocationResult` (Task 1) ↔ consumed in Task 2 (`allocations`, `totalPrincipal`, `totalInterest`, `totalLateFee`). `ScheduleInput` ↔ the `scheduleInputs` map in Task 2. Field names match web (`principalPortion`/`interestPortion`/`lateFeePortion` on LoanPayment; `allocations: { create }` PaymentAllocation with `{ scheduleId, principalAmount, interestAmount, lateFeeAmount }`).
- **Placeholder scan:** none — all code complete, exact paths, exact commands.
- **Risk:** Task 2 is a large rewrite of a money-moving route. Reviewer must verify: (a) `allocations` relation name on LoanPayment, (b) `paymentMethod: null` allowed, (c) response shape unchanged, (d) no `Math.random` introduced (crypto only), (e) GET handler untouched. Implementer should be a standard/integration-tier model (sonnet), not the cheapest.
- **Non-retroactivity:** historical `PAY-M-*` payments remain allocation-less (fix is forward-only). Diagnostic documents this. Not a defect.
