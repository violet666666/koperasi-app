"use client";

import * as React from "react";
import Link from "next/link";
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
import { Download, FileSpreadsheet } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface BalanceSheetItem {
    code: string;
    name: string;
    amount: number;
    children?: BalanceSheetItem[];
}

interface BalanceSheet {
    period: string;
    assets: {
        current: BalanceSheetItem[];
        fixed: BalanceSheetItem[];
        totalAssets: number;
    };
    liabilities: {
        shortTerm: BalanceSheetItem[];
        longTerm: BalanceSheetItem[];
        totalLiabilities: number;
    };
    equity: {
        items: BalanceSheetItem[];
        totalEquity: number;
    };
}

export default function NeracaPage() {
    const [selectedMonth, setSelectedMonth] = React.useState<string>("01");
    const [selectedYear, setSelectedYear] = React.useState<string>("2026");
    const [data, setData] = React.useState<BalanceSheet | null>(null);
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
                    assets: {
                        current: [
                            { code: "1100", name: "Kas", amount: 125000000 },
                            { code: "1110", name: "Bank", amount: 450000000 },
                            { code: "1200", name: "Piutang Anggota", amount: 850000000 },
                            { code: "1210", name: "Cadangan Kerugian Piutang", amount: -25000000 },
                        ],
                        fixed: [
                            { code: "1300", name: "Tanah", amount: 500000000 },
                            { code: "1310", name: "Gedung", amount: 500000000 },
                            { code: "1311", name: "Akum. Penyusutan Gedung", amount: -125000000 },
                            { code: "1320", name: "Kendaraan", amount: 200000000 },
                            { code: "1321", name: "Akum. Penyusutan Kendaraan", amount: -50000000 },
                            { code: "1330", name: "Peralatan", amount: 115000000 },
                            { code: "1331", name: "Akum. Penyusutan Peralatan", amount: -28125000 },
                        ],
                        totalAssets: 2511875000,
                    },
                    liabilities: {
                        shortTerm: [
                            { code: "2100", name: "Simpanan Pokok", amount: 250000000 },
                            { code: "2110", name: "Simpanan Wajib", amount: 750000000 },
                            { code: "2120", name: "Simpanan Sukarela", amount: 450000000 },
                            { code: "2130", name: "Tabungan Anggota", amount: 200000000 },
                        ],
                        longTerm: [
                            { code: "2200", name: "Dana Cadangan", amount: 180000000 },
                            { code: "2210", name: "Dana Pendidikan", amount: 35000000 },
                        ],
                        totalLiabilities: 1865000000,
                    },
                    equity: {
                        items: [
                            { code: "3100", name: "Modal Disetor", amount: 300000000 },
                            { code: "3200", name: "SHU Tahun Lalu", amount: 186875000 },
                            { code: "3300", name: "SHU Tahun Berjalan", amount: 160000000 },
                        ],
                        totalEquity: 646875000,
                    },
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
                title="Laporan Neraca"
                description="Posisi keuangan per periode"
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

            {isLoading ? (
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-96 w-full" />
                    </CardContent>
                </Card>
            ) : data ? (
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Assets */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5" />
                                AKTIVA
                            </CardTitle>
                            <CardDescription>Per {monthName} {selectedYear}</CardDescription>
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
                                    <TableRow className="bg-muted/30">
                                        <TableCell colSpan={3} className="font-semibold">
                                            Aktiva Lancar
                                        </TableCell>
                                    </TableRow>
                                    {data.assets.current.map((item) => (
                                        <TableRow key={item.code}>
                                            <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className={`text-right tabular-nums ${item.amount < 0 ? "text-red-600" : ""}`}>
                                                {item.amount < 0 ? `(${formatCurrency(Math.abs(item.amount))})` : formatCurrency(item.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/30">
                                        <TableCell colSpan={3} className="font-semibold">
                                            Aktiva Tetap
                                        </TableCell>
                                    </TableRow>
                                    {data.assets.fixed.map((item) => (
                                        <TableRow key={item.code}>
                                            <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className={`text-right tabular-nums ${item.amount < 0 ? "text-red-600" : ""}`}>
                                                {item.amount < 0 ? `(${formatCurrency(Math.abs(item.amount))})` : formatCurrency(item.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-primary/10 font-bold">
                                        <TableCell colSpan={2}>TOTAL AKTIVA</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatCurrency(data.assets.totalAssets)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Liabilities & Equity */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5" />
                                PASIVA
                            </CardTitle>
                            <CardDescription>Per {monthName} {selectedYear}</CardDescription>
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
                                    <TableRow className="bg-muted/30">
                                        <TableCell colSpan={3} className="font-semibold">
                                            Kewajiban Jangka Pendek
                                        </TableCell>
                                    </TableRow>
                                    {data.liabilities.shortTerm.map((item) => (
                                        <TableRow key={item.code}>
                                            <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(item.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/30">
                                        <TableCell colSpan={3} className="font-semibold">
                                            Kewajiban Jangka Panjang
                                        </TableCell>
                                    </TableRow>
                                    {data.liabilities.longTerm.map((item) => (
                                        <TableRow key={item.code}>
                                            <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(item.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/30">
                                        <TableCell colSpan={3} className="font-semibold">
                                            Ekuitas
                                        </TableCell>
                                    </TableRow>
                                    {data.equity.items.map((item) => (
                                        <TableRow key={item.code}>
                                            <TableCell className="font-mono text-sm">{item.code}</TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(item.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-primary/10 font-bold">
                                        <TableCell colSpan={2}>TOTAL PASIVA</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatCurrency(data.liabilities.totalLiabilities + data.equity.totalEquity)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ) : null}
        </div>
    );
}
