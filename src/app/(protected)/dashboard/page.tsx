"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Users,
    Wallet,
    CreditCard,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    CheckSquare,
    Award,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/constants";
import { membersApi, loansApi, approvalsApi } from "@/lib/api";

interface DashboardStats {
    totalAnggota: number;
    totalSimpanan: number;
    totalPinjaman: number;
    tunggakan: number;
    simpananHariIni: number;
    simpananHariIniCount: number;
    pencairanHariIni: number;
    pencairanHariIniCount: number;
    angsuranHariIni: number;
    angsuranHariIniCount: number;
    pendingApproval: number;
    totalTunkin: number;
    membersWithTunkin: number;
}

interface PendingApproval {
    id: number;
    type: string;
    title: string;
    amount: number;
    date: string;
}

// Stats Card Component
function StatsCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    trendLabel,
    color = "primary",
    isLoading = false,
}: {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ElementType;
    trend?: number;
    trendLabel?: string;
    color?: "primary" | "success" | "warning" | "danger";
    isLoading?: boolean;
}) {
    const colorClasses = {
        primary: "bg-primary/10 text-primary",
        success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
        warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
        danger: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    };

    return (
        <Card className="stats-card">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        {isLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <p className="text-2xl font-bold tabular-nums">{value}</p>
                        )}
                        {subtitle && (
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                        )}
                        {trend !== undefined && !isLoading && (
                            <div className="flex items-center gap-1 text-xs">
                                {trend >= 0 ? (
                                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                                ) : (
                                    <TrendingDown className="h-3 w-3 text-red-500" />
                                )}
                                <span
                                    className={trend >= 0 ? "text-emerald-600" : "text-red-600"}
                                >
                                    {trend >= 0 ? "+" : ""}
                                    {trend}%
                                </span>
                                {trendLabel && (
                                    <span className="text-muted-foreground">{trendLabel}</span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Quick Action Card
function QuickActionCard({
    title,
    description,
    href,
    icon: Icon,
}: {
    title: string;
    description: string;
    href: string;
    icon: React.ElementType;
}) {
    return (
        <Link href={href}>
            <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
                <CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <p className="font-medium">{title}</p>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardContent>
            </Card>
        </Link>
    );
}

// Pending Approval Item
function ApprovalItem({
    type,
    title,
    amount,
    date,
}: {
    type: string;
    title: string;
    amount: number;
    date: string;
}) {
    return (
        <div className="flex items-center justify-between border-b py-3 last:border-0">
            <div className="space-y-1">
                <p className="text-sm font-medium">{title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{type}</span>
                    <span>{date}</span>
                </div>
            </div>
            <div className="text-right">
                <p className="font-medium tabular-nums">{formatCurrency(amount)}</p>
                <div className="flex gap-1 mt-1">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                        Tolak
                    </Button>
                    <Button size="sm" className="h-7 px-2 text-xs">
                        Setuju
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalAnggota: 0,
        totalSimpanan: 0,
        totalPinjaman: 0,
        tunggakan: 0,
        simpananHariIni: 0,
        simpananHariIniCount: 0,
        pencairanHariIni: 0,
        pencairanHariIniCount: 0,
        angsuranHariIni: 0,
        angsuranHariIniCount: 0,
        pendingApproval: 0,
        totalTunkin: 0,
        membersWithTunkin: 0,
    });
    const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);

    useEffect(() => {
        async function fetchDashboardData() {
            try {
                setIsLoading(true);

                // Fetch data in parallel - now including dashboard stats
                const [statsRes, approvalsRes] = await Promise.allSettled([
                    fetch("/api/dashboard-stats").then((res) => res.json()),
                    approvalsApi.list("pending"),
                ]);

                // Process dashboard stats from new API
                if (statsRes.status === "fulfilled" && statsRes.value.data) {
                    const data = statsRes.value.data;
                    setStats({
                        totalAnggota: data.totalMembers || 0,
                        totalSimpanan: data.totalSavings || 0,
                        totalPinjaman: data.totalLoansOutstanding || 0,
                        tunggakan: data.totalArrears || 0,
                        simpananHariIni: data.todayDeposits || 0,
                        simpananHariIniCount: data.todayDepositsCount || 0,
                        pencairanHariIni: data.todayWithdrawals || 0,
                        pencairanHariIniCount: data.todayWithdrawalsCount || 0,
                        angsuranHariIni: data.todayPayments || 0,
                        angsuranHariIniCount: data.todayPaymentsCount || 0,
                        pendingApproval: data.pendingApprovals || 0,
                        totalTunkin: data.totalTunkin || 0,
                        membersWithTunkin: data.membersWithTunkin || 0,
                    });
                }

                // Process pending approvals
                let approvals: PendingApproval[] = [];
                if (approvalsRes.status === "fulfilled") {
                    const data = approvalsRes.value.data as any[];
                    approvals = data.slice(0, 3).map((item: any) => ({
                        id: item.id,
                        type: item.type === "loan_application" ? "Pinjaman" : "Lainnya",
                        title: item.title || item.description,
                        amount: item.amount || 0,
                        date: item.submittedAt
                            ? new Date(item.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                            : "-",
                    }));
                }

                setPendingApprovals(approvals);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchDashboardData();
    }, []);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">
                    Selamat datang kembali! Berikut ringkasan aktivitas koperasi.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatsCard
                    title="Total Anggota"
                    value={stats.totalAnggota.toLocaleString("id-ID")}
                    subtitle="anggota aktif"
                    icon={Users}
                    trend={5.2}
                    trendLabel="vs bulan lalu"
                    color="primary"
                    isLoading={isLoading}
                />
                <StatsCard
                    title="Total Simpanan"
                    value={formatCurrency(stats.totalSimpanan)}
                    icon={Wallet}
                    trend={8.1}
                    trendLabel="vs bulan lalu"
                    color="success"
                    isLoading={isLoading}
                />
                <StatsCard
                    title="Total Pinjaman Aktif"
                    value={formatCurrency(stats.totalPinjaman)}
                    icon={CreditCard}
                    trend={3.4}
                    trendLabel="vs bulan lalu"
                    color="primary"
                    isLoading={isLoading}
                />
                <StatsCard
                    title="Total Tunkin"
                    value={formatCurrency(stats.totalTunkin)}
                    subtitle={`${stats.membersWithTunkin} anggota`}
                    icon={Award}
                    color="primary"
                    isLoading={isLoading}
                />
                <StatsCard
                    title="Tunggakan"
                    value={formatCurrency(stats.tunggakan)}
                    subtitle="perlu perhatian"
                    icon={AlertCircle}
                    color="danger"
                    isLoading={isLoading}
                />
            </div>

            {/* Today's Activity */}
            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Simpanan Hari Ini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <p className="text-2xl font-bold text-emerald-600">
                                {formatCurrency(stats.simpananHariIni)}
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground">{stats.simpananHariIniCount} transaksi</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Pencairan Hari Ini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <p className="text-2xl font-bold text-blue-600">
                                {formatCurrency(stats.pencairanHariIni)}
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground">{stats.pencairanHariIniCount} pencairan</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Angsuran Hari Ini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <p className="text-2xl font-bold text-amber-600">
                                {formatCurrency(stats.angsuranHariIni)}
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground">{stats.angsuranHariIniCount} pembayaran</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Aksi Cepat</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <QuickActionCard
                            title="Tambah Anggota Baru"
                            description="Daftarkan anggota baru ke sistem"
                            href="/anggota/tambah"
                            icon={Users}
                        />
                        <QuickActionCard
                            title="Transaksi Simpanan"
                            description="Catat setoran atau penarikan"
                            href="/simpanan/transaksi/tambah"
                            icon={Wallet}
                        />
                        <QuickActionCard
                            title="Input Angsuran"
                            description="Catat pembayaran angsuran"
                            href="/pinjaman/angsuran/bayar"
                            icon={CreditCard}
                        />
                    </CardContent>
                </Card>

                {/* Pending Approvals */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <CheckSquare className="h-5 w-5" />
                            Menunggu Persetujuan
                            {stats.pendingApproval > 0 && (
                                <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                                    {stats.pendingApproval}
                                </span>
                            )}
                        </CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/approval">Lihat Semua</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ) : pendingApprovals.length > 0 ? (
                            <div className="space-y-1">
                                {pendingApprovals.map((item) => (
                                    <ApprovalItem key={item.id} {...item} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">
                                Tidak ada yang perlu disetujui
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
