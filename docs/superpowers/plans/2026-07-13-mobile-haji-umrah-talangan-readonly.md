# Fase 9a.2 — Mobile H&U Talangan READ-ONLY Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile staff can view talangan loans (gap-aware list), browse accounts needing financing, and drill into loan detail with schedules + payments.

**Architecture:** 3 mobile GET routes mirroring web H&U talangan queries (mobile JWT auth). 1 FlatList screen with stat cards + filter chips. READ-ONLY — no write operations.

**Tech Stack:** Next.js route handlers, Prisma 6, Expo 55 / RN 0.83, react-hook-form not needed (read-only).

## Global Constraints

- **RBAC:** reads = any auth staff (operator/admin/admin_sp). No write gates.
- **Branch scope:** H&U is org-wide — no branch filter needed.
- **`log.*` only** in mobile screens; `console.error` only in routes.
- **Field contracts:** screen reads exact response shapes from routes (Fase 6 lesson).
- **branch** = `railway-migration` (API auto-deploys on push; screens ship via EAS build).
- **No DRY extraction** (read-only, no money logic).

---

### Task 1: Mobile GET route — talangan list + stats

**Files:**
- Create: `src/app/api/mobile/haji-umrah/talangan/route.ts`

**Interfaces:**
- Consumes: `getMobileUser`, `unauthorizedResponse` from `../../middleware` (4 levels: talangan → haji-umrah → mobile → src/app/api). Auth: any staff.

- [ ] **Step 1: Create the route**

```ts
// src/app/api/mobile/haji-umrah/talangan/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../middleware";

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    // Any auth staff — H&U management is staff-only
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || "all";
        const type = searchParams.get("type") || "";
        const search = searchParams.get("search") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "20");

        // Where: filter loans linked to H&U savings accounts
        const whereClause: Record<string, unknown> = {
            linkedSavingsAccountId: { not: null },
        };
        if (status !== "all") {
            whereClause.status = status;
        }
        if (search) {
            whereClause.member = {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { nrp: { contains: search, mode: "insensitive" } },
                ],
            };
        }
        if (type) {
            whereClause.productSnapshot = { path: ["type"], equals: type };
        }

        // Paginated list
        const [loans, total] = await Promise.all([
            prisma.loan.findMany({
                where: whereClause,
                include: {
                    member: { select: { id: true, name: true, nrp: true } },
                    application: {
                        select: {
                            applicationNo: true,
                            status: true,
                            product: { select: { code: true, name: true, type: true } },
                        },
                    },
                    linkedSavingsAccount: {
                        select: {
                            accountNo: true,
                            balance: true,
                            targetAmount: true,
                            product: { select: { name: true, type: true } },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.loan.count({ where: whereClause }),
        ]);

        // Stats (same as web, separate queries)
        const statsWhere = { linkedSavingsAccountId: { not: null } };
        const [activeCount, activeLoans, paidLoans, totalOutstanding] = await Promise.all([
            prisma.loan.count({ where: { ...statsWhere, status: "active" } }),
            prisma.loan.findMany({
                where: { ...statsWhere, status: "active" },
                select: { principalOutstanding: true },
            }),
            prisma.loan.findMany({
                where: { ...statsWhere, status: "paid_off" },
                select: { principalPaid: true },
            }),
            prisma.loanPayment.findMany({
                where: {
                    loan: { linkedSavingsAccountId: { not: null } },
                    status: "completed",
                    createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
                },
                select: { amount: true },
            }),
        ]);

        const outstanding = activeLoans.reduce((sum, l) => sum + Number(l.principalOutstanding), 0);
        const paidThisMonth = totalOutstanding.reduce((sum, p) => sum + Number(p.amount), 0);

        // Gap-detected count
        const gapAccounts = await prisma.savingsAccount.findMany({
            where: {
                status: "active",
                product: { type: { in: ["tabungan_haji", "tabungan_umrah"] } },
                targetAmount: { not: null },
            },
            select: {
                id: true, balance: true, targetAmount: true,
                talanganLoans: { where: { status: "active" }, select: { id: true } },
            },
        });
        const gapDetected = gapAccounts.filter(
            (a) => Number(a.targetAmount) > Number(a.balance) && a.talanganLoans.length === 0
        ).length;

        const data = loans.map((loan) => ({
            loanId: loan.id,
            loanNo: loan.loanNo,
            memberId: loan.memberId,
            memberName: loan.member.name,
            memberNrp: loan.member.nrp,
            productType: (loan.application?.product?.type as string) || null,
            productName: loan.application?.product?.name || null,
            principalAmount: Number(loan.principalAmount),
            interestAmount: Number(loan.interestAmount),
            totalAmount: Number(loan.totalAmount),
            outstanding: Number(loan.principalOutstanding),
            status: loan.status,
            tenorMonths: loan.tenorMonths,
            monthlyInstallment: Number(loan.monthlyInstallment),
            disbursementDate: loan.disbursementDate,
            savingsAccountNo: loan.linkedSavingsAccount?.accountNo || null,
            savingsBalance: loan.linkedSavingsAccount ? Number(loan.linkedSavingsAccount.balance) : null,
            savingsTarget: loan.linkedSavingsAccount ? Number(loan.linkedSavingsAccount.targetAmount) : null,
            applicationStatus: loan.application?.status || null,
        }));

        return NextResponse.json({
            stats: {
                totalActive: activeCount,
                totalOutstanding: outstanding,
                paidThisMonth,
                gapDetected,
                totalPaidOff: paidLoans.length,
                totalRecords: total,
            },
            data,
            pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
        });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/talangan error:", error);
        return NextResponse.json({ message: "Gagal memuat data talangan" }, { status: 500 });
    }
}
```

- [ ] **Step 2: tsc** — `npx tsc --noEmit` → no errors in new route.

- [ ] **Step 3: Commit**
```bash
git add src/app/api/mobile/haji-umrah/talangan/route.ts
git commit -m "feat(mobile-api): GET /haji-umrah/talangan list+stats (Fase 9a.2 T1)"
```

---

### Task 2: Mobile GET route — talangan gap calculator

**Files:**
- Create: `src/app/api/mobile/haji-umrah/talangan/gap/route.ts`

**Interfaces:**
- Consumes: `getMobileUser`, `unauthorizedResponse` from `../../../middleware` (5 levels: gap → talangan → haji-umrah → mobile → api → app → src).

- [ ] **Step 1: Create the route**

```ts
// src/app/api/mobile/haji-umrah/talangan/gap/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../../middleware";

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const onlyWithGap = searchParams.get("onlyWithGap") === "true";
        const productType = searchParams.get("productType") || "";

        const whereClause: Record<string, unknown> = {
            status: "active",
            product: { type: { in: ["tabungan_haji", "tabungan_umrah"] } },
        };
        if (productType) {
            (whereClause.product as Record<string, unknown>).type = productType;
        }

        const accounts = await prisma.savingsAccount.findMany({
            where: whereClause,
            include: {
                member: { select: { id: true, name: true, nrp: true } },
                product: { select: { id: true, code: true, name: true, type: true } },
                talanganLoans: {
                    where: { status: "active" },
                    select: { id: true, loanNo: true, principalOutstanding: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const data = accounts
            .map((account) => {
                const balance = Number(account.balance);
                const target = account.targetAmount ? Number(account.targetAmount) : 0;
                const gap = Math.max(0, target - balance);
                const progress = target > 0 ? Math.min(100, (balance / target) * 100) : 0;
                const hasActiveTalangan = account.talanganLoans.length > 0;

                let status: string;
                if (!account.targetAmount) {
                    status = "no_target";
                } else if (progress >= 100) {
                    status = "target_reached";
                } else if (hasActiveTalangan) {
                    status = "has_talangan";
                } else {
                    status = "needs_talangan";
                }

                return {
                    accountId: account.id,
                    accountNo: account.accountNo,
                    memberId: account.member.id,
                    memberName: account.member.name,
                    memberNrp: account.member.nrp,
                    productType: account.product.type,
                    productName: account.product.name,
                    balance,
                    targetAmount: target,
                    gap,
                    progress: Math.round(progress * 10) / 10,
                    hasActiveTalangan,
                    activeTalanganId: hasActiveTalangan ? account.talanganLoans[0].id : null,
                    activeTalanganOutstanding: hasActiveTalangan
                        ? Number(account.talanganLoans[0].principalOutstanding)
                        : null,
                    status,
                };
            })
            .filter((a) => {
                if (onlyWithGap) return a.status === "needs_talangan";
                return true;
            });

        const summary = {
            totalAccounts: accounts.length,
            withGap: accounts.filter((a) => {
                const t = a.targetAmount ? Number(a.targetAmount) : 0;
                return t > Number(a.balance) && a.talanganLoans.length === 0;
            }).length,
            coveredByTalangan: accounts.filter((a) => a.talanganLoans.length > 0).length,
            targetReached: accounts.filter((a) => {
                const t = a.targetAmount ? Number(a.targetAmount) : 0;
                return t > 0 && Number(a.balance) >= t;
            }).length,
        };

        return NextResponse.json({ data, summary });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/talangan/gap error:", error);
        return NextResponse.json({ message: "Gagal menghitung gap" }, { status: 500 });
    }
}
```

- [ ] **Step 2: tsc** — `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**
```bash
git add src/app/api/mobile/haji-umrah/talangan/gap/route.ts
git commit -m "feat(mobile-api): GET /haji-umrah/talangan/gap calculator (Fase 9a.2 T2)"
```

---

### Task 3: Mobile GET route — talangan loan detail

**Files:**
- Create: `src/app/api/mobile/haji-umrah/talangan/[loanId]/route.ts`

**Interfaces:**
- Consumes: `getMobileUser`, `unauthorizedResponse` from `../../../../middleware`.

- [ ] **Step 1: Create the route**

```ts
// src/app/api/mobile/haji-umrah/talangan/[loanId]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../../../middleware";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ loanId: string }> }
) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { loanId } = await params;
        const id = parseInt(loanId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });
        }

        // Fetch loan + related data
        const [loan, schedules, payments] = await Promise.all([
            prisma.loan.findUnique({
                where: { id },
                include: {
                    member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                    linkedSavingsAccount: {
                        select: {
                            accountNo: true,
                            balance: true,
                            targetAmount: true,
                            product: { select: { name: true, type: true } },
                        },
                    },
                    application: {
                        select: { status: true },
                    },
                },
            }),
            prisma.loanSchedule.findMany({
                where: { loanId: id },
                orderBy: { installmentNumber: "asc" },
            }),
            prisma.loanPayment.findMany({
                where: { loanId: id, status: "completed" },
                orderBy: { paymentDate: "desc" },
                take: 50,
            }),
        ]);

        if (!loan) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan" }, { status: 404 });
        }

        const stats = {
            totalPaid: Number(loan.principalPaid) + Number(loan.interestPaid),
            remaining: Number(loan.principalOutstanding),
            installmentPaid: loan.status === "paid_off"
                ? loan.tenorMonths
                : schedules.filter((s) => s.status === "paid").length,
            installmentRemaining: loan.status === "paid_off"
                ? 0
                : schedules.filter((s) => s.status !== "paid").length,
            nextDueDate: schedules.find((s) => s.status !== "paid")?.dueDate || null,
            nextDueAmount: (() => {
                const next = schedules.find((s) => s.status !== "paid");
                return next ? Number(next.principalPortion) + Number(next.interestPortion) : 0;
            })(),
        };

        return NextResponse.json({
            loan: {
                id: loan.id,
                loanNo: loan.loanNo,
                memberId: loan.memberId,
                memberName: loan.member.name,
                memberNrp: loan.member.nrp,
                memberNo: loan.member.memberNo,
                productType: (loan.productSnapshot as Record<string, unknown>)?.type || null,
                productName: (loan.productSnapshot as Record<string, unknown>)?.name || null,
                principalAmount: Number(loan.principalAmount),
                interestAmount: Number(loan.interestAmount),
                totalAmount: Number(loan.totalAmount),
                tenorMonths: loan.tenorMonths,
                monthlyInstallment: Number(loan.monthlyInstallment),
                disbursementDate: loan.disbursementDate,
                firstDueDate: loan.firstDueDate,
                lastDueDate: loan.lastDueDate,
                principalPaid: Number(loan.principalPaid),
                interestPaid: Number(loan.interestPaid),
                principalOutstanding: Number(loan.principalOutstanding),
                interestOutstanding: Number(loan.interestOutstanding),
                status: loan.status,
                approvalStatus: loan.application?.status || null,
                savingsAccountNo: loan.linkedSavingsAccount?.accountNo || null,
                savingsBalance: loan.linkedSavingsAccount
                    ? Number(loan.linkedSavingsAccount.balance)
                    : null,
                savingsTarget: loan.linkedSavingsAccount
                    ? Number(loan.linkedSavingsAccount.targetAmount)
                    : null,
            },
            schedules: schedules.map((s) => ({
                id: s.id,
                installmentNumber: s.installmentNumber,
                dueDate: s.dueDate,
                principalPortion: Number(s.principalPortion),
                interestPortion: Number(s.interestPortion),
                totalDue: Number(s.principalPortion) + Number(s.interestPortion),
                amountPaid: s.amountPaid ? Number(s.amountPaid) : 0,
                paidDate: s.paidDate,
                status: s.status,
            })),
            payments: payments.map((p) => ({
                id: p.id,
                paymentDate: p.paymentDate,
                amount: Number(p.amount),
                principalPortion: Number(p.principalPortion),
                interestPortion: Number(p.interestPortion),
                remainingBalance: Number(p.remainingBalance),
                notes: p.notes,
            })),
            stats,
        });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/talangan/[loanId] error:", error);
        return NextResponse.json({ message: "Gagal memuat detail talangan" }, { status: 500 });
    }
}
```

- [ ] **Step 2: tsc** — `npx tsc --noEmit` → no errors in new route.

- [ ] **Step 3: Commit**
```bash
git add src/app/api/mobile/haji-umrah/talangan/\[loanId\]/route.ts
git commit -m "feat(mobile-api): GET /haji-umrah/talangan/[loanId] detail (Fase 9a.2 T3)"
```

---

### Task 4: HajiUmrahTalanganScreen

**Files:**
- Create: `mobile/src/screens/operator/HajiUmrahTalanganScreen.tsx`
- Modify: `mobile/src/screens/common/DashboardScreen.tsx` (add menu entry under H&U section)
- Modify: `mobile/App.tsx` (register route)
- Modify: `mobile/src/lib/api.ts` (add client function)

**Interfaces:**
- Consumes: GET `/api/mobile/haji-umrah/talangan` + GET `/api/mobile/haji-umrah/talangan/[loanId]`.
- Produces: `TalanganLoan[]` + `TalanganStats` types.

**Pattern:** mirrors `HajiUmrahScreen.tsx` (stat cards + FlatList + filter chips + search + pull-refresh). No FAB (read-only).

- [ ] **Step 1: Confirm middleware depth** — verify `../../middleware` paths above (T1 = 4 levels, T2 = 5 levels, T3 = 6 levels from `src/app/api/mobile/haji-umrah/talangan/`). T1 = `../../middleware` ✓, T2 = `../../../middleware` ✓, T3 = `../../../../middleware` ✓.

- [ ] **Step 2: Create `HajiUmrahTalanganScreen.tsx`**

Structure mirrors `HajiUmrahScreen.tsx`:
- 4 stat cards: "Perlu Talangan" (amber if >0) / "Aktif" / "Outstanding" (Rp formatted) / "Lunas"
- Search input + filter chips: Semua / Haji / Umrah
- FlatList of talangan loans (loanNo, memberName, productType badge, outstanding Rp, status badge)
- Pull-to-refresh
- Navigation: tap row → `HajiUmrahTalanganDetail` (or inline expandable detail)

```tsx
// mobile/src/screens/operator/HajiUmrahTalanganScreen.tsx
// Field contract matches GET /api/mobile/haji-umrah/talangan response
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/entities';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

type TalanganStats = {
  totalActive: number;
  totalOutstanding: number;
  paidThisMonth: number;
  gapDetected: number;
  totalPaidOff: number;
  totalRecords: number;
};

type TalanganLoan = {
  loanId: number;
  loanNo: string;
  memberId: number;
  memberName: string;
  memberNrp: string;
  productType: string | null;
  productName: string | null;
  principalAmount: number;
  outstanding: number;
  status: string;
  tenorMonths: number;
  monthlyInstallment: number;
  disbursementDate: string | null;
  savingsAccountNo: string | null;
  savingsBalance: number | null;
  savingsTarget: number | null;
};

type FilterChip = { label: string; value: string | null };
const FILTER_CHIPS: FilterChip[] = [
  { label: 'Semua', value: null },
  { label: 'Haji', value: 'talangan_haji' },
  { label: 'Umrah', value: 'talangan_umrah' },
];

const formatRp = (n: number) =>
  'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

export default function HajiUmrahTalanganScreen({ navigation }: any) {
  const [loans, setLoans] = useState<TalanganLoan[]>([]);
  const [stats, setStats] = useState<TalanganStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = { perPage: '100' };
      if (search.trim()) params.search = search.trim();
      if (activeFilter) params.type = activeFilter;
      const res = await api.get('/api/mobile/haji-umrah/talangan', { params });
      setLoans(res.data?.data || []);
      setStats(res.data?.stats || null);
    } catch (err) {
      log.error('Failed to load talangan:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const typeBadge = (t: string | null) => {
    if (t === 'talangan_haji') return { label: 'Haji', bg: '#16A34A' };
    if (t === 'talangan_umrah') return { label: 'Umrah', bg: '#0EA5E9' };
    return { label: 'Talangan', bg: '#6B7280' };
  };

  const statusBadge = (s: string) => {
    if (s === 'active') return { label: 'Aktif', bg: '#16A34A' };
    if (s === 'paid_off') return { label: 'Lunas', bg: '#0EA5E9' };
    if (s === 'overdue') return { label: 'Jatuh Tempo', bg: '#DC2626' };
    return { label: s, bg: '#6B7280' };
  };

  const renderItem = ({ item }: { item: TalanganLoan }) => {
    const typeB = typeBadge(item.productType);
    const statB = statusBadge(item.status);
    return (
      <TouchableOpacity style={styles.card} onPress={() => {
        // Navigation to detail — TBD or inline expand
      }}>
        <View style={styles.cardHeader}>
          <Text style={styles.memberName}>{item.memberName}</Text>
          <View style={[styles.badge, { backgroundColor: typeB.bg }]}>
            <Text style={styles.badgeText}>{typeB.label}</Text>
          </View>
        </View>
        <Text style={styles.loanNo}>{item.loanNo}</Text>
        <View style={styles.cardStats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Outstanding</Text>
            <Text style={styles.statValue}>{formatRp(item.outstanding)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statB.bg, alignSelf: 'flex-end' }]}>
            <Text style={styles.badgeText}>{statB.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Stats cards */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, stats.gapDetected > 0 && styles.statCardAmber]}>
            <Text style={styles.statCardNum}>{stats.gapDetected}</Text>
            <Text style={styles.statCardLabel}>Perlu Talangan</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardNum}>{stats.totalActive}</Text>
            <Text style={styles.statCardLabel}>Aktif</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardNumSmall}>{formatRp(stats.totalOutstanding)}</Text>
            <Text style={styles.statCardLabel}>Outstanding</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardNum}>{stats.totalPaidOff}</Text>
            <Text style={styles.statCardLabel}>Lunas</Text>
          </View>
        </View>
      )}

      {/* Search + filters */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama / NRP..."
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <View style={styles.chipsRow}>
        {FILTER_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.label}
            style={[styles.chip, activeFilter === chip.value && styles.chipActive]}
            onPress={() => setActiveFilter(chip.value)}
          >
            <Text style={[styles.chipText, activeFilter === chip.value && styles.chipTextActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={loans}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.loanId)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Tidak ada data talangan</Text>}
      />
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', padding: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 12, alignItems: 'center' },
  statCardAmber: { backgroundColor: '#FEF3C7' },
  statCardNum: { fontSize: 20, fontWeight: 'bold' },
  statCardNumSmall: { fontSize: 12, fontWeight: 'bold' },
  statCardLabel: { fontSize: 10, color: '#6B7280', textAlign: 'center' },
  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 14 },
  chipsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#E5E7EB' },
  chipActive: { backgroundColor: C.primary },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  memberName: { fontSize: 16, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  loanNo: { fontSize: 12, color: '#6B7280', fontFamily: 'monospace', marginBottom: 8 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  stat: {},
  statLabel: { fontSize: 11, color: '#6B7280' },
  statValue: { fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 14 },
};
```

- [ ] **Step 3: Add API client** — append to `mobile/src/lib/api.ts`:
```ts
export const hajiUmrahTalanganApi = {
  list: (params?: Record<string, string>) =>
    api.get('/api/mobile/haji-umrah/talangan', { params }),
  gap: (params?: Record<string, string>) =>
    api.get('/api/mobile/haji-umrah/talangan/gap', { params }),
  detail: (loanId: number) =>
    api.get(`/api/mobile/haji-umrah/talangan/${loanId}`),
};
```
And import+use it in the screen.

- [ ] **Step 4: Dashboard menu entry** — add "Talangan" button in H&U section of `DashboardScreen.tsx` (near "Tabungan" button). Gate: operator/admin/admin_sp.

- [ ] **Step 5: App.tsx route** — register `HajiUmrahTalangan` Stack.Screen near other H&U routes.

- [ ] **Step 6: tsc** — `cd mobile && npx tsc --noEmit` → no errors.

- [ ] **Step 7: Grep console.* → 0** in new screen.

- [ ] **Step 8: Commit**
```bash
git add mobile/src/screens/operator/HajiUmrahTalanganScreen.tsx mobile/src/lib/api.ts mobile/src/screens/common/DashboardScreen.tsx mobile/App.tsx
git commit -m "feat(mobile): HajiUmrahTalanganScreen + nav (Fase 9a.2 T4)"
```

---

### Task 5: Final review + push

- [ ] Verify all 3 routes respond correctly (manual test with operator token or Postman).
- [ ] Full test suite: `npm test` — baseline green.
- [ ] `finishing-a-development-branch`: push to `railway-migration` + document in progress doc.

---

## After T1-T5 → push

Railway auto-deploys the 3 routes. Screens ship via next EAS build.

## Notes for final review

- RBAC: all 3 routes gate operator/admin/admin_sp — H&U management is staff-only.
- Response shapes match web verbatim.
- No money operations — read-only scope confirmed.
- No new dependencies.
- tsc clean + grep `console.*` 0 in screen.
