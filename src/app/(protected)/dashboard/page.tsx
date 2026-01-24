import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Users,
    Wallet,
    CreditCard,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    CheckSquare,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/constants";

// Stats Card Component
function StatsCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    trendLabel,
    color = "primary",
}: {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ElementType;
    trend?: number;
    trendLabel?: string;
    color?: "primary" | "success" | "warning" | "danger";
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
                        <p className="text-2xl font-bold tabular-nums">{value}</p>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                        )}
                        {trend !== undefined && (
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
    // Mock data - in production, this would come from API
    const stats = {
        totalAnggota: 1250,
        totalSimpanan: 2500000000,
        totalPinjaman: 1800000000,
        tunggakan: 45000000,
        simpananHariIni: 15000000,
        pencairanHariIni: 50000000,
        angsuranHariIni: 25000000,
        pendingApproval: 5,
    };

    const pendingApprovals = [
        { type: "Pinjaman", title: "Budi Santoso - Pinjaman Reguler", amount: 10000000, date: "24 Jan 2025" },
        { type: "Koreksi", title: "Koreksi Simpanan - Siti Aminah", amount: 500000, date: "24 Jan 2025" },
        { type: "Pinjaman", title: "Joko Widodo - Pinjaman Reguler", amount: 25000000, date: "23 Jan 2025" },
    ];

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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Anggota"
                    value={stats.totalAnggota.toLocaleString("id-ID")}
                    subtitle="anggota aktif"
                    icon={Users}
                    trend={5.2}
                    trendLabel="vs bulan lalu"
                    color="primary"
                />
                <StatsCard
                    title="Total Simpanan"
                    value={formatCurrency(stats.totalSimpanan)}
                    icon={Wallet}
                    trend={8.1}
                    trendLabel="vs bulan lalu"
                    color="success"
                />
                <StatsCard
                    title="Total Pinjaman Aktif"
                    value={formatCurrency(stats.totalPinjaman)}
                    icon={CreditCard}
                    trend={3.4}
                    trendLabel="vs bulan lalu"
                    color="primary"
                />
                <StatsCard
                    title="Tunggakan"
                    value={formatCurrency(stats.tunggakan)}
                    subtitle="perlu perhatian"
                    icon={AlertCircle}
                    color="danger"
                />
            </div>

            {/* Today's Activity */}
            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Simpanan Hari Ini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-emerald-600">
                            {formatCurrency(stats.simpananHariIni)}
                        </p>
                        <p className="text-sm text-muted-foreground">12 transaksi</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Pencairan Hari Ini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(stats.pencairanHariIni)}
                        </p>
                        <p className="text-sm text-muted-foreground">3 pencairan</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Angsuran Hari Ini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-amber-600">
                            {formatCurrency(stats.angsuranHariIni)}
                        </p>
                        <p className="text-sm text-muted-foreground">8 pembayaran</p>
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
                            <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                                {stats.pendingApproval}
                            </span>
                        </CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/approval">Lihat Semua</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {pendingApprovals.length > 0 ? (
                            <div className="space-y-1">
                                {pendingApprovals.map((item, index) => (
                                    <ApprovalItem key={index} {...item} />
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
