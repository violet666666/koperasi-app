"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Download, Printer, PieChart, Users, Percent, CalendarDays, FileText, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/patterns/data-table";
import { formatCurrency } from "@/lib/constants";
import { reportsApi } from "@/lib/api";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

const shuExportColumns: ExportColumn[] = [
    { header: "NRP", key: "memberNo", width: 14 },
    { header: "Nama Anggota", key: "name", width: 28 },
    { header: "Simpanan Pokok", key: "simpananPokok", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Simpanan Wajib", key: "simpananWajib", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Total Poin Simpanan", key: "savingsContribution", width: 22, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Poin Usaha", key: "loanContribution", width: 22, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "SHU Jasa Modal", key: "modalPortion", width: 22, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "SHU Jasa Usaha", key: "usahaPortion", width: 22, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "SHU Cuci Mobil", key: "carwashBonus", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Total SHU Diterima", key: "shuShare", width: 20, format: (v) => formatCurrency(Number(v || 0)) },
];

interface SHUAllocation {
    key: string;
    label: string;
    percentage: number;
    amount: number;
    description: string;
}

interface MemberSHU {
    memberNo: string;
    name: string;
    simpananPokok: number;
    simpananWajib: number;
    savingsContribution: number;
    loanContribution: number;
    totalContribution: number;
    modalPortion: number;
    usahaPortion: number;
    carwashBonus: number;
    carwashCount: number;
    shuShare: number;
}

interface IncomeExpenseDetail {
    code: string;
    name: string;
    amount: number;
}

interface IncomeGroup {
    key: string;
    label: string;
    amount: number;
    details: { code: string; name: string; amount: number }[];
}

interface PaginationMeta {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
}

interface SHUData {
    totalShu: number;
    totalIncome: number;
    totalExpense: number;
    memberNetIncome: number;
    nonMemberNetIncome: number;
    period: string;
    month: number;
    periodLabel: string;
    allocationsMember: SHUAllocation[];
    allocationsNonMember: SHUAllocation[];
    incomeDetails: IncomeExpenseDetail[];
    incomeGroups: IncomeGroup[];
    expenseDetails: IncomeExpenseDetail[];
    memberShu: MemberSHU[];
    memberSharePercent: number;
    pagination?: PaginationMeta;
    unitBreakdown?: UnitBreakdown[];
}

interface UnitBreakdown {
    unitType: string;
    label: string;
    category: "store" | "service";
    revenue: number;
    expense: number;
    transactionCount: number;
    paymentMethodBreakdown: { method: string; label: string; amount: number; count: number }[];
}

const MONTHS = [
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
];

const columns: ColumnDef<MemberSHU>[] = [
    {
        accessorKey: "memberNo",
        header: "NRP",
        cell: ({ row }) => <span className="font-mono">{row.getValue("memberNo")}</span>,
    },
    {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
        accessorKey: "simpananPokok",
        header: () => <div className="text-right">Simp. Pokok</div>,
        cell: ({ row }) => <div className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.getValue("simpananPokok"))}</div>,
    },
    {
        accessorKey: "simpananWajib",
        header: () => <div className="text-right">Simp. Wajib</div>,
        cell: ({ row }) => <div className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.getValue("simpananWajib"))}</div>,
    },
    {
        accessorKey: "loanContribution",
        header: () => <div className="text-right">Poin Usaha</div>,
        cell: ({ row }) => <div className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.getValue("loanContribution"))}</div>,
    },
    {
        accessorKey: "modalPortion",
        header: () => <div className="text-right">SHU Jasa Modal</div>,
        cell: ({ row }) => <div className="text-right tabular-nums font-medium text-blue-600">{formatCurrency(row.getValue("modalPortion"))}</div>,
    },
    {
        accessorKey: "usahaPortion",
        header: () => <div className="text-right">SHU Jasa Usaha</div>,
        cell: ({ row }) => <div className="text-right tabular-nums font-medium text-orange-600">{formatCurrency(row.getValue("usahaPortion"))}</div>,
    },
    {
        accessorKey: "carwashBonus",
        header: () => <div className="text-right">SHU Cuci Mobil</div>,
        cell: ({ row }) => {
            const bonus = Number(row.getValue("carwashBonus") || 0);
            const count = row.original.carwashCount || 0;
            return (
                <div className="text-right tabular-nums font-medium text-cyan-600" title={`${count} transaksi x Rp 2.000`}>
                    {bonus > 0 ? formatCurrency(bonus) : "-"}
                </div>
            );
        },
    },
    {
        accessorKey: "shuShare",
        header: () => <div className="text-right font-bold">Total Diterima</div>,
        cell: ({ row }) => <div className="text-right tabular-nums font-bold text-emerald-600">{formatCurrency(row.getValue("shuShare"))}</div>,
    },
];

export default function LaporanSHUPage() {
    const now = new Date();
    const [selectedYear, setSelectedYear] = React.useState(String(now.getFullYear()));
    const [selectedMonth, setSelectedMonth] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [data, setData] = React.useState<SHUData | null>(null);
    const [expandedUnits, setExpandedUnits] = React.useState<Set<string>>(new Set());

    // Server-side pagination state
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 });

    // Print state: all-member data for print view
    const [printData, setPrintData] = React.useState<MemberSHU[] | null>(null);
    const [isExporting, setIsExporting] = React.useState(false);

    const yearOptions = React.useMemo(() => {
        const years: string[] = [];
        for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
            years.push(String(y));
        }
        return years;
    }, []);

    const fetchData = React.useCallback(async (page: number, perPage: number) => {
        setIsLoading(true);
        try {
            const params: Record<string, unknown> = { year: parseInt(selectedYear), page, perPage };
            if (selectedMonth !== "all") {
                params.month = parseInt(selectedMonth);
            }
            const response = await reportsApi.shu(params as Parameters<typeof reportsApi.shu>[0]);
            const reportData = response.data as unknown as SHUData;
            setData(reportData);
        } catch (error) {
            console.error("Failed to fetch SHU data:", error);
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    // Fetch paginated data when filters or page change
    React.useEffect(() => {
        fetchData(pagination.pageIndex + 1, pagination.pageSize);
    }, [selectedYear, selectedMonth, pagination.pageIndex, pagination.pageSize, fetchData]);

    // Fetch ALL members for export (no pagination)
    const fetchAllMembers = React.useCallback(async (): Promise<MemberSHU[]> => {
        const params: Record<string, unknown> = { year: parseInt(selectedYear), export: "true" };
        if (selectedMonth !== "all") {
            params.month = parseInt(selectedMonth);
        }
        const response = await reportsApi.shu(params as Parameters<typeof reportsApi.shu>[0]);
        const reportData = response.data as unknown as SHUData;
        return reportData.memberShu || [];
    }, [selectedYear, selectedMonth]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, [selectedYear, selectedMonth]);

    const totalMemberContribution = data?.memberShu?.reduce((sum, m) => sum + m.totalContribution, 0) || 0;
    const totalMemberShuShare = data?.memberShu?.reduce((sum, m) => sum + m.shuShare, 0) || 0;
    // Use totalItems from pagination for accurate count in summary
    const totalMemberCount = data?.pagination?.totalItems ?? data?.memberShu?.length ?? 0;

    const periodDisplay = data?.periodLabel
        || (selectedMonth !== "all"
            ? `${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
            : `Tahun ${selectedYear}`);

    const isMonthlyView = selectedMonth !== "all";

    // Handlers for export/print — fetch all data first
    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const allMembers = await fetchAllMembers();
            exportToExcel(allMembers as unknown as Record<string, unknown>[], shuExportColumns, `Laporan_SHU_${selectedYear}`, "SHU");
        } catch (error) {
            console.error("Export Excel failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const allMembers = await fetchAllMembers();
            exportToPDF(allMembers as unknown as Record<string, unknown>[], shuExportColumns, `Laporan SHU - PRIMKOPPOL Resor Lumajang (${periodDisplay})`, `Laporan_SHU_${selectedYear}`);
        } catch (error) {
            console.error("Export PDF failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = async () => {
        setIsExporting(true);
        try {
            const allMembers = await fetchAllMembers();
            setPrintData(allMembers);
            // Wait for React to render the print div, then trigger print
            setTimeout(() => {
                window.print();
            }, 100);
        } catch (error) {
            console.error("Print failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    // Pagination handler for DataTable
    const handlePaginationChange = (updater: any) => {
        setPagination(prev => {
            const next = typeof updater === "function" ? updater(prev) : updater;
            return { ...prev, ...next };
        });
    };

    return (
        <div className="space-y-6">
            {/* ===== PRINT HEADER — only visible when printing ===== */}
            <div className="hidden print:flex items-center gap-4 mb-6">
                <div className="logo-frame-sedang">
                    <img src="/LogoPrimkoppol.png" alt="Logo Primkoppol" className="logo-inner-sedang" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-black">LAPORAN SHU (SISA HASIL USAHA)</h1>
                    <h2 className="text-lg font-bold text-black">PRIMKOPPOL RESOR LUMAJANG</h2>
                    <p className="text-sm font-medium text-black mt-1">Periode: {periodDisplay}</p>
                    {isMonthlyView && (
                        <p className="text-xs text-gray-600 mt-0.5">Proyeksi Bulanan -- SHU resmi dibagi setahun sekali saat RAT</p>
                    )}
                </div>
            </div>

            {/* ===== SCREEN HEADER — hidden when printing ===== */}
            <div className="print:hidden">
                <PageHeader
                    title="Laporan SHU"
                    description="Sisa Hasil Usaha dan pembagian ke anggota"
                    backHref="/laporan"
                    actions={
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                                Cetak
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Excel
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                PDF
                            </Button>
                        </div>
                    }
                />
            </div>

            {/* Period Selector — hidden when printing */}
            <div className="print:hidden flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>Filter Periode:</span>
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Pilih tahun" />
                    </SelectTrigger>
                    <SelectContent>
                        {yearOptions.map(y => (
                            <SelectItem key={y} value={y}>Tahun {y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Semua Bulan" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Bulan</SelectItem>
                        {MONTHS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {isMonthlyView && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        Proyeksi Bulanan
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-64" />
                </div>
            ) : data ? (
                <div className="space-y-6">
                    {/* SHU Summary */}
                    <Card className="print:border print:border-gray-300 print:shadow-none">
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-lg bg-primary/10 p-4 text-primary print:hidden">
                                        <PieChart className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            {isMonthlyView ? "Proyeksi SHU" : "Total SHU"} {periodDisplay}
                                        </p>
                                        <p className="text-3xl font-bold tabular-nums">{formatCurrency(data.totalShu)}</p>
                                        {isMonthlyView && (
                                            <p className="text-xs text-muted-foreground mt-1 print:block">
                                                SHU resmi dibagi setahun sekali saat RAT. Ini adalah proyeksi perbulan.
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-primary">{totalMemberCount}</p>
                                        <p className="text-sm text-muted-foreground">Anggota</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-emerald-600">{data.memberSharePercent || 50}%</p>
                                        <p className="text-sm text-muted-foreground">Untuk Anggota</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Pendapatan</p>
                                    <p className="text-xl font-semibold text-emerald-600">{formatCurrency(data.totalIncome || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Beban</p>
                                    <p className="text-xl font-semibold text-red-600">{formatCurrency(data.totalExpense || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">SHU dari Anggota (80%)</p>
                                    <p className="text-xl font-semibold">{formatCurrency(data.memberNetIncome)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">SHU dari Non-Anggota (20%)</p>
                                    <p className="text-xl font-semibold">{formatCurrency(data.nonMemberNetIncome)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Income Group Summary — 3 kategori pendapatan */}
                    {data.incomeGroups && data.incomeGroups.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-3">
                            {data.incomeGroups.map(group => {
                                const isUnit = group.key === "unit";
                                const isSP = group.key === "sp";
                                const colorClass = isUnit
                                    ? "border-emerald-200 dark:border-emerald-800"
                                    : isSP
                                    ? "border-blue-200 dark:border-blue-800"
                                    : "border-amber-200 dark:border-amber-800";
                                const textClass = isUnit
                                    ? "text-emerald-600"
                                    : isSP
                                    ? "text-blue-600"
                                    : "text-amber-600";
                                const bgClass = isUnit
                                    ? "bg-emerald-50 dark:bg-emerald-950/30"
                                    : isSP
                                    ? "bg-blue-50 dark:bg-blue-950/30"
                                    : "bg-amber-50 dark:bg-amber-950/30";
                                const icon = isUnit ? "🏪" : isSP ? "🏦" : "📦";
                                return (
                                    <Card key={group.key} className={`${colorClass} print:border-gray-300 print:shadow-none`}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-lg">{icon}</span>
                                                <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
                                            </div>
                                            <p className={`text-xl font-bold tabular-nums ${textClass}`}>
                                                {formatCurrency(group.amount)}
                                            </p>
                                            {group.details.length > 0 && (
                                                <div className="mt-2 pt-2 border-t space-y-1">
                                                    {group.details.map(d => (
                                                        <div key={d.code} className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground truncate mr-2">{d.name}</span>
                                                            <span className={`tabular-nums font-medium ${textClass}`}>
                                                                {formatCurrency(d.amount)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

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

                    {/* Income & Expense Breakdown */}
                    {((data.incomeDetails && data.incomeDetails.length > 0) || (data.expenseDetails && data.expenseDetails.length > 0)) && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {data.incomeDetails && data.incomeDetails.length > 0 && (
                                <Card className="border-emerald-200 print:border-gray-300 print:shadow-none">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base text-emerald-700 print:text-black">Rincian Pendapatan -- {periodDisplay}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {data.incomeDetails.map((item) => (
                                                <div key={item.code} className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">{item.code} -- {item.name}</span>
                                                    <span className="font-medium tabular-nums text-emerald-600">{formatCurrency(item.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            {data.expenseDetails && data.expenseDetails.length > 0 && (
                                <Card className="border-red-200 print:border-gray-300 print:shadow-none">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base text-red-700 print:text-black">Rincian Beban -- {periodDisplay}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {data.expenseDetails.map((item) => (
                                                <div key={item.code} className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">{item.code} -- {item.name}</span>
                                                    <span className="font-medium tabular-nums text-red-600">{formatCurrency(item.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* Allocation Table */}
                    <Card className="print:border print:border-gray-300 print:shadow-none">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Percent className="h-5 w-5 print:hidden" />
                                Pembagian SHU dari Anggota
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border print:border-gray-300">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead className="w-24">Persentase</TableHead>
                                            <TableHead className="text-right w-40">Jumlah</TableHead>
                                            <TableHead>Keterangan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.allocationsMember?.length > 0 ? (
                                            data.allocationsMember.map((alloc) => (
                                                <TableRow key={alloc.key}>
                                                    <TableCell className="font-medium">{alloc.label}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={alloc.percentage} className="h-2 w-16 print:hidden" />
                                                            <span className="text-sm tabular-nums">{alloc.percentage}%</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-medium">
                                                        {formatCurrency(alloc.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {alloc.description}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                    Tidak ada data alokasi anggota
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Allocation Table Non-Member */}
                    <Card className="print:border print:border-gray-300 print:shadow-none">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Percent className="h-5 w-5 print:hidden" />
                                Pembagian SHU dari Non-Anggota
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border print:border-gray-300">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead className="w-24">Persentase</TableHead>
                                            <TableHead className="text-right w-40">Jumlah</TableHead>
                                            <TableHead>Keterangan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.allocationsNonMember?.length > 0 ? (
                                            data.allocationsNonMember.map((alloc) => (
                                                <TableRow key={alloc.key}>
                                                    <TableCell className="font-medium">{alloc.label}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={alloc.percentage} className="h-2 w-16 print:hidden" />
                                                            <span className="text-sm tabular-nums">{alloc.percentage}%</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-medium">
                                                        {formatCurrency(alloc.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {alloc.description}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                    Tidak ada data alokasi non-anggota
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Member SHU Distribution */}
                    <Card className="print:border print:border-gray-300 print:shadow-none">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="h-5 w-5 print:hidden" />
                                Pembagian SHU Anggota -- {periodDisplay}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Jasa anggota sebesar <strong>{formatCurrency(totalMemberShuShare)}</strong> dibagikan berdasarkan kontribusi simpanan dan pinjaman anggota aktif (Total Nilai Poin Transaksi: <strong>{formatCurrency(totalMemberContribution)}</strong>).
                                {isMonthlyView && <span className="text-blue-600"> Proporsi dihitung berdasarkan data {periodDisplay}.</span>}
                            </p>

                            {/* Screen view: DataTable with server-side pagination */}
                            <div className="print:hidden">
                                <DataTable
                                    columns={columns}
                                    data={data.memberShu || []}
                                    searchPlaceholder="Cari anggota berdasarkan nama..."
                                    manualPagination
                                    pageCount={data.pagination?.totalPages ?? 1}
                                    pagination={pagination}
                                    onPaginationChange={handlePaginationChange}
                                    totalRows={data.pagination?.totalItems ?? 0}
                                />
                            </div>

                            {/* Print view: plain table, ALL rows from printData, no pagination */}
                            <div className="hidden print:block">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-gray-400 bg-gray-100">
                                            <th className="text-left py-2 px-2 font-bold">No</th>
                                            <th className="text-left py-2 px-2 font-bold">NRP</th>
                                            <th className="text-left py-2 px-2 font-bold">Nama Anggota</th>
                                            <th className="text-right py-2 px-2 font-bold">Simp. Pokok</th>
                                            <th className="text-right py-2 px-2 font-bold">Simp. Wajib</th>
                                            <th className="text-right py-2 px-2 font-bold">SHU Jasa Modal</th>
                                            <th className="text-right py-2 px-2 font-bold">SHU Jasa Usaha</th>
                                            <th className="text-right py-2 px-2 font-bold">SHU Cuci Mobil</th>
                                            <th className="text-right py-2 px-2 font-bold">Total SHU Diterima</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(printData || data.memberShu || []).map((member, index) => (
                                            <tr key={member.memberNo} className={index % 2 === 0 ? "" : "bg-gray-50"} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                                <td className="py-1.5 px-2 text-gray-500">{index + 1}</td>
                                                <td className="py-1.5 px-2 font-mono text-xs">{member.memberNo}</td>
                                                <td className="py-1.5 px-2 font-medium">{member.name}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(member.simpananPokok)}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(member.simpananWajib)}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(member.modalPortion)}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(member.usahaPortion)}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums text-cyan-600">{member.carwashBonus > 0 ? formatCurrency(member.carwashBonus) : "-"}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums font-bold text-emerald-600">{formatCurrency(member.shuShare)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                                            <td colSpan={3} className="py-2 px-2 text-right">TOTAL</td>
                                            <td className="py-2 px-2 text-right tabular-nums">{formatCurrency((printData || data.memberShu || []).reduce((s, m) => s + m.simpananPokok, 0))}</td>
                                            <td className="py-2 px-2 text-right tabular-nums">{formatCurrency((printData || data.memberShu || []).reduce((s, m) => s + m.simpananWajib, 0))}</td>
                                            <td className="py-2 px-2 text-right tabular-nums">{formatCurrency((printData || data.memberShu || []).reduce((s, m) => s + m.modalPortion, 0))}</td>
                                            <td className="py-2 px-2 text-right tabular-nums">{formatCurrency((printData || data.memberShu || []).reduce((s, m) => s + m.usahaPortion, 0))}</td>
                                            <td className="py-2 px-2 text-right tabular-nums text-cyan-600">{formatCurrency((printData || data.memberShu || []).reduce((s, m) => s + (m.carwashBonus || 0), 0))}</td>
                                            <td className="py-2 px-2 text-right tabular-nums text-emerald-700">{formatCurrency((printData || data.memberShu || []).reduce((s, m) => s + m.shuShare, 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                                <p className="text-xs text-gray-500 mt-3">
                                    Total anggota: {(printData || data.memberShu || []).length} orang | Dicetak: {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    Tidak ada data SHU untuk periode ini
                </div>
            )}
        </div>
    );
}
