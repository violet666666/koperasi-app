"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import type { SavingsTransaction } from "@/types";
import { formatCurrency, SAVINGS_TRANSACTION_TYPES } from "@/lib/constants";

// Mock data
const MOCK_TRANSACTIONS: SavingsTransaction[] = [
    {
        id: 1,
        transaction_no: "SIM-2025-00001",
        account_id: 1,
        member_id: 1,
        member: { member_no: "A-001", name: "Budi Santoso" },
        product_id: 2,
        product: { code: "SIM-WAJIB", name: "Simpanan Wajib" },
        branch_id: 1,
        type: "deposit",
        amount: 100000,
        balance_before: 1100000,
        balance_after: 1200000,
        payment_method: "cash",
        transaction_date: "2025-01-24",
        status: "completed",
        created_by: { id: 1, name: "Teller 1" },
        created_at: "2025-01-24T09:00:00Z",
    },
    {
        id: 2,
        transaction_no: "SIM-2025-00002",
        account_id: 2,
        member_id: 2,
        member: { member_no: "A-002", name: "Siti Aminah" },
        product_id: 3,
        product: { code: "SIM-SUK", name: "Simpanan Sukarela" },
        branch_id: 1,
        type: "deposit",
        amount: 500000,
        balance_before: 2000000,
        balance_after: 2500000,
        payment_method: "bank_transfer",
        transaction_date: "2025-01-24",
        status: "completed",
        created_by: { id: 1, name: "Teller 1" },
        created_at: "2025-01-24T09:30:00Z",
    },
    {
        id: 3,
        transaction_no: "SIM-2025-00003",
        account_id: 3,
        member_id: 3,
        member: { member_no: "A-003", name: "Joko Widodo" },
        product_id: 3,
        product: { code: "SIM-SUK", name: "Simpanan Sukarela" },
        branch_id: 2,
        type: "withdrawal",
        amount: 200000,
        balance_before: 1500000,
        balance_after: 1300000,
        payment_method: "cash",
        transaction_date: "2025-01-23",
        status: "completed",
        created_by: { id: 2, name: "Teller 2" },
        created_at: "2025-01-23T14:00:00Z",
    },
    {
        id: 4,
        transaction_no: "SIM-2025-00004",
        account_id: 1,
        member_id: 1,
        member: { member_no: "A-001", name: "Budi Santoso" },
        product_id: 3,
        product: { code: "SIM-SUK", name: "Simpanan Sukarela" },
        branch_id: 1,
        type: "deposit",
        amount: 1000000,
        balance_before: 2700000,
        balance_after: 3700000,
        payment_method: "cash",
        transaction_date: "2025-01-22",
        status: "completed",
        created_by: { id: 1, name: "Teller 1" },
        created_at: "2025-01-22T11:00:00Z",
    },
];

// Type badge component
function TypeBadge({ type }: { type: keyof typeof SAVINGS_TRANSACTION_TYPES }) {
    const config = SAVINGS_TRANSACTION_TYPES[type];
    const isDeposit = type === "deposit" || type === "interest";

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
const columns: ColumnDef<SavingsTransaction>[] = [
    {
        accessorKey: "transaction_no",
        header: "No. Transaksi",
        cell: ({ row }) => (
            <span className="font-mono text-sm">{row.getValue("transaction_no")}</span>
        ),
    },
    {
        accessorKey: "member",
        header: "Anggota",
        cell: ({ row }) => (
            <div>
                <Link
                    href={`/anggota/${row.original.member_id}`}
                    className="font-medium text-primary hover:underline"
                >
                    {row.original.member?.name}
                </Link>
                <div className="text-sm text-muted-foreground">
                    {row.original.member?.member_no}
                </div>
            </div>
        ),
    },
    {
        accessorKey: "product",
        header: "Produk",
        cell: ({ row }) => row.original.product?.name || "-",
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
            const isDeposit = type === "deposit" || type === "interest";
            return (
                <span className={`font-medium tabular-nums ${isDeposit ? "text-emerald-600" : "text-amber-600"}`}>
                    {isDeposit ? "+" : "-"}{formatCurrency(amount)}
                </span>
            );
        },
    },
    {
        accessorKey: "balance_after",
        header: "Saldo Akhir",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums">
                {formatCurrency(row.getValue("balance_after"))}
            </span>
        ),
    },
    {
        accessorKey: "transaction_date",
        header: "Tanggal",
        cell: ({ row }) => {
            const date = new Date(row.getValue("transaction_date"));
            return date.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        },
    },
];

export default function SimpananTransaksiPage() {
    const router = useRouter();
    const [typeFilter, setTypeFilter] = React.useState("all");
    const [productFilter, setProductFilter] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [transactions, setTransactions] = React.useState<SavingsTransaction[]>([]);

    // Calculate summary stats
    const stats = React.useMemo(() => {
        const today = new Date().toISOString().split("T")[0];
        const todayTrx = transactions.filter((t) => t.transaction_date === today);

        const totalDeposit = todayTrx
            .filter((t) => t.type === "deposit")
            .reduce((sum, t) => sum + t.amount, 0);
        const totalWithdrawal = todayTrx
            .filter((t) => t.type === "withdrawal")
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            todayDeposit: totalDeposit,
            todayWithdrawal: totalWithdrawal,
            todayNet: totalDeposit - totalWithdrawal,
            todayCount: todayTrx.length,
        };
    }, [transactions]);

    // Simulate data loading
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setTransactions(MOCK_TRANSACTIONS);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Filter data
    const filteredTransactions = React.useMemo(() => {
        return transactions.filter((trx) => {
            const typeMatch = typeFilter === "all" || trx.type === typeFilter;
            const productMatch = productFilter === "all" || trx.product_id.toString() === productFilter;
            return typeMatch && productMatch;
        });
    }, [transactions, typeFilter, productFilter]);

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
            <div className="flex flex-wrap gap-4">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Jenis" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Jenis</SelectItem>
                        <SelectItem value="deposit">Setoran</SelectItem>
                        <SelectItem value="withdrawal">Penarikan</SelectItem>
                        <SelectItem value="correction">Koreksi</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Produk" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Produk</SelectItem>
                        <SelectItem value="1">Simpanan Pokok</SelectItem>
                        <SelectItem value="2">Simpanan Wajib</SelectItem>
                        <SelectItem value="3">Simpanan Sukarela</SelectItem>
                    </SelectContent>
                </Select>
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
