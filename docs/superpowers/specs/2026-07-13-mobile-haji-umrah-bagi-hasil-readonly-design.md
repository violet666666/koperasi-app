# Fase 9a.3 — Mobile H&U Bagi Hasil READ-ONLY (Design Spec)

> **Scope:** READ-ONLY mobile mirror. No process/void. Staff view distributions + drill-down.

**Goal:** Mobile staff can browse distributions, see per-member breakdown, understand pool status.

**Architecture:** Thin mobile GET wrappers over existing Bij DourDistribution queries.

## API Design — Mobile Endpoints

| # | Method + Path | Source | Response |
|---|---------------|--------|----------|
| 1 | `GET /api/mobile/haji-umrah/bagi-hasil` | `bagi-hasil GET | list + summary |
| 2 | `GET /api/mobile/haji-umrah/bagi-hasil/[id]` | `bagi-hasil/[id]` | distribution + items |

### Response shapes

**Endpoint 1:**
```ts
{ data: Distribution[], meta: { page, perPage } }
Distribution = { id, periodLabel, status, memberPool, spreadPool, memberRate, spreadRate, createdAt, itemCount }
```

**Endpoint 2:**
```ts
{ distribution: Distribution, items: DistributionItem[] }
DistributionItem = { id, memberId, memberName, savingsAccountNo, amount, savingsBalance, poolShare }
```

## Screen: HajiUmrahBagiHasilScreen

Single screen. Filter by status (processed/draft). List distributions. Tap → drill-down.

**Out of Scope:** POST process, POST void. Money ops = web only.

## Risks

Low — read-only.

## Essential Files

Web: `src/app/api/haji-umrah/bagi-hasil/route.ts`, `bagi-hasil/[id]/route.ts`
