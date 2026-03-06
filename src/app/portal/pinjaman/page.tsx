"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { memberPortalApi } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function PinjamanPortalPage() {
    type SummaryResponse = {
        data: {
            loans: { totalOutstanding: number; activeCount: number; list: any[] };
        }
    };

    const { data: response, isLoading } = useQuery<SummaryResponse>({
        queryKey: ["member-summary"],
        queryFn: () => memberPortalApi.summary() as Promise<SummaryResponse>,
    });

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Status Pinjaman</h1>
                <p className="text-muted-foreground">Monitor plafond, sisa hutang, dan jadwal angsuran Anda.</p>
            </div>

            <Card className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white border-0 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <CreditCard className="w-32 h-32" />
                </div>
                <CardContent className="p-8 relative z-10">
                    <p className="text-blue-200 font-medium mb-1">Total Sisa Pinjaman Aktif</p>
                    <div className="text-4xl md:text-5xl font-bold tracking-tight">
                        {isLoading ? <Skeleton className="h-12 w-64 bg-white/20" /> : formatCurrency(response?.data?.loans?.totalOutstanding || 0)}
                    </div>
                    {!isLoading && (response?.data?.loans?.activeCount ?? 0) > 0 && (
                        <p className="mt-2 text-sm text-blue-100 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> Ada {response?.data?.loans?.activeCount} fasilitas pinjaman yang sedang berjalan
                        </p>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-4 mt-8">
                <h2 className="text-lg font-semibold px-1">Daftar Pinjaman</h2>

                {isLoading ? (
                    [1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)
                ) : response?.data.loans.list.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50 text-muted-foreground">
                        <CreditCard className="mx-auto h-12 w-12 opacity-20 mb-4" />
                        <p className="font-medium">Tidak ada fasilitas pinjaman</p>
                    </div>
                ) : response?.data.loans.list.map((loan: any) => {
                    const totalSisa = loan.principalOutstanding + loan.interestOutstanding;
                    const persentaseBayar = Math.min(100, Math.max(0, 100 - (totalSisa / loan.principalAmount) * 100));

                    return (
                        <Card key={loan.id} className="border shadow-sm overflow-hidden">
                            <div className={`h-1.5 w-full ${loan.status === 'active' ? 'bg-blue-500' : loan.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-lg">Pinjaman #{loan.loanNo}</h3>
                                                    <Badge variant={loan.status === 'active' ? 'default' : 'secondary'} className={loan.status === 'active' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100 uppercase' : 'uppercase'}>
                                                        {loan.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">Plafond: <span className="font-semibold text-slate-800">{formatCurrency(loan.principalAmount)}</span></p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-lg border flex flex-col sm:flex-row justify-between gap-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1">Angsuran per Bulan</p>
                                                <p className="font-bold text-primary">{formatCurrency(loan.monthlyInstallment)}</p>
                                            </div>
                                            <div className="hidden sm:block w-px bg-slate-200"></div>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1">Sisa Pokok</p>
                                                <p className="font-medium text-slate-800">{formatCurrency(loan.principalOutstanding)}</p>
                                            </div>
                                            <div className="hidden sm:block w-px bg-slate-200"></div>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1">Sisa Jasa/Bunga</p>
                                                <p className="font-medium text-slate-800">{formatCurrency(loan.interestOutstanding)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full md:w-64 flex flex-col justify-center">
                                        <div className="flex justify-between text-sm mb-2 font-medium">
                                            <span>Progress Pembayaran</span>
                                            <span>{Math.round(persentaseBayar)}%</span>
                                        </div>
                                        <Progress value={persentaseBayar} className="h-2.5 bg-slate-100" />

                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Total Sisa Tagihan</p>
                                            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalSisa)}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
