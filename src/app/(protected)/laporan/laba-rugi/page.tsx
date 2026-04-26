"use client";

import * as React from "react";
import { reportsApi } from "@/lib/api";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Download, FileSpreadsheet, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

interface IncomeStatementItem {
    code: string;
    name: string;
    amount: number;
}

interface IncomeStatement {
    period: string;
    income: {
        items: IncomeStatementItem[];
        totalIncome: number;
    };
    expense: {
        items: IncomeStatementItem[];
        totalExpense: number;
    };
    netIncome: number;
}

export default function LabaRugiPage() {
    const currentYear = new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = React.useState<string>("01");
    const [selectedYear, setSelectedYear] = React.useState<string>(String(currentYear));
    const [data, setData] = React.useState<IncomeStatement | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // Fetch real data from API
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const lastDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
                const periodFrom = `${selectedYear}-${selectedMonth}-01`;
                const periodTo = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
                const response = await reportsApi.labaRugi({ periodFrom, periodTo });
                const d = response.data as any;
                setData({
                    period: `${selectedMonth}/${selectedYear}`,
                    income: {
                        items: d.revenue?.items || [],
                        totalIncome: d.revenue?.total || 0,
                    },
                    expense: {
                        items: d.expenses?.items || [],
                        totalExpense: d.expenses?.total || 0,
                    },
                    netIncome: d.netIncome || 0,
                });
            } catch (error) {
                console.error("Failed to fetch:", error);
                setData(null);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedMonth, selectedYear]);

    const monthName = new Date(2000, Number(selectedMonth) - 1).toLocaleDateString("id-ID", { month: "long" });

    const buildExportRows = () => {
        if (!data) return [];
        const rows: Record<string, unknown>[] = [];
        const push = (ket: string, jumlah: number) => rows.push({ keterangan: ket, jumlah });
        push("=== PENDAPATAN ===", 0);
        data.income.items.forEach(i => push(`${i.code} - ${i.name}`, i.amount));
        push("Total Pendapatan", data.income.totalIncome);
        push("=== BIAYA-BIAYA ===", 0);
        data.expense.items.forEach(i => push(`${i.code} - ${i.name}`, -i.amount));
        push("Total Biaya", -data.expense.totalExpense);
        push("SHU (Laba Bersih)", data.netIncome);
        return rows;
    };

    const labaRugiExportCols: ExportColumn[] = [
        { header: "Keterangan", key: "keterangan", width: 40 },
        { header: "Jumlah (Rp)", key: "jumlah", width: 22, format: (v) => v === 0 ? "" : formatCurrency(Number(v)) },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Laporan Laba Rugi"
                description="Hasil usaha per periode"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportToExcel(buildExportRows(), labaRugiExportCols, `Laba_Rugi_${monthName}_${selectedYear}`, "Laba Rugi")}>
                            <Download className="mr-2 h-4 w-4" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportToPDF(buildExportRows(), labaRugiExportCols, `Laporan Laba Rugi ${monthName} ${selectedYear}`, `Laba_Rugi_${monthName}_${selectedYear}`)}>
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                    </div>
                }
            />

            {/* Period Selector */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <span className="text-sm text-muted-foreground">Periode:</span>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 4 }, (_, i) => currentYear - 2 + i).map(y => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            {data && (
                <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Pendapatan</p>
                                <p className="text-lg font-bold tabular-nums text-emerald-600">
                                    {formatCurrency(data.income.totalIncome || 0)}
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
                                <p className="text-sm text-muted-foreground">Total Biaya</p>
                                <p className="text-lg font-bold tabular-nums text-red-600">
                                    {formatCurrency(data.expense.totalExpense || 0)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-primary">
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="rounded-lg bg-primary/10 p-3">
                                <FileSpreadsheet className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">SHU Bulan Ini</p>
                                <p className={`text-xl font-bold tabular-nums ${data.netIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                    {formatCurrency(data.netIncome)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {isLoading ? (
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-96 w-full" />
                    </CardContent>
                </Card>
            ) : data ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5" />
                            Laporan Laba Rugi
                        </CardTitle>
                        <CardDescription>Periode {monthName} {selectedYear}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kode</TableHead>
                                    <TableHead>Nama Akun</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Income Section */}
                                <TableRow className="bg-emerald-50 dark:bg-emerald-900/20">
                                    <TableCell colSpan={3} className="font-bold text-emerald-700 dark:text-emerald-300">
                                        PENDAPATAN
                                    </TableCell>
                                </TableRow>
                                {data.income.items.map((item) => (
                                    <TableRow key={item.code}>
                                        <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right tabular-nums text-emerald-600">
                                            {formatCurrency(item.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-emerald-100/50 dark:bg-emerald-900/30 font-bold">
                                    <TableCell colSpan={2}>TOTAL PENDAPATAN</TableCell>
                                    <TableCell className="text-right tabular-nums text-emerald-700">
                                        {formatCurrency(data.income.totalIncome)}
                                    </TableCell>
                                </TableRow>

                                {/* Expense Section */}
                                <TableRow className="bg-red-50 dark:bg-red-900/20">
                                    <TableCell colSpan={3} className="font-bold text-red-700 dark:text-red-300">
                                        BIAYA-BIAYA
                                    </TableCell>
                                </TableRow>
                                {data.expense.items.map((item) => (
                                    <TableRow key={item.code}>
                                        <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right tabular-nums text-red-600">
                                            ({formatCurrency(item.amount)})
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-red-100/50 dark:bg-red-900/30 font-bold">
                                    <TableCell colSpan={2}>TOTAL BIAYA</TableCell>
                                    <TableCell className="text-right tabular-nums text-red-700">
                                        ({formatCurrency(data.expense.totalExpense)})
                                    </TableCell>
                                </TableRow>

                                {/* Net Income */}
                                <TableRow className="bg-primary/10 font-bold text-lg">
                                    <TableCell colSpan={2}>SISA HASIL USAHA (SHU)</TableCell>
                                    <TableCell className={`text-right tabular-nums ${data.netIncome >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                        {formatCurrency(data.netIncome)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
