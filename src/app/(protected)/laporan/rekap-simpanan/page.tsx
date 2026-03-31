"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { Download, Wallet, TrendingUp, TrendingDown, PiggyBank, FileText } from "lucide-react";
import { formatCurrency, formatNumber, SAVINGS_PRODUCT_TYPES } from "@/lib/constants";
import { reportsApi } from "@/lib/api";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

const savingsExportColumns: ExportColumn[] = [
    { header: "Kode", key: "productCode", width: 12 },
    { header: "Produk Simpanan", key: "productName", width: 25 },
    { header: "Jenis", key: "productType", width: 15 },
    { header: "Jml Anggota", key: "totalMembers", width: 12, format: (v) => String(v || 0) },
    { header: "Total Setoran", key: "totalDeposit", width: 20, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Total Penarikan", key: "totalWithdrawal", width: 20, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Saldo Saat Ini", key: "currentBalance", width: 20, format: (v) => formatCurrency(Number(v || 0)) },
];

interface SavingsRecap {
    productCode: string;
    productName: string;
    productType: string;
    totalMembers: number;
    totalDeposit: number;
    totalWithdrawal: number;
    currentBalance: number;
}

// Table columns
const columns: ColumnDef<SavingsRecap>[] = [
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
        header: "Produk Simpanan",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{row.getValue("productName")}</span>
            </div>
        ),
    },
    {
        accessorKey: "productType",
        header: "Jenis",
        cell: ({ row }) => {
            const type = row.getValue("productType") as keyof typeof SAVINGS_PRODUCT_TYPES;
            return <span>{SAVINGS_PRODUCT_TYPES[type]?.label || type}</span>;
        },
    },
    {
        accessorKey: "totalMembers",
        header: "Jml Anggota",
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.getValue("totalMembers"))}</span>,
    },
    {
        accessorKey: "totalDeposit",
        header: "Total Setoran",
        cell: ({ row }) => (
            <span className="tabular-nums text-emerald-600">{formatCurrency(row.getValue("totalDeposit"))}</span>
        ),
    },
    {
        accessorKey: "totalWithdrawal",
        header: "Total Penarikan",
        cell: ({ row }) => (
            <span className="tabular-nums text-amber-600">{formatCurrency(row.getValue("totalWithdrawal"))}</span>
        ),
    },
    {
        accessorKey: "currentBalance",
        header: "Saldo Saat Ini",
        cell: ({ row }) => (
            <span className="tabular-nums font-bold">{formatCurrency(row.getValue("currentBalance"))}</span>
        ),
    },
];

export default function RekapSimpananPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [period, setPeriod] = React.useState("2026");
    const [data, setData] = React.useState<SavingsRecap[]>([]);

    // Fetch data from API
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const response = await reportsApi.savingsRecap();
                const reportData = response.data as unknown as { products: SavingsRecap[] };
                setData(reportData.products || []);
            } catch (error) {
                console.error("Failed to fetch savings recap:", error);
                setData([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [period]);

    const totalDeposit = data.reduce((sum, s) => sum + s.totalDeposit, 0);
    const totalWithdrawal = data.reduce((sum, s) => sum + s.totalWithdrawal, 0);
    const totalBalance = data.reduce((sum, s) => sum + s.currentBalance, 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Rekap Simpanan"
                description="Rekapitulasi simpanan berdasarkan produk"
                backHref="/laporan"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportToExcel(data as unknown as Record<string, unknown>[], savingsExportColumns, "Rekap_Simpanan", "Simpanan")}>
                            <Download className="mr-2 h-4 w-4" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportToPDF(data as unknown as Record<string, unknown>[], savingsExportColumns, "Rekap Simpanan - Koperasi Primkoppol", "Rekap_Simpanan")}>
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Saldo</CardTitle>
                        <PiggyBank className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{formatCurrency(totalBalance)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Setoran</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums text-emerald-600">{formatCurrency(totalDeposit)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Penarikan</CardTitle>
                        <TrendingDown className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums text-amber-600">{formatCurrency(totalWithdrawal)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Produk Aktif</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.length}</div>
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
