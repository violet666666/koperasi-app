"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    TrendingDown, Calculator, Calendar, Play, CheckCircle, Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface DepreciationRow {
    id: number;
    code: string;
    name: string;
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
    const [data, setData] = React.useState<DepreciationRow[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const now = new Date();
    const [periodMonth, setPeriodMonth] = React.useState<string>(String(now.getMonth() + 1).padStart(2, "0"));
    const [periodYear, setPeriodYear] = React.useState<string>(String(now.getFullYear()));
    const [isProcessing, setIsProcessing] = React.useState(false);

    const stats = React.useMemo(() => ({
        totalAssets: data.length,
        totalMonthly: data.reduce((s, d) => s + d.currentMonth, 0),
        totalAccumulated: data.reduce((s, d) => s + d.accumulatedAfter, 0),
        totalBookValue: data.reduce((s, d) => s + d.bookValue, 0),
    }), [data]);

    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/aset");
                if (!res.ok) throw new Error("Failed to fetch assets");
                const json = await res.json();
                const assets = json.data || [];

                const month = parseInt(periodMonth);
                const year = parseInt(periodYear);
                const periodDate = new Date(year, month - 1, 1); // first day of selected period

                const rows: DepreciationRow[] = assets
                    .filter((a: any) => a.status === "active")
                    .map((a: any) => {
                        const cost = Number(a.acquisitionCost);
                        const residual = Number(a.residualValue || 0);
                        const depreciableCost = cost - residual;
                        const totalMonths = (a.usefulLifeYears || 1) * 12;
                        const monthlyDep = totalMonths > 0 ? depreciableCost / totalMonths : 0;

                        // Calculate months elapsed from acquisition to start of selected period
                        const acqDate = new Date(a.acquisitionDate);
                        const monthsElapsed = (year - acqDate.getFullYear()) * 12 + (month - 1 - acqDate.getMonth());
                        const monthsBefore = Math.max(0, Math.min(monthsElapsed, totalMonths));
                        const accBefore = monthlyDep * monthsBefore;

                        // Current month depreciation (only if asset was acquired before this period and still depreciable)
                        const canDepreciate = monthsBefore < totalMonths && periodDate >= acqDate;
                        const currentDep = canDepreciate ? monthlyDep : 0;

                        const accAfter = accBefore + currentDep;
                        const bv = cost - accAfter;

                        return {
                            id: a.id,
                            code: a.code,
                            name: a.name,
                            category: a.category,
                            acquisitionCost: cost,
                            usefulLifeYears: a.usefulLifeYears,
                            monthlyDepreciation: Math.round(monthlyDep),
                            accumulatedBefore: Math.round(accBefore),
                            currentMonth: Math.round(currentDep),
                            accumulatedAfter: Math.round(accAfter),
                            bookValue: Math.round(Math.max(0, bv)),
                        };
                    });
                setData(rows);
            } catch (error) {
                console.error("Failed to fetch:", error);
                toast.error("Gagal memuat data aset");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [periodMonth, periodYear]);

    const handleProcess = async () => {
        setIsProcessing(true);
        try {
            // Update accumulated depreciation in DB for each asset
            for (const row of data) {
                if (row.currentMonth > 0) {
                    await fetch(`/api/aset/${row.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            accumulatedDepreciation: row.accumulatedAfter,
                            bookValue: row.bookValue,
                        }),
                    });
                }
            }
            toast.success("Penyusutan bulan ini berhasil diproses");
        } catch (error) {
            toast.error("Gagal memproses penyusutan");
        } finally {
            setIsProcessing(false);
        }
    };

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Penyusutan Aset"
                description="Jadwal penyusutan aset tetap"
                backHref="/aset"
                actions={
                    <Button onClick={handleProcess} disabled={isProcessing || data.length === 0}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Proses Penyusutan
                    </Button>
                }
            />

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <span className="text-sm text-muted-foreground">Periode:</span>
                        <Select value={periodMonth} onValueChange={setPeriodMonth}>
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {new Date(2000, parseInt(m) - 1).toLocaleDateString("id-ID", { month: "long" })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={periodYear} onValueChange={setPeriodYear}>
                            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {years.map(y => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-primary/10 p-3"><Calculator className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Aset</p><p className="text-2xl font-bold">{stats.totalAssets}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30"><Calendar className="h-5 w-5 text-amber-600" /></div><div><p className="text-sm text-muted-foreground">Penyusutan Bulan Ini</p><p className="text-lg font-bold tabular-nums">{formatCurrency(stats.totalMonthly)}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30"><TrendingDown className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">Akum. Penyusutan</p><p className="text-lg font-bold tabular-nums text-red-600">{formatCurrency(stats.totalAccumulated)}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30"><CheckCircle className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Nilai Buku</p><p className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(stats.totalBookValue)}</p></div></CardContent></Card>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : data.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">Tidak ada aset aktif untuk dihitung penyusutannya.</div>
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
                                            <TableCell className="font-mono text-sm">{row.code}</TableCell>
                                            <TableCell className="font-medium">{row.name}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatCurrency(row.acquisitionCost)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.accumulatedBefore)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-amber-600 font-medium">{formatCurrency(row.currentMonth)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-red-600">{formatCurrency(row.accumulatedAfter)}</TableCell>
                                            <TableCell className="text-right tabular-nums font-bold text-emerald-600">{formatCurrency(row.bookValue)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/50 font-bold">
                                        <TableCell colSpan={4} className="text-right">TOTAL</TableCell>
                                        <TableCell className="text-right tabular-nums text-amber-600">{formatCurrency(stats.totalMonthly)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-red-600">{formatCurrency(stats.totalAccumulated)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(stats.totalBookValue)}</TableCell>
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
