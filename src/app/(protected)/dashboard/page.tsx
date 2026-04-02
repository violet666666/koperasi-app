"use client";

import React, { useEffect, useState } from "react";
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
import { InfoCardWrapper } from "@/components/patterns/info-card-wrapper";
import { CashFlowChart } from "@/components/patterns/cash-flow-chart";
import { ApprovalDialog, ApprovalItem as FullApprovalItem } from "@/components/patterns/approval-dialog";

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
    href,
}: {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ElementType;
    trend?: number;
    trendLabel?: string;
    color?: "primary" | "success" | "warning" | "danger";
    isLoading?: boolean;
    href?: string;
}) {
    const colorClasses = {
        primary: "bg-primary/10 text-primary",
        success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
        warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
        danger: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    };

    const content = (
        <Card className={`stats-card ${href && !isLoading ? 'hover:shadow-md hover:border-primary/50 cursor-pointer transition-all' : ''}`}>
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
                                <span className={trend >= 0 ? "text-emerald-600" : "text-red-600"}>
                                    {trend >= 0 ? "+" : ""}
                                    {trend}%
                                </span>
                                {trendLabel && (
                                    <span className="text-muted-foreground">{trendLabel}</span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className={`rounded-lg p-3 ${colorClasses[color || "primary"]}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (href && !isLoading) {
        return <Link href={href}>{content}</Link>;
    }
    
    return content;
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

// Local Approval Item Component for Dashboard
function DashboardApprovalCard({ item, onClick }: { item: FullApprovalItem, onClick: () => void }) {
    const isLoan = item.requestType === "loan_application";
    return (
        <div 
            onClick={onClick}
            className="flex items-center justify-between border-b py-3 last:border-0 cursor-pointer hover:bg-muted/50 px-2 rounded-md transition-colors"
        >
            <div className="space-y-1">
                <p className="text-sm font-medium">{item.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5 border">{isLoan ? "Pinjaman" : "Lainnya"}</span>
                    <span>{new Date(item.requestedAt || new Date()).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
            </div>
            <div className="text-right flex items-center gap-3">
                <p className="font-medium tabular-nums">{formatCurrency(item.amount || 0)}</p>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs ml-2 text-primary hidden md:inline-flex rounded-full bg-primary/10 hover:bg-primary/20">
                    Buka Rincian <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
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
    const [pendingApprovals, setPendingApprovals] = useState<FullApprovalItem[]>([]);
    
    // Approval Dialog State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState<FullApprovalItem | null>(null);

    const fetchDashboardData = React.useCallback(async () => {
        try {
            setIsLoading(true);

            // Fetch data in parallel
            const [statsRes, approvalsRes] = await Promise.allSettled([
                fetch("/api/dashboard-stats").then((res) => res.json()),
                approvalsApi.list("pending"),
            ]);

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

            let approvals: FullApprovalItem[] = [];
            if (approvalsRes.status === "fulfilled") {
                const resData = approvalsRes.value.data as any;
                approvals = Array.isArray(resData?.data) ? resData.data : (Array.isArray(resData) ? resData : []);
            }

            setPendingApprovals(approvals);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

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
                <InfoCardWrapper
                    tooltip="Jumlah seluruh anggota aktif terdaftar di PRIMKOPPOL Resor Lumajang."
                    detailTitle="Total Anggota"
                    detailDescription={"Menampilkan jumlah anggota yang terdaftar dengan status aktif di dalam sistem.\n\nAnggota baru dapat didaftarkan melalui menu Anggota → Tambah Anggota, atau melalui fitur Import Data.\n\nAnggota yang sudah tidak aktif (resign, pensiun) tidak dihitung dalam angka ini."}
                >
                    <StatsCard
                        title="Total Anggota"
                        value={stats.totalAnggota.toLocaleString("id-ID")}
                        subtitle="anggota aktif"
                        icon={Users}
                        color="primary"
                        isLoading={isLoading}
                        href="/anggota"
                    />
                </InfoCardWrapper>
                <InfoCardWrapper
                    tooltip="Akumulasi seluruh simpanan anggota (Pokok + Wajib + Sukarela)."
                    detailTitle="Total Simpanan"
                    detailDescription={"Menampilkan total seluruh dana simpanan anggota yang tersimpan di PRIMKOPPOL, meliputi:\n\n• Simpanan Pokok — Dibayar sekali saat pendaftaran\n• Simpanan Wajib (Tabungan Wajib) — Dibayar rutin setiap bulan melalui potongan gaji\n• Simpanan Sukarela — Setoran bebas oleh anggota\n\nSemakin tinggi simpanan, semakin besar porsi SHU yang diterima anggota di akhir tahun."}
                >
                    <StatsCard
                        title="Total Simpanan"
                        value={formatCurrency(stats.totalSimpanan)}
                        icon={Wallet}
                        color="success"
                        isLoading={isLoading}
                        href="/simpanan/rekap"
                    />
                </InfoCardWrapper>
                <InfoCardWrapper
                    tooltip="Total sisa kewajiban pinjaman anggota yang masih berjalan."
                    detailTitle="Total Pinjaman Aktif"
                    detailDescription={"Menampilkan total sisa pokok pinjaman seluruh anggota yang statusnya masih 'Aktif' (belum lunas).\n\nAngka ini mencerminkan piutang PRIMKOPPOL kepada anggota. Setiap bulan, angka ini akan berkurang seiring pembayaran angsuran oleh anggota.\n\nJika anggota melakukan Bayar Sendiri (BS / pelunasan sebagian ekstra), angka ini akan turun lebih cepat."}
                >
                    <StatsCard
                        title="Total Pinjaman Aktif"
                        value={formatCurrency(stats.totalPinjaman)}
                        icon={CreditCard}
                        color="primary"
                        isLoading={isLoading}
                        href="/laporan/rekap-pinjaman"
                    />
                </InfoCardWrapper>
                <InfoCardWrapper
                    tooltip="Total Tunjangan Kinerja (Tunkin) seluruh anggota yang tercatat."
                    detailTitle="Total Tunkin"
                    detailDescription={"Menampilkan total Tunjangan Kinerja (Tunkin) seluruh anggota yang sudah didata.\n\nTunkin digunakan sebagai salah satu sumber pemotongan angsuran pinjaman, selain gaji pokok. Anggota dapat memilih sumber pemotongan saat mengajukan pinjaman sesuai ketentuan AD-ART 2026."}
                >
                    <StatsCard
                        title="Total Tunkin"
                        value={formatCurrency(stats.totalTunkin)}
                        subtitle={`${stats.membersWithTunkin} anggota`}
                        icon={Award}
                        color="primary"
                        isLoading={isLoading}
                    />
                </InfoCardWrapper>
                <InfoCardWrapper
                    tooltip="Total tunggakan angsuran yang sudah jatuh tempo dan belum dibayar."
                    detailTitle="Tunggakan"
                    detailDescription={"Menampilkan total angsuran pinjaman yang sudah melewati tanggal jatuh tempo namun belum dilunasi.\n\nTunggakan perlu diperhatikan karena memengaruhi kesehatan keuangan PRIMKOPPOL. Anggota yang menunggak sebaiknya segera dihubungi untuk menyelesaikan kewajiban.\n\nAngka Rp 0 berarti seluruh anggota membayar tepat waktu."}
                >
                    <StatsCard
                        title="Tunggakan"
                        value={formatCurrency(stats.tunggakan)}
                        subtitle="perlu perhatian"
                        icon={AlertCircle}
                        color="danger"
                        isLoading={isLoading}
                        href="/pinjaman/jadwal"
                    />
                </InfoCardWrapper>
            </div>

            {/* Today's Activity */}
            <div className="grid gap-4 lg:grid-cols-3">
                <InfoCardWrapper
                    tooltip="Total setoran simpanan yang masuk hari ini."
                    detailTitle="Simpanan Hari Ini"
                    detailDescription={"Menampilkan total dana simpanan (setoran) yang masuk pada hari ini.\n\nTermasuk setoran Simpanan Pokok, Wajib, maupun Sukarela dari seluruh anggota yang bertransaksi hari ini.\n\nUntuk melihat rincian transaksi, buka menu Simpanan → Transaksi."}
                >
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
                </InfoCardWrapper>
                <InfoCardWrapper
                    tooltip="Total pencairan pinjaman yang dikeluarkan hari ini."
                    detailTitle="Pencairan Hari Ini"
                    detailDescription={"Menampilkan total dana pinjaman yang telah dicairkan kepada anggota pada hari ini.\n\nPencairan terjadi setelah pengajuan pinjaman disetujui dan dana diberikan kepada peminjam. Angka ini mencerminkan arus kas keluar PRIMKOPPOL hari ini."}
                >
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
                </InfoCardWrapper>
                <InfoCardWrapper
                    tooltip="Total pembayaran angsuran pinjaman yang diterima hari ini."
                    detailTitle="Angsuran Hari Ini"
                    detailDescription={"Menampilkan total pembayaran angsuran pinjaman yang diterima dari anggota pada hari ini.\n\nTermasuk pembayaran angsuran rutin maupun Bayar Sendiri (BS) / pembayaran ekstra pokok.\n\nUntuk mencatat pembayaran angsuran, buka menu Pinjaman → Bayar Angsuran."}
                >
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
                </InfoCardWrapper>
            </div>

            {/* Cash Flow Chart */}
            <div className="grid grid-cols-1">
                <CashFlowChart />
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
                                {pendingApprovals.slice(0, 4).map((item) => (
                                    <DashboardApprovalCard 
                                        key={item.id} 
                                        item={item} 
                                        onClick={() => {
                                            setSelectedApproval(item);
                                            setDialogOpen(true);
                                        }} 
                                    />
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
            
            {/* Direct Approval Modal */}
            <ApprovalDialog 
                open={dialogOpen} 
                onOpenChange={setDialogOpen} 
                approval={selectedApproval} 
                onSuccess={fetchDashboardData} 
            />
        </div>
    );
}
