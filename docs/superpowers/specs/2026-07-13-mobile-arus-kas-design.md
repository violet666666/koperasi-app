# Fase 18a — Mobile Arus Kas Report (READ-ONLY)

> **Scope:** READ-ONLY mobile mirror of `/api/reports/arus-kas`. Cash flow statement view.

**Goal:** Staff view monthly cash flow: opening balance + 3 buckets (operasional/investasi/finansial) + closing balance.

**Architecture:** Single mobile GET endpoint. SQL-aggregated.

## API: `GET /mobile/reports/arus-kas?month&year`

Source: `api/reports/arus-kas/route.ts`. Params: `month`, `year`. Response shape:
```ts
{
  month: number; year: number;
  openingBalance: number;
  operasional: { total: number; items: { description: string; amount: number }[] };
  investasi: { total: number; items: { description: string; amount: number }[] };
  finanasial: { total: number; items: { description: string; amount: number }[] };
  closingBalance: number;
}
```

## Screen: ArusKasScreen

Period selector → 3-bucket cards → item drill-down. `GET /mobile/reports/arus-kas`. Format currency. Pull-to-refresh.
