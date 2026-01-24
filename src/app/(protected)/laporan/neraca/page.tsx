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

interface BalanceSheetItem {
    code: string;
    name: string;
    balance: number;
    children?: BalanceSheetItem[];
}

// Mock data
const MOCK_ASSETS: BalanceSheetItem[] = [
    {
        code: "1",
        name: "ASET",
        balance: 850000000,
        children: [
            {
                code: "1.1",
                name: "Aset Lancar",
                balance: 650000000,
                children: [
                    { code: "1.1.01", name: "Kas", balance: 30000000 },
                    { code: "1.1.02", name: "Bank", balance: 235000000 },
                    { code: "1.1.03", name: "Piutang Anggota - Simpanan", balance: 5000000 },
                    { code: "1.1.04", name: "Piutang Anggota - Pinjaman", balance: 380000000 },
                ],
            },
            {
                code: "1.2",
                name: "Aset Tetap",
                balance: 200000000,
                children: [
                    { code: "1.2.01", name: "Tanah & Bangunan", balance: 150000000 },
                    { code: "1.2.02", name: "Kendaraan", balance: 80000000 },
                    { code: "1.2.03", name: "Inventaris Kantor", balance: 30000000 },
                    { code: "1.2.04", name: "Akumulasi Penyusutan", balance: -60000000 },
                ],
            },
        ],
    },
];

const MOCK_LIABILITIES: BalanceSheetItem[] = [
    {
        code: "2",
        name: "KEWAJIBAN",
        balance: 450000000,
        children: [
            {
                code: "2.1",
                name: "Kewajiban Lancar",
                balance: 50000000,
                children: [
                    { code: "2.1.01", name: "Hutang Usaha", balance: 20000000 },
                    { code: "2.1.02", name: "Hutang Pajak", balance: 15000000 },
                    { code: "2.1.03", name: "Beban yang Masih Harus Dibayar", balance: 15000000 },
                ],
            },
            {
                code: "2.2",
                name: "Simpanan Anggota",
                balance: 400000000,
                children: [
                    { code: "2.2.01", name: "Simpanan Pokok", balance: 50000000 },
                    { code: "2.2.02", name: "Simpanan Wajib", balance: 150000000 },
                    { code: "2.2.03", name: "Simpanan Sukarela", balance: 200000000 },
                ],
            },
        ],
    },
];

const MOCK_EQUITY: BalanceSheetItem[] = [
    {
        code: "3",
        name: "MODAL",
        balance: 400000000,
        children: [
            { code: "3.1.01", name: "Modal Penyertaan", balance: 100000000 },
            { code: "3.1.02", name: "Cadangan Umum", balance: 200000000 },
            { code: "3.1.03", name: "Cadangan Risiko", balance: 50000000 },
            { code: "3.1.04", name: "SHU Tahun Berjalan", balance: 50000000 },
        ],
    },
];

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

    // Simulate loading
    React.useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, [period]);

    const totalAssets = MOCK_ASSETS[0].balance;
    const totalLiabilities = MOCK_LIABILITIES[0].balance;
    const totalEquity = MOCK_EQUITY[0].balance;
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
                    Per tanggal: {new Date(period + "-31").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
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
                                        {MOCK_ASSETS.map((item) => (
                                            <BalanceSheetRow key={item.code} item={item} />
                                        ))}
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
                                            {MOCK_LIABILITIES.map((item) => (
                                                <BalanceSheetRow key={item.code} item={item} />
                                            ))}
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
                                            {MOCK_EQUITY.map((item) => (
                                                <BalanceSheetRow key={item.code} item={item} />
                                            ))}
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
                        <div className={`flex justify-between items-center p-4 rounded-lg ${isBalanced ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                            <span className="font-bold">TOTAL KEWAJIBAN + MODAL</span>
                            <span className="text-xl font-bold tabular-nums">{formatCurrency(totalLiabilities + totalEquity)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Balance Check */}
            {!isLoading && (
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
