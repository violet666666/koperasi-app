# Fase 12b — Mobile Loan Application CREATE (READ-ONLY mirror — mobile VIEW ONLY)

> **Scope clarification:** Mobile CREATE = defer. READ-ONLY mirror of EXISTING applications.

**Goal:** Staff view pending/submitted/approved/rejected applications.

## API Endpoints (EXISTING — mobile mirror)

| Method + Path | Source | Purpose |
|---------------|--------|---------|
| GET `/mobile/loan-applications` | `GET /loans/applications` | list with status filter |

### Response shape
```ts
{
  data: Application[]
  summary: { submitted: n; approved: n; rejected: n }
}
Application = { id, applicationNo, memberName, productName, amount, status, createdAt }
```

## Screen: LoanApplicationListScreen

Status tabs (submitted/approved/rejected) + FlatList + filter by unit.

**Out of Scope CREATE/submit/approve/disburse — desktop workflow.