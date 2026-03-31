"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { memberPortalApi } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertCircle, Calendar, Banknote, Clock } from "lucide-react";
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

    // Compute installment details for each loan
    const computeLoanDetails = (loan: any) => {
        const principalAmount = Number(loan.principalAmount || 0);
        const principalOutstanding = Number(loan.principalOutstanding || 0);
        const interestOutstanding = Number(loan.interestOutstanding || 0);
        const monthlyInstallment = Number(loan.monthlyInstallment || 0);
        const tenorMonths = loan.tenorMonths || loan.tenor_months || 0;

        // Calculate paid installments from principal progress
        const principalPaid = principalAmount - principalOutstanding;
        let paidInstallments = 0;
        let remainingInstallments = tenorMonths;
        if (monthlyInstallment > 0 && principalAmount > 0 && tenorMonths > 0) {
            const principalPerMonth = principalAmount / tenorMonths;
            paidInstallments = Math.round(principalPaid / principalPerMonth);
            remainingInstallments = Math.max(0, tenorMonths - paidInstallments);
        }
        if (loan.status === "paid_off") {
            paidInstallments = tenorMonths;
            remainingInstallments = 0;
        }

        const totalSisa = principalOutstanding + interestOutstanding;
        const progressPercent = principalAmount > 0
            ? Math.min(100, Math.round((principalPaid / principalAmount) * 100))
            : 0;

        return {
            ...loan,
            principalPaid,
            totalSisa,
            paidInstallments,
            remainingInstallments,
            progressPercent,
            tenorMonths,
        };
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Status Pinjaman</h1>
                <p className="text-muted-foreground">Monitor plafond, sisa hutang, jadwal angsuran, dan progress pembayaran Anda.</p>
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
                ) : response?.data.loans.list.map((rawLoan: any) => {
                    const loan = computeLoanDetails(rawLoan);
                    const statusConfig: Record<string, { label: string; color: string; barColor: string }> = {
                        active: { label: "Aktif", color: "bg-blue-100 text-blue-800", barColor: "bg-blue-500" },
                        overdue: { label: "Menunggak", color: "bg-red-100 text-red-800", barColor: "bg-red-500" },
                        paid_off: { label: "Lunas", color: "bg-emerald-100 text-emerald-800", barColor: "bg-emerald-500" },
                        written_off: { label: "Dihapusbukukan", color: "bg-gray-100 text-gray-800", barColor: "bg-gray-300" },
                    };
                    const st = statusConfig[loan.status] || { label: loan.status, color: "bg-gray-100 text-gray-800", barColor: "bg-gray-300" };

                    return (
                        <Card key={loan.id} className="border shadow-sm overflow-hidden">
                            <div className={`h-1.5 w-full ${st.barColor}`} />
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold">Pinjaman #{loan.loanNo}</CardTitle>
                                    <Badge className={`${st.color} border-0 text-xs uppercase font-semibold`}>
                                        {st.label}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* Info Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-slate-50 rounded-lg p-3 border">
                                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span className="text-xs font-medium">Tanggal Pinjam</span>
                                        </div>
                                        <p className="font-semibold text-sm">
                                            {loan.disbursementDate 
                                                ? new Date(loan.disbursementDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                                                : "-"
                                            }
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 border">
                                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                            <Banknote className="w-3.5 h-3.5" />
                                            <span className="text-xs font-medium">Jumlah Pinjaman</span>
                                        </div>
                                        <p className="font-bold text-sm tabular-nums">{formatCurrency(loan.principalAmount)}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 border">
                                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="text-xs font-medium">Jangka Waktu</span>
                                        </div>
                                        <p className="font-semibold text-sm">{loan.tenorMonths} bulan</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                        <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                                            <CreditCard className="w-3.5 h-3.5" />
                                            <span className="text-xs font-medium">Angsuran/Bulan</span>
                                        </div>
                                        <p className="font-bold text-sm text-blue-700 tabular-nums">{formatCurrency(loan.monthlyInstallment)}</p>
                                    </div>
                                </div>

                                {/* Detail Table */}
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y">
                                            <tr className="bg-muted/40">
                                                <td className="px-4 py-2.5 text-muted-foreground font-medium">Angsuran Terbayar</td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <span className="font-bold text-emerald-600">{loan.paidInstallments}x</span>
                                                    <span className="text-muted-foreground"> dari {loan.tenorMonths}x</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground font-medium">Sisa Angsuran</td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <span className="font-bold text-amber-600">{loan.remainingInstallments}x</span>
                                                    <span className="text-muted-foreground"> angsuran lagi</span>
                                                </td>
                                            </tr>
                                            <tr className="bg-muted/40">
                                                <td className="px-4 py-2.5 text-muted-foreground font-medium">Sudah Dibayar</td>
                                                <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 tabular-nums">
                                                    {formatCurrency(loan.principalPaid)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 font-semibold">Sisa Tagihan</td>
                                                <td className="px-4 py-2.5 text-right font-bold text-red-600 tabular-nums text-base">
                                                    {formatCurrency(loan.totalSisa)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Progress Pembayaran</span>
                                        <span className="font-bold">{loan.progressPercent}%</span>
                                    </div>
                                    <Progress value={loan.progressPercent} className="h-2.5 bg-slate-100" />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
