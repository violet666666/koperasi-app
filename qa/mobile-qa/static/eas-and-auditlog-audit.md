# EAS Config + Mobile Audit-Log Consistency Audit

Date: 2026-07-18

## R7 — EAS Update + submit config

- `mobile/app.json` version: `1.1.7`
- Android `versionCode`: `9`
- EAS `projectId`: present (`3db40b2b-1d5f-4362-a61a-cacdaf712cd5`)
- `updates.url`: absent
- Runtime version / update channel: absent
- Build profiles: development, preview APK, production AAB, apk-debug APK, store AAB
- `submit.production`: empty object

Verdict:
- EAS Build profiles are present for internal/dev/APK/AAB workflows.
- EAS Update OTA is not configured; OTA behavior cannot be tested or relied upon.
- Store submission profile is incomplete; manual Play Console upload can still work, but automated `eas submit` needs credentials/config.

## R8 — audit-log consistency

Static counts:
- Mutation handlers: 32 across 31 files.
- Direct `prisma.auditLog.create` call sites: 14.
- Helper-based audit (`logAudit` / `logAuditFromRequest`) call sites: 15.
- Mutation files with no recognized audit call: 9.

| Route file | Impact | Verdict |
|------------|--------|---------|
| `kas-bank/transactions/route.ts` | Money-moving CashBank balance | High — no application audit record |
| `kas-bank/transfers/route.ts` | Money-moving two-account transfer | High — no application audit record |
| `loans-operator/direct-disburse/route.ts` | Critical loan + receipt + CB outflow | High — no application audit record |
| `loans-operator/kompen-disburse/route.ts` | Critical old/new loan + CB movements | High — no application audit record |
| `toko/history/route.ts` | Void request / auto-void | Medium — relies on sale metadata/approval row, no standard audit helper |
| `toko/shifts/route.ts` | Open shift | Low — business record exists, no audit helper |
| `toko/shifts/[id]/route.ts` | Close shift | Medium — business record state transition, no audit helper |
| `notifications/route.ts` | Self-state mark-read | Informational — audit not necessary |
| `push-token/route.ts` | Self-state FCM token | Informational — audit not necessary |

Recommendation: money-moving routes must write an application audit entry after/inside the transaction as appropriate, using a consistent helper that captures user, route/action, resource ID, IP/user-agent, and status. Self-state routes (notifications/push-token) may remain unaudited by policy.
