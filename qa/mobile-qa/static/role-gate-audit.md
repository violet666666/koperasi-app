# Mobile API Role-Gate & Scope Audit

Date: 2026-07-18  
Scope: `src/app/api/mobile/**/route.ts`  
Route files: 70 (`git ls-files "src/app/api/mobile/**/route.ts"`)  
Authorization-related route files: 71 hits by authorization symbol search (includes multiple matching patterns / nested scans)  
`admin_sp` references: 64 files (`mobile/src`, `src/app/api/mobile`, `src/lib`)

## Verified authorization model

- JWT fields: `id`, `email`, `name`, `role`, optional `nrp`, `unitId`, `branchId`, `isOperator`; no `permissions` field: `src/lib/jwt.ts:6-15`.
- `getMobileUser(request)` validates Bearer JWT: `src/app/api/mobile/middleware.ts:9-16`.
- `getMobileUserWithScope(request)` reloads branch/unit/member scope from DB, preventing stale JWT scope: `src/app/api/mobile/middleware.ts:30-44`.
- Role validation remains repeated inline across routes. Scope uses `canAccessBranch`, `canAccessUnit`, `branchListFilter`, and `unitListFilter` where applicable.

## Sampled high-risk routes — verified current code

| Route | Verb | Role gate | Scope | Verdict |
|---|---|---|---|---|
| `assets/[id]` | GET/PUT/DELETE | operator/admin/admin_sp | role-only; Asset has no branch/unit | Current code protected, no member leak: `assets/[id]/route.ts:5-11` | 
| `loan-payment` | GET | operator/admin/admin_sp | `branchListFilter` | Current code protected/scoped: `loan-payment/route.ts:11-19` |
| `loan-payment` | POST | operator/admin/admin_sp | `canAccessBranch` loan + selected cash account branch | Current code protected/scoped: `loan-payment/route.ts:87-125`, `261-268` |
| `loans-operator/direct-disburse` | POST | operator/admin/admin_sp | `canAccessBranch` member branch | Scope verified; dead `permissions` fallback below |

## Confirmed finding

| ID | Severity | File:line | Finding | Evidence | Recommended remediation | Status |
|----|----------|-----------|---------|----------|-------------------------|--------|
| A4-1 | Low | `src/app/api/mobile/loans-operator/direct-disburse/route.ts:22` | `user.permissions?.includes("manage_all")` is dead fallback because `MobileJWTPayload` has no `permissions` property. Role checks still enforce access. | `src/lib/jwt.ts:6-15`; direct-disburse role expression | Remove the unused fallback, or add/populate typed permissions consistently. Do not change role policy incidentally. | Open |

## Legacy role inventory

`admin_sp` remains granted in the mobile client/API/shared code despite being retired operationally. It is excluded from the normal production QA matrix and must be negative-tested only. Full deletion requires separate remediation after DB account inventory, migration/blocking, route gate cleanup, navigation cleanup, and documentation cleanup.

## False-positive guard

Earlier audit notes that describe `assets/[id]` GET or `loan-payment` GET as auth-only are stale. Current files were re-read on 2026-07-18 and both now have role gates; `loan-payment` GET also has branch scope. Do not report those as active vulnerabilities.
