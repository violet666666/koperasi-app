"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import { formatCurrency } from "@/lib/constants";
import { Wallet, Users, TrendingUp, Target, Clock, ArrowRight, Banknote, HandCoins } from "lucide-react";

interface TalanganSummary {
    totalActive: number;
    totalOutstanding: number;
    gapDetected: number;
    totalPaidOff: number;
}

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
    const [talanganSummary, setTalanganSummary] = React.useState<TalanganSummary | null>(null);
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

    // Fetch talangan summary
    React.useEffect(() => {
        async function loadTalangan() {
            try {
                const res = await fetch("/api/haji-umrah/talangan");
                if (res.ok) {
                    const json = await res.json();
                    setTalanganSummary(json.stats);
                }
            } catch { /* ignore */ }
        }
        loadTalangan();
    }, []);

    const statCards = [
        { title: "Total Rekening Aktif", value: stats?.totalAccounts ?? 0, icon: Users, format: "number" as const },
        { title: "Total Saldo", value: stats?.totalSaldo ?? 0, icon: Wallet, format: "currency" as const },
        { title: "Target Keseluruhan", value: stats?.totalTarget ?? 0, icon: Target, format: "currency" as const },
        { title: "Setoran Bulan Ini", value: stats?.monthlyDeposits ?? 0, icon: TrendingUp, format: "currency" as const },
        { title: "Admin Fee Bulan Ini", value: stats?.adminFeeRevenue ?? 0, icon: Banknote, format: "currency" as const },
        { title: "Mendekati Target (≥80%)", value: stats?.nearTarget ?? 0, icon: Clock, format: "number" as const },
        { title: "Talangan Aktif", value: talanganSummary?.totalActive ?? 0, icon: HandCoins, format: "number" as const },
        { title: "Gap Terdeteksi", value: talanganSummary?.gapDetected ?? 0, icon: Target, format: "number" as const },
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
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-8">
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
                <div className="border border-yellow-500 bg-yellow-50 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-yellow-600 text-lg">⚠️</span>
                    <div>
                        <span className="font-medium text-yellow-800">{stats.nearTargetAccounts.filter(a => a.progress >= 90).length} rekening</span>
                        <span className="text-yellow-700"> sudah mendekati target (≥90%). Segera koordinasi dengan BSI untuk proses selanjutnya.</span>
                    </div>
                </div>
            )}

            {/* Near Target Accounts */}
            {stats?.nearTargetAccounts && stats.nearTargetAccounts.length > 0 && (
                <Card>
                    <div className="p-4 pb-2">
                        <h3 className="text-base font-semibold">Mendekati Target</h3>
                    </div>
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
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push("/haji-umrah/talangan")}>
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <HandCoins className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-medium">Talangan</p>
                                <p className="text-sm text-muted-foreground">Gap financing haji/umrah</p>
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
