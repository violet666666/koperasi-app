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
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { reportsApi } from "@/lib/api";

interface BalanceSheetItem {
    code: string;
    name: string;
    balance: number;
    children?: BalanceSheetItem[];
}

// Recursive row component
function BalanceSheetRow({ item, level = 0 }: { item: BalanceSheetItem; level?: number }) {
    const isParent = item.children && item.children.length > 0;
    const paddingLeft = level * 20;

    return (
        <>
            <TableRow className={isParent && level < 2 ? "bg-muted/50" : ""}>
                <TableCell style={{ paddingLeft: paddingLeft + 16 }}>
                    <span className={isParent ? "font-semibold" : ""}>
                        {item.code}
                    </span>
                </TableCell>
                <TableCell style={{ paddingLeft: paddingLeft }}>
                    <span className={isParent ? "font-semibold" : ""}>
                        {item.name}
                    </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                    <span className={isParent ? "font-semibold" : ""}>
                        {formatCurrency(Math.abs(item.balance))}
                        {item.balance < 0 && <span className="text-muted-foreground"> (akum.)</span>}
                    </span>
                </TableCell>
            </TableRow>
            {item.children?.map((child) => (
                <BalanceSheetRow key={child.code} item={child} level={level + 1} />
            ))}
        </>
    );
}

export default function NeracaPage() {
    const [period, setPeriod] = React.useState("2025-01");
    const [isLoading, setIsLoading] = React.useState(true);
    const [data, setData] = React.useState<{
        assets: BalanceSheetItem[];
        liabilities: BalanceSheetItem[];
        equity: BalanceSheetItem[];
    }>({ assets: [], liabilities: [], equity: [] });

    // Fetch report data from API
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const [year, month] = period.split("-");
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                const asOfDate = `${period}-${lastDay.toString().padStart(2, "0")}`;

                const response = await reportsApi.neraca({ asOfDate });
                const reportData = response.data as unknown as {
                    assets?: BalanceSheetItem[];
                    liabilities?: BalanceSheetItem[];
                    equity?: BalanceSheetItem[];
                };

                setData({
                    assets: reportData.assets || [],
                    liabilities: reportData.liabilities || [],
                    equity: reportData.equity || [],
                });
            } catch (error) {
                console.error("Failed to fetch neraca:", error);
                // Set empty data on error
                setData({ assets: [], liabilities: [], equity: [] });
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [period]);

    // Calculate totals
    const totalAssets = data.assets.reduce((sum, item) => sum + item.balance, 0);
    const totalLiabilities = data.liabilities.reduce((sum, item) => sum + item.balance, 0);
    const totalEquity = data.equity.reduce((sum, item) => sum + item.balance, 0);
    const isBalanced = totalAssets === totalLiabilities + totalEquity;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Neraca"
                description="Laporan posisi keuangan koperasi"
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
                    Per tanggal: {new Date(period + "-28").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </span>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-96" />
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Assets */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5" />
                                ASET
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-20">Kode</TableHead>
                                            <TableHead>Nama Akun</TableHead>
                                            <TableHead className="text-right w-32">Saldo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.assets.length > 0 ? (
                                            data.assets.map((item) => (
                                                <BalanceSheetRow key={item.code} item={item} />
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                    Tidak ada data
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="mt-4 flex justify-between items-center p-4 bg-primary/10 rounded-lg">
                                <span className="font-bold">TOTAL ASET</span>
                                <span className="text-xl font-bold tabular-nums">{formatCurrency(totalAssets)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Liabilities & Equity */}
                    <div className="space-y-6">
                        {/* Liabilities */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5" />
                                    KEWAJIBAN
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-20">Kode</TableHead>
                                                <TableHead>Nama Akun</TableHead>
                                                <TableHead className="text-right w-32">Saldo</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.liabilities.length > 0 ? (
                                                data.liabilities.map((item) => (
                                                    <BalanceSheetRow key={item.code} item={item} />
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                        Tidak ada data
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="mt-4 flex justify-between items-center p-3 bg-muted rounded-lg">
                                    <span className="font-semibold">Total Kewajiban</span>
                                    <span className="font-bold tabular-nums">{formatCurrency(totalLiabilities)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Equity */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5" />
                                    MODAL
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-20">Kode</TableHead>
                                                <TableHead>Nama Akun</TableHead>
                                                <TableHead className="text-right w-32">Saldo</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.equity.length > 0 ? (
                                                data.equity.map((item) => (
                                                    <BalanceSheetRow key={item.code} item={item} />
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                        Tidak ada data
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="mt-4 flex justify-between items-center p-3 bg-muted rounded-lg">
                                    <span className="font-semibold">Total Modal</span>
                                    <span className="font-bold tabular-nums">{formatCurrency(totalEquity)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Total Liabilities + Equity */}
                        <div className={`flex justify-between items-center p-4 rounded-lg ${isBalanced || (totalAssets === 0 && totalLiabilities === 0) ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                            <span className="font-bold">TOTAL KEWAJIBAN + MODAL</span>
                            <span className="text-xl font-bold tabular-nums">{formatCurrency(totalLiabilities + totalEquity)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Balance Check */}
            {!isLoading && totalAssets > 0 && (
                <Card className={isBalanced ? "border-emerald-500" : "border-red-500"}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">Status Neraca:</span>
                            <span className={`font-bold ${isBalanced ? "text-emerald-600" : "text-red-600"}`}>
                                {isBalanced ? "✓ BALANCE" : "✗ TIDAK BALANCE"}
                            </span>
                        </div>
                        {!isBalanced && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Selisih: {formatCurrency(Math.abs(totalAssets - totalLiabilities - totalEquity))}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
