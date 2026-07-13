# Fase 9a.2 — Mobile Haji/Umrah Talangan READ-ONLY (Design Spec)

> **Scope:** READ-ONLY mobile mirror of web H&U Talangan. No apply/approve void on mobile. Staff see gap-aware talangan list + detail.

**Goal:** Mobile staff can view talangan accounts (who needs financing, who's financed, outstanding), browse the gap perspective (accounts needing talangan), and drill into loan detail with schedules + payments.

**Architecture:** Thin mobile route wrappers over Prisma (mirror web queries with mobile JWT auth). One FlatList screen with stat cards + filter chips. No shared helper extraction needed (read-only, no money logic).

**Tech Stack:** Next.js route handlers, Prisma 6, Expo 55 / RN 0.83, react-hook-form (not needed for read-only).

## API Design — Mobile Endpoints

All 3 endpoints are GET-only. Gate: any authenticated staff (`operator/admin/admin_sp`). No write operations.

| # | Method + Path | Web counterpart | Query params | Response |
|---|---------------|----------------|--------------|----------|
| 1 | `GET /api/mobile/haji-umrah/talangan` | web GET `/talangan` | `status`, `type`, `search`, `page`, `perPage` | `{ stats, data[], pagination }` |
| 2 | `GET /api/mobile/haji-umrah/talangan/gap` | web GET `/talangan/gap` | `onlyWithGap`, `productType` | `{ data[], summary }` |
| 3 | `GET /api/mobile/haji-umrah/talangan/[loanId]` | web GET `/talangan/[applicationId]` | path: `loanId` | loan detail + schedules + payments |

### Response shapes

**Endpoint 1 (`/talangan`):**
```ts
{
  stats: {
    totalActive: number;       // count of active talangan loans
    totalOutstanding: number;   // sum of principalOutstanding
    paidThisMonth: number;     // payments this month
    gapDetected: number;       // accounts with gap but no talangan
    totalPaidOff: number;      // count paid_off
    totalRecords: number;       // total paginated count
  };
  data: Array<{
    loanId: number;
    loanNo: string;
    memberId: number;
    memberName: string;
    memberNrp: string;
    productType: string | null;   // "talangan_haji" | "talangan_umrah"
    productName: string | null;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
    outstanding: number;
    status: string;
    tenorMonths: number;
    monthlyInstallment: number;
    disbursementDate: string | null;
    savingsAccountNo: string | null;
    savingsBalance: number | null;
    savingsTarget: number | null;
    applicationStatus: string | null;
  }>;
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}
```

**Endpoint 2 (`/talangan/gap`):**
```ts
{
  summary: {
    totalAccounts: number;
    withGap: number;           // accounts needing talangan
    coveredByTalangan: number; // accounts with active talangan
    targetReached: number;    // accounts at/beyond target
  };
  data: Array<{
    accountId: number;
    accountNo: string;
    memberId: number;
    memberName: string;
    memberNrp: string;
    productType: string;
    productName: string;
    balance: number;
    targetAmount: number;
    gap: number;               // max(0, target - balance)
    progress: number;           // percentage (0-100)
    hasActiveTalangan: boolean;
    activeTalanganId: number | null;
    activeTalanganOutstanding: number | null;
    status: "needs_talangan" | "has_talangan" | "target_reached" | "no_target";
  }>;
}
```

**Endpoint 3 (`/talangan/[loanId]`):**
```ts
{
  loan: {
    id, loanNo, memberId, memberName, memberNrp,
    productType, productName,
    principalAmount, interestAmount, totalAmount,
    tenorMonths, monthlyInstallment,
    disbursementDate, firstDueDate, lastDueDate,
    principalPaid, interestPaid, principalOutstanding, interestOutstanding,
    status, approvalStatus
  };
  schedules: Array<{
    id, installmentNumber, dueDate, principalPortion, interestPortion,
    totalDue, amountPaid, paidDate, status
  }>;
  payments: Array<{
    id, paymentDate, amount, principalPortion, interestPortion, remainingBalance, notes
  }>;
  stats: {
    totalPaid: number;
    remaining: number;
    nextDueDate: string | null;
    nextDueAmount: number | null;
    installmentPaid: number;
    installmentRemaining: number;
  };
}
```

## Screen Design

### HajiUmrahTalanganScreen

**Layout:** Single screen, stat cards at top + filter chips + FlatList.

**Stat cards (4):**
- `Perlu Talangan` — `stats.gapDetected` (amber highlight if > 0)
- `Aktif` — `stats.totalActive`
- `Outstanding` — `stats.totalOutstanding` (formatted Rp)
- `Lunas` — `stats.totalPaidOff`

**Filter chips:** Semua (null) / Haji (talangan_haji) / Umrah (talangan_umrah)

**List items:** Each row shows member name, product type badge (Haji/Umrah), outstanding amount (Rp), status badge (Aktif/Lunas), tenor months. Tap → drill-down navigation.

**No FAB** — READ-ONLY scope. No apply button.

**Navigation:** Dashboard "Haji & Umrah" sub-menu or tab under HajiUmrahScreen tab row.

**API client:** `api.get('/mobile/haji-umrah/talangan', { params: { status, type, search, page, perPage } })`.

## Out of Scope

- Talangan apply (write) — desktop web operation
- Talangan approve/reject
- Talangan void
- Auto-disbursement
- Gap account → apply flow (write)

These are all high-risk money operations better done on web desktop with full audit trail.

## Open Decisions

None — both scope questions answered by user: READ-ONLY + Option A (combined tabs / gap stats).

## Essential Files

Web source:
- `src/app/api/haji-umrah/talangan/route.ts`
- `src/app/api/haji-umrah/talangan/gap/route.ts`
- `src/app/api/haji-umrah/talangan/[applicationId]/route.ts`

Mobile pattern reference:
- `src/app/api/mobile/haji-umrah/savings/route.ts` (GET list pattern)
- `mobile/src/screens/operator/HajiUmrahScreen.tsx` (stat cards + filter chips + FlatList pattern)

## Risks

- Low risk — read-only, mirrors existing working web queries
- No money operations
- No schema changes
