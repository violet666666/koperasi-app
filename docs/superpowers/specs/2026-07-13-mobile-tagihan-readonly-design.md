# Fase 9b — Mobile Tagihan/Billing READ-ONLY (Design Spec)

> **Scope:** READ-ONLY mobile mirror. No generate/refresh/settle/delete/write. Staff view billing periods + item detail.

**Goal:** Mobile operator/admin SP can browse billing periods (current + riwayat), drill into item detail.

**Architecture:** Thin mobile GET wrappers over existing BillingPeriod queries. No new Prisma models, no money operations.

**Tech Stack:** Next.js route handlers, Prisma 6, Expo 55 / RN 0.83.

## API Design — Mobile Endpoints

All GET only. Gate: operator OR admin_sp (same as Piutang Gabungan Fase 6).

| # | Method + Path | Source | Response |
|---|---------------|---------|--------|
| 1 | `GET /api/mobile/billing/current` | `billing/current` | current period + summary |
| 2 | `GET /api/mobile/billing/riwayat` | `billing/riwayat` | paginated periods |
| 3 | `GET /api/mobile/billing/[periodId]` | `billing/[periodId]` | period detail + items |

### Response shapes

**Endpoint 1 (`/current`):**
```ts
{
  data: {
    id: number;
    periodStart: string; periodEnd: string; periodLabel: string;
    status: "draft" | "processed";
    totalMembers: number; totalAmount: number;
    processedBy: { name: string } | null;
    processedAt: string | null;
  } | null;
  meta: { daysRemaining: number; nextBillingDate: string }
}
```

**Endpoint 2 (`/riwayat`):**
```ts
{ data: BillingPeriod[], meta: { page, perPage, total, totalPages } }
BillingPeriod = { id, periodLabel, status, totalMembers, totalAmount, processedAt, processedBy }
```

**Endpoint 3 (`/[periodId`):**
```ts
{
  data: {
    period: BillingPeriod;
    items: BillingItem[];
    stats: { total: number; marked: number; unpaid: number }
  }
}
BillingItem = { id, memberId, memberName, unitType, amount, isPaid, paidAt, paidBy }
```

## Screen Design

### TagihanScreen

**Layout:** Card (current period status + stats) + riwayat FlatList.

**Stat cards:** Total Amount / Members / Paid / Unpaid. Pull-to-refresh.

**Navigation:** Dashboard menu "Tagihan" (operator/admin_sp) → `TagihanScreen`.

## Out of Scope

Generate, Refresh, Process, Delete, Toggle item paid, mark-as-paid. Money operations = web desktop only.

## Risks

Low — read-only, mirrors existing working queries. No schema, no money operations.

## Essential Files

Web source:
- `src/app/api/billing/current/route.ts`
- `src/app/api/billing/riwayat/route.ts`
- `src/app/api/billing/[periodId]/route.ts`

Mobile pattern reference:
- `src/app/api/mobile/reports/piutang-gabungan/route.ts` (same auth pattern)
- `mobile/src/screens/operator/LaporanPiutangGabunganScreen.tsx` (screen pattern)
