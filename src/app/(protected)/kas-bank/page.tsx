"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import {
    Plus,
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    Building,
    ArrowLeftRight,
} from "lucide-react";
import { formatCurrency, CASH_BANK_TRANSACTION_TYPES } from "@/lib/constants";

// Types
interface CashBankAccount {
    id: number;
    code: string;
    name: string;
    type: "cash" | "bank";
    bank_name?: string;
    account_number?: string;
    balance: number;
    is_active: boolean;
}

interface CashBankTransaction {
    id: number;
    transaction_no: string;
    account_id: number;
    account: { code: string; name: string };
    type: "in" | "out";
    amount: number;
    balance_before: number;
    balance_after: number;
    description: string;
    reference_no?: string;
    transaction_date: string;
    created_by: { id: number; name: string };
    created_at: string;
}

// Mock data
const MOCK_ACCOUNTS: CashBankAccount[] = [
    { id: 1, code: "K-001", name: "Kas Besar", type: "cash", balance: 25000000, is_active: true },
    { id: 2, code: "K-002", name: "Kas Kecil", type: "cash", balance: 5000000, is_active: true },
    { id: 3, code: "B-001", name: "Bank BCA", type: "bank", bank_name: "BCA", account_number: "1234567890", balance: 150000000, is_active: true },
    { id: 4, code: "B-002", name: "Bank Mandiri", type: "bank", bank_name: "Mandiri", account_number: "0987654321", balance: 85000000, is_active: true },
];

const MOCK_TRANSACTIONS: CashBankTransaction[] = [
    {
        id: 1,
        transaction_no: "CB-2025-00001",
        account_id: 1,
        account: { code: "K-001", name: "Kas Besar" },
        type: "in",
        amount: 5000000,
        balance_before: 20000000,
        balance_after: 25000000,
        description: "Setoran tunai dari anggota",
        transaction_date: "2025-01-24",
        created_by: { id: 1, name: "Teller 1" },
        created_at: "2025-01-24T09:00:00Z",
    },
    {
        id: 2,
        transaction_no: "CB-2025-00002",
        account_id: 3,
        account: { code: "B-001", name: "Bank BCA" },
        type: "in",
        amount: 10000000,
        balance_before: 140000000,
        balance_after: 150000000,
        description: "Transfer masuk dari cabang",
        reference_no: "TRF-123456",
        transaction_date: "2025-01-24",
        created_by: { id: 1, name: "Teller 1" },
        created_at: "2025-01-24T10:00:00Z",
    },
    {
        id: 3,
        transaction_no: "CB-2025-00003",
        account_id: 1,
        account: { code: "K-001", name: "Kas Besar" },
        type: "out",
        amount: 2000000,
        balance_before: 27000000,
        balance_after: 25000000,
        description: "Pencairan pinjaman A-005",
        transaction_date: "2025-01-23",
        created_by: { id: 2, name: "Kasir" },
        created_at: "2025-01-23T14:00:00Z",
    },
];

// Account card component
function AccountCard({ account }: { account: CashBankAccount }) {
    const isCash = account.type === "cash";
    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-4">
                <div className={`rounded-lg p-3 ${isCash ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                    {isCash ? <Wallet className="h-5 w-5" /> : <Building className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <p className="font-medium">{account.name}</p>
                        <Badge variant="outline" className="text-xs">{account.code}</Badge>
                    </div>
                    {account.type === "bank" && (
                        <p className="text-sm text-muted-foreground">
                            {account.bank_name} - {account.account_number}
                        </p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(account.balance)}</p>
                </div>
            </CardContent>
        </Card>
    );
}

// Transaction columns
const transactionColumns: ColumnDef<CashBankTransaction>[] = [
    {
        accessorKey: "transaction_no",
        header: "No. Transaksi",
        cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("transaction_no")}</span>,
    },
    {
        accessorKey: "account",
        header: "Akun",
        cell: ({ row }) => (
            <div>
                <p className="font-medium">{row.original.account.name}</p>
                <p className="text-xs text-muted-foreground">{row.original.account.code}</p>
            </div>
        ),
    },
    {
        accessorKey: "type",
        header: "Jenis",
        cell: ({ row }) => {
            const type = row.getValue("type") as "in" | "out";
            const config = CASH_BANK_TRANSACTION_TYPES[type];
            return (
                <div className="flex items-center gap-2">
                    {type === "in" ? (
                        <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                    ) : (
                        <ArrowDownCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className={type === "in" ? "text-emerald-600" : "text-amber-600"}>
                        {config.label}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "amount",
        header: "Jumlah",
        cell: ({ row }) => {
            const type = row.original.type;
            const amount = row.getValue("amount") as number;
            return (
                <span className={`font-medium tabular-nums ${type === "in" ? "text-emerald-600" : "text-amber-600"}`}>
                    {type === "in" ? "+" : "-"}{formatCurrency(amount)}
                </span>
            );
        },
    },
    {
        accessorKey: "description",
        header: "Keterangan",
        cell: ({ row }) => (
            <div className="max-w-[200px] truncate" title={row.getValue("description")}>
                {row.getValue("description")}
            </div>
        ),
    },
    {
        accessorKey: "transaction_date",
        header: "Tanggal",
        cell: ({ row }) => new Date(row.getValue("transaction_date")).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
    },
];

export default function KasBankPage() {
    const [accountFilter, setAccountFilter] = React.useState("all");
    const [typeFilter, setTypeFilter] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [accounts, setAccounts] = React.useState<CashBankAccount[]>([]);
    const [transactions, setTransactions] = React.useState<CashBankTransaction[]>([]);

    // Calculate totals
    const totals = React.useMemo(() => {
        const cashTotal = accounts.filter((a) => a.type === "cash").reduce((sum, a) => sum + a.balance, 0);
        const bankTotal = accounts.filter((a) => a.type === "bank").reduce((sum, a) => sum + a.balance, 0);
        return { cash: cashTotal, bank: bankTotal, total: cashTotal + bankTotal };
    }, [accounts]);

    // Simulate loading
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setAccounts(MOCK_ACCOUNTS);
            setTransactions(MOCK_TRANSACTIONS);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Filter transactions
    const filteredTransactions = React.useMemo(() => {
        return transactions.filter((trx) => {
            const accountMatch = accountFilter === "all" || trx.account_id.toString() === accountFilter;
            const typeMatch = typeFilter === "all" || trx.type === typeFilter;
            return accountMatch && typeMatch;
        });
    }, [transactions, accountFilter, typeFilter]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kas & Bank"
                description="Kelola kas tunai dan rekening bank koperasi"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/kas-bank/transfer">
                                <ArrowLeftRight className="mr-2 h-4 w-4" />
                                Transfer
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/kas-bank/transaksi/tambah">
                                <Plus className="mr-2 h-4 w-4" />
                                Transaksi Baru
                            </Link>
                        </Button>
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Kas</p>
                            <p className="text-xl font-bold tabular-nums">{formatCurrency(totals.cash)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <Building className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Bank</p>
                            <p className="text-xl font-bold tabular-nums">{formatCurrency(totals.bank)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3 text-primary">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Keseluruhan</p>
                            <p className="text-xl font-bold tabular-nums">{formatCurrency(totals.total)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="accounts" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="accounts">Daftar Akun</TabsTrigger>
                    <TabsTrigger value="transactions">Transaksi</TabsTrigger>
                </TabsList>

                {/* Accounts Tab */}
                <TabsContent value="accounts" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Wallet className="h-5 w-5" /> Kas
                            </h3>
                            {accounts.filter((a) => a.type === "cash").map((account) => (
                                <AccountCard key={account.id} account={account} />
                            ))}
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Building className="h-5 w-5" /> Bank
                            </h3>
                            {accounts.filter((a) => a.type === "bank").map((account) => (
                                <AccountCard key={account.id} account={account} />
                            ))}
                        </div>
                    </div>
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transactions" className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4">
                        <Select value={accountFilter} onValueChange={setAccountFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Akun" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Akun</SelectItem>
                                {accounts.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id.toString()}>
                                        {acc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Jenis" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Jenis</SelectItem>
                                <SelectItem value="in">Masuk</SelectItem>
                                <SelectItem value="out">Keluar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DataTable
                        columns={transactionColumns}
                        data={filteredTransactions}
                        isLoading={isLoading}
                        searchPlaceholder="Cari transaksi..."
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
