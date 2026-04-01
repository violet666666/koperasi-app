"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatCurrency, CASH_BANK_TRANSACTION_TYPES, CASH_BANK_CATEGORIES } from "@/lib/constants";
import { cashBankApi } from "@/lib/api";

// Types
interface CashBankAccount {
    id: number;
    code: string;
    name: string;
    type: "cash" | "bank";
    bankName?: string;
    accountNumber?: string;
    currentBalance: number;
    isActive: boolean;
}

interface CashBankTransaction {
    id: number;
    transactionNo: string;
    accountId: number;
    account?: { code: string; name: string };
    type: "in" | "out";
    category?: keyof typeof CASH_BANK_CATEGORIES;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    referenceNo?: string;
    transactionDate: string;
}

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
                            {account.bankName} - {account.accountNumber}
                        </p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(account.currentBalance)}</p>
                </div>
            </CardContent>
        </Card>
    );
}

// Transaction columns
const transactionColumns: ColumnDef<CashBankTransaction>[] = [
    {
        accessorKey: "transactionDate",
        header: "Tgl",
        cell: ({ row }) => {
            const dateValue = row.getValue("transactionDate");
            if (!dateValue) return "-";
            return new Date(dateValue as string).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
        },
    },
    {
        accessorKey: "transactionNo",
        header: "No. Bukti",
        cell: ({ row }) => <span className="font-mono text-sm font-medium text-muted-foreground">{row.getValue("transactionNo")}</span>,
    },
    {
        accessorKey: "description",
        header: "Keterangan & Kategori",
        cell: ({ row }) => {
            const catStr = row.original.category;
            const categoryObj = catStr ? CASH_BANK_CATEGORIES[catStr] : null;

            return (
                <div className="max-w-[250px]" title={row.getValue("description")}>
                    <p className="font-medium truncate whitespace-normal leading-tight text-sm">{row.getValue("description") || "-"}</p>
                    {categoryObj && (
                        <Badge variant="outline" className="text-[10px] mt-1 uppercase tracking-wider">
                            {categoryObj.label}
                        </Badge>
                    )}
                </div>
            );
        },
    },
    {
        id: "masuk",
        header: "Masuk (Debit)",
        cell: ({ row }) => {
            const type = row.original.type;
            const amount = row.original.amount;
            if (type !== "in") return <span className="text-muted-foreground">-</span>;
            return <span className="font-semibold text-emerald-600 tabular-nums">{formatCurrency(amount)}</span>;
        },
    },
    {
        id: "keluar",
        header: "Keluar (Kredit)",
        cell: ({ row }) => {
            const type = row.original.type;
            const amount = row.original.amount;
            if (type !== "out") return <span className="text-muted-foreground">-</span>;
            return <span className="font-semibold text-destructive tabular-nums">{formatCurrency(amount)}</span>;
        },
    },
    {
        accessorKey: "balanceAfter",
        header: "Saldo",
        cell: ({ row }) => {
            const balance = row.getValue("balanceAfter") as number;
            return <span className="font-bold tabular-nums text-primary">{formatCurrency(balance)}</span>;
        },
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
        const cashTotal = accounts.filter((a) => a.type === "cash").reduce((sum, a) => sum + a.currentBalance, 0);
        const bankTotal = accounts.filter((a) => a.type === "bank").reduce((sum, a) => sum + a.currentBalance, 0);
        return { cash: cashTotal, bank: bankTotal, total: cashTotal + bankTotal };
    }, [accounts]);

    // Fetch data from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [accountsRes, transactionsRes] = await Promise.allSettled([
                    cashBankApi.accounts(),
                    cashBankApi.transactions(),
                ]);

                if (accountsRes.status === "fulfilled") {
                    setAccounts(accountsRes.value.data as unknown as CashBankAccount[]);
                }

                if (transactionsRes.status === "fulfilled") {
                    setTransactions(transactionsRes.value.data as unknown as CashBankTransaction[]);
                }
            } catch (error) {
                console.error("Failed to fetch cash bank data:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    // Filter transactions
    const filteredTransactions = React.useMemo(() => {
        return transactions.filter((trx) => {
            const accountMatch = accountFilter === "all" || trx.accountId.toString() === accountFilter;
            const typeMatch = typeFilter === "all" || trx.category === typeFilter || (trx.category == null && typeFilter === "lainnya");
            return accountMatch && typeMatch;
        });
    }, [transactions, accountFilter, typeFilter]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kas & Bank"
                description="Kelola kas tunai dan rekening bank PRIMKOPPOL"
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
                            {accounts.filter((a) => a.type === "cash").length === 0 && !isLoading && (
                                <p className="text-muted-foreground text-sm">Tidak ada akun kas</p>
                            )}
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Building className="h-5 w-5" /> Bank
                            </h3>
                            {accounts.filter((a) => a.type === "bank").map((account) => (
                                <AccountCard key={account.id} account={account} />
                            ))}
                            {accounts.filter((a) => a.type === "bank").length === 0 && !isLoading && (
                                <p className="text-muted-foreground text-sm">Tidak ada akun bank</p>
                            )}
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
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                {Object.entries(CASH_BANK_CATEGORIES).map(([key, val]) => (
                                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                                ))}
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
