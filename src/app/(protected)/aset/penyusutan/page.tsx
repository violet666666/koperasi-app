"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    TrendingDown,
    Calculator,
    Calendar,
    Play,
    CheckCircle,
    Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface DepreciationSchedule {
    id: number;
    assetCode: string;
    assetName: string;
    category: string;
    acquisitionCost: number;
    usefulLifeYears: number;
    monthlyDepreciation: number;
    accumulatedBefore: number;
    currentMonth: number;
    accumulatedAfter: number;
    bookValue: number;
}

export default function PenyusutanAsetPage() {
    const [data, setData] = React.useState<DepreciationSchedule[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [periodMonth, setPeriodMonth] = React.useState<string>("01");
    const [periodYear, setPeriodYear] = React.useState<string>("2026");
    const [isProcessing, setIsProcessing] = React.useState(false);

    // Stats
    const stats = React.useMemo(() => {
        return {
            totalAssets: data.length,
            totalMonthly: data.reduce((sum, d) => sum + d.currentMonth, 0),
            totalAccumulated: data.reduce((sum, d) => sum + d.accumulatedAfter, 0),
            totalBookValue: data.reduce((sum, d) => sum + d.bookValue, 0),
        };
    }, [data]);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                const mockData: DepreciationSchedule[] = [
                    {
                        id: 1,
                        assetCode: "AST-001",
                        assetName: "Gedung Kantor Pusat",
                        category: "building",
                        acquisitionCost: 500000000,
                        usefulLifeYears: 20,
                        monthlyDepreciation: 2083333,
                        accumulatedBefore: 122916667,
                        currentMonth: 2083333,
                        accumulatedAfter: 125000000,
                        bookValue: 375000000,
                    },
                    {
                        id: 2,
                        assetCode: "AST-002",
                        assetName: "Mobil Operasional",
                        category: "vehicle",
                        acquisitionCost: 200000000,
                        usefulLifeYears: 8,
                        monthlyDepreciation: 2083333,
                        accumulatedBefore: 47916667,
                        currentMonth: 2083333,
                        accumulatedAfter: 50000000,
                        bookValue: 150000000,
                    },
                    {
                        id: 3,
                        assetCode: "AST-003",
                        assetName: "Server Komputer",
                        category: "computer",
                        acquisitionCost: 75000000,
                        usefulLifeYears: 4,
                        monthlyDepreciation: 1562500,
                        accumulatedBefore: 26562500,
                        currentMonth: 1562500,
                        accumulatedAfter: 28125000,
                        bookValue: 46875000,
                    },
                ];

                setData(mockData);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [periodMonth, periodYear]);

    // Process depreciation
    const handleProcess = async () => {
        setIsProcessing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success("Penyusutan bulan ini berhasil diproses");
        } catch (error) {
            toast.error("Gagal memproses penyusutan");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Penyusutan Aset"
                description="Jadwal penyusutan aset tetap"
                backHref="/aset"
                actions={
                    <Button onClick={handleProcess} disabled={isProcessing}>
                        {isProcessing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="mr-2 h-4 w-4" />
                        )}
                        Proses Penyusutan
                    </Button>
                }
            />

            {/* Period Selector */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <span className="text-sm text-muted-foreground">Periode:</span>
                        <Select value={periodMonth} onValueChange={setPeriodMonth}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {new Date(2000, parseInt(m) - 1).toLocaleDateString("id-ID", { month: "long" })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={periodYear} onValueChange={setPeriodYear}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Calculator className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Aset</p>
                            <p className="text-2xl font-bold">{stats.totalAssets}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <Calendar className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Penyusutan Bulan Ini</p>
                            <p className="text-lg font-bold tabular-nums">
                                {formatCurrency(stats.totalMonthly)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Akum. Penyusutan</p>
                            <p className="text-lg font-bold tabular-nums text-red-600">
                                {formatCurrency(stats.totalAccumulated)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Nilai Buku</p>
                            <p className="text-lg font-bold tabular-nums text-emerald-600">
                                {formatCurrency(stats.totalBookValue)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Depreciation Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kode</TableHead>
                                        <TableHead>Nama Aset</TableHead>
                                        <TableHead className="text-right">Harga Perolehan</TableHead>
                                        <TableHead className="text-right">Akum. Sebelum</TableHead>
                                        <TableHead className="text-right">Bulan Ini</TableHead>
                                        <TableHead className="text-right">Akum. Setelah</TableHead>
                                        <TableHead className="text-right">Nilai Buku</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-mono text-sm">
                                                {row.assetCode}
                                            </TableCell>
                                            <TableCell className="font-medium">{row.assetName}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(row.acquisitionCost)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                {formatCurrency(row.accumulatedBefore)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-amber-600 font-medium">
                                                {formatCurrency(row.currentMonth)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-red-600">
                                                {formatCurrency(row.accumulatedAfter)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-bold text-emerald-600">
                                                {formatCurrency(row.bookValue)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* Total Row */}
                                    <TableRow className="bg-muted/50 font-bold">
                                        <TableCell colSpan={4} className="text-right">TOTAL</TableCell>
                                        <TableCell className="text-right tabular-nums text-amber-600">
                                            {formatCurrency(stats.totalMonthly)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-red-600">
                                            {formatCurrency(stats.totalAccumulated)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-emerald-600">
                                            {formatCurrency(stats.totalBookValue)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
