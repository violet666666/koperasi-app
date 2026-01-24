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

interface IncomeStatementItem {
    code: string;
    name: string;
    amount: number;
    children?: IncomeStatementItem[];
}

// Mock data
const MOCK_INCOME: IncomeStatementItem[] = [
    {
        code: "4",
        name: "PENDAPATAN",
        amount: 125000000,
        children: [
            {
                code: "4.1",
                name: "Pendapatan Bunga",
                amount: 95000000,
                children: [
                    { code: "4.1.01", name: "Bunga Pinjaman Anggota", amount: 85000000 },
                    { code: "4.1.02", name: "Bunga Deposito Bank", amount: 10000000 },
                ],
            },
            {
                code: "4.2",
                name: "Pendapatan Administrasi",
                amount: 20000000,
                children: [
                    { code: "4.2.01", name: "Biaya Admin Pinjaman", amount: 15000000 },
                    { code: "4.2.02", name: "Biaya Admin Simpanan", amount: 5000000 },
                ],
            },
            {
                code: "4.3",
                name: "Pendapatan Lain-lain",
                amount: 10000000,
                children: [
                    { code: "4.3.01", name: "Denda Keterlambatan", amount: 3000000 },
                    { code: "4.3.02", name: "Pendapatan Non-SP", amount: 7000000 },
                ],
            },
        ],
    },
];

const MOCK_EXPENSES: IncomeStatementItem[] = [
    {
        code: "5",
        name: "BEBAN",
        amount: 75000000,
        children: [
            {
                code: "5.1",
                name: "Beban Bunga",
                amount: 25000000,
                children: [
                    { code: "5.1.01", name: "Bunga Simpanan Sukarela", amount: 20000000 },
                    { code: "5.1.02", name: "Bunga Simpanan Berjangka", amount: 5000000 },
                ],
            },
            {
                code: "5.2",
                name: "Beban Operasional",
                amount: 40000000,
                children: [
                    { code: "5.2.01", name: "Gaji & Tunjangan", amount: 25000000 },
                    { code: "5.2.02", name: "Sewa Gedung", amount: 8000000 },
                    { code: "5.2.03", name: "Listrik & Air", amount: 3000000 },
                    { code: "5.2.04", name: "Perlengkapan Kantor", amount: 2000000 },
                    { code: "5.2.05", name: "Telepon & Internet", amount: 2000000 },
                ],
            },
            {
                code: "5.3",
                name: "Beban Penyusutan",
                amount: 10000000,
                children: [
                    { code: "5.3.01", name: "Penyusutan Bangunan", amount: 5000000 },
                    { code: "5.3.02", name: "Penyusutan Kendaraan", amount: 3000000 },
                    { code: "5.3.03", name: "Penyusutan Inventaris", amount: 2000000 },
                ],
            },
        ],
    },
];

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

    // Simulate loading
    React.useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, [period]);

    const totalIncome = MOCK_INCOME[0].amount;
    const totalExpenses = MOCK_EXPENSES[0].amount;
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
                                        {MOCK_INCOME.map((item) => (
                                            <IncomeStatementRow key={item.code} item={item} type="income" />
                                        ))}
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
                                        {MOCK_EXPENSES.map((item) => (
                                            <IncomeStatementRow key={item.code} item={item} type="expense" />
                                        ))}
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
                    <Card className={isProfit ? "border-emerald-500" : "border-red-500"}>
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
                                    {((netIncome / totalIncome) * 100).toFixed(1)}%
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
