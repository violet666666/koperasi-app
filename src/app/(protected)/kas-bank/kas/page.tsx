"use client";

import * as React from "react";
import Link from "next/link";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Plus,
    Banknote,
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    TrendingUp,
    TrendingDown,
    Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { cashBankApi } from "@/lib/api/services";

interface CashTransaction {
    id: number;
    transactionNo: string;
    type: "in" | "out";
    category: string;
    amount: number;
    description: string;
    transactionDate: string;
    balanceAfter: number;
}

interface CashAccount {
    id: number;
    code: string;
    name: string;
    currentBalance: number;
}

const columns: ColumnDef<CashTransaction>[] = [
    {
        accessorKey: "transactionDate",
        header: "Tanggal",
        cell: ({ row }) => new Date(row.getValue("transactionDate")).toLocaleDateString("id-ID"),
    },
    {
        accessorKey: "transactionNo",
        header: "No. Transaksi",
        cell: ({ row }) => (
            <span className="font-mono text-sm">{row.getValue("transactionNo")}</span>
        ),
    },
    {
        accessorKey: "type",
        header: "Jenis",
        cell: ({ row }) => {
            const type = row.getValue("type") as string;
            return type === "in" ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">
                    <ArrowUpCircle className="mr-1 h-3 w-3" />
                    Masuk
                </Badge>
            ) : (
                <Badge variant="destructive">
                    <ArrowDownCircle className="mr-1 h-3 w-3" />
                    Keluar
                </Badge>
            );
        },
    },
    {
        accessorKey: "category",
        header: "Kategori",
        cell: ({ row }) => {
            const categories: Record<string, string> = {
                operational: "Operasional",
                savings: "Simpanan",
                loan: "Pinjaman",
                other: "Lainnya",
            };
            return categories[row.getValue("category") as string] || row.getValue("category");
        },
    },
    {
        accessorKey: "description",
        header: "Keterangan",
    },
    {
        accessorKey: "amount",
        header: "Jumlah",
        cell: ({ row }) => {
            const type = row.original.type;
            const amount = row.getValue("amount") as number;
            return (
                <span className={`font-bold tabular-nums ${type === "in" ? "text-emerald-600" : "text-red-600"}`}>
                    {type === "in" ? "+" : "-"}{formatCurrency(amount)}
                </span>
            );
        },
    },
    {
        accessorKey: "balanceAfter",
        header: "Saldo",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums">
                {formatCurrency(row.getValue("balanceAfter"))}
            </span>
        ),
    },
];

export default function TransaksiKasPage() {
    const [transactions, setTransactions] = React.useState<CashTransaction[]>([]);
    const [accounts, setAccounts] = React.useState<CashAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = React.useState<string>("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [transactionType, setTransactionType] = React.useState<"in" | "out">("in");
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Form state
    const [formData, setFormData] = React.useState({
        accountId: "",
        amount: "",
        category: "operational",
        description: "",
    });

    // Stats
    const stats = React.useMemo(() => {
        const totalBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
        const todayIn = transactions
            .filter(t => t.type === "in" && new Date(t.transactionDate).toDateString() === new Date().toDateString())
            .reduce((sum, t) => sum + t.amount, 0);
        const todayOut = transactions
            .filter(t => t.type === "out" && new Date(t.transactionDate).toDateString() === new Date().toDateString())
            .reduce((sum, t) => sum + t.amount, 0);

        return { totalBalance, todayIn, todayOut };
    }, [accounts, transactions]);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Fetch accounts
                const accountsRes = await cashBankApi.accounts();
                const allAccounts = (accountsRes as any).data || [];
                setAccounts(allAccounts);

                // Fetch transactions
                const params = selectedAccount !== "all" ? { accountId: Number(selectedAccount) } : {};
                const txRes = await cashBankApi.transactions({ ...params });
                setTransactions(((txRes as any).data || []) as CashTransaction[]);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedAccount]);

    // Handle submit
    const handleSubmit = async () => {
        if (!formData.accountId || !formData.amount) {
            toast.error("Lengkapi data transaksi");
            return;
        }

        setIsSubmitting(true);
        try {
            await cashBankApi.createTransaction({
                accountId: Number(formData.accountId),
                type: transactionType,
                amount: Number(formData.amount),
                description: formData.description,
            });
            toast.success("Transaksi berhasil dicatat");
            setDialogOpen(false);
            setFormData({ accountId: "", amount: "", category: "operational", description: "" });
            // Refresh data
            const txRes = await cashBankApi.transactions({});
            setTransactions(((txRes as any).data || []) as CashTransaction[]);
        } catch (error) {
            toast.error("Gagal mencatat transaksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Transaksi Kas"
                description="Kelola transaksi kas masuk dan keluar"
                actions={
                    <div className="flex gap-2">
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setTransactionType("in")}>
                                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                                    Kas Masuk
                                </Button>
                            </DialogTrigger>
                            <DialogTrigger asChild>
                                <Button variant="outline" onClick={() => setTransactionType("out")}>
                                    <ArrowDownCircle className="mr-2 h-4 w-4" />
                                    Kas Keluar
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        {transactionType === "in" ? "Kas Masuk" : "Kas Keluar"}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Catat transaksi {transactionType === "in" ? "pemasukan" : "pengeluaran"} kas
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div>
                                        <Label>Akun Kas</Label>
                                        <Select
                                            value={formData.accountId}
                                            onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih akun kas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts.map((acc) => (
                                                    <SelectItem key={acc.id} value={String(acc.id)}>
                                                        {acc.name} ({formatCurrency(acc.currentBalance)})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Jumlah</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={formData.amount}
                                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Kategori</Label>
                                        <Select
                                            value={formData.category}
                                            onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="operational">Operasional</SelectItem>
                                                <SelectItem value="savings">Simpanan</SelectItem>
                                                <SelectItem value="loan">Pinjaman</SelectItem>
                                                <SelectItem value="other">Lainnya</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Keterangan</Label>
                                        <Textarea
                                            placeholder="Deskripsi transaksi"
                                            value={formData.description}
                                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                        Batal
                                    </Button>
                                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Simpan
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Wallet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Saldo Kas</p>
                            <p className="text-xl font-bold tabular-nums">
                                {formatCurrency(stats.totalBalance)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Masuk Hari Ini</p>
                            <p className="text-xl font-bold tabular-nums text-emerald-600">
                                +{formatCurrency(stats.todayIn)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Keluar Hari Ini</p>
                            <p className="text-xl font-bold tabular-nums text-red-600">
                                -{formatCurrency(stats.todayOut)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Pilih akun kas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Akun Kas</SelectItem>
                                {accounts.map((acc) => (
                                    <SelectItem key={acc.id} value={String(acc.id)}>
                                        {acc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={transactions}
                    searchColumn="description"
                    searchPlaceholder="Cari transaksi..."
                />
            )}
        </div>
    );
}
