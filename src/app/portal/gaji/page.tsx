"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { memberPortalApi } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import {
    Receipt,
    Wallet,
    ArrowRight,
    TrendingDown,
    Banknote,
    FileText,
} from "lucide-react";

// -- Types --
interface PayrollSlipSummary {
    slipId: number;
    periodName: string;
    periodId: number;
    gajiBersih: number;
    totalPotKoperasi: number;
    sisaGaji: number;
    terimaBersih: number;
    bisaDiambilATM: number;
}

type PayrollResponse = { data: PayrollSlipSummary[] };

export default function PortalGajiPage() {
    const { data: response, isLoading, isError } = useQuery<PayrollResponse>({
        queryKey: ["member-payroll"],
        queryFn: () => memberPortalApi.payroll() as Promise<PayrollResponse>,
        retry: 1,
    });

    const slips = response?.data ?? [];

    if (isError) {
        return (
            <div className="max-w-5xl mx-auto py-12 text-center space-y-4">
                <Receipt className="mx-auto h-16 w-16 text-red-300" />
                <h2 className="text-xl font-bold text-red-600">Gagal Memuat Data Slip Gaji</h2>
                <p className="text-muted-foreground">
                    Akun Anda mungkin belum terhubung dengan data gaji PRIMKOPPOL.
                    Silakan hubungi operator untuk pengecekan.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Slip Gaji</h1>
                <p className="text-muted-foreground">
                    Riwayat slip gaji dan potongan koperasi Anda setiap periode.
                </p>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-52 rounded-xl" />
                    ))}
                </div>
            ) : slips.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 border-2 border-dashed rounded-xl bg-slate-50 text-muted-foreground">
                    <FileText className="mx-auto h-14 w-14 opacity-20 mb-4" />
                    <p className="font-semibold text-lg">Belum Ada Slip Gaji</p>
                    <p className="text-sm mt-1">
                        Data slip gaji Anda belum tersedia. Hubungi operator PRIMKOPPOL jika Anda merasa ini tidak benar.
                    </p>
                </div>
            ) : (
                /* Slip Cards Grid */
                <div className="grid gap-4 md:grid-cols-2">
                    {slips.map(slip => (
                        <Card
                            key={slip.slipId}
                            className="border shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                        >
                            {/* Card Header - Period Name */}
                            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-5 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Receipt className="h-4 w-4 opacity-75" />
                                    <span className="font-semibold text-sm">{slip.periodName}</span>
                                </div>
                            </div>

                            <CardContent className="p-5 space-y-4">
                                {/* Summary Numbers */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Wallet className="h-3 w-3" /> Gaji Bersih
                                        </p>
                                        <p className="text-base font-bold text-slate-800">
                                            {formatCurrency(slip.gajiBersih)}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <TrendingDown className="h-3 w-3" /> Pot. Koperasi
                                        </p>
                                        <p className="text-base font-bold text-red-600">
                                            {formatCurrency(slip.totalPotKoperasi)}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Banknote className="h-3 w-3" /> Terima Bersih
                                        </p>
                                        <p className="text-base font-bold text-emerald-700">
                                            {formatCurrency(slip.terimaBersih)}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Wallet className="h-3 w-3" /> Bisa di ATM
                                        </p>
                                        <p className="text-base font-bold text-blue-700">
                                            {formatCurrency(slip.bisaDiambilATM)}
                                        </p>
                                    </div>
                                </div>

                                {/* Action: View Full Slip */}
                                <Link
                                    href={`/portal/gaji/${slip.slipId}`}
                                >
                                    <Button variant="outline" className="w-full" size="sm">
                                        <FileText className="mr-2 h-4 w-4" />
                                        Lihat Slip Lengkap
                                        <ArrowRight className="ml-auto h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
