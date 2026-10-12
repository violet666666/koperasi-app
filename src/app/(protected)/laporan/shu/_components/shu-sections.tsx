"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import type { AuditTx, SHUData } from "../_types";

// Dipindah VERBATIM dari page.tsx (2026-10-12). Props memakai nama identifier asli.

export function PerUnitBreakdownSection({data, expandedUnits, setExpandedUnits, periodDisplay}: {
    data: SHUData;
    expandedUnits: Set<string>;
    setExpandedUnits: React.Dispatch<React.SetStateAction<Set<string>>>;
    periodDisplay: string;
}) {
    return (
        <>
                    {/* Per-Unit Revenue Breakdown */}
                    {data.unitBreakdown && data.unitBreakdown.length > 0 && (
                        <Card className="print:border print:border-gray-300 print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base print:text-black">
                                    Pendapatan Per Unit Usaha — {periodDisplay}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border print:border-gray-300">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-8"></TableHead>
                                                <TableHead>Unit Usaha</TableHead>
                                                <TableHead className="text-right">Pendapatan</TableHead>
                                                <TableHead className="text-right">Pengeluaran</TableHead>
                                                <TableHead className="text-right">Laba/Rugi</TableHead>
                                                <TableHead className="text-right w-20">Transaksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.unitBreakdown
                                                .sort((a, b) => b.revenue - a.revenue)
                                                .map((unit) => {
                                                    const netProfit = unit.revenue - (unit.expense || 0);
                                                    const isExpanded = expandedUnits.has(unit.unitType);
                                                    const hasMethods = unit.paymentMethodBreakdown && unit.paymentMethodBreakdown.length > 0;
                                                    return (
                                                        <React.Fragment key={unit.unitType}>
                                                            <TableRow
                                                                className={hasMethods ? "cursor-pointer hover:bg-muted/50" : ""}
                                                                onClick={() => {
                                                                    if (hasMethods) {
                                                                        setExpandedUnits(prev => {
                                                                            const next = new Set(prev);
                                                                            if (next.has(unit.unitType)) next.delete(unit.unitType);
                                                                            else next.add(unit.unitType);
                                                                            return next;
                                                                        });
                                                                    }
                                                                }}
                                                            >
                                                                <TableCell className="w-8 py-2">
                                                                    {hasMethods ? (
                                                                        isExpanded
                                                                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                                    ) : null}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`inline-block w-2 h-2 rounded-full ${unit.category === "store" ? "bg-emerald-500" : "bg-blue-500"}`} />
                                                                        <span className="font-medium">{unit.label}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                                                                    {formatCurrency(unit.revenue)}
                                                                </TableCell>
                                                                <TableCell className="text-right tabular-nums text-red-600 font-medium">
                                                                    {unit.expense ? formatCurrency(unit.expense) : "-"}
                                                                </TableCell>
                                                                <TableCell className={`text-right tabular-nums font-bold ${netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                                                    {formatCurrency(netProfit)}
                                                                </TableCell>
                                                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                                                    {unit.transactionCount}
                                                                </TableCell>
                                                            </TableRow>
                                                            {/* Payment Method Breakdown (expandable) */}
                                                            {isExpanded && hasMethods && (
                                                                <TableRow className="bg-muted/30">
                                                                    <TableCell colSpan={6} className="p-0">
                                                                        <div className="px-12 py-3 space-y-2">
                                                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                                                                Rincian Metode Pembayaran
                                                                            </p>
                                                                            <div className="grid grid-cols-3 gap-3">
                                                                                {unit.paymentMethodBreakdown.map(pm => {
                                                                                    const pct = unit.revenue > 0 ? Math.round((pm.amount / unit.revenue) * 100) : 0;
                                                                                    const methodColor =
                                                                                        pm.method === "cash" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" :
                                                                                        pm.method === "qris" ? "text-purple-600 bg-purple-50 dark:bg-purple-950/30" :
                                                                                        "text-orange-600 bg-orange-50 dark:bg-orange-950/30";
                                                                                    return (
                                                                                        <div key={pm.method} className={`rounded-md p-3 ${methodColor}`}>
                                                                                            <div className="flex items-center justify-between mb-1">
                                                                                                <span className="text-xs font-medium">{pm.label}</span>
                                                                                                <span className="text-xs tabular-nums">{pct}%</span>
                                                                                            </div>
                                                                                            <p className="text-sm font-bold tabular-nums">{formatCurrency(pm.amount)}</p>
                                                                                            <p className="text-xs mt-0.5 opacity-70">{pm.count} transaksi</p>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })
                                            }
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Retail / F&B</span>
                                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Jasa</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
        </>
    );
}

export function AuditDetailSection({data, showAudit, setShowAudit, auditUnit, setAuditUnit, auditType, setAuditType, auditMethod, setAuditMethod, auditData, auditLoading, setAuditPage, fetchAuditDetail}: {
    data: SHUData;
    showAudit: boolean;
    setShowAudit: (v: boolean) => void;
    auditUnit: string;
    setAuditUnit: (v: string) => void;
    auditType: string;
    setAuditType: (v: string) => void;
    auditMethod: string;
    setAuditMethod: (v: string) => void;
    auditData: { transactions: AuditTx[]; summary: { totalIncome: number; totalExpense: number; netAmount: number; totalItems: number }; pagination: { page: number; perPage: number; totalItems: number; totalPages: number } } | null;
    auditLoading: boolean;
    setAuditPage: (v: number) => void;
    fetchAuditDetail: (page: number) => void;
}) {
    return (
        <>
                    {/* ===== AUDIT DETAIL: Filterable Transaction Table per Unit ===== */}
                    <Card className="print:hidden">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Audit Transaksi per Unit
                                </CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAudit(!showAudit)}
                                >
                                    {showAudit ? "Tutup" : "Buka Audit"}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Lihat detail pemasukan & pengeluaran per unit untuk audit manual. Filter berdasarkan metode pembayaran.
                            </p>
                        </CardHeader>
                        {showAudit && (
                            <CardContent className="space-y-4">
                                {/* Filters */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <Select value={auditUnit} onValueChange={setAuditUnit}>
                                        <SelectTrigger className="w-[160px]">
                                            <SelectValue placeholder="Pilih Unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">-- Pilih Unit --</SelectItem>
                                            {data?.unitBreakdown
                                                ?.filter(u => u.unitType !== "_umum")
                                                .sort((a, b) => b.revenue - a.revenue)
                                                .map(u => (
                                                    <SelectItem key={u.unitType} value={u.unitType}>
                                                        {u.label}
                                                    </SelectItem>
                                                ))}
                                            <SelectItem value="_umum">Beban Umum (SP)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={auditType} onValueChange={setAuditType}>
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Jenis</SelectItem>
                                            <SelectItem value="income">Pemasukan</SelectItem>
                                            <SelectItem value="expense">Pengeluaran</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={auditMethod} onValueChange={setAuditMethod}>
                                        <SelectTrigger className="w-[150px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Metode</SelectItem>
                                            <SelectItem value="cash">Tunai</SelectItem>
                                            <SelectItem value="qris">QRIS</SelectItem>
                                            <SelectItem value="salary_cut">Potong Gaji</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        size="sm"
                                        disabled={auditUnit === "all" || auditLoading}
                                        onClick={() => { setAuditPage(1); fetchAuditDetail(1); }}
                                    >
                                        {auditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Muat Data"}
                                    </Button>
                                </div>

                                {auditUnit === "all" && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Pilih unit usaha terlebih dahulu untuk melihat rincian transaksi.
                                    </p>
                                )}

                                {/* Summary */}
                                {auditData && (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                                            <p className="text-xs text-muted-foreground">Total Pemasukan</p>
                                            <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(auditData.summary.totalIncome)}</p>
                                        </div>
                                        <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-center">
                                            <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
                                            <p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(auditData.summary.totalExpense)}</p>
                                        </div>
                                        <div className={`rounded-md p-3 text-center ${auditData.summary.netAmount >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                                            <p className="text-xs text-muted-foreground">Selisih</p>
                                            <p className={`text-lg font-bold tabular-nums ${auditData.summary.netAmount >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                                {formatCurrency(auditData.summary.netAmount)}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Transaction Table */}
                                {auditData && auditData.transactions.length > 0 && (
                                    <>
                                        <div className="rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[90px]">Tanggal</TableHead>
                                                        <TableHead>Keterangan</TableHead>
                                                        <TableHead className="w-[100px]">Jenis</TableHead>
                                                        <TableHead className="w-[110px]">Metode</TableHead>
                                                        <TableHead className="text-right w-[130px]">Jumlah</TableHead>
                                                        <TableHead className="w-[80px]">No. Ref</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {auditData.transactions.map((tx, i) => (
                                                        <TableRow key={`${tx.referenceNo}-${i}`}>
                                                            <TableCell className="text-xs tabular-nums text-muted-foreground">
                                                                {tx.date}
                                                            </TableCell>
                                                            <TableCell className="text-sm max-w-[250px] truncate" title={tx.description}>
                                                                {tx.description}
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                                    tx.type === "income"
                                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                                                }`}>
                                                                    {tx.type === "income" ? "Masuk" : "Keluar"}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                {tx.paymentMethod ? (
                                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                                        tx.paymentMethod === "Tunai" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                                                                        tx.paymentMethod === "QRIS" ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
                                                                        "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                                                    }`}>
                                                                        {tx.paymentMethod}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className={`text-right tabular-nums font-medium ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                                                                {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-mono text-muted-foreground">
                                                                {tx.referenceNo || "-"}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {/* Pagination */}
                                        {auditData.pagination.totalPages > 1 && (
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-muted-foreground">
                                                    {auditData.pagination.totalItems} transaksi • Halaman {auditData.pagination.page} dari {auditData.pagination.totalPages}
                                                </p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline" size="sm"
                                                        disabled={auditData.pagination.page <= 1 || auditLoading}
                                                        onClick={() => {
                                                            const p = auditData.pagination.page - 1;
                                                            setAuditPage(p);
                                                            fetchAuditDetail(p);
                                                        }}
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <Button
                                                        variant="outline" size="sm"
                                                        disabled={auditData.pagination.page >= auditData.pagination.totalPages || auditLoading}
                                                        onClick={() => {
                                                            const p = auditData.pagination.page + 1;
                                                            setAuditPage(p);
                                                            fetchAuditDetail(p);
                                                        }}
                                                    >
                                                        Berikutnya
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {auditData && auditData.transactions.length === 0 && auditUnit !== "all" && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Tidak ada transaksi untuk unit ini dengan filter yang dipilih.
                                    </p>
                                )}
                            </CardContent>
                        )}
                    </Card>
        </>
    );
}

