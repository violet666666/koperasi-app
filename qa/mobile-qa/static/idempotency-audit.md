# Mobile Mutation Idempotency Surface Audit

Date: 2026-07-18  
Scope: current primary working tree, all 32 exported mutation handlers under `src/app/api/mobile/**/route.ts`.  
Method: static code review only; no network/DB access.

## Definitions

- **Atomicity** (`prisma.$transaction`): one request fully commits or rolls back. It does not stop a second identical request.
- **Idempotency**: repeating the same logical request has one net effect.
- Crypto/random unique transaction numbers prevent key collisions, but do **not** deduplicate logical retries.
- No handler reads an `Idempotency-Key`, `requestId`, or `clientRequestId` (0 matches in the mobile API tree).

## Highest-risk money mutations

| Route | Atomic | Server dedup/state guard | UI in-flight guard | Verdict |
|-------|--------|--------------------------|--------------------|---------|
| `POST savings-tx` | yes | none | `submitting` | High: duplicate setoran/tarik changes savings and optional CB twice |
| `POST loan-payment` | yes | none | `submitting` | High: duplicate payment updates schedules, loan counters, and CB twice |
| `POST toko` | yes | saleNo uniqueness only | `processing` | High: duplicate sale; salary-cut can double piutang |
| `POST unit-layanan` | yes | transactionNo uniqueness only | `processing` | High: duplicate service sale / salary-cut piutang |
| `POST kas-bank/transactions` | yes | none; generated transactionNo unique only | `submitting` | High: duplicate directly changes account balance twice |
| `POST kas-bank/transfers` | yes | none; generated transfer base unique only | `submitting` | High: duplicate moves the same amount twice between accounts |
| `POST haji-umrah/savings/[accountId]/transactions` | helper transaction | none visible at route; generated txnNo recorded | `submitting` | High: duplicate deposit changes savings + CB twice |
| `POST loans-operator/direct-disburse` | yes/helper | application/loan numbering uniqueness but no request dedup | `submitting` | High: multi-table loan + schedules + receipt + CB outflow; race may become duplicate or 500 |
| `POST loans-operator/kompen-disburse` | yes | old-loan state guard after first commit | `submitting` | Medium/High: sequential retry blocked, concurrent pre-commit race remains |
| `POST toko/stock-in` | yes | none | `siSubmitting` | High: duplicate stock + moving-average HPP |
| `POST journals` | yes | journalNo uniqueness only | `submitting` | Medium/High: duplicate GL entry |
| `POST payroll/import` commit | shared helper | period duplicate guard expected in helper; DB uniqueness protects final state | `loading` | Medium: sequential duplicate likely rejected; concurrent race can surface 500; bulk operation is forbidden for live production QA |

## Sequentially protected / state-idempotent

| Route | Guard | Residual risk |
|-------|-------|---------------|
| `POST loan-payment-void` | rejects `payment.status === "voided"` | Concurrent race before first commit; no optimistic lock |
| `POST toko/history` void | metadata `isVoided` / `voidPending`; approval request unique | Operator auto-void concurrent race |
| `POST edit-nrp` | rejects sale already assigned | narrow concurrent race |
| `POST toko/shifts` | blocks existing open shift | narrow concurrent race without DB uniqueness |
| `PUT toko/shifts/[id]` | requires status open | narrow concurrent race |
| `PATCH approvals` | requires submitted status | narrow concurrent race |
| `POST assets/[id]/dispose` | rejects status disposed | narrow concurrent race |
| `DELETE assets/[id]` | soft-delete then subsequent 404 | state-idempotent |
| `POST payroll/delete` | delete then P2025/404 | state-idempotent; audit duplicates not produced |

## State-idempotent / low financial duplication risk

| Route | Behavior |
|-------|----------|
| `PATCH members/[id]` | reapplying same whitelist fields leaves same member state |
| `PUT assets/[id]` | same body recomputes same values; duplicate audit records possible |
| `PUT loans/[id]` | same target values converge, but schedule regeneration and duplicate audit may repeat; needs helper-level review before calling safe |
| `POST assets` | unique `code` rejects duplicate |
| `POST haji-umrah/savings/open` | shared helper should enforce account/business uniqueness; needs helper-level proof before live test |
| `POST login` | token issuance; no persisted business mutation |
| `POST change-password` | repeat with old password fails after first success |
| `POST push-token` | set-idempotent overwrite |
| `PUT notifications` | set-idempotent mark-read |
| `POST loan-apply` | no cash yet; submitted applications are not clearly deduplicated by member/product/period |
| `POST members/import` | per-row memberNo pre-check + DB uniqueness; concurrent race can 500; bulk live test forbidden |

## Confirmed UI safety property

Major financial screens use `submitting`/`processing`/`loading` state and disable their submit action. This reduces accidental double taps but is not a server reliability boundary: mobile timeout/app restart/user retry can still create a second request.

## Recommended remediation order

1. Add a client-generated idempotency key persisted before submit; send it on money mutations.
2. Persist the key server-side with a unique constraint and replay the original response when seen again.
3. Start with savings-tx, loan-payment, toko/unit-layanan, kas-bank transaction/transfer, H&U deposits, direct disburse, and stock-in.
4. Keep DB transactions; idempotency complements atomicity, not replaces it.
5. Do not live-test replay/double-submit on production until the user explicitly approves one minimal marked transaction and a verified void/reversal cleanup path.
