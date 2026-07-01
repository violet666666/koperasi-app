# Mobile Void Angsuran — Implementation Plan (Fase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give mobile users a correction path for mis-posted loan installments — void an individual `LoanPayment` (atomic reversal of schedules, CashBank, allocations, loan counters), mirroring the web route, by reusing the existing tested `payment-void-helpers`.

**Architecture:** Three pieces. (1) API void route reuses `payment-void-helpers` (no new pure logic) — orchestration mirrors web `api/loans/[id]/payments/[paymentId]/void` steps 1-9 with mobile auth + flat routing (`{ paymentId, reason }` in body). (2) API list-payments route (loan-scoped) to feed the UI. (3) A new `RiwayatAngsuranScreen` + wiring showing payments with a VOID confirm dialog.

**Tech Stack:** Next.js 16 route handlers, Prisma 6 (`$transaction` callback), TypeScript, Expo 55 / React Native 0.83 (screen), existing `payment-void-helpers.ts`.

## Global Constraints

- **Branch:** `railway-migration` — auto-deploys to prod on push. Commit freely; push only when ready (batch strategy).
- **Do NOT stage non-mine files:** `.claude/settings.local.json`, `mobile/app.json`.
- **REUSE `src/lib/payment-void-helpers.ts`** — do NOT rewrite or duplicate the reversal logic. Import: `calcPaymentCbReversalAmount`, `buildScheduleRollbackOps`, `buildLoanRollbackData`, `buildPaymentVoidResponse`, type `AllocationReversal`.
- **Atomic** void: the whole reversal (schedules, CB, allocations, payment, loan) is one `$transaction(async (tx) => {...})` callback — mirror web exactly.
- **Generic error message** to client (no `error.message` leak); `console.error` server-side. (Lesson from Fase 2a.)
- **Decimal coercion:** `Number()` for all Prisma Decimal fields before helper/math.
- **Auth:** mobile `getMobileUser`; roles `operator`/`admin_sp` (mirror web — void is a privileged correction, not for `admin`/`kasir`).
- Pre-existing failing tests (`split-bill`, `batch-navigation`, `floor-plan`) + pre-existing tsc errors (`api/mobile/toko/shifts/[id]`, `prisma/seed-*.ts`) are NOT regressions.
- Tests: `npx vitest run <file>` / `npm run test`. Typecheck: `npx tsc --noEmit` (web) + `cd mobile && npx tsc --noEmit` (mobile).

---

### Task 1: API void route (reuse helpers)

**Files:**
- Create: `src/app/api/mobile/loan-payment-void/route.ts`

**Interfaces:**
- Consumes: `payment-void-helpers` (see Global Constraints).
- Produces: `POST { paymentId, reason? }` → `{ message, detail, data: { paymentId, status: "voided" } }`.

- [ ] **Step 1: Create the route file**

`src/app/api/mobile/loan-payment-void/route.ts`:
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";
import {
    calcPaymentCbReversalAmount,
    buildScheduleRollbackOps,
    buildLoanRollbackData,
    buildPaymentVoidResponse,
    type AllocationReversal,
} from "@/lib/payment-void-helpers";

// POST /api/mobile/loan-payment-void — Void a single loan payment (atomic reversal).
// Mirrors web api/loans/[id]/payments/[paymentId]/void, reusing payment-void-helpers.
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Hanya Operator yang dapat membatalkan pembayaran angsuran." }, { status: 403 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const paymentId = Number(body.paymentId);
        const reason = (body.reason as string | undefined)?.trim() || "Dibatalkan oleh Operator";

        if (!paymentId || Number.isNaN(paymentId)) {
            return NextResponse.json({ message: "paymentId wajib diisi" }, { status: 400 });
        }

        // ── Fetch payment with allocations ──
        const payment = await prisma.loanPayment.findUnique({
            where: { id: paymentId },
            include: { allocations: true },
        });
        if (!payment) {
            return NextResponse.json({ message: "Pembayaran tidak ditemukan" }, { status: 404 });
        }
        if (payment.status === "voided") {
            return NextResponse.json({ message: "Pembayaran ini sudah dibatalkan (VOID)" }, { status: 400 });
        }

        const loanId = payment.loanId;

        // ── Fetch loan ──
        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        if (!loan) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan" }, { status: 404 });
        }
        if (loan.status === "voided" || loan.status === "written_off") {
            return NextResponse.json(
                { message: "Tidak dapat membatalkan pembayaran pada pinjaman yang sudah dibatalkan/dihapusbukukan" },
                { status: 400 },
            );
        }

        // ── Prepare reversal data ──
        const allocations: AllocationReversal[] = payment.allocations.map((a) => ({
            scheduleId: a.scheduleId,
            principalAmount: Number(a.principalAmount),
            interestAmount: Number(a.interestAmount),
            lateFeeAmount: Number(a.lateFeeAmount),
        }));

        // ── Atomic Transaction (mirror web steps 1-9) ──
        const result = await prisma.$transaction(async (tx) => {
            // 1. Fresh schedules inside tx
            const scheduleIds = allocations.map((a) => a.scheduleId);
            const currentSchedules = await tx.loanSchedule.findMany({ where: { id: { in: scheduleIds } } });
            const mappedSchedules = currentSchedules.map((s) => ({
                id: s.id,
                principalAmount: Number(s.principalAmount),
                interestAmount: Number(s.interestAmount),
                lateFee: Number(s.lateFee),
                principalPaid: Number(s.principalPaid),
                interestPaid: Number(s.interestPaid),
                lateFeePaid: Number(s.lateFeePaid),
                status: s.status,
                paidDate: s.paidDate,
            }));

            // 2. Rollback allocated schedules
            const rollbackOps = buildScheduleRollbackOps(allocations, mappedSchedules);
            for (const op of rollbackOps) {
                await tx.loanSchedule.update({ where: { id: op.scheduleId }, data: op.data });
            }

            // 2b. Early-settlement: revert unallocated schedules that were batch-marked paid
            if (payment.paymentType === "early_settlement") {
                const allocatedIds = allocations.map((a) => a.scheduleId);
                const unallocatedPaid = await tx.loanSchedule.findMany({
                    where: { loanId, id: { notIn: allocatedIds }, status: "paid" },
                });
                for (const s of unallocatedPaid) {
                    await tx.loanSchedule.update({ where: { id: s.id }, data: { status: "pending", paidDate: null } });
                }
            }

            // 3. CashBankTransactions linked to this payment
            const cbTransactions = await tx.cashBankTransaction.findMany({
                where: { referenceType: "LoanPayment", referenceId: payment.id },
            });

            // 4. Total CB reversal amount
            const cbReversalAmount = calcPaymentCbReversalAmount(
                cbTransactions.map((cb) => ({ type: cb.type, amount: Number(cb.amount) })),
            );

            // 5. Reverse CashBankAccount balance
            let cbReversed = false;
            if (payment.cashBankAccountId && cbReversalAmount > 0) {
                const cbAccount = await tx.cashBankAccount.findUnique({ where: { id: payment.cashBankAccountId } });
                if (cbAccount) {
                    const newBalance = Number(cbAccount.currentBalance) - cbReversalAmount;
                    await tx.cashBankAccount.update({
                        where: { id: payment.cashBankAccountId },
                        data: { currentBalance: Math.max(0, newBalance) },
                    });
                    cbReversed = true;
                }
            }

            // 6. Delete CB transactions
            if (cbTransactions.length > 0) {
                await tx.cashBankTransaction.deleteMany({
                    where: { referenceType: "LoanPayment", referenceId: payment.id },
                });
            }

            // 7. Delete LoanPaymentAllocation records
            await tx.loanPaymentAllocation.deleteMany({ where: { paymentId: payment.id } });

            // 8. Void the payment
            const voidedPayment = await tx.loanPayment.update({
                where: { id: payment.id },
                data: { status: "voided", voidedAt: new Date(), voidedById: Number(user.id), voidReason: reason },
            });

            // 9. Reverse loan counters
            const loanRollbackData = buildLoanRollbackData(
                {
                    principalPortion: Number(payment.principalPortion),
                    interestPortion: Number(payment.interestPortion),
                    lateFeePortion: Number(payment.lateFeePortion),
                    paymentType: payment.paymentType,
                    earlySettlementFee: Number(payment.earlySettlementFee),
                },
                loan.status,
            );

            // Early-settlement: recalc outstanding from actual schedule state
            if (payment.paymentType === "early_settlement") {
                const allSchedules = await tx.loanSchedule.findMany({ where: { loanId } });
                const totalPrincipalOut = allSchedules.reduce((s, x) => s + Number(x.principalAmount) - Number(x.principalPaid), 0);
                const totalInterestOut = allSchedules.reduce((s, x) => s + Number(x.interestAmount) - Number(x.interestPaid), 0);
                loanRollbackData.principalOutstanding = Math.max(0, totalPrincipalOut);
                loanRollbackData.interestOutstanding = Math.max(0, totalInterestOut);
                loanRollbackData.status = "active";
                loanRollbackData.paidOffDate = null;
            }

            await tx.loan.update({ where: { id: loanId }, data: loanRollbackData });

            return {
                voidedPayment,
                cbReversed,
                cbReversalAmount,
                schedulesRolledBack: rollbackOps.length,
                loanReactivated: loan.status === "paid_off",
            };
        }, { timeout: 30000 });

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "UPDATE",
            module: "Pinjaman",
            description: `Void pembayaran angsuran ${payment.paymentNo} (Rp ${Number(payment.amount).toLocaleString("id-ID")}) pada pinjaman ID ${loanId} via mobile`,
            ipAddress: "mobile-app",
        });

        const response = buildPaymentVoidResponse({
            paymentNo: payment.paymentNo,
            principalReversed: Number(payment.principalPortion),
            interestReversed: Number(payment.interestPortion),
            lateFeeReversed: Number(payment.lateFeePortion),
            cbReversed: result.cbReversed,
            cbAmount: result.cbReversalAmount,
            schedulesRolledBack: result.schedulesRolledBack,
            loanReactivated: result.loanReactivated,
            reason,
        });

        return NextResponse.json({
            message: response.message,
            detail: response.detail,
            data: { paymentId: payment.id, status: "voided" },
        });
    } catch (error) {
        console.error("POST /api/mobile/loan-payment-void error:", error);
        return NextResponse.json({ message: "Gagal membatalkan pembayaran" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verify imports + typecheck**

Confirm `payment-void-helpers` exports match (read it if any import fails): `calcPaymentCbReversalAmount`, `buildScheduleRollbackOps`, `buildLoanRollbackData`, `buildPaymentVoidResponse`, `AllocationReversal`.
Run: `npx tsc --noEmit` → no NEW errors. Watch: `LoanPaymentAllocation` model name (relation `allocations`), `LoanPayment.voidedAt`/`voidedById`/`voidReason`/`status` fields, `loanSchedule.paidDate` nullable.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mobile/loan-payment-void/route.ts
git commit -m "feat(mobile-loan): void angsuran API (reuse payment-void-helpers, atomic)"
```

---

### Task 2: API list-payments route

**Files:**
- Create: `src/app/api/mobile/loan-payments/route.ts`

- [ ] **Step 1: Create the route file**
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/loan-payments?loanId=X — list payments for a loan (for the Void Angsuran UI).
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    const url = new URL(request.url);
    const loanId = Number(url.searchParams.get("loanId"));
    if (!loanId || Number.isNaN(loanId)) {
        return NextResponse.json({ message: "loanId wajib diisi" }, { status: 400 });
    }

    try {
        const payments = await prisma.loanPayment.findMany({
            where: { loanId },
            orderBy: { paymentDate: "desc" },
            include: { _count: { select: { allocations: true } } },
        });

        return NextResponse.json({
            data: payments.map((p) => ({
                id: p.id,
                paymentNo: p.paymentNo,
                amount: Number(p.amount),
                principalPortion: Number(p.principalPortion),
                interestPortion: Number(p.interestPortion),
                lateFeePortion: Number(p.lateFeePortion),
                paymentType: p.paymentType,
                status: p.status,
                voidedAt: p.voidedAt,
                voidReason: p.voidReason,
                paymentDate: p.paymentDate,
                allocCount: p._count.allocations,
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/loan-payments error:", error);
        return NextResponse.json({ message: "Gagal memuat riwayat angsuran" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verify typecheck**
Run: `npx tsc --noEmit` → no NEW errors (confirm `LoanPayment.voidedAt`/`voidReason` + `_count.allocations` relation name).

- [ ] **Step 3: Commit**
```bash
git add src/app/api/mobile/loan-payments/route.ts
git commit -m "feat(mobile-loan): list-payments API (for Void Angsuran UI)"
```

---

### Task 3: RiwayatAngsuranScreen + wiring + VOID confirm

**Files:**
- Create: `mobile/src/screens/operator/RiwayatAngsuranScreen.tsx`
- Modify: `mobile/App.tsx` (lazy import + Stack.Screen "RiwayatAngsuran")
- Modify: `mobile/src/screens/operator/DaftarPinjamanScreen.tsx` (add a "Riwayat Angsuran" action per loan → navigate)

**Interfaces:**
- Consumes: `GET /api/mobile/loan-payments?loanId=X`; `POST /api/mobile/loan-payment-void` `{ paymentId, reason }`.

- [ ] **Step 1: Create the screen**

`mobile/src/screens/operator/RiwayatAngsuranScreen.tsx` (follow the existing operator-screen pattern — header with back btn, ScrollView, api client, formatRupiah from `../../lib/constants`):
```tsx
import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import C from "../../lib/colors";
import api from "../../lib/api";
import { formatRp, formatDate } from "../../lib/constants";

export default function RiwayatAngsuranScreen({ navigation }: any) {
  const route = useRoute<any>();
  const loanId = route.params?.loanId;
  const loanNo = route.params?.loanNo || `#${loanId}`;

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/mobile/loan-payments", { params: { loanId } });
      setPayments(res.data?.data || []);
    } catch (e) {
      console.warn("Error fetching payments:", e);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchPayments(); }, []));

  const confirmVoid = (p: any) => { setVoidTarget(p); setReason(""); };
  const cancelVoid = () => { setVoidTarget(null); setReason(""); };

  const doVoid = async () => {
    if (!voidTarget) return;
    setSubmitting(true);
    try {
      const res = await api.post("/api/mobile/loan-payment-void", { paymentId: voidTarget.id, reason: reason.trim() || undefined });
      Alert.alert("Berhasil", res.data?.detail || res.data?.message || "Pembayaran dibatalkan");
      cancelVoid();
      fetchPayments();
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.message || "Gagal membatalkan pembayaran");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}><ActivityIndicator size="large" color={C.primary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: C.primary, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "700", flex: 1 }}>Riwayat Angsuran</Text>
        <Text style={{ color: "#cbd5e1", fontSize: 12 }}>{loanNo}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {payments.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Ionicons name="receipt-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12 }}>Belum ada pembayaran</Text>
          </View>
        ) : (
          payments.map((p) => {
            const isVoided = p.status === "voided";
            return (
              <View key={p.id} style={[styles.card, isVoided && { opacity: 0.55 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.foreground }}>{p.paymentNo}</Text>
                  <Text style={[styles.badge, isVoided ? styles.badgeVoid : styles.badgePaid]}>{isVoided ? "VOID" : "Lunas"}</Text>
                </View>
                <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 2 }}>
                  {formatDate(p.paymentDate)} · {p.paymentType === "early_settlement" ? "Pelunasan" : "Angsuran"} · {p.allocCount} alokasi
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.primary, marginTop: 6 }}>{formatRp(p.amount)}</Text>
                {!isVoided && (
                  <TouchableOpacity style={styles.voidBtn} onPress={() => confirmVoid(p)}>
                    <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>Batalkan (VOID)</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* VOID confirm modal */}
      <Modal visible={!!voidTarget} transparent animationType="fade" onRequestClose={cancelVoid}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.foreground }}>Batalkan Pembayaran?</Text>
            <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 4 }}>
              {voidTarget?.paymentNo} · {formatRp(voidTarget?.amount || 0)}. Reversal: schedule, kas/bank, alokasi, counter loan.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Alasan (opsional)"
              value={reason}
              onChangeText={setReason}
              placeholderTextColor="#94a3b8"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: "#e2e8f0" }]} onPress={cancelVoid} disabled={submitting}>
                <Text style={{ color: C.foreground, fontWeight: "700" }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: "#DC2626" }]} onPress={doVoid} disabled={submitting}>
                <Text style={{ color: "#FFF", fontWeight: "700" }}>{submitting ? "Memproses..." : "Ya, VOID"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  badge: { fontSize: 10, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" },
  badgePaid: { backgroundColor: "#ECFDF5", color: "#059669" },
  badgeVoid: { backgroundColor: "#FEF2F2", color: "#DC2626" },
  voidBtn: { marginTop: 10, backgroundColor: "#DC2626", paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: { backgroundColor: "#FFF", borderRadius: 14, padding: 18, width: "100%" },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10, marginTop: 10, fontSize: 13, color: C.foreground },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
});
```

- [ ] **Step 2: Wire into App.tsx**

In `mobile/App.tsx`: add a lazy import near the other operator screens:
```tsx
const RiwayatAngsuranScreen = React.lazy(() => import("./src/screens/operator/RiwayatAngsuranScreen"));
```
and a Stack.Screen inside the authenticated `<>...</>` block (near the other loan screens):
```tsx
<Stack.Screen name="RiwayatAngsuran">{() => <LS><RiwayatAngsuranScreen /></LS>}</Stack.Screen>
```

- [ ] **Step 3: Add navigation entry from DaftarPinjamanScreen**

In `mobile/src/screens/operator/DaftarPinjamanScreen.tsx`, add a per-loan action (e.g., in the loan row or a detail view) that navigates:
```tsx
navigation.navigate("RiwayatAngsuran", { loanId: item.id, loanNo: item.loanNo });
```
(Place it where the loan row's actions live — the implementer should read DaftarPinjamanScreen to find the natural spot, e.g., a small "Riwayat" button next to the existing actions. Keep it minimal.)

- [ ] **Step 4: Verify mobile typecheck + manual**
Run: `cd mobile && npx tsc --noEmit` → no NEW errors in the new/changed files. (`formatRp`/`formatDate` exist in `../../lib/constants`; `api` default-import from `../../lib/api`; route param `loanId`/`loanNo` passed from DaftarPinjaman.)
Manual Expo (deferred, no emulator): open DaftarPinjaman → tap "Riwayat" on a loan → see payments → VOID one with reason → confirm reversal via re-fetch.

- [ ] **Step 5: Commit**
```bash
git add mobile/src/screens/operator/RiwayatAngsuranScreen.tsx mobile/App.tsx mobile/src/screens/operator/DaftarPinjamanScreen.tsx
git commit -m "feat(mobile-loan): RiwayatAngsuran screen + VOID confirm dialog"
```

---

## Self-Review (controller notes)

- **Spec coverage:** API void (Task 1) + list-payments (Task 2) + UI (Task 3) — all spec sections mapped. Helpers reused (not rewritten). Atomic mirror of web. Generic error. RBAC operator/admin_sp.
- **Type consistency:** `AllocationReversal` + helper signatures match web usage. UI consumes list-payments response fields (`paymentNo`, `amount`, `status`, `paymentType`, `allocCount`, `paymentDate`) + posts `{ paymentId, reason }`.
- **Placeholder scan:** none — complete code (Task 3 Step 3 defers exact placement in DaftarPinjaman to the implementer reading the file, which is explicit, not a placeholder).
- **Risk:** Task 1 is a money-moving reversal route — reviewer must verify helper signatures match `payment-void-helpers.ts` (read it), `LoanPaymentAllocation` relation name, voided-fields exist, atomicity, generic error. Task 3 UI follows repo patterns; implementer reads DaftarPinjaman for nav placement. Implementer: Task 1 sonnet (integration), Task 2 sonnet (small), Task 3 sonnet (UI).
- **RBAC:** same pre-existing systemic note — defer to Fase 4.
