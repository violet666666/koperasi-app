"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { memberPortalApi } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Store, Car, Printer, BookOpen, Dumbbell, Wallet } from "lucide-react";

function getUnitName(unitType: string) {
    const types: Record<string, string> = {
        toko: "Toko Retail",
        simpan_pinjam: "Simpan Pinjam",
        fotocopy: "FotoCopy & ATK",
        cuci_mobil: "Cuci Mobil",
        fitness: "Fitness Center",
        laundry: "Laundry",
        barbershop: "Barbershop",
        playstation: "PlayStation",
        resto: "Resto & Cafe",
    };
    return types[unitType] || unitType;
}

export default function TransaksiPortalPage() {
    const [page, setPage] = React.useState(1);
    const [activeTab, setActiveTab] = React.useState("unit");
    const [unitType, setUnitType] = React.useState("all");
    const [isPaid, setIsPaid] = React.useState("all");

    // We only type the data response we care about
    const { data: response, isLoading } = useQuery<{ data: any }>({
        queryKey: ["portal-transactions", activeTab, unitType, isPaid, page],
        queryFn: () => memberPortalApi.transactions({
            type: activeTab,
            unitType,
            isPaid,
            page
        }) as Promise<{ data: any }>,
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Riwayat Transaksi</h1>
                <p className="text-muted-foreground">Monitor semua mutasi dan transaksi koperasi Anda di bawah ini.</p>
            </div>

            <Tabs defaultValue="unit" onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-md bg-white border shadow-sm">
                    <TabsTrigger value="unit" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Transaksi Unit</TabsTrigger>
                    <TabsTrigger value="savings" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Simpanan</TabsTrigger>
                    <TabsTrigger value="loan" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Angsuran</TabsTrigger>
                </TabsList>

                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                    {activeTab === "unit" && (
                        <>
                            <div className="w-full sm:w-48">
                                <Select value={unitType} onValueChange={setUnitType}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Semua Unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Unit Layanan</SelectItem>
                                        <SelectItem value="toko">Toko Retail</SelectItem>
                                        <SelectItem value="resto">Resto & Cafe</SelectItem>
                                        <SelectItem value="simpan_pinjam">Simpan Pinjam</SelectItem>
                                        <SelectItem value="fotocopy">FotoCopy & ATK</SelectItem>
                                        <SelectItem value="cuci_mobil">Cuci Mobil</SelectItem>
                                        <SelectItem value="fitness">Fitness Center</SelectItem>
                                        <SelectItem value="laundry">Laundry</SelectItem>
                                        <SelectItem value="barbershop">Barbershop</SelectItem>
                                        <SelectItem value="playstation">PlayStation</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-full sm:w-48">
                                <Select value={isPaid} onValueChange={setIsPaid}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Status Pembayaran" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Status</SelectItem>
                                        <SelectItem value="true">Lunas</SelectItem>
                                        <SelectItem value="false">Belum Lunas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-4">
                    <Card className="border-0 shadow-md">
                        {isLoading ? (
                            <div className="p-12 flex justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="divide-y">
                                {activeTab === "unit" && response?.data.unitTransactions?.map((tx: any) => (
                                    <div key={tx.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between gap-4 bg-white hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-base">{tx.description}</p>
                                                {tx.status === "voided" ? (
                                                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 h-5 text-[10px]">DIBATALKAN</Badge>
                                                ) : (
                                                    <>
                                                        {!tx.isPaid && <Badge variant="destructive" className="h-5 text-[10px]">BELUM LUNAS</Badge>}
                                                        {tx.isPaid && <Badge variant="default" className="bg-emerald-500 h-5 text-[10px]">LUNAS</Badge>}
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                                <span>{tx.transactionNo}</span>
                                                <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                <span className="font-medium text-slate-700">{getUnitName(tx.unitType)}</span>
                                                <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                <span>{format(new Date(tx.transactionDate), "EEEE, d MMM yyyy", { locale: id })}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-start sm:items-end justify-center">
                                            <div className="text-lg font-bold text-slate-800">{formatCurrency(tx.amount)}</div>
                                            {tx.isPaid && tx.paidDate && (
                                                <div className="text-xs text-emerald-600 mt-1">Dibayar: {format(new Date(tx.paidDate), "d MMM", { locale: id })}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {activeTab === "savings" && response?.data.savingsTransactions?.map((tx: any) => (
                                    <div key={tx.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between gap-4 bg-white hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${tx.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {tx.type === 'deposit' ? 'Setor' : 'Tarik'}
                                                </span>
                                                <p className="font-semibold text-base">{tx.product?.name || "Simpanan"}</p>
                                            </div>
                                            <div className="flex items-center gap-x-4 text-sm text-muted-foreground">
                                                <span>{tx.transactionNo}</span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                <span>{format(new Date(tx.transactionDate), "d MMM yyyy", { locale: id })}</span>
                                            </div>
                                            {tx.notes && <p className="text-sm mt-2 text-slate-500">{tx.notes}</p>}
                                        </div>
                                        <div className="flex flex-col items-start sm:items-end justify-center">
                                            <div className={`text-lg font-bold ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">Saldo Akhir: {formatCurrency(tx.balanceAfter)}</div>
                                        </div>
                                    </div>
                                ))}

                                {activeTab === "loan" && response?.data.loanPayments?.map((tx: any) => (
                                    <div key={tx.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between gap-4 bg-white hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg">
                                        <div>
                                            <p className="font-semibold text-base mb-1">Angsuran Pinjaman</p>
                                            <div className="flex items-center gap-x-4 text-sm text-muted-foreground">
                                                <span>{tx.loan?.loanNo}</span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                <span>{format(new Date(tx.paymentDate), "d MMM yyyy", { locale: id })}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-start sm:items-end justify-center">
                                            <div className="text-lg font-bold text-emerald-600">{formatCurrency(tx.amount)}</div>
                                            <div className="text-xs text-muted-foreground mt-1 text-right">
                                                Pokok: {formatCurrency(tx.principalPortion)} <br />
                                                Bunga/Jasa: {formatCurrency(tx.interestPortion)}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Empty States */}
                                {activeTab === "unit" && (!response?.data.unitTransactions || response.data.unitTransactions.length === 0) && (
                                    <div className="p-12 text-center text-muted-foreground">Tidak ada riwayat transaksi unit.</div>
                                )}
                                {activeTab === "savings" && (!response?.data.savingsTransactions || response.data.savingsTransactions.length === 0) && (
                                    <div className="p-12 text-center text-muted-foreground">Tidak ada riwayat mutasi simpanan.</div>
                                )}
                                {activeTab === "loan" && (!response?.data.loanPayments || response.data.loanPayments.length === 0) && (
                                    <div className="p-12 text-center text-muted-foreground">Tidak ada riwayat pembayaran pinjaman.</div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </Tabs>
        </div>
    );
}
