"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { memberPortalApi } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import {
    PiggyBank,
    CreditCard,
    Wallet,
    ArrowRight,
    Store,
    BookOpen,
    Car,
    Dumbbell,
    Printer,
    History
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/use-auth";

function getUnitIcon(unitType: string) {
    switch (unitType) {
        case "toko": return <Store className="h-5 w-5" />;
        case "simpan_pinjam": return <BookOpen className="h-5 w-5" />;
        case "fotocopy": return <Printer className="h-5 w-5" />;
        case "cuci_mobil": return <Car className="h-5 w-5" />;
        case "fitness": return <Dumbbell className="h-5 w-5" />;
        default: return <Wallet className="h-5 w-5" />;
    }
}

function getUnitName(unitType: string) {
    const types: Record<string, string> = {
        toko: "Toko Retail",
        simpan_pinjam: "Simpan Pinjam",
        fotocopy: "FotoCopy & ATK",
        cuci_mobil: "Cuci Mobil",
        fitness: "Fitness Center",
    };
    return types[unitType] || unitType;
}

export default function MemberDashboardPage() {
    const { user } = useAuth();

    // Define the type we expect to match the API response
    type SummaryResponse = {
        data: {
            member: any;
            savings: { totalBalance: number; accounts: any[] };
            loans: { totalOutstanding: number; activeCount: number; list: any[] };
            unitTransactions: {
                unpaidTotal: number;
                unpaidCount: number;
                byUnit: { unitType: string; totalAmount: number; count: number }[];
                recent: any[];
            };
        }
    };

    const { data: response, isLoading } = useQuery<SummaryResponse>({
        queryKey: ["member-summary"],
        queryFn: () => memberPortalApi.summary() as Promise<SummaryResponse>,
    });

    const data = response?.data;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Selamat Datang, {user?.name?.split(' ')[0]}!</h1>
                <p className="text-muted-foreground">Ringkasan aktivitas dan layanan koperasi digital Anda hari ini.</p>
            </div>

            {/* Top Stat Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-0 shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium opacity-90">Total Simpanan</CardTitle>
                        <PiggyBank className="h-4 w-4 opacity-75" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : formatCurrency(data?.savings.totalBalance || 0)}
                        </div>
                        <p className="text-xs opacity-80 mt-1">Saldo aktif dari {data?.savings.accounts.length || 0} rekening</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0 shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium opacity-90">Sisa Pinjaman</CardTitle>
                        <CreditCard className="h-4 w-4 opacity-75" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : formatCurrency(data?.loans.totalOutstanding || 0)}
                        </div>
                        <p className="text-xs opacity-80 mt-1">Dari {data?.loans.activeCount || 0} pinjaman aktif</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500 to-red-700 text-white border-0 shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium opacity-90">Tagihan Transaksi Unit</CardTitle>
                        <Wallet className="h-4 w-4 opacity-75" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : formatCurrency(data?.unitTransactions.unpaidTotal || 0)}
                        </div>
                        <p className="text-xs opacity-80 mt-1">{data?.unitTransactions.unpaidCount || 0} transaksi belum lunas</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Riwayat Transaksi Terbaru */}
                <Card className="md:col-span-2 lg:col-span-4 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Transaksi Unit Terbaru</CardTitle>
                            <CardDescription>Aktivitas Anda di berbagai unit layanan Koperasi</CardDescription>
                        </div>
                        <Link href="/portal/transaksi" className="text-sm text-primary hover:underline flex items-center gap-1 font-medium">
                            Lihat Semua <ArrowRight className="h-4 w-4" />
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-full max-w-[200px]" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : data?.unitTransactions.recent.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 rounded-xl border border-dashed">
                                <History className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
                                <p className="text-sm font-medium text-muted-foreground">Belum ada transaksi</p>
                                <p className="text-xs text-muted-foreground mt-1">Anda belum melakukan transaksi di unit manapun.</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {data?.unitTransactions.recent.slice(0, 5).map((tx: any) => (
                                    <div key={tx.id} className="flex items-start justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                        <div className="flex gap-3">
                                            <div className="mt-1 h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                {getUnitIcon(tx.unitType)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm line-clamp-1">{tx.description}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[10px] h-5 bg-slate-50 uppercase tracking-wider">{getUnitName(tx.unitType)}</Badge>
                                                    <span className="text-xs text-muted-foreground">{format(new Date(tx.transactionDate), "d MMM yyyy", { locale: id })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-sm">{formatCurrency(tx.amount)}</div>
                                            {!tx.isPaid ? (
                                                <span className="text-[10px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">BELUM LUNAS</span>
                                            ) : (
                                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">LUNAS</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Penggunaan per Unit */}
                <Card className="md:col-span-1 lg:col-span-3 shadow-sm bg-slate-50 border-0 ring-1 ring-slate-200">
                    <CardHeader>
                        <CardTitle>Ringkasan Per Unit</CardTitle>
                        <CardDescription>Total transaksi Anda per unit layanan</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex gap-3 items-center">
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-full" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : data?.unitTransactions.byUnit.length === 0 ? (
                            <p className="text-sm text-center text-muted-foreground py-8">Tidak ada data ringkasan</p>
                        ) : (
                            <div className="space-y-4">
                                {data?.unitTransactions.byUnit.map((stats: any) => (
                                    <div key={stats.unitType} className="flex items-center p-3 bg-white rounded-lg border shadow-sm">
                                        <div className="h-10 w-10 text-slate-500 bg-slate-100 rounded-md flex items-center justify-center mr-3">
                                            {getUnitIcon(stats.unitType)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-sm font-semibold">{getUnitName(stats.unitType)}</p>
                                                <p className="text-sm font-bold text-primary">{formatCurrency(stats.totalAmount)}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{stats.count} Transaksi</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
