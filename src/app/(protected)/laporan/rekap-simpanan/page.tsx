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
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Wallet, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { formatCurrency, formatNumber, SAVINGS_PRODUCT_TYPES } from "@/lib/constants";

interface SavingsRecap {
    product_code: string;
    product_name: string;
    product_type: string;
    total_members: number;
    total_deposit: number;
    total_withdrawal: number;
    current_balance: number;
}

// Mock data
const MOCK_SAVINGS: SavingsRecap[] = [
    { product_code: "SP", product_name: "Simpanan Pokok", product_type: "pokok", total_members: 856, total_deposit: 85600000, total_withdrawal: 0, current_balance: 85600000 },
    { product_code: "SW", product_name: "Simpanan Wajib", product_type: "wajib", total_members: 856, total_deposit: 428000000, total_withdrawal: 0, current_balance: 428000000 },
    { product_code: "SS", product_name: "Simpanan Sukarela", product_type: "sukarela", total_members: 654, total_deposit: 850000000, total_withdrawal: 320000000, current_balance: 530000000 },
    { product_code: "SB", product_name: "Simpanan Berjangka", product_type: "lainnya", total_members: 124, total_deposit: 2500000000, total_withdrawal: 800000000, current_balance: 1700000000 },
];

// Table columns
const columns: ColumnDef<SavingsRecap>[] = [
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
        header: "Produk Simpanan",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{row.getValue("product_name")}</span>
            </div>
        ),
    },
    {
        accessorKey: "product_type",
        header: "Jenis",
        cell: ({ row }) => {
            const type = row.getValue("product_type") as keyof typeof SAVINGS_PRODUCT_TYPES;
            return <span>{SAVINGS_PRODUCT_TYPES[type]?.label || type}</span>;
        },
    },
    {
        accessorKey: "total_members",
        header: "Jml Anggota",
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.getValue("total_members"))}</span>,
    },
    {
        accessorKey: "total_deposit",
        header: "Total Setoran",
        cell: ({ row }) => (
            <span className="tabular-nums text-emerald-600">{formatCurrency(row.getValue("total_deposit"))}</span>
        ),
    },
    {
        accessorKey: "total_withdrawal",
        header: "Total Penarikan",
        cell: ({ row }) => (
            <span className="tabular-nums text-amber-600">{formatCurrency(row.getValue("total_withdrawal"))}</span>
        ),
    },
    {
        accessorKey: "current_balance",
        header: "Saldo Saat Ini",
        cell: ({ row }) => (
            <span className="tabular-nums font-bold">{formatCurrency(row.getValue("current_balance"))}</span>
        ),
    },
];

export default function RekapSimpananPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [period, setPeriod] = React.useState("2025-01");

    React.useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, [period]);

    const totalDeposit = MOCK_SAVINGS.reduce((sum, s) => sum + s.total_deposit, 0);
    const totalWithdrawal = MOCK_SAVINGS.reduce((sum, s) => sum + s.total_withdrawal, 0);
    const totalBalance = MOCK_SAVINGS.reduce((sum, s) => sum + s.current_balance, 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Rekap Simpanan"
                description="Rekapitulasi simpanan berdasarkan produk"
                backHref="/laporan"
                actions={
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
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
                        <div className="text-2xl font-bold">{MOCK_SAVINGS.length}</div>
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
                    data={MOCK_SAVINGS}
                    searchPlaceholder="Cari produk..."
                    searchColumn="product_name"
                />
            )}
        </div>
    );
}
