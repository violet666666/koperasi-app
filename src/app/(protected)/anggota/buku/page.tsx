"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
    BookOpen,
    Search,
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    CreditCard,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { ExportButton, formatCurrencyExport, formatDateExport } from "@/components/patterns/export-button";
import { PrintButton } from "@/components/patterns/print-button";

interface Transaction {
    id: number;
    date: string;
    type: "simpanan" | "penarikan" | "angsuran" | "pinjaman";
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

interface MemberBook {
    memberId: number;
    memberNo: string;
    name: string;
    totalSimpanan: number;
    sisaPinjaman: number;
    transactions: Transaction[];
}

export default function BukuAnggotaPage() {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedMonth, setSelectedMonth] = React.useState<string>("all");
    const [data, setData] = React.useState<MemberBook | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    // Search member
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));

            // Mock data
            setData({
                memberId: 1,
                memberNo: "A-001",
                name: "AKBP Budi Santoso, S.I.K.",
                totalSimpanan: 45000000,
                sisaPinjaman: 75000000,
                transactions: [
                    { id: 1, date: "2026-01-02", type: "simpanan", description: "Simpanan Wajib Januari", debit: 0, credit: 500000, balance: 45500000 },
                    { id: 2, date: "2026-01-05", type: "angsuran", description: "Angsuran Pinjaman #PJ-2025-001", debit: 2500000, credit: 0, balance: 43000000 },
                    { id: 3, date: "2026-01-10", type: "simpanan", description: "Simpanan Sukarela", debit: 0, credit: 2000000, balance: 45000000 },
                    { id: 4, date: "2025-12-28", type: "angsuran", description: "Angsuran Pinjaman #PJ-2025-001", debit: 2500000, credit: 0, balance: 42500000 },
                    { id: 5, date: "2025-12-15", type: "penarikan", description: "Penarikan Simpanan Sukarela", debit: 5000000, credit: 0, balance: 45000000 },
                    { id: 6, date: "2025-12-02", type: "simpanan", description: "Simpanan Wajib Desember", debit: 0, credit: 500000, balance: 50000000 },
                    { id: 7, date: "2025-11-25", type: "pinjaman", description: "Pencairan Pinjaman #PJ-2025-001", debit: 0, credit: 100000000, balance: 49500000 },
                ],
            });
        } catch (error) {
            toast.error("Anggota tidak ditemukan");
        } finally {
            setIsLoading(false);
        }
    };

    // Filter transactions
    const filteredTransactions = data?.transactions.filter(t => {
        if (selectedMonth === "all") return true;
        const txMonth = new Date(t.date).getMonth() + 1;
        return txMonth === parseInt(selectedMonth);
    }) || [];

    const getTypeColor = (type: string) => {
        switch (type) {
            case "simpanan": return "bg-emerald-100 text-emerald-700";
            case "penarikan": return "bg-red-100 text-red-700";
            case "angsuran": return "bg-blue-100 text-blue-700";
            case "pinjaman": return "bg-purple-100 text-purple-700";
            default: return "";
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "simpanan": return "Setoran";
            case "penarikan": return "Penarikan";
            case "angsuran": return "Angsuran";
            case "pinjaman": return "Pinjaman";
            default: return type;
        }
    };

    const exportColumns = [
        { key: "date", header: "Tanggal", format: formatDateExport },
        { key: "type", header: "Jenis" },
        { key: "description", header: "Keterangan" },
        { key: "debit", header: "Debit", format: formatCurrencyExport },
        { key: "credit", header: "Kredit", format: formatCurrencyExport },
        { key: "balance", header: "Saldo", format: formatCurrencyExport },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Buku Transaksi Anggota"
                description="Riwayat transaksi lengkap anggota"
                actions={
                    data && (
                        <div className="flex gap-2">
                            <ExportButton
                                title={`Buku Transaksi - ${data.name}`}
                                filename={`buku_transaksi_${data.memberNo}`}
                                columns={exportColumns}
                                data={filteredTransactions}
                            />
                            <PrintButton elementId="printable-area" title="Buku Transaksi" />
                        </div>
                    )
                }
            />

            {/* Search */}
            <Card className="no-print">
                <CardContent className="p-4">
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <Input
                                placeholder="Cari no. anggota atau NRP..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={isLoading}>
                            <Search className="mr-2 h-4 w-4" />
                            Cari
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            ) : data ? (
                <div id="printable-area">
                    {/* Member Info & Summary */}
                    <div className="grid gap-4 sm:grid-cols-3 mb-6">
                        <Card className="sm:col-span-1 print-info">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2 no-print">
                                        <BookOpen className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">{data.memberNo}</p>
                                        <p className="font-bold">{data.name}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="print-info">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30 no-print">
                                    <Wallet className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Simpanan</p>
                                    <p className="text-lg font-bold text-emerald-600">
                                        {formatCurrency(data.totalSimpanan)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="print-info">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30 no-print">
                                    <CreditCard className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Sisa Pinjaman</p>
                                    <p className="text-lg font-bold text-amber-600">
                                        {formatCurrency(data.sisaPinjaman)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card className="no-print mb-6">
                        <CardContent className="p-4">
                            <div className="flex flex-wrap gap-4 items-center">
                                <span className="text-sm text-muted-foreground">Filter:</span>
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="Bulan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Bulan</SelectItem>
                                        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m) => (
                                            <SelectItem key={m} value={m}>
                                                {new Date(2000, parseInt(m) - 1).toLocaleDateString("id-ID", { month: "long" })}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Transactions Table */}
                    <Card>
                        <CardHeader className="no-print">
                            <CardTitle className="text-lg">Riwayat Transaksi</CardTitle>
                            <CardDescription>
                                {filteredTransactions.length} transaksi ditemukan
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table className="print-table">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Jenis</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        <TableHead className="text-right">Debit</TableHead>
                                        <TableHead className="text-right">Kredit</TableHead>
                                        <TableHead className="text-right">Saldo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTransactions.map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell>
                                                {new Date(tx.date).toLocaleDateString("id-ID")}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`${getTypeColor(tx.type)} no-print`}>
                                                    {tx.type === "simpanan" || tx.type === "pinjaman" ? (
                                                        <ArrowDownCircle className="mr-1 h-3 w-3" />
                                                    ) : (
                                                        <ArrowUpCircle className="mr-1 h-3 w-3" />
                                                    )}
                                                    {getTypeLabel(tx.type)}
                                                </Badge>
                                                <span className="hidden print-block">
                                                    {getTypeLabel(tx.type)}
                                                </span>
                                            </TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell className="text-right tabular-nums text-red-600">
                                                {tx.debit > 0 ? formatCurrency(tx.debit) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-emerald-600">
                                                {tx.credit > 0 ? formatCurrency(tx.credit) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-medium">
                                                {formatCurrency(tx.balance)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredTransactions.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                Tidak ada data
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-medium">Cari Anggota</h3>
                        <p className="mt-2 text-muted-foreground">
                            Masukkan nomor anggota atau NRP untuk melihat buku transaksi
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
