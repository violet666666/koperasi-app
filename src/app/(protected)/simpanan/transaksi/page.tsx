"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, SAVINGS_TRANSACTION_TYPES } from "@/lib/constants";
import { savingsApi, masterApi } from "@/lib/api";
import { DatePeriodFilter, matchesDateRange, type DateRange } from "@/components/patterns/date-period-filter";
import { toast } from "sonner";

// Transaction type from API
interface Transaction {
    id: number;
    transactionNo: string;
    accountId: number;
    memberId: number;
    member?: { id: number; memberNo: string; name: string };
    productId?: number;
    product?: { code: string; name: string };
    account?: { product?: { code: string; name: string; type: string } };
    type: "deposit" | "withdrawal" | "correction" | "interest";
    amount: number;
    notes?: string;
    balanceBefore?: number;
    balanceAfter?: number;
    transactionDate: string;
}

// Type badge component
function TypeBadge({ type }: { type: string }) {
    const config = SAVINGS_TRANSACTION_TYPES[type as keyof typeof SAVINGS_TRANSACTION_TYPES];
    const isDeposit = type === "deposit" || type === "interest";

    return (
        <div className="flex items-center gap-2">
            {isDeposit ? (
                <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
            ) : (
                <ArrowDownCircle className="h-4 w-4 text-amber-500" />
            )}
            <span className={isDeposit ? "text-emerald-600" : "text-amber-600"}>
                {config?.label || type}
            </span>
        </div>
    );
}

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

    // Edit dialog state
    const [editOpen, setEditOpen] = React.useState(false);
    const [editTx, setEditTx] = React.useState<Transaction | null>(null);
    const [editForm, setEditForm] = React.useState({ type: "deposit", amount: "", notes: "", transactionDate: "" });
    const [editLoading, setEditLoading] = React.useState(false);

    // Delete dialog state
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [deleteTx, setDeleteTx] = React.useState<Transaction | null>(null);
    const [deleteLoading, setDeleteLoading] = React.useState(false);

    // Fetch data from API
    const fetchData = React.useCallback(async () => {
        try {
            setIsLoading(true);
            const [txResponse, statsResponse] = await Promise.allSettled([
                savingsApi.transactions({ perPage: 9999 }),
                fetch("/api/dashboard-stats").then(r => r.json()),
            ]);

            if (txResponse.status === "fulfilled") {
                const txResult = txResponse.value as any;
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
    }, []);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    // Handle Edit
    const openEdit = (tx: Transaction) => {
        setEditTx(tx);
        const wib = new Date(new Date(tx.transactionDate).getTime() + 7 * 60 * 60 * 1000);
        setEditForm({
            type: tx.type,
            amount: String(Number(tx.amount)),
            notes: tx.notes || "",
            transactionDate: wib.toISOString().split("T")[0],
        });
        setEditOpen(true);
    };

    const handleEditSave = async () => {
        if (!editTx) return;
        setEditLoading(true);
        try {
            const res = await fetch(`/api/savings/transactions/${editTx.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: editForm.type,
                    amount: Number(editForm.amount),
                    notes: editForm.notes,
                    transactionDate: editForm.transactionDate,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal menyimpan perubahan");
                return;
            }
            toast.success("Transaksi berhasil diperbarui");
            setEditOpen(false);
            fetchData();
        } catch {
            toast.error("Gagal menyimpan perubahan");
        } finally {
            setEditLoading(false);
        }
    };

    // Handle Delete
    const openDelete = (tx: Transaction) => {
        setDeleteTx(tx);
        setDeleteOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTx) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/savings/transactions/${deleteTx.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal menghapus transaksi");
                return;
            }
            toast.success("Transaksi berhasil dihapus");
            setDeleteOpen(false);
            fetchData();
        } catch {
            toast.error("Gagal menghapus transaksi");
        } finally {
            setDeleteLoading(false);
        }
    };

    // Table columns — defined inside component to access openEdit/openDelete
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
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <TypeBadge type={row.getValue("type")} />
                    <span className="text-xs text-muted-foreground font-medium">
                        {row.original.account?.product?.name || "-"}
                    </span>
                </div>
            ),
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
            accessorKey: "balanceAfter",
            header: "Saldo Akhir",
            cell: ({ row }) => (
                <span className="font-medium tabular-nums">
                    {row.original.balanceAfter ? formatCurrency(row.original.balanceAfter) : "-"}
                </span>
            ),
        },
        {
            accessorKey: "notes",
            header: "Catatan",
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground truncate max-w-[150px] inline-block" title={row.original.notes || "-"}>
                    {row.original.notes || "-"}
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
        {
            id: "actions",
            header: "",
            cell: ({ row }) => {
                const tx = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(tx)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Transaksi
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => openDelete(tx)}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus Transaksi
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

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

            {/* Simpanan Wajib Info Banner */}
            {tabunganWajibInfo && tabunganWajibInfo.total > 0 && transactions.length === 0 && (
                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                                <Wallet className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-blue-800 dark:text-blue-300">
                                    Total Simpanan Wajib Anggota: {formatCurrency(tabunganWajibInfo.total)}
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

            {/* ── Edit Dialog ── */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Transaksi Simpanan</DialogTitle>
                        <DialogDescription>
                            {editTx?.transactionNo} — {editTx?.member?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Anggota</Label>
                                <Input value={editTx?.member?.name || ""} disabled className="bg-muted" />
                            </div>
                            <div className="space-y-2">
                                <Label>Produk Simpanan</Label>
                                <Input value={editTx?.account?.product?.name || ""} disabled className="bg-muted text-primary font-medium" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Jenis Transaksi</Label>
                            <Select value={editForm.type} onValueChange={(v) => setEditForm(f => ({ ...f, type: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="deposit">Setoran</SelectItem>
                                    <SelectItem value="withdrawal">Penarikan</SelectItem>
                                    <SelectItem value="correction">Koreksi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Jumlah (Rp)</Label>
                            <Input
                                type="number"
                                value={editForm.amount}
                                onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tanggal Transaksi</Label>
                            <Input
                                type="date"
                                value={editForm.transactionDate}
                                onChange={(e) => setEditForm(f => ({ ...f, transactionDate: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Catatan</Label>
                            <Textarea
                                value={editForm.notes}
                                onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                rows={2}
                                placeholder="Opsional"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editLoading}>
                            Batal
                        </Button>
                        <Button onClick={handleEditSave} disabled={editLoading || !editForm.amount}>
                            {editLoading ? "Menyimpan..." : "Simpan Perubahan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation ── */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Transaksi Simpanan?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>Anda akan menghapus transaksi berikut secara permanen:</p>
                            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                                <p><strong>No:</strong> {deleteTx?.transactionNo}</p>
                                <p><strong>Anggota:</strong> {deleteTx?.member?.name}</p>
                                <p><strong>Jenis:</strong> {deleteTx?.type === "deposit" ? "Setoran" : deleteTx?.type === "withdrawal" ? "Penarikan" : deleteTx?.type}</p>
                                <p><strong>Jumlah:</strong> {deleteTx ? formatCurrency(Number(deleteTx.amount)) : "-"}</p>
                            </div>
                            <p className="text-red-600 font-medium text-xs">
                                ⚠️ Saldo rekening anggota akan otomatis disesuaikan. Tindakan ini tidak dapat dibatalkan.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={deleteLoading}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteLoading ? "Menghapus..." : "Ya, Hapus Transaksi"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
