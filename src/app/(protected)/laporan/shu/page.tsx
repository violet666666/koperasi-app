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
import { Download, Printer, PieChart, Users, Percent, CalendarDays, FileText, Loader2, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/patterns/data-table";
import { formatCurrency } from "@/lib/constants";
import { reportsApi } from "@/lib/api";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
import { SHUDetailDialog } from "./_components/shu-detail-dialog";
import type { SHUSource, IncomeGroupFilter, ExpenseGroupFilter, CalculationData, SPMonthlyItem } from "./_types";

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

interface ExpenseGroupData {
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
    spMonthlyBreakdown?: SPMonthlyItem[];
    expenseDetails: IncomeExpenseDetail[];
    expenseGroups?: ExpenseGroupData[];
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

interface AuditTx {
    date: string;
    description: string;
    category: string;
    type: "income" | "expense";
    amount: number;
    paymentMethod: string | null;
    source: string;
    referenceNo: string | null;
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

    // Unit Detail Audit state
    const [auditUnit, setAuditUnit] = React.useState<string>("all");
    const [auditType, setAuditType] = React.useState<string>("all");
    const [auditMethod, setAuditMethod] = React.useState<string>("all");
    const [auditData, setAuditData] = React.useState<{
        transactions: AuditTx[];
        summary: { totalIncome: number; totalExpense: number; netAmount: number; totalItems: number };
        pagination: { page: number; perPage: number; totalItems: number; totalPages: number };
    } | null>(null);
    const [auditLoading, setAuditLoading] = React.useState(false);
    const [auditPage, setAuditPage] = React.useState(1);
    const [showAudit, setShowAudit] = React.useState(false);

    // Detail Dialog state
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogSource, setDialogSource] = React.useState<SHUSource>("income");
    const [dialogTitle, setDialogTitle] = React.useState("");
    const [dialogIncomeGroup, setDialogIncomeGroup] = React.useState<IncomeGroupFilter | undefined>(undefined);
    const [dialogExpenseGroup, setDialogExpenseGroup] = React.useState<ExpenseGroupFilter | undefined>(undefined);
    const [dialogSummaryData, setDialogSummaryData] = React.useState<{ code: string; name: string; amount: number }[]>([]);
    const [dialogSummaryTotal, setDialogSummaryTotal] = React.useState(0);

    const openDetailDialog = React.useCallback((
        source: SHUSource,
        title: string,
        summaryData: { code: string; name: string; amount: number }[],
        total: number,
        incomeGroup?: IncomeGroupFilter,
        expenseGroup?: ExpenseGroupFilter,
    ) => {
        setDialogSource(source);
        setDialogTitle(title);
        setDialogSummaryData(summaryData);
        setDialogSummaryTotal(total);
        setDialogIncomeGroup(incomeGroup);
        setDialogExpenseGroup(expenseGroup);
        setDialogOpen(true);
    }, []);

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

    // Fetch audit detail for a specific unit
    const fetchAuditDetail = React.useCallback(async (page: number) => {
        setAuditLoading(true);
        try {
            const params = new URLSearchParams({
                year: selectedYear,
                unitType: auditUnit,
                type: auditType,
                paymentMethod: auditMethod,
                page: String(page),
                perPage: "25",
            });
            if (selectedMonth !== "all") params.set("month", selectedMonth);
            const res = await fetch(`/api/reports/shu/unit-detail?${params}`);
            if (res.ok) {
                const json = await res.json();
                setAuditData(json.data);
            } else {
                setAuditData(null);
            }
        } catch {
            setAuditData(null);
        } finally {
            setAuditLoading(false);
        }
    }, [selectedYear, selectedMonth, auditUnit, auditType, auditMethod]);

    // Refetch when audit filters change
    React.useEffect(() => {
        if (showAudit && auditUnit !== "all") {
            setAuditPage(1);
            fetchAuditDetail(1);
        }
    }, [showAudit, auditUnit, auditType, auditMethod, selectedYear, selectedMonth, fetchAuditDetail]);

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
                                <div
                                    className="rounded-lg p-2 -m-2 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer group relative"
                                    title="Klik untuk detail"
                                    onClick={() => openDetailDialog(
                                        "income",
                                        "Detail: Total Pendapatan",
                                        data.incomeDetails || [],
                                        data.totalIncome || 0,
                                    )}
                                >
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Eye className="h-3.5 w-3.5 text-emerald-500" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Total Pendapatan</p>
                                    <p className="text-xl font-semibold text-emerald-600 border-b border-dashed border-emerald-300 inline-block">
                                        {formatCurrency(data.totalIncome || 0)}
                                    </p>
                                </div>
                                <div
                                    className="rounded-lg p-2 -m-2 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer group relative"
                                    title="Klik untuk detail"
                                    onClick={() => openDetailDialog(
                                        "expense",
                                        "Detail: Total Beban",
                                        data.expenseDetails || [],
                                        data.totalExpense || 0,
                                    )}
                                >
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Eye className="h-3.5 w-3.5 text-red-500" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Total Beban</p>
                                    <p className="text-xl font-semibold text-red-600 border-b border-dashed border-red-300 inline-block">
                                        {formatCurrency(data.totalExpense || 0)}
                                    </p>
                                </div>
                                <div
                                    className="rounded-lg p-2 -m-2 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer group relative"
                                    title="Klik untuk detail kalkulasi"
                                    onClick={() => openDetailDialog(
                                        "member_surplus",
                                        "Detail: SHU dari Anggota",
                                        data.allocationsMember?.map(a => ({ code: a.key, name: a.label, amount: a.amount })) || [],
                                        data.memberNetIncome || 0,
                                    )}
                                >
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Eye className="h-3.5 w-3.5 text-blue-500" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">SHU dari Anggota ({data.memberSharePercent || 50}%)</p>
                                    <p className="text-xl font-semibold border-b border-dashed border-blue-300 inline-block">
                                        {formatCurrency(data.memberNetIncome)}
                                    </p>
                                </div>
                                <div
                                    className="rounded-lg p-2 -m-2 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer group relative"
                                    title="Klik untuk detail kalkulasi"
                                    onClick={() => openDetailDialog(
                                        "non_member_surplus",
                                        "Detail: SHU dari Non-Anggota",
                                        data.allocationsNonMember?.map(a => ({ code: a.key, name: a.label, amount: a.amount })) || [],
                                        data.nonMemberNetIncome || 0,
                                    )}
                                >
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Eye className="h-3.5 w-3.5 text-amber-500" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">SHU dari Non-Anggota ({100 - (data.memberSharePercent || 50)}%)</p>
                                    <p className="text-xl font-semibold border-b border-dashed border-amber-300 inline-block">
                                        {formatCurrency(data.nonMemberNetIncome)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Income Group Summary — 2 kategori pendapatan (Unit + SP; Lainnya dikecualikan dari SHU) */}
                    {data.incomeGroups && data.incomeGroups.filter(g => g.key !== "lainnya" && g.amount > 0).length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {data.incomeGroups.filter(g => g.key !== "lainnya" && g.amount > 0).map(group => {
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
                                const hoverClass = isUnit
                                    ? "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40"
                                    : isSP
                                    ? "hover:bg-blue-50/50 dark:hover:bg-blue-950/40"
                                    : "hover:bg-amber-50/50 dark:hover:bg-amber-950/40";
                                const icon = isUnit ? "🏪" : isSP ? "🏦" : "📦";

                                // SP monthly data for this card
                                const spMonthly = isSP ? data.spMonthlyBreakdown : undefined;

                                return (
                                    <Card
                                        key={group.key}
                                        className={`${colorClass} print:border-gray-300 print:shadow-none transition-colors cursor-pointer ${hoverClass} group relative`}
                                        onClick={() => openDetailDialog(
                                            "income",
                                            `Detail: ${group.label}`,
                                            group.details,
                                            group.amount,
                                            group.key as IncomeGroupFilter,
                                        )}
                                        title="Klik untuk detail transaksi"
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{icon}</span>
                                                    <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
                                                </div>
                                                <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                            </div>
                                            <p className={`text-xl font-bold tabular-nums ${textClass} border-b border-dashed inline-block ${isUnit ? "border-emerald-300" : isSP ? "border-blue-300" : "border-amber-300"}`}>
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

                                            {/* SP Monthly Mini-Table — expandable inside card */}
                                            {isSP && spMonthly && spMonthly.length > 0 && (
                                                <details className="mt-3 pt-2 border-t border-blue-200 dark:border-blue-800">
                                                    <summary className="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-800 flex items-center gap-1">
                                                        📊 Rincian Bulanan ({spMonthly.length} bulan)
                                                    </summary>
                                                    <div className="mt-2 max-h-[200px] overflow-y-auto">
                                                        <table className="w-full text-[10px]">
                                                            <thead>
                                                                <tr className="text-muted-foreground border-b">
                                                                    <th className="text-left py-1 font-medium">Bulan</th>
                                                                    <th className="text-right py-1 font-medium">Jasa</th>
                                                                    <th className="text-right py-1 font-medium">DR</th>
                                                                    <th className="text-right py-1 font-medium">Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {spMonthly.map(m => (
                                                                    <tr key={m.month} className="border-b border-muted/30">
                                                                        <td className="py-0.5 text-muted-foreground">{m.monthLabel.replace(` ${data.period}`, "")}</td>
                                                                        <td className="py-0.5 text-right tabular-nums text-blue-600">{formatCurrency(m.jasaPinjaman)}</td>
                                                                        <td className="py-0.5 text-right tabular-nums text-indigo-600">{formatCurrency(m.danaResiko)}</td>
                                                                        <td className="py-0.5 text-right tabular-nums font-medium">{formatCurrency(m.total)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <a
                                                            href="/pinjaman/laporan-jasa"
                                                            className="text-[10px] text-blue-600 hover:underline"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            📅 Laporan Jasa →
                                                        </a>
                                                        <a
                                                            href="/pinjaman/laporan-dana-resiko"
                                                            className="text-[10px] text-indigo-600 hover:underline"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            📅 Laporan DR →
                                                        </a>
                                                    </div>
                                                </details>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {/* Expense Group Summary — 2 kategori beban (Operasional + Unit; Lainnya dikecualikan dari SHU) */}
                    {data.expenseGroups && data.expenseGroups.filter(g => g.key !== "lainnya" && g.amount > 0).length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <p className="col-span-full text-sm font-semibold text-muted-foreground -mb-2">Beban Operasional</p>
                            {data.expenseGroups.filter(g => g.key !== "lainnya" && g.amount > 0).map(group => {
                                const isOperasional = group.key === "operasional";
                                const isUnitBeban = group.key === "unit_beban";
                                const colorClass = isOperasional
                                    ? "border-red-200 dark:border-red-800"
                                    : isUnitBeban
                                    ? "border-orange-200 dark:border-orange-800"
                                    : "border-gray-200 dark:border-gray-700";
                                const textClass = isOperasional
                                    ? "text-red-600"
                                    : isUnitBeban
                                    ? "text-orange-600"
                                    : "text-gray-600";
                                const hoverClass = isOperasional
                                    ? "hover:bg-red-50/50 dark:hover:bg-red-950/40"
                                    : isUnitBeban
                                    ? "hover:bg-orange-50/50 dark:hover:bg-orange-950/40"
                                    : "hover:bg-gray-50/50 dark:hover:bg-gray-950/40";
                                const icon = isOperasional ? "🏢" : isUnitBeban ? "🔧" : "📋";
                                return (
                                    <Card
                                        key={group.key}
                                        className={`${colorClass} print:border-gray-300 print:shadow-none transition-colors cursor-pointer ${hoverClass} group relative`}
                                        onClick={() => openDetailDialog(
                                            "expense",
                                            `Detail: ${group.label}`,
                                            group.details,
                                            group.amount,
                                            undefined,
                                            group.key as ExpenseGroupFilter,
                                        )}
                                        title="Klik untuk detail transaksi"
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{icon}</span>
                                                    <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
                                                </div>
                                                <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                            </div>
                                            <p className={`text-xl font-bold tabular-nums ${textClass} border-b border-dashed inline-block ${isOperasional ? "border-red-300" : isUnitBeban ? "border-orange-300" : "border-gray-300"}`}>
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

            {/* ===== SHU DETAIL DIALOG ===== */}
            {data && (
                <SHUDetailDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    source={dialogSource}
                    title={dialogTitle}
                    periodLabel={periodDisplay}
                    summaryData={dialogSummaryData}
                    summaryTotal={dialogSummaryTotal}
                    incomeGroup={dialogIncomeGroup}
                    expenseGroup={dialogExpenseGroup}
                    spMonthlyBreakdown={data?.spMonthlyBreakdown}
                    year={parseInt(selectedYear)}
                    month={selectedMonth !== "all" ? parseInt(selectedMonth) : null}
                    calculationData={
                        dialogSource === "member_surplus" || dialogSource === "non_member_surplus"
                            ? (() => {
                                const totalCarwashBonus = data.memberShu?.reduce((s, m) => s + (m.carwashBonus || 0), 0) || 0;
                                const carwashCount = data.memberShu?.reduce((s, m) => s + (m.carwashCount || 0), 0) || 0;
                                const rawNetSurplus = (data.totalIncome || 0) - (data.totalExpense || 0);
                                const netSurplus = Math.max(0, rawNetSurplus);
                                const adjustedNetSurplus = Math.max(0, netSurplus - totalCarwashBonus);
                                const memberRatio = data.memberSharePercent ? data.memberSharePercent / 100 : 0.8;
                                const nonMemberRatio = data.memberSharePercent ? (100 - data.memberSharePercent) / 100 : 0.2;
                                // Estimate gross income from ratio for display purposes
                                const totalGross = data.totalIncome || 0;
                                const memberGrossIncome = Math.round(totalGross * memberRatio);
                                const nonMemberGrossIncome = Math.round(totalGross * nonMemberRatio);
                                const memberSurplus = Math.round(adjustedNetSurplus * memberRatio);
                                const nonMemberSurplus = adjustedNetSurplus - memberSurplus;
                                return {
                                    totalIncome: data.totalIncome || 0,
                                    totalExpense: data.totalExpense || 0,
                                    netSurplus,
                                    totalCarwashBonus,
                                    carwashCount,
                                    adjustedNetSurplus,
                                    memberRatio,
                                    nonMemberRatio,
                                    memberGrossIncome,
                                    nonMemberGrossIncome,
                                    memberSurplus,
                                    nonMemberSurplus,
                                    jasaModalPool: 0,
                                    jasaUsahaPool: 0,
                                    allocations: dialogSource === "member_surplus"
                                        ? (data.allocationsMember || []).map(a => ({
                                            key: a.key,
                                            label: a.label,
                                            percentage: a.percentage,
                                            amount: a.amount,
                                            description: a.description,
                                        }))
                                        : (data.allocationsNonMember || []).map(a => ({
                                            key: a.key,
                                            label: a.label,
                                            percentage: a.percentage,
                                            amount: a.amount,
                                            description: a.description,
                                        })),
                                } as CalculationData;
                            })()
                            : undefined
                    }
                />
            )}
        </div>
    );
}
