"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { Download, CreditCard, TrendingUp, AlertTriangle, CheckCircle, FileText } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/constants";
import { reportsApi } from "@/lib/api";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

const loanExportColumns: ExportColumn[] = [
    { header: "Kode", key: "productCode", width: 12 },
    { header: "Produk Pinjaman", key: "productName", width: 25 },
    { header: "Bunga (%)", key: "interestRate", width: 10, format: (v) => `${v}%` },
    { header: "Jml Pinjaman", key: "totalLoans", width: 12, format: (v) => String(v || 0) },
    { header: "Total Dicairkan", key: "totalDisbursed", width: 20, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Outstanding", key: "totalOutstanding", width: 20, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Sudah Dibayar", key: "totalPaid", width: 20, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Kolektibilitas", key: "collectibilityRatio", width: 12, format: (v) => `${v}%` },
];

interface LoanRecap {
    productCode: string;
    productName: string;
    interestRate: number;
    totalLoans: number;
    totalDisbursed: number;
    totalOutstanding: number;
    totalPaid: number;
    collectibilityRatio: number;
}

// Table columns
const columns: ColumnDef<LoanRecap>[] = [
    {
        accessorKey: "productCode",
        header: "Kode",
        cell: ({ row }) => (
            <Badge variant="outline" className="font-mono">
                {row.getValue("productCode")}
            </Badge>
        ),
    },
    {
        accessorKey: "productName",
        header: "Produk Pinjaman",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{row.getValue("productName")}</span>
            </div>
        ),
    },
    {
        accessorKey: "interestRate",
        header: "Bunga",
        cell: ({ row }) => <span className="tabular-nums">{row.getValue("interestRate")}%/bln</span>,
    },
    {
        accessorKey: "totalLoans",
        header: "Jml Pinjaman",
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.getValue("totalLoans"))}</span>,
    },
    {
        accessorKey: "totalDisbursed",
        header: "Total Dicairkan",
        cell: ({ row }) => (
            <span className="tabular-nums">{formatCurrency(row.getValue("totalDisbursed"))}</span>
        ),
    },
    {
        accessorKey: "totalOutstanding",
        header: "Outstanding",
        cell: ({ row }) => (
            <span className="tabular-nums text-amber-600 font-medium">{formatCurrency(row.getValue("totalOutstanding"))}</span>
        ),
    },
    {
        accessorKey: "totalPaid",
        header: "Sudah Dibayar",
        cell: ({ row }) => (
            <span className="tabular-nums text-emerald-600">{formatCurrency(row.getValue("totalPaid"))}</span>
        ),
    },
    {
        accessorKey: "collectibilityRatio",
        header: "Kolektibilitas",
        cell: ({ row }) => {
            const ratio = row.getValue("collectibilityRatio") as number;
            return (
                <div className="flex items-center gap-2 min-w-[100px]">
                    <Progress value={ratio} className="h-2 flex-1" />
                    <span className={`text-sm tabular-nums font-medium ${ratio >= 90 ? "text-emerald-600" : ratio >= 80 ? "text-amber-600" : "text-red-600"}`}>
                        {ratio}%
                    </span>
                </div>
            );
        },
    },
];

export default function RekapPinjamanPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [period, setPeriod] = React.useState("2026");
    const [data, setData] = React.useState<LoanRecap[]>([]);

    // Fetch data from API
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const response = await reportsApi.loansRecap();
                const reportData = response.data as unknown as { products: LoanRecap[] };
                setData(reportData.products || []);
            } catch (error) {
                console.error("Failed to fetch loans recap:", error);
                setData([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [period]);

    const totalDisbursed = data.reduce((sum, l) => sum + l.totalDisbursed, 0);
    const totalOutstanding = data.reduce((sum, l) => sum + l.totalOutstanding, 0);
    const totalPaid = data.reduce((sum, l) => sum + l.totalPaid, 0);
    const totalLoans = data.reduce((sum, l) => sum + l.totalLoans, 0);
    const avgCollectibility = data.length > 0 ? Math.round(data.reduce((sum, l) => sum + l.collectibilityRatio, 0) / data.length) : 0;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Rekap Pinjaman"
                description="Rekapitulasi pinjaman berdasarkan produk"
                backHref="/laporan"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportToExcel(data as unknown as Record<string, unknown>[], loanExportColumns, "Rekap_Pinjaman", "Pinjaman")}>
                            <Download className="mr-2 h-4 w-4" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportToPDF(data as unknown as Record<string, unknown>[], loanExportColumns, "Rekap Pinjaman - PRIMKOPPOL Resor Lumajang", "Rekap_Pinjaman")}>
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Pinjaman</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(totalLoans)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Dicairkan</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold tabular-nums">{formatCurrency(totalDisbursed)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold tabular-nums text-amber-600">{formatCurrency(totalOutstanding)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Sudah Dibayar</CardTitle>
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold tabular-nums text-emerald-600">{formatCurrency(totalPaid)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Kolektibilitas</CardTitle>
                        <Progress value={avgCollectibility} className="h-2 w-12" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${avgCollectibility >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                            {avgCollectibility}%
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-4">
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Pilih tahun" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="2026">Tahun 2026</SelectItem>
                        <SelectItem value="2025">Tahun 2025</SelectItem>
                        <SelectItem value="2024">Tahun 2024</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                columns={columns}
                data={data}
                isLoading={isLoading}
                searchPlaceholder="Cari produk..."
                searchColumn="productName"
            />
        </div>
    );
}
