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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Plus,
    ArrowDownCircle,
    TrendingDown,
    Receipt,
    Loader2,
    Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { DatePeriodFilter, matchesDateRange, type DateRange } from "@/components/patterns/date-period-filter";

interface NonSPTransaction {
    id: number;
    transactionNo: string;
    transactionDate: string;
    category: string;
    description: string;
    amount: number;
    paymentMethod: string;
    createdBy: { id: number; name: string };
}

interface Account {
    id: number;
    code: string;
    name: string;
}

export default function PengeluaranNonSPPage() {
    const [data, setData] = React.useState<NonSPTransaction[]>([]);
    const [expenseAccounts, setExpenseAccounts] = React.useState<Account[]>([]);
    const [assetAccounts, setAssetAccounts] = React.useState<Account[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [dateRange, setDateRange] = React.useState<DateRange>({ start: null, end: null, mode: "all", label: "Semua Data" });

    // Form state
    const [formData, setFormData] = React.useState({
        categoryAccountId: "",
        amount: "",
        description: "",
        paymentAccountId: "",
    });

    const columns: ColumnDef<NonSPTransaction>[] = [
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
            accessorKey: "category",
            header: "Kategori Beban",
            cell: ({ row }) => (
                <Badge variant="outline">
                    {row.getValue("category")}
                </Badge>
            ),
        },
        {
            accessorKey: "description",
            header: "Keterangan",
            cell: ({ row }) => (
                <div className="max-w-xs truncate">{row.getValue("description")}</div>
            ),
        },
        {
            accessorKey: "paymentMethod",
            header: "Sumber Dana",
            cell: ({ row }) => (
                <span className="text-sm font-medium">{row.getValue("paymentMethod")}</span>
            ),
        },
        {
            accessorKey: "amount",
            header: "Jumlah",
            cell: ({ row }) => (
                <span className="font-bold tabular-nums text-red-600">
                    -{formatCurrency(row.getValue("amount"))}
                </span>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const tx = row.original;
                return (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                            if (!confirm("Hapus pengeluaran ini? Laporan SHU akan otomatis disesuaikan.")) return;
                            try {
                                const res = await fetch(`/api/non-sp/pengeluaran/${tx.id}`, {
                                    method: "DELETE"
                                });
                                if (!res.ok) throw new Error("Gagal menghapus");
                                toast.success("Transaksi dihapus");
                                loadData();
                            } catch (e) {
                                toast.error("Gagal menghapus transaksi");
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                );
            },
        },
    ];

    // Stats
    const stats = React.useMemo(() => {
        const today = new Date().toISOString().split("T")[0];
        return {
            total: data.length,
            totalAmount: data.reduce((sum, d) => sum + d.amount, 0),
            todayAmount: data
                .filter(d => d.transactionDate.startsWith(today))
                .reduce((sum, d) => sum + d.amount, 0),
        };
    }, [data]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [trxRes, expRes, astRes] = await Promise.all([
                fetch("/api/non-sp/pengeluaran"),
                fetch("/api/master/accounts?type=expense"),
                fetch("/api/master/accounts?type=asset")
            ]);
            
            if (trxRes.ok) {
                const trxJson = await trxRes.json();
                setData(trxJson.data || []);
            }
            if (expRes.ok) {
                const expJson = await expRes.json();
                setExpenseAccounts(expJson.data || []);
            }
            if (astRes.ok) {
                const astJson = await astRes.json();
                // We typically only want Kas/Bank for payments, assume codes starting with 11 are cash/bank equivalents
                const liquidAssets = (astJson.data || []).filter((a: Account) => a.code.startsWith("11"));
                setAssetAccounts(liquidAssets);
            }
        } catch (error) {
            console.error("Failed to fetch:", error);
            toast.error("Gagal memuat data");
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        loadData();
    }, []);

    // Handle submit
    const handleSubmit = async () => {
        if (!formData.categoryAccountId || !formData.amount || !formData.paymentAccountId) {
            toast.error("Lengkapi data pengeluaran");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/non-sp/pengeluaran", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    categoryAccountId: formData.categoryAccountId,
                    paymentAccountId: formData.paymentAccountId,
                    amount: formData.amount,
                    description: formData.description,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Gagal mencatat pengeluaran");
            }

            toast.success("Pengeluaran berhasil dicatat (Jurnal dibuat)");
            setDialogOpen(false);
            setFormData({ categoryAccountId: "", amount: "", description: "", paymentAccountId: "" });
            loadData();
        } catch (error: any) {
            toast.error(error.message || "Gagal mencatat pengeluaran");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pengeluaran Non S/P"
                description="Biaya di luar operasional simpan pinjam (Otomatis masuk Jurnal & SHU)"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Pengeluaran
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Pengeluaran Baru</DialogTitle>
                                <DialogDescription>
                                    Catat pengeluaran non simpan pinjam
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div>
                                    <Label>Akun Kategori Beban</Label>
                                    <Select
                                        value={formData.categoryAccountId}
                                        onValueChange={(v) => setFormData(prev => ({ ...prev, categoryAccountId: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih akun beban..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {expenseAccounts.map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>{acc.code} - {acc.name}</SelectItem>
                                            ))}
                                            {expenseAccounts.length === 0 && (
                                                <SelectItem value="none" disabled>Tidak ada data Akun Beban (COA)</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Sumber Dana (Kas/Bank)</Label>
                                    <Select
                                        value={formData.paymentAccountId}
                                        onValueChange={(v) => setFormData(prev => ({ ...prev, paymentAccountId: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih sumber dana..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {assetAccounts.map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>{acc.code} - {acc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Jumlah Pengeuaran</Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>Keterangan</Label>
                                    <Textarea
                                        placeholder="Deskripsi pengeluaran"
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                                    Batal
                                </Button>
                                <Button onClick={handleSubmit} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan Transaksi
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Receipt className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Transaksi</p>
                            <p className="text-2xl font-bold">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <ArrowDownCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Hari Ini</p>
                            <p className="text-xl font-bold tabular-nums text-red-600">
                                -{formatCurrency(stats.todayAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <TrendingDown className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
                            <p className="text-xl font-bold tabular-nums">
                                {formatCurrency(stats.totalAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter */}
            <Card>
                <CardContent className="p-4 space-y-3">
                    <DatePeriodFilter onChange={setDateRange} showImportNote />
                    {dateRange.mode !== "all" && (
                        <p className="text-xs text-muted-foreground">Menampilkan: <strong>{dateRange.label}</strong></p>
                    )}
                </CardContent>
            </Card>

            {/* Data Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={data.filter(t => matchesDateRange(t.transactionDate, dateRange))}
                    searchColumn="description"
                    searchPlaceholder="Cari transaksi..."
                />
            )}
        </div>
    );
}
