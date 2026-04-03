"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatCurrency, SAVINGS_TRANSACTION_TYPES } from "@/lib/constants";
import { savingsApi, masterApi } from "@/lib/api";
import { DatePeriodFilter, matchesDateRange, type DateRange } from "@/components/patterns/date-period-filter";

// Transaction type from API
interface Transaction {
    id: number;
    transactionNo: string;
    accountId: number;
    memberId: number;
    member?: { id: number; memberNo: string; name: string };
    productId?: number;
    product?: { code: string; name: string };
    type: "deposit" | "withdrawal";
    amount: number;
    balanceBefore?: number;
    balanceAfter?: number;
    transactionDate: string;
}

// Type badge component
function TypeBadge({ type }: { type: "deposit" | "withdrawal" }) {
    const config = SAVINGS_TRANSACTION_TYPES[type];
    const isDeposit = type === "deposit";

    return (
        <div className="flex items-center gap-2">
            {isDeposit ? (
                <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
            ) : (
                <ArrowDownCircle className="h-4 w-4 text-amber-500" />
            )}
            <span className={isDeposit ? "text-emerald-600" : "text-amber-600"}>
                {config.label}
            </span>
        </div>
    );
}

// Table columns
const columns: ColumnDef<Transaction>[] = [
    {
        accessorKey: "transactionNo",
        header: "No. Transaksi",
        cell: ({ row }) => (
            <span className="font-mono text-sm">{row.getValue("transactionNo")}</span>
        ),
    },
    {
        accessorKey: "member",
        header: "Anggota",
        cell: ({ row }) => (
            <div>
                <Link
                    href={`/anggota/${row.original.memberId}`}
                    className="font-medium text-primary hover:underline"
                >
                    {row.original.member?.name || "-"}
                </Link>
                <div className="text-sm text-muted-foreground">
                    {row.original.member?.memberNo}
                </div>
            </div>
        ),
    },
    {
        accessorKey: "type",
        header: "Jenis",
        cell: ({ row }) => <TypeBadge type={row.getValue("type")} />,
    },
    {
        accessorKey: "amount",
        header: "Jumlah",
        cell: ({ row }) => {
            const amount = row.getValue("amount") as number;
            const type = row.original.type;
            const isDeposit = type === "deposit";
            return (
                <span className={`font-medium tabular-nums ${isDeposit ? "text-emerald-600" : "text-amber-600"}`}>
                    {isDeposit ? "+" : "-"}{formatCurrency(amount)}
                </span>
            );
        },
    },
    {
        accessorKey: "balanceAfter",
        header: "Saldo Akhir",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums">
                {row.original.balanceAfter ? formatCurrency(row.original.balanceAfter) : "-"}
            </span>
        ),
    },
    {
        accessorKey: "transactionDate",
        header: "Tanggal",
        cell: ({ row }) => {
            const dateValue = row.getValue("transactionDate");
            if (!dateValue) return "-";
            const date = new Date(dateValue as string);
            return date.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        },
    },
];

export default function SimpananTransaksiPage() {
    const [typeFilter, setTypeFilter] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [transactions, setTransactions] = React.useState<Transaction[]>([]);
    const [dateRange, setDateRange] = React.useState<DateRange>({ start: null, end: null, mode: "all", label: "Semua Data" });
    const [tabunganWajibInfo, setTabunganWajibInfo] = React.useState<{
        total: number;
        count: number;
    } | null>(null);

    const [stats, setStats] = React.useState({
        todayDeposit: 0,
        todayWithdrawal: 0,
        todayNet: 0,
        todayCount: 0,
    });

    // Fetch data from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [txResponse, statsResponse] = await Promise.allSettled([
                    savingsApi.transactions({ perPage: 9999 }),
                    fetch("/api/dashboard-stats").then(r => r.json()),
                ]);

                if (txResponse.status === "fulfilled") {
                    const txResult = txResponse.value as any;
                    // The API client returns { data: [...], meta: {...} } directly
                    const txArray = Array.isArray(txResult) ? txResult : (txResult?.data || []);
                    setTransactions(txArray as Transaction[]);
                }

                if (statsResponse.status === "fulfilled" && statsResponse.value.data) {
                    const d = statsResponse.value.data;
                    setTabunganWajibInfo({
                        total: d.totalTabunganWajib || 0,
                        count: d.membersWithTabunganWajib || 0,
                    });
                    setStats({
                        todayDeposit: d.todayDeposits || 0,
                        todayWithdrawal: d.todayWithdrawals || 0,
                        todayNet: (d.todayDeposits || 0) - (d.todayWithdrawals || 0),
                        todayCount: (d.todayDepositsCount || 0) + (d.todayWithdrawalsCount || 0),
                    });
                }
            } catch (error) {
                console.error("Failed to fetch transactions:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    // Filter data
    const filteredTransactions = React.useMemo(() => {
        return transactions.filter((trx) => {
            const matchesType = typeFilter === "all" || trx.type === typeFilter;
            const matchesDate = matchesDateRange(trx.transactionDate, dateRange);
            return matchesType && matchesDate;
        });
    }, [transactions, typeFilter, dateRange]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Transaksi Simpanan"
                description="Kelola setoran dan penarikan simpanan anggota"
                actions={
                    <Button asChild>
                        <Link href="/simpanan/transaksi/tambah">
                            <Plus className="mr-2 h-4 w-4" />
                            Transaksi Baru
                        </Link>
                    </Button>
                }
            />

            {/* Tabungan Wajib Info Banner */}
            {tabunganWajibInfo && tabunganWajibInfo.total > 0 && transactions.length === 0 && (
                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                                <Wallet className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-blue-800 dark:text-blue-300">
                                    Total Tabungan Wajib Anggota: {formatCurrency(tabunganWajibInfo.total)}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    Data dari {tabunganWajibInfo.count} anggota (hasil import). Transaksi setoran/penarikan manual akan ditampilkan di tabel bawah.
                                </p>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/simpanan/rekap">Lihat Rekap</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <ArrowUpCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Setoran Hari Ini</p>
                            <p className="text-xl font-bold tabular-nums text-emerald-600">
                                {formatCurrency(stats.todayDeposit)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            <ArrowDownCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Penarikan Hari Ini</p>
                            <p className="text-xl font-bold tabular-nums text-amber-600">
                                {formatCurrency(stats.todayWithdrawal)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3 text-primary">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Neto Hari Ini</p>
                            <p className={`text-xl font-bold tabular-nums ${stats.todayNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {stats.todayNet >= 0 ? "+" : ""}{formatCurrency(stats.todayNet)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Jenis" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Jenis</SelectItem>
                            <SelectItem value="deposit">Setoran</SelectItem>
                            <SelectItem value="withdrawal">Penarikan</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <DatePeriodFilter onChange={setDateRange} showImportNote />
                        {dateRange.mode !== "all" && (
                            <p className="text-xs text-muted-foreground">Menampilkan: <strong>{dateRange.label}</strong></p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={filteredTransactions}
                isLoading={isLoading}
                searchPlaceholder="Cari no. transaksi atau nama anggota..."
            />
        </div>
    );
}
