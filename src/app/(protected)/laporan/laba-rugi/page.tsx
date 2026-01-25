"use client";

import * as React from "react";
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
import { Download, FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface IncomeStatementItem {
    code: string;
    name: string;
    amount: number;
}

interface IncomeStatement {
    period: string;
    income: {
        operational: IncomeStatementItem[];
        other: IncomeStatementItem[];
        totalIncome: number;
    };
    expense: {
        operational: IncomeStatementItem[];
        administrative: IncomeStatementItem[];
        other: IncomeStatementItem[];
        totalExpense: number;
    };
    netIncome: number;
}

export default function LabaRugiPage() {
    const [selectedMonth, setSelectedMonth] = React.useState<string>("01");
    const [selectedYear, setSelectedYear] = React.useState<string>("2026");
    const [data, setData] = React.useState<IncomeStatement | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                setData({
                    period: `${selectedMonth}/${selectedYear}`,
                    income: {
                        operational: [
                            { code: "4100", name: "Pendapatan Bunga Pinjaman", amount: 75000000 },
                            { code: "4110", name: "Pendapatan Administrasi", amount: 15000000 },
                            { code: "4120", name: "Pendapatan Provisi", amount: 8500000 },
                        ],
                        other: [
                            { code: "4200", name: "Pendapatan Jasa Giro", amount: 2500000 },
                            { code: "4210", name: "Pendapatan Lain-lain", amount: 1500000 },
                        ],
                        totalIncome: 102500000,
                    },
                    expense: {
                        operational: [
                            { code: "5100", name: "Biaya Bunga Simpanan", amount: 25000000 },
                            { code: "5110", name: "Cadangan Risiko Kredit", amount: 5000000 },
                        ],
                        administrative: [
                            { code: "5200", name: "Gaji Karyawan", amount: 18000000 },
                            { code: "5210", name: "Tunjangan Karyawan", amount: 4500000 },
                            { code: "5220", name: "Biaya Listrik/Air/Telepon", amount: 3500000 },
                            { code: "5230", name: "Biaya Perlengkapan", amount: 1500000 },
                            { code: "5240", name: "Biaya Penyusutan", amount: 5729167 },
                            { code: "5250", name: "Biaya Sewa", amount: 5000000 },
                        ],
                        other: [
                            { code: "5300", name: "Biaya Administrasi Bank", amount: 500000 },
                            { code: "5310", name: "Biaya Lain-lain", amount: 1200000 },
                        ],
                        totalExpense: 69929167,
                    },
                    netIncome: 32570833,
                });
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedMonth, selectedYear]);

    const monthName = new Date(2000, Number(selectedMonth) - 1).toLocaleDateString("id-ID", { month: "long" });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Laporan Laba Rugi"
                description="Hasil usaha per periode"
                actions={
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
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
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
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
                                    {formatCurrency(data.income.totalIncome)}
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
                                    {formatCurrency(data.expense.totalExpense)}
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
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={3} className="font-semibold">
                                        Pendapatan Operasional
                                    </TableCell>
                                </TableRow>
                                {data.income.operational.map((item) => (
                                    <TableRow key={item.code}>
                                        <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right tabular-nums text-emerald-600">
                                            {formatCurrency(item.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={3} className="font-semibold">
                                        Pendapatan Lain-lain
                                    </TableCell>
                                </TableRow>
                                {data.income.other.map((item) => (
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
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={3} className="font-semibold">
                                        Biaya Operasional
                                    </TableCell>
                                </TableRow>
                                {data.expense.operational.map((item) => (
                                    <TableRow key={item.code}>
                                        <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right tabular-nums text-red-600">
                                            ({formatCurrency(item.amount)})
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={3} className="font-semibold">
                                        Biaya Administrasi dan Umum
                                    </TableCell>
                                </TableRow>
                                {data.expense.administrative.map((item) => (
                                    <TableRow key={item.code}>
                                        <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right tabular-nums text-red-600">
                                            ({formatCurrency(item.amount)})
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={3} className="font-semibold">
                                        Biaya Lain-lain
                                    </TableCell>
                                </TableRow>
                                {data.expense.other.map((item) => (
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
