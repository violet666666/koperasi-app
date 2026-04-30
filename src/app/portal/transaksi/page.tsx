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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Store, Car, Printer, BookOpen, Dumbbell, Wallet, Receipt, X } from "lucide-react";

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
    const [selectedTx, setSelectedTx] = React.useState<any>(null);

    const { data: response, isLoading, isError } = useQuery<{ data: any }>({
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

            <Tabs defaultValue="unit" onValueChange={(v) => { setActiveTab(v); setPage(1); }} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-md bg-white border shadow-sm">
                    <TabsTrigger value="unit" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Transaksi Unit</TabsTrigger>
                    <TabsTrigger value="savings" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Simpanan</TabsTrigger>
                    <TabsTrigger value="loan" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Angsuran</TabsTrigger>
                </TabsList>

                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                    {activeTab === "unit" && (
                        <>
                            <div className="w-full sm:w-48">
                                <Select value={unitType} onValueChange={(v) => { setUnitType(v); setPage(1); }}>
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
                                <Select value={isPaid} onValueChange={(v) => { setIsPaid(v); setPage(1); }}>
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
                        ) : isError ? (
                            <div className="p-12 text-center text-destructive">
                                Gagal memuat data transaksi. Silakan coba lagi.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {activeTab === "unit" && response?.data.unitTransactions?.map((tx: any) => (
                                    <div
                                        key={tx.id}
                                        className={`p-4 sm:p-6 flex flex-col sm:flex-row justify-between gap-4 bg-white transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                            tx.items?.length ? "hover:bg-slate-50 cursor-pointer" : ""
                                        } ${tx.status === "voided" ? "opacity-50" : ""}`}
                                        onClick={() => tx.items?.length && setSelectedTx(tx)}
                                    >
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
                                                {tx.items?.length > 0 && (
                                                    <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                                <span>{tx.transactionNo}</span>
                                                <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                <span className="font-medium text-slate-700">{getUnitName(tx.unitType)}</span>
                                                <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                <span>{tx.transactionDate ? format(new Date(tx.transactionDate), "EEEE, d MMM yyyy", { locale: id }) : "-"}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-start sm:items-end justify-center">
                                            <div className="text-lg font-bold text-slate-800">{formatCurrency(tx.amount)}</div>
                                            {tx.paymentMethodLabel && (
                                                <div className="text-xs text-muted-foreground mt-0.5">{tx.paymentMethodLabel}</div>
                                            )}
                                            {tx.isPaid && tx.paidDate && (
                                                <div className="text-xs text-emerald-600 mt-1">Dibayar: {tx.paidDate ? format(new Date(tx.paidDate), "d MMM", { locale: id }) : "-"}</div>
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
                                                <span>{tx.transactionDate ? format(new Date(tx.transactionDate), "d MMM yyyy", { locale: id }) : "-"}</span>
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
                                                <span>{tx.paymentDate ? format(new Date(tx.paymentDate), "d MMM yyyy", { locale: id }) : "-"}</span>
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

            {/* Detail Nota/Struk Dialog */}
            <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Detail Transaksi {selectedTx?.transactionNo}</DialogTitle>
                    </DialogHeader>
                    {selectedTx && (
                        <div className="space-y-0">
                            {/* Header */}
                            <div className="text-center pb-4">
                                <p className="text-sm font-bold tracking-wide uppercase">PRIMKOPPOL RESOR LUMAJANG</p>
                                <p className="text-xs text-muted-foreground">{getUnitName(selectedTx.unitType)}</p>
                            </div>

                            <Separator className="border-dashed" />

                            {/* Info Transaksi */}
                            <div className="py-3 space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">No. Transaksi</span>
                                    <span className="font-mono font-medium">{selectedTx.transactionNo}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Tanggal</span>
                                    <span>{selectedTx.transactionDate ? format(new Date(selectedTx.transactionDate), "dd/MM/yyyy HH:mm", { locale: id }) : "-"}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Pembayaran</span>
                                    <span className="font-medium">{selectedTx.paymentMethodLabel}</span>
                                </div>
                                {selectedTx.cashierDisplayName && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Kasir</span>
                                        <span className="font-medium">{selectedTx.cashierDisplayName}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Status</span>
                                    {selectedTx.isPaid ? (
                                        <span className="text-emerald-600 font-semibold">LUNAS</span>
                                    ) : (
                                        <span className="text-red-600 font-semibold">BELUM LUNAS</span>
                                    )}
                                </div>
                            </div>

                            <Separator className="border-dashed" />

                            {/* Items Table */}
                            <div className="py-3">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-muted-foreground">
                                            <th className="text-left font-medium pb-2">Item</th>
                                            <th className="text-center font-medium pb-2 w-10">Qty</th>
                                            <th className="text-right font-medium pb-2">Harga</th>
                                            <th className="text-right font-medium pb-2">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedTx.items?.map((item: any, idx: number) => (
                                            <tr key={idx} className="border-t border-dashed border-slate-200">
                                                <td className="py-1.5 pr-2">{item.name}</td>
                                                <td className="py-1.5 text-center">{item.quantity}</td>
                                                <td className="py-1.5 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                                                <td className="py-1.5 text-right tabular-nums font-medium">{formatCurrency(item.subtotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Separator className="border-dashed" />

                            {/* Total */}
                            <div className="py-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold uppercase">Total</span>
                                    <span className="text-lg font-bold">{formatCurrency(selectedTx.amount)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                    <span>{selectedTx.items?.length || 0} item</span>
                                </div>
                            </div>

                            <Separator className="border-dashed" />

                            {/* Footer */}
                            <div className="pt-3 pb-1 text-center">
                                <p className="text-[10px] text-muted-foreground">Terima kasih atas pembelian Anda</p>
                                <p className="text-[10px] text-muted-foreground">PRIMKOPPOL RESOR LUMAJANG</p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
