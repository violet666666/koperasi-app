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
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

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
    const currentYear = new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = React.useState<string>("01");
    const [selectedYear, setSelectedYear] = React.useState<string>(String(currentYear));
    const [data, setData] = React.useState<BalanceSheet | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // Fetch data from real API
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const lastDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
                const asOfDate = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
                const response = await reportsApi.neraca({ asOfDate });
                const d = response.data as any;
                setData({
                    period: `${selectedMonth}/${selectedYear}`,
                    assets: {
                        current: d.assets?.current || [],
                        fixed: d.assets?.fixed || [],
                        totalAssets: d.assets?.totalAssets || 0,
                    },
                    liabilities: {
                        shortTerm: d.liabilities?.shortTerm || [],
                        longTerm: d.liabilities?.longTerm || [],
                        totalLiabilities: d.liabilities?.totalLiabilities || 0,
                    },
                    equity: {
                        items: d.equity?.items || [],
                        totalEquity: d.equity?.totalEquity || 0,
                    },
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
        push("=== AKTIVA LANCAR ===", 0);
        data.assets.current.forEach(i => push(`${i.code} - ${i.name}`, i.amount));
        push("=== AKTIVA TETAP ===", 0);
        data.assets.fixed.forEach(i => push(`${i.code} - ${i.name}`, i.amount));
        push("Total Aktiva", data.assets.totalAssets);
        push("=== KEWAJIBAN ===", 0);
        data.liabilities.shortTerm.forEach(i => push(`${i.code} - ${i.name}`, i.amount));
        data.liabilities.longTerm.forEach(i => push(`${i.code} - ${i.name}`, i.amount));
        push("Total Kewajiban", data.liabilities.totalLiabilities);
        push("=== EKUITAS ===", 0);
        data.equity.items.forEach(i => push(`${i.code} - ${i.name}`, i.amount));
        push("Total Ekuitas", data.equity.totalEquity);
        return rows;
    };

    const neracaExportCols: ExportColumn[] = [
        { header: "Keterangan", key: "keterangan", width: 40 },
        { header: "Jumlah (Rp)", key: "jumlah", width: 22, format: (v) => v === 0 ? "" : formatCurrency(Number(v)) },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Laporan Neraca"
                description="Posisi keuangan per periode"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportToExcel(buildExportRows(), neracaExportCols, `Neraca_${monthName}_${selectedYear}`, "Neraca")}>
                            <Download className="mr-2 h-4 w-4" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportToPDF(buildExportRows(), neracaExportCols, `Laporan Neraca ${monthName} ${selectedYear}`, `Neraca_${monthName}_${selectedYear}`)}>
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
