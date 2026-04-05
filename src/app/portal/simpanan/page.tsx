"use client";



import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { memberPortalApi } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PiggyBank, ShieldCheck } from "lucide-react";

export default function SimpananPortalPage() {
    type SummaryResponse = {
        data: {
            savings: { totalBalance: number; accounts: any[] };
        }
    };

    const { data: response, isLoading, isError, error } = useQuery<SummaryResponse>({
        queryKey: ["member-summary"],
        queryFn: () => memberPortalApi.summary() as Promise<SummaryResponse>,
        retry: 1,
    });

    if (isError) {
        return (
            <div className="max-w-5xl mx-auto py-12 text-center space-y-4">
                <PiggyBank className="mx-auto h-16 w-16 text-red-300" />
                <h2 className="text-xl font-bold text-red-600">Gagal Memuat Data Simpanan</h2>
                <p className="text-muted-foreground">Akun Anda mungkin belum terhubung dengan data anggota PRIMKOPPOL. Silakan hubungi operator untuk pengecekan.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Portofolio Simpanan</h1>
                <p className="text-muted-foreground">Ringkasan saldo dan akun simpanan wajib, sukarela, dan pokok Anda.</p>
            </div>

            <Card className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-0 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <PiggyBank className="w-32 h-32" />
                </div>
                <CardContent className="p-8 relative z-10">
                    <p className="text-emerald-100 font-medium mb-1">Total Saldo Simpanan</p>
                    <div className="text-4xl md:text-5xl font-bold tracking-tight">
                        {isLoading ? <Skeleton className="h-12 w-64 bg-white/20" /> : formatCurrency(response?.data.savings.totalBalance || 0)}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    [1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)
                ) : response?.data.savings.accounts.map((acc: any) => (
                    <Card key={acc.id} className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 inline-block px-2 py-1 rounded uppercase tracking-wider mb-1">
                                        {acc.product?.type === 'pokok' ? 'Wajib (Sekali)' :
                                            acc.product?.type === 'wajib' ? 'Rutinitas' : 'Sukarela'}
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono">{acc.accountNo}</p>
                                </div>
                            </div>
                            <h3 className="font-bold text-lg mb-1">{acc.product?.name}</h3>
                            <div className="mt-4 pt-4 border-t">
                                <p className="text-sm text-muted-foreground mb-1">Saldo Saat Ini</p>
                                <p className="text-2xl font-bold text-slate-800">{formatCurrency(acc.balance)}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {!isLoading && response?.data.savings.accounts.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50 text-muted-foreground">
                    <PiggyBank className="mx-auto h-12 w-12 opacity-20 mb-4" />
                    <p className="font-medium">Belum ada akun simpanan aktif</p>
                </div>
            )}
        </div>
    );
}
