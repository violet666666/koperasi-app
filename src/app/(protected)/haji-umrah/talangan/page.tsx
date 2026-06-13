"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/constants";
import { HandCoins, TrendingUp, AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface GapAccount {
    accountId: number;
    accountNo: string;
    memberName: string;
    memberNrp: string | null;
    productType: string;
    productName: string;
    balance: number;
    targetAmount: number;
    gap: number;
    progress: number;
    hasActiveTalangan: boolean;
    activeTalanganId: number | null;
    activeTalanganOutstanding: number | null;
    status: string;
}

interface TalanganStats {
    totalActive: number;
    totalOutstanding: number;
    paidThisMonth: number;
    gapDetected: number;
    totalPaidOff: number;
}

export default function TalanganListPage() {
    const router = useRouter();
    const [accounts, setAccounts] = React.useState<GapAccount[]>([]);
    const [stats, setStats] = React.useState<TalanganStats | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [tab, setTab] = React.useState("all");
    const [searchQuery, setSearchQuery] = React.useState("");

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const onlyWithGap = tab === "needs_talangan" ? "true" : "false";
            const productType = tab === "haji" ? "tabungan_haji" : tab === "umrah" ? "tabungan_umrah" : "";
            const params = new URLSearchParams({
                onlyWithGap,
                ...(productType && { productType }),
            });
            const res = await fetch(`/api/haji-umrah/talangan/gap?${params}`);
            if (res.ok) {
                const json = await res.json();
                let data = json.data as GapAccount[];
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    data = data.filter(
                        (a) => a.memberName.toLowerCase().includes(q) || (a.memberNrp && a.memberNrp.toLowerCase().includes(q))
                    );
                }
                setAccounts(data);
                setStats({
                    totalActive: json.summary.coveredByTalangan,
                    totalOutstanding: 0,
                    paidThisMonth: 0,
                    gapDetected: json.summary.withGap,
                    totalPaidOff: 0,
                });
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat data talangan");
        } finally {
            setLoading(false);
        }
    }, [tab, searchQuery]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    // Also fetch talangan stats from the main endpoint
    React.useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch("/api/haji-umrah/talangan");
                if (res.ok) {
                    const json = await res.json();
                    setStats(json.stats);
                }
            } catch { /* ignore */ }
        }
        fetchStats();
    }, []);

    const statusBadge = (status: string) => {
        switch (status) {
            case "needs_talangan": return <Badge variant="destructive" className="text-xs">Perlu Talangan</Badge>;
            case "has_talangan": return <Badge className="bg-blue-100 text-blue-800 text-xs">Ada Talangan</Badge>;
            case "target_reached": return <Badge className="bg-green-100 text-green-800 text-xs">Target Tercapai</Badge>;
            default: return <Badge variant="secondary" className="text-xs">Tanpa Target</Badge>;
        }
    };

    const columns: ColumnDef<GapAccount>[] = React.useMemo(() => [
        {
            accessorKey: "accountNo",
            header: "No. Rekening",
            cell: ({ row }) => (
                <span className="font-mono text-sm">{row.original.accountNo}</span>
            ),
        },
        {
            accessorKey: "memberName",
            header: "Anggota",
            cell: ({ row }) => (
                <div>
                    <p className="font-medium">{row.original.memberName}</p>
                    {row.original.memberNrp && <p className="text-xs text-muted-foreground">{row.original.memberNrp}</p>}
                </div>
            ),
        },
        {
            accessorKey: "productType",
            header: "Jenis",
            cell: ({ row }) => (
                <Badge variant="outline" className="text-xs">
                    {row.original.productType === "tabungan_haji" ? "Haji" : "Umrah"}
                </Badge>
            ),
        },
        {
            accessorKey: "balance",
            header: "Saldo",
            cell: ({ row }) => formatCurrency(row.original.balance),
        },
        {
            accessorKey: "targetAmount",
            header: "Target",
            cell: ({ row }) => formatCurrency(row.original.targetAmount),
        },
        {
            accessorKey: "gap",
            header: "Gap",
            cell: ({ row }) => (
                <span className={row.original.gap > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                    {formatCurrency(row.original.gap)}
                </span>
            ),
        },
        {
            id: "progress",
            header: "Progress",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-20 bg-muted rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${Math.min(100, row.original.progress)}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium">{row.original.progress}%</span>
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => statusBadge(row.original.status),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => {
                if (row.original.status === "needs_talangan") {
                    return (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/haji-umrah/talangan/apply?savingsAccountId=${row.original.accountId}`)}
                        >
                            <HandCoins className="mr-1 h-3 w-3" /> Ajukan
                        </Button>
                    );
                }
                if (row.original.activeTalanganId) {
                    return (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/haji-umrah/talangan/${row.original.activeTalanganId}`)}
                        >
                            Lihat
                        </Button>
                    );
                }
                return null;
            },
        },
    ], [router]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Talangan Haji & Umrah"
                description="Kelola talangan gap financing untuk tabungan haji & umrah anggota"
                actions={
                    <Button onClick={() => router.push("/haji-umrah/talangan/apply")}>
                        <HandCoins className="mr-2 h-4 w-4" /> Buat Talangan
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-2.5">
                            <HandCoins className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Talangan Aktif</p>
                            <p className="text-lg font-bold">{stats?.totalActive ?? 0}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-orange-100 p-2.5">
                            <TrendingUp className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Outstanding</p>
                            <p className="text-lg font-bold">{formatCurrency(stats?.totalOutstanding ?? 0)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-2.5">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Gap Terdeteksi</p>
                            <p className="text-lg font-bold">{stats?.gapDetected ?? 0}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-green-100 p-2.5">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Talangan Lunas</p>
                            <p className="text-lg font-bold">{stats?.totalPaidOff ?? 0}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari anggota..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Tabs value={tab} onValueChange={setTab}>
                    <TabsList>
                        <TabsTrigger value="all">Semua</TabsTrigger>
                        <TabsTrigger value="needs_talangan">Perlu Talangan</TabsTrigger>
                        <TabsTrigger value="haji">Haji</TabsTrigger>
                        <TabsTrigger value="umrah">Umrah</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={accounts}
                loading={loading}
            />
        </div>
    );
}
