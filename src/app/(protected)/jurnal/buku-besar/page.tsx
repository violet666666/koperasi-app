"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    BookOpen, Search, Download, Plus, FileText, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface JournalEntry {
    id: number;
    journalNo: string;
    transactionDate: string;
    description: string;
    sourceType?: string;
    totalDebit: number;
    totalCredit: number;
    isPosted: boolean;
    isAdjustment: boolean;
    createdBy: { id: number; name: string };
}

const columns: ColumnDef<JournalEntry>[] = [
    {
        accessorKey: "transactionDate",
        header: "Tanggal",
        cell: ({ row }) => new Date(row.getValue("transactionDate")).toLocaleDateString("id-ID"),
    },
    {
        accessorKey: "journalNo",
        header: "No. Jurnal",
        cell: ({ row }) => (
            <span className="font-mono text-sm text-primary">{row.getValue("journalNo")}</span>
        ),
    },
    {
        accessorKey: "description",
        header: "Keterangan",
        cell: ({ row }) => <div className="max-w-xs truncate">{row.getValue("description")}</div>,
    },
    {
        accessorKey: "sourceType",
        header: "Sumber",
        cell: ({ row }) => {
            const sources: Record<string, string> = {
                savings: "Simpanan", loan: "Pinjaman", loan_payment: "Angsuran",
                cash_bank: "Kas/Bank", manual: "Manual", store_sale: "Toko",
            };
            const source = row.getValue("sourceType") as string;
            return sources[source] || source || "-";
        },
    },
    {
        accessorKey: "totalDebit",
        header: "Debit",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums text-emerald-600">
                {formatCurrency(row.getValue("totalDebit"))}
            </span>
        ),
    },
    {
        accessorKey: "totalCredit",
        header: "Kredit",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums text-red-600">
                {formatCurrency(row.getValue("totalCredit"))}
            </span>
        ),
    },
    {
        accessorKey: "isPosted",
        header: "Status",
        cell: ({ row }) => {
            const posted = row.getValue("isPosted");
            return posted ? (
                <Badge className="bg-emerald-100 text-emerald-700">Posted</Badge>
            ) : (
                <Badge variant="outline">Draft</Badge>
            );
        },
    },
];

export default function BukuBesarPage() {
    const [data, setData] = React.useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [periodFilter, setPeriodFilter] = React.useState<string>("all");

    const stats = React.useMemo(() => ({
        totalEntries: data.length,
        totalDebit: data.reduce((sum, d) => sum + d.totalDebit, 0),
        totalCredit: data.reduce((sum, d) => sum + d.totalCredit, 0),
        balance: data.reduce((sum, d) => sum + d.totalDebit - d.totalCredit, 0),
    }), [data]);

    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/journals?period=${periodFilter}`);
                if (!res.ok) throw new Error("Failed");
                const json = await res.json();
                setData(json.data || []);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [periodFilter]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Buku Besar"
                description="Daftar jurnal dan transaksi akuntansi"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>
                        <Button asChild><Link href="/jurnal/umum"><Plus className="mr-2 h-4 w-4" />Jurnal Umum</Link></Button>
                    </div>
                }
            />

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-primary/10 p-3"><FileText className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Jurnal</p><p className="text-2xl font-bold">{stats.totalEntries}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30"><ArrowUpRight className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Total Debit</p><p className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(stats.totalDebit)}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30"><ArrowDownRight className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">Total Kredit</p><p className="text-lg font-bold tabular-nums text-red-600">{formatCurrency(stats.totalCredit)}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30"><BookOpen className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Balance</p><p className={`text-lg font-bold tabular-nums ${stats.balance === 0 ? "text-emerald-600" : "text-amber-600"}`}>{formatCurrency(Math.abs(stats.balance))}{stats.balance === 0 && " ✓"}</p></div></CardContent></Card>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <Select value={periodFilter} onValueChange={setPeriodFilter}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Periode" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="current">Bulan Ini</SelectItem>
                                <SelectItem value="last">Bulan Lalu</SelectItem>
                                <SelectItem value="year">Tahun Ini</SelectItem>
                                <SelectItem value="all">Semua</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <Card><CardContent className="p-6 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
            ) : (
                <DataTable columns={columns} data={data} searchColumn="description" searchPlaceholder="Cari keterangan..." />
            )}
        </div>
    );
}
