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
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Download, Printer, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { reportsApi } from "@/lib/api";

interface IncomeStatementItem {
    code: string;
    name: string;
    amount: number;
    children?: IncomeStatementItem[];
}

// Recursive row component
function IncomeStatementRow({ item, level = 0, type }: { item: IncomeStatementItem; level?: number; type: "income" | "expense" }) {
    const isParent = item.children && item.children.length > 0;
    const paddingLeft = level * 20;
    const colorClass = type === "income" ? "text-emerald-600" : "text-amber-600";

    return (
        <>
            <TableRow className={isParent && level < 2 ? "bg-muted/50" : ""}>
                <TableCell style={{ paddingLeft: paddingLeft + 16 }}>
                    <span className={isParent ? "font-semibold" : ""}>{item.code}</span>
                </TableCell>
                <TableCell style={{ paddingLeft: paddingLeft }}>
                    <span className={isParent ? "font-semibold" : ""}>{item.name}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                    <span className={`${isParent ? "font-semibold" : ""} ${level === 0 ? colorClass : ""}`}>
                        {formatCurrency(item.amount)}
                    </span>
                </TableCell>
            </TableRow>
            {item.children?.map((child) => (
                <IncomeStatementRow key={child.code} item={child} level={level + 1} type={type} />
            ))}
        </>
    );
}

export default function LabaRugiPage() {
    const [period, setPeriod] = React.useState("2025-01");
    const [isLoading, setIsLoading] = React.useState(true);
    const [data, setData] = React.useState<{
        income: IncomeStatementItem[];
        expenses: IncomeStatementItem[];
    }>({ income: [], expenses: [] });

    // Fetch report data from API
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const [year, month] = period.split("-");
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                const periodFrom = `${period}-01`;
                const periodTo = `${period}-${lastDay.toString().padStart(2, "0")}`;

                const response = await reportsApi.labaRugi({ periodFrom, periodTo });
                const reportData = response.data as unknown as {
                    income?: IncomeStatementItem[];
                    expenses?: IncomeStatementItem[];
                };

                setData({
                    income: reportData.income || [],
                    expenses: reportData.expenses || [],
                });
            } catch (error) {
                console.error("Failed to fetch laba rugi:", error);
                setData({ income: [], expenses: [] });
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [period]);

    // Calculate totals
    const totalIncome = data.income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = data.expenses.reduce((sum, item) => sum + item.amount, 0);
    const netIncome = totalIncome - totalExpenses;
    const isProfit = netIncome >= 0;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Laba Rugi"
                description="Laporan pendapatan dan beban koperasi"
                backHref="/laporan"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Printer className="mr-2 h-4 w-4" />
                            Cetak
                        </Button>
                        <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export Excel
                        </Button>
                    </div>
                }
            />

            {/* Period Selector */}
            <div className="flex items-center gap-4">
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Pilih periode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="2025-01">Januari 2025</SelectItem>
                        <SelectItem value="2024-12">Desember 2024</SelectItem>
                        <SelectItem value="2024-11">November 2024</SelectItem>
                        <SelectItem value="2024-10">Oktober 2024</SelectItem>
                    </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                    Periode: 1 - 31 {new Date(period + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </span>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Income Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2 text-emerald-600">
                                <TrendingUp className="h-5 w-5" />
                                PENDAPATAN
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-24">Kode</TableHead>
                                            <TableHead>Nama Akun</TableHead>
                                            <TableHead className="text-right w-40">Jumlah</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.income.length > 0 ? (
                                            data.income.map((item) => (
                                                <IncomeStatementRow key={item.code} item={item} type="income" />
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                    Tidak ada data pendapatan
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="mt-4 flex justify-between items-center p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <span className="font-bold text-emerald-700 dark:text-emerald-300">TOTAL PENDAPATAN</span>
                                <span className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                                    {formatCurrency(totalIncome)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Expenses Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2 text-amber-600">
                                <TrendingDown className="h-5 w-5" />
                                BEBAN
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-24">Kode</TableHead>
                                            <TableHead>Nama Akun</TableHead>
                                            <TableHead className="text-right w-40">Jumlah</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.expenses.length > 0 ? (
                                            data.expenses.map((item) => (
                                                <IncomeStatementRow key={item.code} item={item} type="expense" />
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                    Tidak ada data beban
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="mt-4 flex justify-between items-center p-4 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <span className="font-bold text-amber-700 dark:text-amber-300">TOTAL BEBAN</span>
                                <span className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                                    {formatCurrency(totalExpenses)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Net Income */}
                    <Card className={totalIncome > 0 ? (isProfit ? "border-emerald-500" : "border-red-500") : ""}>
                        <CardContent className="p-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-lg font-bold">
                                        {isProfit ? "SISA HASIL USAHA (SHU)" : "RUGI OPERASIONAL"}
                                    </span>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Pendapatan - Beban
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-3xl font-bold tabular-nums ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
                                        {formatCurrency(Math.abs(netIncome))}
                                    </span>
                                    <p className={`text-sm ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
                                        {isProfit ? "Laba" : "Rugi"}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary Card */}
                    {totalIncome > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Ringkasan</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Total Pendapatan</p>
                                    <p className="text-xl font-bold tabular-nums text-emerald-600">{formatCurrency(totalIncome)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Total Beban</p>
                                    <p className="text-xl font-bold tabular-nums text-amber-600">{formatCurrency(totalExpenses)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Margin</p>
                                    <p className={`text-xl font-bold tabular-nums ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
                                        {totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) : 0}%
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
