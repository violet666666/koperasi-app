# Haji & Umrah — Phase 1C: UI Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 7 UI pages + layout under `/(protected)/haji-umrah/` — dashboard with 6 stat cards + target alert, tabungan listing with buka rekening dialog + progress bars, detail page with riwayat + kwitansi print, setoran form with admin fee calculation, produk CRUD (create + edit), and laporan with export.

**Architecture:** Client components (`"use client"`) following existing simpanan/toko page patterns. Uses `PageHeader`, `DataTable`, `Card`, `Badge` from shared components. Data fetching via `fetch()` to the API routes created in Phase 1B.

**Tech Stack:** React 19, Next.js 16 App Router, Tailwind v4, shadcn/ui (Radix), TanStack Table, Recharts, Lucide icons

**Depends on:** `2026-06-10-haji-umrah-2-api-layer.md` (API routes must exist)

**Design Spec:** `docs/superpowers/specs/2026-06-10-haji-umrah-savings-only-design.md`

**Next Plan:** `2026-06-10-haji-umrah-4-integration.md`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/app/(protected)/haji-umrah/layout.tsx` | Create | Shared layout — redirect to dashboard |
| `src/app/(protected)/haji-umrah/page.tsx` | Create | Dashboard — overview stats cards |
| `src/app/(protected)/haji-umrah/tabungan/page.tsx` | Create | Daftar rekening + progress bars |
| `src/app/(protected)/haji-umrah/tabungan/[accountId]/page.tsx` | Create | Detail rekening — riwayat + progress |
| `src/app/(protected)/haji-umrah/tabungan/[accountId]/setoran/page.tsx` | Create | Form setoran with admin fee calc |
| `src/app/(protected)/haji-umrah/produk/page.tsx` | Create | CRUD produk tabungan |
| `src/app/(protected)/haji-umrah/laporan/page.tsx` | Create | Export laporan (Excel/PDF) |

---

### Task 1: Layout — Index Redirect

**Files:**
- Create: `src/app/(protected)/haji-umrah/layout.tsx`

- [ ] **Step 1: Create layout (simple passthrough — uses parent AppShell)**

```typescript
export default function HajiUmrahLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
```

The parent `(protected)/layout.tsx` already provides the `AppShell` with sidebar, so this layout just passes through.

- [ ] **Step 2: Commit**

```bash
git add "src/app/(protected)/haji-umrah/layout.tsx"
git commit -m "feat(haji-umrah): add passthrough layout"
```

---

### Task 2: Dashboard Page — Stats Overview

**Files:**
- Create: `src/app/(protected)/haji-umrah/page.tsx`

- [ ] **Step 1: Create dashboard with stat cards**

```typescript
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import { formatCurrency } from "@/lib/constants";
import { Wallet, Users, TrendingUp, Target, Clock, ArrowRight, Banknote } from "lucide-react";

interface DashboardStats {
    totalAccounts: number;
    totalSaldo: number;
    totalTarget: number;
    globalProgress: number;
    monthlyDeposits: number;
    adminFeeRevenue: number;
    nearTarget: number;
    reachedTarget: number;
    recentAccounts: Array<{
        accountNo: string;
        memberName: string;
        productType: string;
        balance: number;
        target: number;
        progress: number;
        openedDate: string;
    }>;
    nearTargetAccounts: Array<{
        memberName: string;
        balance: number;
        target: number;
        progress: number;
    }>;
}

export default function HajiUmrahDashboard() {
    const router = useRouter();
    const [stats, setStats] = React.useState<DashboardStats | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function loadDashboard() {
            try {
                const res = await fetch("/api/haji-umrah/reports?type=progress");
                if (res.ok) {
                    const json = await res.json();
                    setStats(json.data);
                }
            } catch (err) {
                console.error("Dashboard load error:", err);
            } finally {
                setLoading(false);
            }
        }
        loadDashboard();
    }, []);

    const statCards = [
        {
            title: "Total Rekening Aktif",
            value: stats?.totalAccounts ?? 0,
            icon: Users,
            format: "number" as const,
        },
        {
            title: "Total Saldo",
            value: stats?.totalSaldo ?? 0,
            icon: Wallet,
            format: "currency" as const,
        },
        {
            title: "Target Keseluruhan",
            value: stats?.totalTarget ?? 0,
            icon: Target,
            format: "currency" as const,
        },
        {
            title: "Setoran Bulan Ini",
            value: stats?.monthlyDeposits ?? 0,
            icon: TrendingUp,
            format: "currency" as const,
        },
        {
            title: "Admin Fee Bulan Ini",
            value: stats?.adminFeeRevenue ?? 0,
            icon: Banknote,
            format: "currency" as const,
        },
        {
            title: "Mendekati Target (≥80%)",
            value: stats?.nearTarget ?? 0,
            icon: Clock,
            format: "number" as const,
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Haji & Umrah"
                description="Tabungan Haji & Umrah — Kelola tabungan anggota untuk perjalanan suci"
                actions={
                    <div className="flex gap-2">
                        <Button onClick={() => router.push("/haji-umrah/tabungan")} variant="outline">
                            <Wallet className="mr-2 h-4 w-4" /> Tabungan
                        </Button>
                        <Button onClick={() => router.push("/haji-umrah/produk")}>
                            Kelola Produk
                        </Button>
                    </div>
                }
            />

            {/* Stat Cards */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                {statCards.map((card) => (
                    <Card key={card.title}>
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="rounded-lg bg-primary/10 p-2.5">
                                <card.icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{card.title}</p>
                                <p className="text-lg font-bold">
                                    {loading ? "..." : card.format === "currency"
                                        ? formatCurrency(card.value)
                                        : card.value.toLocaleString("id-ID")}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Target Alert Banner — ≥90% */}
            {stats?.nearTargetAccounts && stats.nearTargetAccounts.filter(a => a.progress >= 90).length > 0 && (
                <Alert className="border-yellow-500 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                        <span className="font-medium">⚠️ {stats.nearTargetAccounts.filter(a => a.progress >= 90).length} rekening</span> sudah mendekati target (≥90%). Segera koordinasi dengan BSI untuk proses selanjutnya.
                    </AlertDescription>
                </Alert>
            )}

            {/* Near Target Accounts */}
            {stats?.nearTargetAccounts && stats.nearTargetAccounts.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Mendekati Target</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.nearTargetAccounts.slice(0, 5).map((acc, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{acc.memberName}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatCurrency(acc.balance)} / {formatCurrency(acc.target)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 bg-muted rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full"
                                                style={{ width: `${Math.min(100, acc.progress)}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium">{acc.progress}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Links */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push("/haji-umrah/tabungan")}>
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <Wallet className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-medium">Daftar Tabungan</p>
                                <p className="text-sm text-muted-foreground">Kelola rekening anggota</p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push("/haji-umrah/laporan")}>
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-medium">Laporan</p>
                                <p className="text-sm text-muted-foreground">Export rekap & progress</p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push("/haji-umrah/produk")}>
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <Target className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-medium">Produk</p>
                                <p className="text-sm text-muted-foreground">Kelola produk tabungan</p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify dashboard renders**

Run: `npm run dev` → Navigate to `/haji-umrah`
Expected: Dashboard with 4 stat cards + quick links

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/haji-umrah/page.tsx"
git commit -m "feat(haji-umrah): add dashboard page with stats cards and quick links"
```

---

### Task 3: Tabungan Listing Page

**Files:**
- Create: `src/app/(protected)/haji-umrah/tabungan/page.tsx`

- [ ] **Step 1: Create listing page with DataTable + progress bars**

```typescript
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/constants";
import { Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface SavingsAccount {
    id: number;
    accountNo: string;
    balance: number;
    target: number;
    progress: number;
    monthlyTarget: number;
    status: string;
    openedDate: string;
    member: { id: number; memberNo: string; name: string; nrp: string | null };
    product: { id: number; code: string; name: string; type: string };
}

export default function TabunganListPage() {
    const router = useRouter();
    const [accounts, setAccounts] = React.useState<SavingsAccount[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [pageCount, setPageCount] = React.useState(0);
    const [pagination, setPagination] = React.useState({ page: 1, perPage: 15 });
    const [searchQuery, setSearchQuery] = React.useState("");
    const [typeFilter, setTypeFilter] = React.useState<string>("all");

    const fetchAccounts = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pagination.page),
                perPage: String(pagination.perPage),
                ...(searchQuery && { search: searchQuery }),
                ...(typeFilter !== "all" && { type: typeFilter }),
            });
            const res = await fetch(`/api/haji-umrah/savings?${params}`);
            if (res.ok) {
                const json = await res.json();
                setAccounts(json.data);
                setPageCount(json.meta.totalPages);
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat data tabungan");
        } finally {
            setLoading(false);
        }
    }, [pagination, searchQuery, typeFilter]);

    React.useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    const columns: ColumnDef<SavingsAccount>[] = React.useMemo(() => [
        {
            accessorKey: "accountNo",
            header: "No. Rekening",
            cell: ({ row }) => (
                <button
                    onClick={() => router.push(`/haji-umrah/tabungan/${row.original.id}`)}
                    className="text-primary hover:underline font-mono text-sm"
                >
                    {row.original.accountNo}
                </button>
            ),
        },
        {
            accessorKey: "member.name",
            header: "Anggota",
            cell: ({ row }) => (
                <div>
                    <p className="font-medium">{row.original.member.name}</p>
                    <p className="text-xs text-muted-foreground">{row.original.member.nrp || row.original.member.memberNo}</p>
                </div>
            ),
        },
        {
            accessorKey: "product.name",
            header: "Produk",
            cell: ({ row }) => (
                <Badge variant={row.original.product.type === "tabungan_haji" ? "default" : "secondary"}>
                    {row.original.product.name}
                </Badge>
            ),
        },
        {
            accessorKey: "balance",
            header: "Saldo",
            cell: ({ row }) => (
                <span className="font-medium">{formatCurrency(row.original.balance)}</span>
            ),
        },
        {
            id: "progress",
            header: "Progress",
            cell: ({ row }) => {
                const { progress, target } = row.original;
                if (!target || target <= 0) return <span className="text-muted-foreground">—</span>;
                return (
                    <div className="flex items-center gap-2 min-w-[140px]">
                        <div className="flex-1 bg-muted rounded-full h-2.5">
                            <div
                                className={`h-2.5 rounded-full transition-all ${
                                    progress >= 100 ? "bg-green-500" : progress >= 80 ? "bg-yellow-500" : "bg-primary"
                                }`}
                                style={{ width: `${Math.min(100, progress)}%` }}
                            />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{progress}%</span>
                    </div>
                );
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.original.status === "active" ? "default" : "secondary"}>
                    {row.original.status === "active" ? "Aktif" : "Tutup"}
                </Badge>
            ),
        },
    ], [router]);

    // ── Buka Rekening Dialog State ──
    const [bukaDialogOpen, setBukaDialogOpen] = React.useState(false);
    const [bukaSubmitting, setBukaSubmitting] = React.useState(false);
    const [products, setProducts] = React.useState<Array<{ id: number; code: string; name: string; type: string; targetAmount: number | null }>>([]);
    const [memberSearch, setMemberSearch] = React.useState("");
    const [memberResults, setMemberResults] = React.useState<Array<{ id: number; name: string; memberNo: string; nrp: string | null }>>([]);
    const [bukaForm, setBukaForm] = React.useState({
        memberId: 0,
        memberName: "",
        productId: "",
        targetAmount: "",
        monthlyTarget: "",
        maturityDate: "",
    });

    // Load products for dialog
    React.useEffect(() => {
        if (bukaDialogOpen) {
            fetch("/api/haji-umrah/products").then(r => r.json()).then(j => setProducts(j.data || [])).catch(() => {});
        }
    }, [bukaDialogOpen]);

    // Member search
    React.useEffect(() => {
        if (memberSearch.length < 2) { setMemberResults([]); return; }
        const timer = setTimeout(() => {
            fetch(`/api/members?search=${encodeURIComponent(memberSearch)}&perPage=10`)
                .then(r => r.json())
                .then(j => setMemberResults(j.data || []))
                .catch(() => {});
        }, 300);
        return () => clearTimeout(timer);
    }, [memberSearch]);

    function selectMember(m: { id: number; name: string; memberNo: string; nrp: string | null }) {
        setBukaForm(f => ({ ...f, memberId: m.id, memberName: m.name }));
        setMemberSearch(m.name);
        setMemberResults([]);
    }

    // Auto-fill target from product default
    React.useEffect(() => {
        const product = products.find(p => p.id === parseInt(bukaForm.productId));
        if (product?.targetAmount && !bukaForm.targetAmount) {
            setBukaForm(f => ({ ...f, targetAmount: String(product.targetAmount) }));
        }
    }, [bukaForm.productId, products]);

    async function handleBukaRekening() {
        if (!bukaForm.memberId || !bukaForm.productId) {
            toast.error("Pilih anggota dan produk terlebih dahulu");
            return;
        }
        setBukaSubmitting(true);
        try {
            const res = await fetch("/api/haji-umrah/savings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memberId: bukaForm.memberId,
                    productId: parseInt(bukaForm.productId),
                    targetAmount: bukaForm.targetAmount ? parseFloat(bukaForm.targetAmount) : undefined,
                    monthlyTarget: bukaForm.monthlyTarget ? parseFloat(bukaForm.monthlyTarget) : undefined,
                    maturityDate: bukaForm.maturityDate || undefined,
                }),
            });
            if (res.ok) {
                toast.success("Rekening berhasil dibuka!");
                setBukaDialogOpen(false);
                setBukaForm({ memberId: 0, memberName: "", productId: "", targetAmount: "", monthlyTarget: "", maturityDate: "" });
                setMemberSearch("");
                fetchAccounts();
            } else {
                const json = await res.json();
                toast.error(json.message || "Gagal membuka rekening");
            }
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan");
        } finally {
            setBukaSubmitting(false);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tabungan Haji & Umrah"
                description="Daftar rekening tabungan haji dan umrah anggota"
                actions={
                    <Button onClick={() => setBukaDialogOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Buka Rekening
                    </Button>
                }
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama, NRP, atau no rekening..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
                        className="pl-10"
                    />
                </div>
                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPagination((p) => ({ ...p, page: 1 })); }}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Semua Produk" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Produk</SelectItem>
                        <SelectItem value="tabungan_haji">Tabungan Haji</SelectItem>
                        <SelectItem value="tabungan_umrah">Tabungan Umrah</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={accounts}
                pageCount={pageCount}
                pageIndex={pagination.page - 1}
                pageSize={pagination.perPage}
                onPaginationChange={(updater) => {
                    const newPagination = typeof updater === "function" ? updater({ pageIndex: pagination.page - 1, pageSize: pagination.perPage }) : updater;
                    setPagination({ page: newPagination.pageIndex + 1, perPage: newPagination.pageSize });
                }}
                loading={loading}
            />

            {/* Buka Rekening Dialog */}
            <Dialog open={bukaDialogOpen} onOpenChange={setBukaDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Buka Rekening Tabungan</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Member Search */}
                        <div>
                            <Label>Cari Anggota *</Label>
                            <div className="relative">
                                <Input
                                    placeholder="Ketik nama atau NRP..."
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                />
                                {bukaForm.memberName && (
                                    <Badge variant="secondary" className="mt-1">✓ {bukaForm.memberName}</Badge>
                                )}
                                {memberResults.length > 0 && (
                                    <div className="absolute z-50 w-full bg-background border rounded-md shadow-lg mt-1 max-h-40 overflow-auto">
                                        {memberResults.map((m) => (
                                            <button key={m.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => selectMember(m)}>
                                                <p className="font-medium">{m.name}</p>
                                                <p className="text-xs text-muted-foreground">{m.nrp || m.memberNo}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Product Selection */}
                        <div>
                            <Label>Produk Tabungan *</Label>
                            <Select value={bukaForm.productId} onValueChange={(v) => setBukaForm(f => ({ ...f, productId: v }))}>
                                <SelectTrigger><SelectValue placeholder="Pilih produk..." /></SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => (
                                        <SelectItem key={p.id} value={String(p.id)}>
                                            {p.name} ({p.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Target Amount */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Target Tabungan</Label>
                                <Input type="number" value={bukaForm.targetAmount} onChange={(e) => setBukaForm(f => ({ ...f, targetAmount: e.target.value }))} placeholder="Auto dari produk" />
                            </div>
                            <div>
                                <Label>Target Bulanan</Label>
                                <Input type="number" value={bukaForm.monthlyTarget} onChange={(e) => setBukaForm(f => ({ ...f, monthlyTarget: e.target.value }))} placeholder="Opsional" />
                            </div>
                        </div>

                        <div>
                            <Label>Target Tanggal Tercapai</Label>
                            <Input type="date" value={bukaForm.maturityDate} onChange={(e) => setBukaForm(f => ({ ...f, maturityDate: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBukaDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleBukaRekening} disabled={bukaSubmitting || !bukaForm.memberId || !bukaForm.productId}>
                            {bukaSubmitting ? "Memproses..." : "Buka Rekening"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
```

Note: Requires additional imports — add these to the existing imports at the top of the file:
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(protected)/haji-umrah/tabungan/page.tsx"
git commit -m "feat(haji-umrah): add tabungan listing page with progress bars and filters"
```

---

### Task 4: Tabungan Detail Page

**Files:**
- Create: `src/app/(protected)/haji-umrah/tabungan/[accountId]/page.tsx`

- [ ] **Step 1: Create detail page with progress + riwayat transaksi**

```typescript
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/constants";
import { Plus, ArrowLeft, CheckCircle2, Target, Calendar, TrendingUp, Printer } from "lucide-react";
import { toast } from "sonner";

interface AccountDetail {
    id: number;
    accountNo: string;
    balance: number;
    target: number;
    progress: number;
    monthlyTarget: number;
    status: string;
    openedDate: string;
    maturityDate: string | null;
    member: { id: number; name: string; memberNo: string; nrp: string | null };
    product: { id: number; name: string; type: string; adminFeeType: string | null; adminFeeValue: number | null };
    transactions: Array<{
        id: number;
        transactionNo: string;
        type: string;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        notes: string | null;
        transactionDate: string;
        createdBy: { id: number; name: string } | null;
    }>;
    stats: {
        totalDeposits: number;
        monthlyDeposits: number;
        depositCount: number;
        remaining: number;
        monthsRemaining: number | null;
        isTargetReached: boolean;
    };
}

export default function TabunganDetailPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.accountId as string;
    const [detail, setDetail] = React.useState<AccountDetail | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function loadDetail() {
            try {
                const res = await fetch(`/api/haji-umrah/savings/${accountId}`);
                if (res.ok) {
                    const json = await res.json();
                    setDetail(json.data);
                } else {
                    toast.error("Rekening tidak ditemukan");
                    router.push("/haji-umrah/tabungan");
                }
            } catch (err) {
                console.error(err);
                toast.error("Gagal memuat detail rekening");
            } finally {
                setLoading(false);
            }
        }
        if (accountId) loadDetail();
    }, [accountId, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!detail) return null;

    const productLabel = detail.product.type === "tabungan_haji" ? "Haji" : "Umrah";

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Tabungan ${productLabel} — ${detail.member.name}`}
                description={`${detail.accountNo} | ${detail.member.nrp || detail.member.memberNo}`}
                backHref="/haji-umrah/tabungan"
                backLabel="Daftar Tabungan"
                actions={
                    detail.status === "active" && (
                        <Button onClick={() => router.push(`/haji-umrah/tabungan/${accountId}/setoran`)}>
                            <Plus className="mr-2 h-4 w-4" /> Setoran
                        </Button>
                    )
                }
            />

            {/* Progress Card */}
            <Card className={detail.stats.isTargetReached ? "border-green-500" : ""}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Saldo saat ini</p>
                            <p className="text-3xl font-bold">{formatCurrency(detail.balance)}</p>
                        </div>
                        {detail.stats.isTargetReached && (
                            <Badge className="bg-green-500 text-white px-3 py-1">
                                <CheckCircle2 className="mr-1 h-4 w-4" /> Target Tercapai!
                            </Badge>
                        )}
                    </div>
                    {detail.target > 0 && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress ke Target ({formatCurrency(detail.target)})</span>
                                <span className="font-medium">{detail.progress}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-4">
                                <div
                                    className={`h-4 rounded-full transition-all ${
                                        detail.stats.isTargetReached ? "bg-green-500" : detail.progress >= 80 ? "bg-yellow-500" : "bg-primary"
                                    }`}
                                    style={{ width: `${Math.min(100, detail.progress)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Sisa: {formatCurrency(detail.stats.remaining)}</span>
                                {detail.stats.monthsRemaining && (
                                    <span>~{detail.stats.monthsRemaining} bulan lagi</span>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-xs text-muted-foreground">Total Setoran</p>
                                <p className="font-bold">{formatCurrency(detail.stats.totalDeposits)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-xs text-muted-foreground">Setoran Bulan Ini</p>
                                <p className="font-bold">{formatCurrency(detail.stats.monthlyDeposits)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Target className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-xs text-muted-foreground">Target Bulanan</p>
                                <p className="font-bold">{formatCurrency(detail.monthlyTarget)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-xs text-muted-foreground">Jumlah Setoran</p>
                                <p className="font-bold">{detail.stats.depositCount}x</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Riwayat Transaksi */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Riwayat Transaksi</CardTitle>
                </CardHeader>
                <CardContent>
                    {detail.transactions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">Belum ada transaksi</p>
                    ) : (
                        <div className="space-y-3">
                            {detail.transactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                                    <div>
                                        <p className="font-medium">
                                            {tx.type === "deposit" ? "Setoran" : tx.type === "withdrawal" ? "Penarikan" : "Koreksi"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(tx.transactionDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                            {tx.createdBy && ` • oleh ${tx.createdBy.name}`}
                                        </p>
                                        {tx.notes && <p className="text-xs text-muted-foreground mt-1">{tx.notes}</p>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className={`font-medium ${tx.type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                                                {tx.type === "deposit" ? "+" : "-"}{formatCurrency(tx.amount)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Saldo: {formatCurrency(tx.balanceAfter)}</p>
                                        </div>
                                        {tx.type === "deposit" && (
                                            <Button variant="ghost" size="sm" onClick={() => handlePrintKwitansi(tx)}>
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ── Kwitansi print helper ──
function handlePrintKwitansi(tx: {
    transactionNo: string;
    amount: number;
    balanceAfter: number;
    notes: string | null;
    transactionDate: string;
    createdBy: { name: string } | null;
}) {
    // Access detail from closure via DOM or pass as parameter
    // This function is called from inside the component, so it has access to `detail`
    const printContent = `
        <html><head><title>Kwitansi - ${tx.transactionNo}</title>
        <style>
            body { font-family: monospace; max-width: 300px; margin: 0 auto; padding: 10px; font-size: 12px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; }
            td { padding: 2px 0; }
            .right { text-align: right; }
        </style></head><body>
        <div class="center bold">PRIMKOPPOL</div>
        <div class="center">KWITANSI SETORAN</div>
        <div class="center">Tabungan Haji/Umrah</div>
        <div class="line"></div>
        <table>
            <tr><td>No. Transaksi</td><td class="right">${tx.transactionNo}</td></tr>
            <tr><td>Tanggal</td><td class="right">${new Date(tx.transactionDate).toLocaleDateString("id-ID")}</td></tr>
        </table>
        <div class="line"></div>
        <table>
            <tr><td>Jumlah Setoran</td><td class="right bold">Rp ${tx.amount.toLocaleString("id-ID")}</td></tr>
            <tr><td>Saldo Setelah</td><td class="right">Rp ${tx.balanceAfter.toLocaleString("id-ID")}</td></tr>
        </table>
        <div class="line"></div>
        <div class="center">Terima kasih</div>
        <div class="center" style="font-size:10px; margin-top:10px;">${tx.createdBy?.name || ""} • ${new Date().toLocaleDateString("id-ID")}</div>
        </body></html>
    `;
    const win = window.open("", "_blank", "width=400,height=500");
    if (win) {
        win.document.write(printContent);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 300);
    } else {
        alert("Pop-up diblokir. Izinkan pop-up untuk mencetak kwitansi.");
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(protected)/haji-umrah/tabungan/[accountId]/page.tsx"
git commit -m "feat(haji-umrah): add tabungan detail page with progress, stats, and riwayat"
```

---

### Task 5: Setoran Form Page

**Files:**
- Create: `src/app/(protected)/haji-umrah/tabungan/[accountId]/setoran/page.tsx`

- [ ] **Step 1: Create setoran form with admin fee preview**

```typescript
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { Loader2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface CashBankAccount {
    id: number;
    name: string;
    type: string;
    currentBalance: number;
}

interface AccountInfo {
    id: number;
    accountNo: string;
    balance: number;
    target: number;
    progress: number;
    member: { name: string };
    product: { name: string; type: string; adminFeeType: string | null; adminFeeValue: number | null };
}

export default function SetoranPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.accountId as string;

    const [account, setAccount] = React.useState<AccountInfo | null>(null);
    const [cashAccounts, setCashAccounts] = React.useState<CashBankAccount[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);

    const [formData, setFormData] = React.useState({
        amount: "",
        paymentMethod: "cash",
        cashBankAccountId: "",
        referenceNo: "",
        notes: "",
        transactionDate: new Date().toISOString().split("T")[0],
    });

    // Load account info
    React.useEffect(() => {
        async function loadData() {
            try {
                const [accountRes, cbRes] = await Promise.all([
                    fetch(`/api/haji-umrah/savings/${accountId}`),
                    fetch("/api/cash-bank/accounts"),
                ]);
                if (accountRes.ok) {
                    const json = await accountRes.json();
                    setAccount(json.data);
                }
                if (cbRes.ok) {
                    const json = await cbRes.json();
                    setCashAccounts(json.data || []);
                }
            } catch (err) {
                console.error(err);
                toast.error("Gagal memuat data");
            } finally {
                setLoading(false);
            }
        }
        if (accountId) loadData();
    }, [accountId]);

    // Calculate admin fee preview
    const amount = parseFloat(formData.amount) || 0;
    let adminFeePreview = 0;
    if (account?.product.adminFeeType && account.product.adminFeeValue && amount > 0) {
        if (account.product.adminFeeType === "percent") {
            adminFeePreview = Math.round(amount * Number(account.product.adminFeeValue) / 100);
        } else {
            adminFeePreview = Number(account.product.adminFeeValue);
        }
    }

    const totalAfterDeposit = (account?.balance ?? 0) + amount;
    const target = account?.target ?? 0;
    const willReachTarget = target > 0 && totalAfterDeposit >= target;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!amount || amount <= 0) {
            toast.error("Jumlah setoran harus lebih dari 0");
            return;
        }
        if (!formData.cashBankAccountId) {
            toast.error("Pilih akun kas/bank");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/haji-umrah/savings/${accountId}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount,
                    paymentMethod: formData.paymentMethod,
                    cashBankAccountId: parseInt(formData.cashBankAccountId),
                    referenceNo: formData.referenceNo || null,
                    notes: formData.notes || null,
                    transactionDate: formData.transactionDate,
                }),
            });

            if (res.ok) {
                const json = await res.json();
                toast.success(`Setoran berhasil! ${adminFeePreview > 0 ? `Admin fee: ${formatCurrency(json.meta.adminFee)}` : ""}`);
                router.push(`/haji-umrah/tabungan/${accountId}`);
            } else {
                const json = await res.json();
                toast.error(json.message || "Gagal membuat setoran");
            }
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!account) return null;

    const productLabel = account.product.type === "tabungan_haji" ? "Haji" : "Umrah";

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Setoran Tabungan ${productLabel}`}
                description={`${account.member.name} — ${account.accountNo}`}
                backHref={`/haji-umrah/tabungan/${accountId}`}
                backLabel="Detail Rekening"
            />

            <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
                {/* Form */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div>
                                <Label htmlFor="amount">Jumlah Setoran *</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="0"
                                    value={formData.amount}
                                    onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                                    min={0}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Metode Pembayaran</Label>
                                    <Select value={formData.paymentMethod} onValueChange={(v) => setFormData((f) => ({ ...f, paymentMethod: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Tunai</SelectItem>
                                            <SelectItem value="bank_transfer">Transfer Bank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Akun Kas/Bank *</Label>
                                    <Select value={formData.cashBankAccountId} onValueChange={(v) => setFormData((f) => ({ ...f, cashBankAccountId: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
                                        <SelectContent>
                                            {cashAccounts.map((cb) => (
                                                <SelectItem key={cb.id} value={String(cb.id)}>
                                                    {cb.name} ({formatCurrency(cb.currentBalance)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Tanggal Transaksi</Label>
                                    <Input
                                        type="date"
                                        value={formData.transactionDate}
                                        onChange={(e) => setFormData((f) => ({ ...f, transactionDate: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>No. Referensi</Label>
                                    <Input
                                        value={formData.referenceNo}
                                        onChange={(e) => setFormData((f) => ({ ...f, referenceNo: e.target.value }))}
                                        placeholder="Opsional"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Catatan</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                                    placeholder="Opsional"
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Summary Sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Ringkasan</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Saldo Saat Ini</span>
                                <span className="font-medium">{formatCurrency(account.balance)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Setoran</span>
                                <span className="font-medium">+ {formatCurrency(amount)}</span>
                            </div>
                            {adminFeePreview > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Admin Fee ({account.product.adminFeeType === "percent" ? `${account.product.adminFeeValue}%` : "fixed"})</span>
                                    <span className="text-orange-600">{formatCurrency(adminFeePreview)}</span>
                                </div>
                            )}
                            <hr />
                            <div className="flex justify-between">
                                <span className="font-medium">Saldo Setelah</span>
                                <span className="font-bold">{formatCurrency(totalAfterDeposit)}</span>
                            </div>
                            {target > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Target</span>
                                    <span>{formatCurrency(target)}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {willReachTarget && (
                        <Alert className="border-green-500 bg-green-50">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                                🎉 Setoran ini akan mencapai target!
                            </AlertDescription>
                        </Alert>
                    )}

                    <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Proses Setoran
                    </Button>
                </div>
            </form>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(protected)/haji-umrah/tabungan/[accountId]/setoran/page.tsx"
git commit -m "feat(haji-umrah): add setoran form with admin fee preview and target alert"
```

---

### Task 6: Produk CRUD Page

**Files:**
- Create: `src/app/(protected)/haji-umrah/produk/page.tsx`

- [ ] **Step 1: Create produk page with create/edit dialog**

```typescript
"use client";

import React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/constants";
import { Plus, Edit2 } from "lucide-react";
import { toast } from "sonner";

interface Product {
    id: number;
    code: string;
    name: string;
    type: string;
    minimumAmount: number;
    targetAmount: number | null;
    adminFeeType: string | null;
    adminFeeValue: number | null;
    linkedBankName: string | null;
    allowEarlyWithdraw: boolean;
    isActive: boolean;
}

export default function ProdukPage() {
    const [products, setProducts] = React.useState<Product[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<Product | null>(null);
    const [saving, setSaving] = React.useState(false);

    const [form, setForm] = React.useState({
        code: "",
        name: "",
        type: "tabungan_haji",
        minimumAmount: "",
        targetAmount: "",
        adminFeeType: "percent",
        adminFeeValue: "",
        linkedBankName: "BSI",
    });

    const fetchProducts = React.useCallback(async () => {
        try {
            const res = await fetch("/api/haji-umrah/products");
            if (res.ok) {
                const json = await res.json();
                setProducts(json.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchProducts(); }, [fetchProducts]);

    function openCreate() {
        setEditing(null);
        setForm({ code: "", name: "", type: "tabungan_haji", minimumAmount: "100000", targetAmount: "50000000", adminFeeType: "percent", adminFeeValue: "0.5", linkedBankName: "BSI" });
        setDialogOpen(true);
    }

    function openEdit(product: Product) {
        setEditing(product);
        setForm({
            code: product.code,
            name: product.name,
            type: product.type,
            minimumAmount: String(product.minimumAmount),
            targetAmount: String(product.targetAmount ?? ""),
            adminFeeType: product.adminFeeType ?? "percent",
            adminFeeValue: String(product.adminFeeValue ?? ""),
            linkedBankName: product.linkedBankName ?? "BSI",
        });
        setDialogOpen(true);
    }

    async function handleSave() {
        setSaving(true);
        try {
            const payload = {
                code: form.code,
                name: form.name,
                type: form.type,
                minimumAmount: parseFloat(form.minimumAmount) || 0,
                targetAmount: form.targetAmount ? parseFloat(form.targetAmount) : null,
                adminFeeType: form.adminFeeType || null,
                adminFeeValue: form.adminFeeValue ? parseFloat(form.adminFeeValue) : null,
                linkedBankName: form.linkedBankName || null,
            };

            let res: Response;
            if (editing) {
                // UPDATE existing product
                res = await fetch(`/api/haji-umrah/products/${editing.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else {
                // CREATE new product
                res = await fetch("/api/haji-umrah/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            if (res.ok) {
                toast.success("Produk berhasil disimpan");
                setDialogOpen(false);
                fetchProducts();
            } else {
                const json = await res.json();
                toast.error(json.message || "Gagal menyimpan produk");
            }
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Produk Tabungan"
                description="Kelola produk tabungan Haji & Umrah"
                backHref="/haji-umrah"
                backLabel="Dashboard"
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Tambah Produk
                    </Button>
                }
            />

            {/* Product Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                {loading ? (
                    <p>Memuat...</p>
                ) : products.length === 0 ? (
                    <p className="text-muted-foreground col-span-2 text-center py-10">Belum ada produk</p>
                ) : (
                    products.map((product) => (
                        <Card key={product.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">{product.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{product.code}</p>
                                    </div>
                                    <Badge variant={product.type === "tabungan_haji" ? "default" : "secondary"}>
                                        {product.type === "tabungan_haji" ? "Haji" : "Umrah"}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Minimum Setoran</span>
                                    <span>{formatCurrency(product.minimumAmount)}</span>
                                </div>
                                {product.targetAmount && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Target</span>
                                        <span>{formatCurrency(Number(product.targetAmount))}</span>
                                    </div>
                                )}
                                {product.adminFeeValue && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Admin Fee</span>
                                        <span>{product.adminFeeType === "percent" ? `${product.adminFeeValue}%` : formatCurrency(Number(product.adminFeeValue))}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Bank Partner</span>
                                    <span>{product.linkedBankName || "—"}</span>
                                </div>
                                <div className="pt-2">
                                    <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                                        <Edit2 className="mr-1 h-3 w-3" /> Edit
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Kode</Label>
                                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="TH" />
                            </div>
                            <div>
                                <Label>Tipe</Label>
                                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="tabungan_haji">Tabungan Haji</SelectItem>
                                        <SelectItem value="tabungan_umrah">Tabungan Umrah</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Nama Produk</Label>
                            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tabungan Haji" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Minimum Setoran</Label>
                                <Input type="number" value={form.minimumAmount} onChange={(e) => setForm((f) => ({ ...f, minimumAmount: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Target Tabungan</Label>
                                <Input type="number" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} placeholder="Opsional" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Admin Fee Type</Label>
                                <Select value={form.adminFeeType} onValueChange={(v) => setForm((f) => ({ ...f, adminFeeType: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percent">Persen (%)</SelectItem>
                                        <SelectItem value="fixed">Fixed (Rp)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Admin Fee Value</Label>
                                <Input type="number" step="0.01" value={form.adminFeeValue} onChange={(e) => setForm((f) => ({ ...f, adminFeeValue: e.target.value }))} placeholder="0.5" />
                            </div>
                        </div>
                        <div>
                            <Label>Bank Partner</Label>
                            <Input value={form.linkedBankName} onChange={(e) => setForm((f) => ({ ...f, linkedBankName: e.target.value }))} placeholder="BSI" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Menyimpan..." : editing ? "Update" : "Simpan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(protected)/haji-umrah/produk/page.tsx"
git commit -m "feat(haji-umrah): add produk CRUD page with create dialog"
```

---

### Task 7: Laporan Page with Export

**Files:**
- Create: `src/app/(protected)/haji-umrah/laporan/page.tsx`

- [ ] **Step 1: Create laporan page with Excel/PDF export**

```typescript
"use client";

import React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/constants";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

const exportColumns: ExportColumn[] = [
    { header: "No. Rekening", key: "accountNo", width: 18 },
    { header: "Nama Anggota", key: "memberName", width: 25 },
    { header: "NRP", key: "memberNrp", width: 12 },
    { header: "Produk", key: "productName", width: 18 },
    { header: "Saldo", key: "balance", width: 18, format: (v) => formatCurrency(v as number) },
    { header: "Target", key: "target", width: 18, format: (v) => formatCurrency(v as number) },
    { header: "Progress (%)", key: "progress", width: 12 },
    { header: "Target Bulanan", key: "monthlyTarget", width: 15, format: (v) => formatCurrency(v as number) },
    { header: "Tanggal Buka", key: "openedDate", width: 14 },
];

export default function LaporanPage() {
    const [data, setData] = React.useState<Record<string, unknown>[]>([]);
    const [summary, setSummary] = React.useState({ totalAccounts: 0, totalSaldo: 0, totalTarget: 0, globalProgress: 0 });
    const [loading, setLoading] = React.useState(true);
    const [dateFrom, setDateFrom] = React.useState("");
    const [dateTo, setDateTo] = React.useState("");
    const [productType, setProductType] = React.useState("all");

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ type: "rekap" });
            if (dateFrom) params.set("dateFrom", dateFrom);
            if (dateTo) params.set("dateTo", dateTo);
            if (productType !== "all") params.set("productType", productType);

            const res = await fetch(`/api/haji-umrah/reports?${params}`);
            if (res.ok) {
                const json = await res.json();
                setData(json.data);
                setSummary(json.summary);
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat laporan");
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, productType]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    function handleExportExcel() {
        exportToExcel(data, exportColumns, "Laporan_Tabungan_Haji_Umrah", "Tabungan");
    }

    function handleExportPDF() {
        exportToPDF(
            data,
            exportColumns,
            "Laporan Tabungan Haji & Umrah — PRIMKOPPOL",
            "Laporan_Tabungan_Haji_Umrah",
            { subtitle: `Total: ${summary.totalAccounts} rekening | Saldo: ${formatCurrency(summary.totalSaldo)} | Target: ${formatCurrency(summary.totalTarget)}` }
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Laporan Tabungan"
                description="Rekap dan export laporan tabungan Haji & Umrah"
                backHref="/haji-umrah"
                backLabel="Dashboard"
                actions={
                    <>
                        <Button variant="outline" size="sm" onClick={handleExportExcel}>
                            <Download className="mr-2 h-4 w-4" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPDF}>
                            <FileText className="mr-2 h-4 w-4" /> PDF
                        </Button>
                    </>
                }
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-44" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-44" />
                <Select value={productType} onValueChange={setProductType}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Produk</SelectItem>
                        <SelectItem value="tabungan_haji">Tabungan Haji</SelectItem>
                        <SelectItem value="tabungan_umrah">Tabungan Umrah</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Total Rekening</p>
                        <p className="text-xl font-bold">{summary.totalAccounts}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Total Saldo</p>
                        <p className="text-xl font-bold">{formatCurrency(summary.totalSaldo)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Total Target</p>
                        <p className="text-xl font-bold">{formatCurrency(summary.totalTarget)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Progress Global</p>
                        <p className="text-xl font-bold">{summary.globalProgress}%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table Preview */}
            <Card>
                <CardHeader><CardTitle className="text-base">Data Tabungan</CardTitle></CardHeader>
                <CardContent>
                    {loading ? (
                        <p>Memuat data...</p>
                    ) : data.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">Tidak ada data</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        {exportColumns.map((col) => (
                                            <th key={col.key} className="text-left py-2 px-2 font-medium text-muted-foreground">{col.header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row, i) => (
                                        <tr key={i} className="border-b hover:bg-muted/50">
                                            {exportColumns.map((col) => (
                                                <td key={col.key} className="py-2 px-2">
                                                    {col.format
                                                        ? col.format(row[col.key])
                                                        : String(row[col.key] ?? "—")}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(protected)/haji-umrah/laporan/page.tsx"
git commit -m "feat(haji-umrah): add laporan page with export Excel/PDF and summary cards"
```

---

## Self-Review Checklist

- [x] **Spec coverage Section 4.1:** All 7 pages + layout implemented
- [x] **Spec coverage Section 4.3:** Dashboard has 6 stat cards (totalAccounts, totalSaldo, totalTarget, monthlyDeposits, adminFeeRevenue, nearTarget)
- [x] **Spec coverage Section 4.4 #1 (Progress Bar):** Implemented in listing + detail + dashboard
- [x] **Spec coverage Section 4.4 #2 (Setoran Form):** Complete with admin fee preview
- [x] **Spec coverage Section 4.4 #3 (Kwitansi):** Print button on each deposit row in detail page, thermal-style receipt via window.open
- [x] **Spec coverage Section 4.4 #4 (Export):** Excel/PDF via `export-utils.ts` on laporan page
- [x] **Spec coverage Section 4.4 #5 (Notifikasi Target):** Yellow alert banner at ≥90% on dashboard
- [x] **Placeholder scan:** No TBD or TODO — all pages have complete code
- [x] **Pattern consistency:** Uses same imports (`PageHeader`, `DataTable`, `Card`, `Badge`, `formatCurrency`) as existing pages
- [x] **Buka Rekening:** Full dialog with member search, product selection, target auto-fill, monthly target, maturity date
- [x] **Produk CRUD:** Both CREATE (POST) and EDIT (PUT) supported via `handleSave` conditional

## Completion Criteria

After completing this plan:
- [ ] `/haji-umrah` shows dashboard with stat cards
- [ ] `/haji-umrah/tabungan` lists accounts with progress bars
- [ ] `/haji-umrah/tabungan/[id]` shows detail + riwayat
- [ ] `/haji-umrah/tabungan/[id]/setoran` shows setoran form with fee preview
- [ ] `/haji-umrah/produk` shows product cards with create dialog
- [ ] `/haji-umrah/laporan` shows report with export buttons

**Ready for:** `2026-06-10-haji-umrah-4-integration.md`
