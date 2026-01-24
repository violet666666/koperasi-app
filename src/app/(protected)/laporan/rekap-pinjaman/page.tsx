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
import { Skeleton } from "@/components/ui/skeleton";
import { Download, CreditCard, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/constants";

interface LoanRecap {
    product_code: string;
    product_name: string;
    interest_rate: number;
    total_loans: number;
    total_disbursed: number;
    total_outstanding: number;
    total_paid: number;
    collectibility_ratio: number;
}

// Mock data
const MOCK_LOANS: LoanRecap[] = [
    { product_code: "PR", product_name: "Pinjaman Reguler", interest_rate: 1.5, total_loans: 245, total_disbursed: 2450000000, total_outstanding: 1680000000, total_paid: 770000000, collectibility_ratio: 92 },
    { product_code: "PU", product_name: "Pinjaman Usaha", interest_rate: 1.2, total_loans: 89, total_disbursed: 4500000000, total_outstanding: 3200000000, total_paid: 1300000000, collectibility_ratio: 88 },
    { product_code: "PD", product_name: "Pinjaman Darurat", interest_rate: 2.0, total_loans: 156, total_disbursed: 780000000, total_outstanding: 420000000, total_paid: 360000000, collectibility_ratio: 95 },
    { product_code: "PM", product_name: "Pinjaman Multiguna", interest_rate: 1.8, total_loans: 67, total_disbursed: 1850000000, total_outstanding: 1320000000, total_paid: 530000000, collectibility_ratio: 85 },
];

// Table columns
const columns: ColumnDef<LoanRecap>[] = [
    {
        accessorKey: "product_code",
        header: "Kode",
        cell: ({ row }) => (
            <Badge variant="outline" className="font-mono">
                {row.getValue("product_code")}
            </Badge>
        ),
    },
    {
        accessorKey: "product_name",
        header: "Produk Pinjaman",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{row.getValue("product_name")}</span>
            </div>
        ),
    },
    {
        accessorKey: "interest_rate",
        header: "Bunga",
        cell: ({ row }) => <span className="tabular-nums">{row.getValue("interest_rate")}%/bln</span>,
    },
    {
        accessorKey: "total_loans",
        header: "Jml Pinjaman",
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.getValue("total_loans"))}</span>,
    },
    {
        accessorKey: "total_disbursed",
        header: "Total Dicairkan",
        cell: ({ row }) => (
            <span className="tabular-nums">{formatCurrency(row.getValue("total_disbursed"))}</span>
        ),
    },
    {
        accessorKey: "total_outstanding",
        header: "Outstanding",
        cell: ({ row }) => (
            <span className="tabular-nums text-amber-600 font-medium">{formatCurrency(row.getValue("total_outstanding"))}</span>
        ),
    },
    {
        accessorKey: "total_paid",
        header: "Sudah Dibayar",
        cell: ({ row }) => (
            <span className="tabular-nums text-emerald-600">{formatCurrency(row.getValue("total_paid"))}</span>
        ),
    },
    {
        accessorKey: "collectibility_ratio",
        header: "Kolektibilitas",
        cell: ({ row }) => {
            const ratio = row.getValue("collectibility_ratio") as number;
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
    const [period, setPeriod] = React.useState("2025-01");

    React.useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, [period]);

    const totalDisbursed = MOCK_LOANS.reduce((sum, l) => sum + l.total_disbursed, 0);
    const totalOutstanding = MOCK_LOANS.reduce((sum, l) => sum + l.total_outstanding, 0);
    const totalPaid = MOCK_LOANS.reduce((sum, l) => sum + l.total_paid, 0);
    const totalLoans = MOCK_LOANS.reduce((sum, l) => sum + l.total_loans, 0);
    const avgCollectibility = Math.round(MOCK_LOANS.reduce((sum, l) => sum + l.collectibility_ratio, 0) / MOCK_LOANS.length);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Rekap Pinjaman"
                description="Rekapitulasi pinjaman berdasarkan produk"
                backHref="/laporan"
                actions={
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
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
                        <SelectValue placeholder="Pilih periode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="2025-01">Januari 2025</SelectItem>
                        <SelectItem value="2024-12">Desember 2024</SelectItem>
                        <SelectItem value="2024-11">November 2024</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <Skeleton className="h-64" />
            ) : (
                <DataTable
                    columns={columns}
                    data={MOCK_LOANS}
                    searchPlaceholder="Cari produk..."
                    searchColumn="product_name"
                />
            )}
        </div>
    );
}
