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
import { Download, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface CashFlowItem {
    description: string;
    amount: number;
}

interface CashFlowStatement {
    period: string;
    openingBalance: number;
    closingBalance: number;
    operating: {
        inflows: CashFlowItem[];
        outflows: CashFlowItem[];
        netOperating: number;
    };
    investing: {
        inflows: CashFlowItem[];
        outflows: CashFlowItem[];
        netInvesting: number;
    };
    financing: {
        inflows: CashFlowItem[];
        outflows: CashFlowItem[];
        netFinancing: number;
    };
    netChange: number;
}

export default function ArusKasPage() {
    const [selectedMonth, setSelectedMonth] = React.useState<string>("01");
    const [selectedYear, setSelectedYear] = React.useState<string>("2026");
    const [data, setData] = React.useState<CashFlowStatement | null>(null);
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
                    openingBalance: 550000000,
                    closingBalance: 575000000,
                    operating: {
                        inflows: [
                            { description: "Penerimaan Angsuran Pinjaman", amount: 185000000 },
                            { description: "Penerimaan Bunga Pinjaman", amount: 75000000 },
                            { description: "Penerimaan Simpanan Anggota", amount: 45000000 },
                            { description: "Pendapatan Administrasi", amount: 15000000 },
                        ],
                        outflows: [
                            { description: "Pencairan Pinjaman Anggota", amount: -150000000 },
                            { description: "Pembayaran Gaji Karyawan", amount: -22500000 },
                            { description: "Biaya Operasional", amount: -8500000 },
                            { description: "Penarikan Simpanan Anggota", amount: -35000000 },
                        ],
                        netOperating: 104000000,
                    },
                    investing: {
                        inflows: [
                            { description: "Penjualan Aset Tetap", amount: 0 },
                        ],
                        outflows: [
                            { description: "Pembelian Peralatan Kantor", amount: -15000000 },
                        ],
                        netInvesting: -15000000,
                    },
                    financing: {
                        inflows: [
                            { description: "Simpanan Pokok Anggota Baru", amount: 5000000 },
                        ],
                        outflows: [
                            { description: "Pembayaran SHU Anggota", amount: -69000000 },
                        ],
                        netFinancing: -64000000,
                    },
                    netChange: 25000000,
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
                title="Laporan Arus Kas"
                description="Pergerakan kas per periode"
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
                            <div className="rounded-lg bg-muted p-3">
                                <Wallet className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Saldo Awal</p>
                                <p className="text-lg font-bold tabular-nums">
                                    {formatCurrency(data.openingBalance)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className={`rounded-lg p-3 ${data.netChange >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                                {data.netChange >= 0 ? (
                                    <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
                                ) : (
                                    <ArrowDownCircle className="h-5 w-5 text-red-600" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Perubahan Kas</p>
                                <p className={`text-lg font-bold tabular-nums ${data.netChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                    {data.netChange >= 0 ? "+" : ""}{formatCurrency(data.netChange)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-primary">
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="rounded-lg bg-primary/10 p-3">
                                <Wallet className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Saldo Akhir</p>
                                <p className="text-xl font-bold tabular-nums text-primary">
                                    {formatCurrency(data.closingBalance)}
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
                        <CardTitle className="text-lg">Laporan Arus Kas</CardTitle>
                        <CardDescription>Periode {monthName} {selectedYear}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Opening Balance */}
                                <TableRow className="bg-muted/50 font-semibold">
                                    <TableCell>Saldo Kas Awal Periode</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(data.openingBalance)}
                                    </TableCell>
                                </TableRow>

                                {/* Operating Activities */}
                                <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                                    <TableCell colSpan={2} className="font-bold text-blue-700 dark:text-blue-300">
                                        ARUS KAS DARI AKTIVITAS OPERASI
                                    </TableCell>
                                </TableRow>
                                {data.operating.inflows.map((item, idx) => (
                                    <TableRow key={`op-in-${idx}`}>
                                        <TableCell className="pl-6">{item.description}</TableCell>
                                        <TableCell className="text-right tabular-nums text-emerald-600">
                                            {formatCurrency(item.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {data.operating.outflows.map((item, idx) => (
                                    <TableRow key={`op-out-${idx}`}>
                                        <TableCell className="pl-6">{item.description}</TableCell>
                                        <TableCell className="text-right tabular-nums text-red-600">
                                            ({formatCurrency(Math.abs(item.amount))})
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-blue-100/50 dark:bg-blue-900/30 font-semibold">
                                    <TableCell>Arus Kas Bersih Aktivitas Operasi</TableCell>
                                    <TableCell className={`text-right tabular-nums ${data.operating.netOperating >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                        {formatCurrency(data.operating.netOperating)}
                                    </TableCell>
                                </TableRow>

                                {/* Investing Activities */}
                                <TableRow className="bg-purple-50 dark:bg-purple-900/20">
                                    <TableCell colSpan={2} className="font-bold text-purple-700 dark:text-purple-300">
                                        ARUS KAS DARI AKTIVITAS INVESTASI
                                    </TableCell>
                                </TableRow>
                                {data.investing.inflows.concat(data.investing.outflows).map((item, idx) => (
                                    <TableRow key={`inv-${idx}`}>
                                        <TableCell className="pl-6">{item.description}</TableCell>
                                        <TableCell className={`text-right tabular-nums ${item.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                            {item.amount >= 0 ? formatCurrency(item.amount) : `(${formatCurrency(Math.abs(item.amount))})`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-purple-100/50 dark:bg-purple-900/30 font-semibold">
                                    <TableCell>Arus Kas Bersih Aktivitas Investasi</TableCell>
                                    <TableCell className={`text-right tabular-nums ${data.investing.netInvesting >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                        {data.investing.netInvesting >= 0 ? formatCurrency(data.investing.netInvesting) : `(${formatCurrency(Math.abs(data.investing.netInvesting))})`}
                                    </TableCell>
                                </TableRow>

                                {/* Financing Activities */}
                                <TableRow className="bg-amber-50 dark:bg-amber-900/20">
                                    <TableCell colSpan={2} className="font-bold text-amber-700 dark:text-amber-300">
                                        ARUS KAS DARI AKTIVITAS PENDANAAN
                                    </TableCell>
                                </TableRow>
                                {data.financing.inflows.concat(data.financing.outflows).map((item, idx) => (
                                    <TableRow key={`fin-${idx}`}>
                                        <TableCell className="pl-6">{item.description}</TableCell>
                                        <TableCell className={`text-right tabular-nums ${item.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                            {item.amount >= 0 ? formatCurrency(item.amount) : `(${formatCurrency(Math.abs(item.amount))})`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-amber-100/50 dark:bg-amber-900/30 font-semibold">
                                    <TableCell>Arus Kas Bersih Aktivitas Pendanaan</TableCell>
                                    <TableCell className={`text-right tabular-nums ${data.financing.netFinancing >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                        {data.financing.netFinancing >= 0 ? formatCurrency(data.financing.netFinancing) : `(${formatCurrency(Math.abs(data.financing.netFinancing))})`}
                                    </TableCell>
                                </TableRow>

                                {/* Net Change */}
                                <TableRow className="bg-muted font-bold">
                                    <TableCell>Kenaikan/(Penurunan) Kas Bersih</TableCell>
                                    <TableCell className={`text-right tabular-nums ${data.netChange >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                        {data.netChange >= 0 ? formatCurrency(data.netChange) : `(${formatCurrency(Math.abs(data.netChange))})`}
                                    </TableCell>
                                </TableRow>

                                {/* Closing Balance */}
                                <TableRow className="bg-primary/10 font-bold text-lg">
                                    <TableCell>Saldo Kas Akhir Periode</TableCell>
                                    <TableCell className="text-right tabular-nums text-primary">
                                        {formatCurrency(data.closingBalance)}
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
