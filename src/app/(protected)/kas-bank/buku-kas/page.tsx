"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    BookOpen,
    Download,
    Printer,
    TrendingUp,
    TrendingDown,
    Wallet,
    ArrowUpCircle,
    ArrowDownCircle,
} from "lucide-react";
import { formatCurrency, CASH_BANK_CATEGORIES } from "@/lib/constants";
import { api } from "@/lib/api/client";

interface BukuKasEntry {
    id: number;
    transactionDate: string;
    transactionNo: string;
    description: string;
    category: string | null;
    debit: number;
    credit: number;
    saldo: number;
    account?: { id: number; code: string; name: string; type: string };
}

interface BukuKasData {
    period: { month: number; year: number; label: string };
    openingBalance: number;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
    entries: BukuKasEntry[];
    accounts: { id: number; code: string; name: string; type: string }[];
}

const categoryLabels: Record<string, string> = Object.fromEntries(
    Object.entries(CASH_BANK_CATEGORIES).map(([k, v]) => [k, v.label])
);

const MONTHS = [
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
];

export default function BukuKasPage() {
    const now = new Date();
    const [selectedAccount, setSelectedAccount] = React.useState("all");
    const [selectedMonth, setSelectedMonth] = React.useState(String(now.getMonth() + 1));
    const [selectedYear, setSelectedYear] = React.useState(String(now.getFullYear()));
    const [selectedCategory, setSelectedCategory] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [data, setData] = React.useState<BukuKasData | null>(null);

    // Generate year options (5 years back and 1 forward)
    const yearOptions = React.useMemo(() => {
        const years: string[] = [];
        for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
            years.push(String(y));
        }
        return years;
    }, []);

    // Fetch data
    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const params: Record<string, string> = {
                month: selectedMonth,
                year: selectedYear,
            };
            if (selectedAccount !== "all") params.accountId = selectedAccount;
            if (selectedCategory !== "all") params.category = selectedCategory;

            const response = await api.get<{ data: BukuKasData }>("/cash-bank/book", { params });
            setData(response.data);
        } catch (error) {
            console.error("Failed to fetch buku kas:", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedAccount, selectedMonth, selectedYear, selectedCategory]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Print handler
    const handlePrint = () => {
        window.print();
    };

    const entries = data?.entries || [];
    const accounts = data?.accounts || [];

    return (
        <div className="space-y-6">
            <div className="print:hidden">
                <PageHeader
                    title="Buku Kas"
                    description="Catatan kas masuk dan keluar PRIMKOPPOL dengan saldo berjalan"
                    backHref="/kas-bank"
                    actions={
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handlePrint}>
                                <Printer className="mr-2 h-4 w-4" />
                                Cetak
                            </Button>
                        </div>
                    }
                />
            </div>

            {/* Filters */}
            <Card className="print:hidden">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3">
                        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Akun Kas/Bank" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Akun</SelectItem>
                                {accounts.map((acc) => (
                                    <SelectItem key={acc.id} value={String(acc.id)}>
                                        {acc.name} ({acc.code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Bulan" />
                            </SelectTrigger>
                            <SelectContent>
                                {MONTHS.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Tahun" />
                            </SelectTrigger>
                            <SelectContent>
                                {yearOptions.map((y) => (
                                    <SelectItem key={y} value={y}>
                                        {y}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                {Object.entries(CASH_BANK_CATEGORIES).map(([key, val]) => (
                                    <SelectItem key={key} value={key}>
                                        {val.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-4 print:hidden">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Saldo Awal</p>
                            <p className="text-lg font-bold tabular-nums">
                                {data ? formatCurrency(data.openingBalance) : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Masuk (Debit)</p>
                            <p className="text-lg font-bold tabular-nums text-emerald-600">
                                {data ? formatCurrency(data.totalDebit) : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-red-100 p-2.5 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            <TrendingDown className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Keluar (Kredit)</p>
                            <p className="text-lg font-bold tabular-nums text-red-600">
                                {data ? formatCurrency(data.totalCredit) : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Saldo Akhir</p>
                            <p className="text-lg font-bold tabular-nums">
                                {data ? formatCurrency(data.closingBalance) : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Print Header (only visible when printing) */}
            <div className="hidden print:flex items-center gap-4 mb-6">
                <div className="bg-slate-900 p-2 rounded-lg flex-shrink-0" style={{ width: "160px", height: "160px" }}>
                    <img
                        src="/LogoPrimkoppol.png"
                        alt="Logo Primkoppol"
                        className="w-full h-full object-contain"
                    />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-black">BUKU KAS</h1>
                    <h2 className="text-lg font-bold text-black">PRIMKOPPOL RESOR LUMAJANG</h2>
                    <p className="text-sm font-medium text-black mt-1">
                        Periode: {data?.period?.label || "-"}
                    </p>
                </div>
            </div>

            {/* Buku Kas Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6 space-y-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <Card className="print:border-0 print:shadow-none">
                    <CardContent className="p-0 print:p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[110px] font-bold">Tanggal</TableHead>
                                        <TableHead className="w-[130px] font-bold">No. Bukti</TableHead>
                                        <TableHead className="font-bold">Keterangan</TableHead>
                                        <TableHead className="w-[155px] text-right font-bold">
                                            <span className="flex items-center justify-end gap-1">
                                                <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" />
                                                Masuk (Debit)
                                            </span>
                                        </TableHead>
                                        <TableHead className="w-[155px] text-right font-bold">
                                            <span className="flex items-center justify-end gap-1">
                                                <ArrowUpCircle className="h-3.5 w-3.5 text-red-500" />
                                                Keluar (Kredit)
                                            </span>
                                        </TableHead>
                                        <TableHead className="w-[155px] text-right font-bold">Saldo</TableHead>
                                        <TableHead className="w-[150px] font-bold print:hidden">Kategori</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* Opening Balance Row */}
                                    <TableRow className="bg-blue-50/50 dark:bg-blue-950/20 font-medium">
                                        <TableCell colSpan={3} className="italic text-muted-foreground">
                                            Saldo Awal Periode
                                        </TableCell>
                                        <TableCell className="text-right">-</TableCell>
                                        <TableCell className="text-right">-</TableCell>
                                        <TableCell className="text-right font-bold tabular-nums text-primary">
                                            {formatCurrency(data?.openingBalance || 0)}
                                        </TableCell>
                                        <TableCell className="print:hidden">-</TableCell>
                                    </TableRow>

                                    {/* Transaction Rows */}
                                    {entries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                Tidak ada transaksi pada periode ini
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        entries.map((entry) => {
                                            const isKeluar = entry.credit > 0;
                                            return (
                                                <TableRow
                                                    key={entry.id}
                                                    className={isKeluar ? "bg-red-50/30 dark:bg-red-950/10" : ""}
                                                >
                                                    <TableCell className="tabular-nums text-sm">
                                                        {new Date(entry.transactionDate).toLocaleDateString("id-ID", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric",
                                                        })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-mono text-xs text-muted-foreground">
                                                            {entry.transactionNo}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="max-w-[300px]">
                                                            <p className="text-sm font-medium truncate">
                                                                {entry.description}
                                                            </p>
                                                            {entry.account && selectedAccount === "all" && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    {entry.account.name}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {entry.debit > 0 ? (
                                                            <span className="font-semibold text-emerald-600">
                                                                {formatCurrency(entry.debit)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {entry.credit > 0 ? (
                                                            <span className="font-semibold text-red-600">
                                                                {formatCurrency(entry.credit)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-bold text-primary">
                                                        {formatCurrency(entry.saldo)}
                                                    </TableCell>
                                                    <TableCell className="print:hidden">
                                                        {entry.category && categoryLabels[entry.category] ? (
                                                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                                                                {categoryLabels[entry.category]}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                    {/* Footer Summary */}
                                    {entries.length > 0 && (
                                        <TableRow className="bg-muted/60 font-bold hover:bg-muted/60 print:break-inside-avoid">
                                            <TableCell colSpan={3} className="text-right">
                                                TOTAL
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-emerald-600">
                                                {formatCurrency(data?.totalDebit || 0)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-red-600">
                                                {formatCurrency(data?.totalCredit || 0)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-primary font-bold">
                                                {formatCurrency(data?.closingBalance || 0)}
                                            </TableCell>
                                            <TableCell className="print:hidden" />
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Info Box */}
            <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 print:hidden">
                <CardContent className="p-4">
                    <div className="flex gap-3">
                        <BookOpen className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                            <p className="font-medium">Keterangan Buku Kas:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                                <li><strong>Masuk (Debit)</strong> — Uang yang diterima koperasi</li>
                                <li><strong>Keluar (Kredit)</strong> — Uang yang dikeluarkan koperasi</li>
                                <li><strong>Saldo</strong> — Saldo berjalan otomatis (Saldo sebelumnya + Masuk - Keluar)</li>
                                <li>Baris berwarna <span className="text-red-600 font-medium">merah tipis</span> adalah transaksi pengeluaran</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
