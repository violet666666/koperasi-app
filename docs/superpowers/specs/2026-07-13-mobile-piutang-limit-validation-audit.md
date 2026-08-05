# Fase 12c — Mobile Unit Transaksi with Piutang Validation (Integration)

> **Scope:** READ-ONLY mirror of piutang limit validation. Mobile POS should call validate endpoint before accruing piutang.

**Goal:** Verify existing mobile POS flows call the validation endpoint.

**Gap:** `catat-pemasukan` customer path does NOT call `/unit-transactions/validate`. Mobile unit transaksi flows need to verify.

## Audit Tasks

1. Audit existing mobile unit POS routes for validate call.
2. If missing, add mobile route `GET /mobile/unit-transactions/validate?nr p=NRP&amount=N` — wire into mobile POS flows.
3. For read-only mirror: Mobile route `GET /mobile/unit-transactions/validate` (staff confirm balance + plafon). Member portal self-apply uses existing `loan-apply` route.

## Schema reference
```ts
piutang-limit validate: member exists + status active + amount ≤ plafon(manual OR 50% sisaGaji)
```

## Deliverables
- No new screens.
- Mobile route if missing in mobile POS flow.
- Audit report (markdown).