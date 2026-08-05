# Fase 13b — Mobile Faktur Potongan (READ-ONLY)

> **Scope:** READ-ONLY mobile mirror of web `/api/reports/faktur-potongan`. View faktur list + detail + member drill-down.

**Goal:** Staff can browse faktur potongan by month/year, view item detail.

**Architecture:** Mobile wrapper over existing faktur-potongan query.

## API

| Method + Path | Source |
|--------------|--------|
| GET `/mobile/faktur-potongan?month&year` | GET `/reports/faktur-potongan` |
| GET `/mobile/faktur-potongan/export?month&year&export=true` | same, `export=true` |

### Response shape
```ts
{
  fakturList: { id, memberId, memberName, items: FakturItem[], periodLabel },
  summary: { totalPotongan, totalAmount }
}
FakturItem = { jenis, amount, unitLabel }
```

## Screen: FakturPotonganScreen

Month/year picker → FlatList of faktur cards → tap → detail modal. `api/mobile/faktur-potongan` client.

**Out of Scope:** Create/edit/delete. Export. Mobile export = web only.
