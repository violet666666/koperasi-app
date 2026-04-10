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
    MoreHorizontal,
    Pencil,
    Trash2,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/constants";
import { cashBankApi } from "@/lib/api/services";
import { DatePeriodFilter, matchesDateRange, type DateRange } from "@/components/patterns/date-period-filter";

interface CashTransaction {
    id: number;
    transactionNo: string;
    type: "in" | "out";
    category: string;
    amount: number;
    description: string;
    transactionDate: string;
    balanceAfter: number;
    accountId: number;
}

interface CashAccount {
    id: number;
    code: string;
    name: string;
    currentBalance: number;
}

export default function TransaksiKasPage() {
    const [transactions, setTransactions] = React.useState<CashTransaction[]>([]);
    const [accounts, setAccounts] = React.useState<CashAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = React.useState<string>("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dateRange, setDateRange] = React.useState<DateRange>({ start: null, end: null, mode: "all", label: "Semua Data" });
    
    // Create Mode
    const [transactionType, setTransactionType] = React.useState<"in" | "out">("in");
    
    // Edit & Delete states
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [editingTx, setEditingTx] = React.useState<CashTransaction | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [txToDelete, setTxToDelete] = React.useState<CashTransaction | null>(null);
    
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [members, setMembers] = React.useState<{ id: number; name: string; nrp: string | null }[]>([]);
    const [memberSearch, setMemberSearch] = React.useState("");

    // Create Form state
    const [formData, setFormData] = React.useState({
        accountId: "",
        amount: "",
        category: "biaya_operasional",
        description: "",
        transactionDate: new Date().toISOString().split("T")[0],
        unitType: "",
        memberId: "",
    });

    // Split preview calculation
    const splitPreview = React.useMemo(() => {
        const amount = Number(formData.amount) || 0;
        if (formData.unitType !== "cuci_mobil" || formData.category !== "pendapatan_unit" || transactionType !== "in" || amount <= 0) {
            return null;
        }
        const mitraShare = Math.floor(amount * 0.5);
        const koperasiGross = amount - mitraShare;
        const shuAnggota = formData.memberId ? Math.min(2000, koperasiGross) : 0;
        const netKoperasi = koperasiGross - shuAnggota;
        return { mitraShare, shuAnggota, netKoperasi, totalMasuk: amount };
    }, [formData.amount, formData.unitType, formData.category, formData.memberId, transactionType]);

    // UNIT_TYPES constant
    const UNIT_TYPES = [
        { value: "toko", label: "Toko" },
        { value: "cuci_mobil", label: "Cuci Mobil & Resto" },
        { value: "simpan_pinjam", label: "Simpan Pinjam" },
        { value: "fitness", label: "Gym / Fitness" },
        { value: "ps", label: "Playstation" },
    ];

    // Fetch members for the combobox
    React.useEffect(() => {
        if (!formData.unitType) return;
        const fetchMembers = async () => {
            try {
                const res = await fetch(`/api/members?perPage=50&search=${memberSearch}`);
                const json = await res.json();
                setMembers((json.data || []).map((m: any) => ({ id: m.id, name: m.name, nrp: m.nrp })));
            } catch {}
        };
        const debounce = setTimeout(fetchMembers, 300);
        return () => clearTimeout(debounce);
    }, [formData.unitType, memberSearch]);

    // Edit Form state
    const [editFormData, setEditFormData] = React.useState({
        amount: "",
        type: "in" as "in" | "out",
        category: "biaya_operasional",
        description: "",
    });

    // Stats
    const stats = React.useMemo(() => {
        const totalBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
        const todayIn = transactions
            .filter(t => t.type === "in" && new Date(t.transactionDate).toDateString() === new Date().toDateString())
            .reduce((sum, t) => sum + Number(t.amount), 0);
        const todayOut = transactions
            .filter(t => t.type === "out" && new Date(t.transactionDate).toDateString() === new Date().toDateString())
            .reduce((sum, t) => sum + Number(t.amount), 0);

        return { totalBalance, todayIn, todayOut };
    }, [accounts, transactions]);

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const accountsRes = await cashBankApi.accounts();
            const allAccounts = (accountsRes as any).data || [];
            setAccounts(allAccounts);

            const params = selectedAccount !== "all" ? { accountId: Number(selectedAccount), perPage: 9999 } : { perPage: 9999 };
            const txRes = await cashBankApi.transactions({ ...params });
            setTransactions(((txRes as any).data || []) as CashTransaction[]);
        } catch (error) {
            console.error("Failed to fetch:", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedAccount]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateSubmit = async () => {
        if (!formData.accountId || !formData.amount) {
            toast.error("Lengkapi data transaksi");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await cashBankApi.createTransaction({
                accountId: Number(formData.accountId),
                type: transactionType,
                amount: Number(formData.amount),
                category: formData.category,
                description: formData.description,
                transactionDate: formData.transactionDate 
                    ? new Date(formData.transactionDate).toISOString() 
                    : new Date().toISOString(),
                unitType: formData.unitType || undefined,
                memberId: formData.memberId ? Number(formData.memberId) : undefined,
            });
            const message = (res as any)?.message || "Transaksi berhasil dicatat";
            toast.success(message);
            setDialogOpen(false);
            setFormData({ accountId: "", amount: "", category: "biaya_operasional", description: "", transactionDate: new Date().toISOString().split("T")[0], unitType: "", memberId: "" });
            setMemberSearch("");
            await fetchData();
        } catch (error) {
            toast.error("Gagal mencatat transaksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditSave = async () => {
        if (!editingTx || !editFormData.amount) return;
        setIsSubmitting(true);
        try {
            await cashBankApi.updateTransaction(editingTx.id, {
                type: editFormData.type,
                amount: Number(editFormData.amount),
                category: editFormData.category,
                description: editFormData.description,
            });
            toast.success("Transaksi berhasil diubah & saldo terkalkulasi");
            setEditDialogOpen(false);
            setEditingTx(null);
            await fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal mengubah transaksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!txToDelete) return;
        setIsSubmitting(true);
        try {
            await cashBankApi.deleteTransaction(txToDelete.id);
            toast.success("Transaksi dihapus & saldo dikalkulasi ulang");
            setDeleteDialogOpen(false);
            setTxToDelete(null);
            await fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal menghapus transaksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditDialog = (tx: CashTransaction) => {
        setEditingTx(tx);
        setEditFormData({
            type: tx.type,
            amount: String(tx.amount),
            category: tx.category || "lainnya",
            description: tx.description || "",
        });
        setEditDialogOpen(true);
    };

    const openDeleteDialog = (tx: CashTransaction) => {
        setTxToDelete(tx);
        setDeleteDialogOpen(true);
    };

    const columns: ColumnDef<CashTransaction>[] = React.useMemo(() => [
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
                    simpanan_pokok: "Simpanan Pokok",
                    simpanan_wajib: "Simpanan Wajib",
                    simpanan_sukarela: "Simpanan Sukarela",
                    angsuran_pokok: "Angsuran Pinjaman",
                    jasa_pinjaman: "Jasa Pinjaman",
                    pendapatan_unit: "Pendapatan Unit",
                    pencairan_pinjaman: "Pencairan Pinjaman",
                    biaya_operasional: "Operasional",
                    beban_unit: "Beban Unit",
                    hpp_toko: "HPP / Barang",
                    hutang_mitra: "Hutang Mitra",
                    transfer: "Transfer",
                    lainnya: "Lainnya",
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
        {
            id: "actions",
            cell: ({ row }) => {
                const tx = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Aksi Operator</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditDialog(tx)}>
                                <Pencil className="mr-2 h-4 w-4 text-blue-500" />
                                Edit Transaksi
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteDialog(tx)}>
                                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                Hapus (Resync)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ], []);

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
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>
                                        {transactionType === "in" ? "Kas Masuk" : "Kas Keluar"}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Catat transaksi {transactionType === "in" ? "pemasukan" : "pengeluaran"} kas
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-2">
                                            <Label>Akun Kas</Label>
                                            <Select
                                                value={formData.accountId}
                                                onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}
                                            >
                                                <SelectTrigger className="w-full">
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
                                            <Label>Tanggal Transaksi</Label>
                                            <Input
                                                type="date"
                                                value={formData.transactionDate}
                                                onChange={(e) => setFormData(prev => ({ ...prev, transactionDate: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>Jumlah (Rp)</Label>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                value={formData.amount}
                                                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <Label>Unit Usaha <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                                            <Select
                                                value={formData.unitType}
                                                onValueChange={(v) => setFormData(prev => ({ ...prev, unitType: v, memberId: "" }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="— Tanpa Unit —" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">— Tanpa Unit —</SelectItem>
                                                    {UNIT_TYPES.map((u) => (
                                                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
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
                                                {transactionType === "in" ? (
                                                    <>
                                                        <SelectItem value="pendapatan_unit">Pendapatan Unit Usaha</SelectItem>
                                                        <SelectItem value="simpanan_pokok">Simpanan Pokok</SelectItem>
                                                        <SelectItem value="simpanan_wajib">Simpanan Wajib</SelectItem>
                                                        <SelectItem value="simpanan_sukarela">Simpanan Sukarela</SelectItem>
                                                        <SelectItem value="angsuran_pokok">Angsuran Pinjaman</SelectItem>
                                                        <SelectItem value="jasa_pinjaman">Jasa Pinjaman</SelectItem>
                                                        <SelectItem value="lainnya">Lainnya</SelectItem>
                                                    </>
                                                ) : (
                                                    <>
                                                        <SelectItem value="biaya_operasional">Biaya Operasional</SelectItem>
                                                        <SelectItem value="beban_unit">Beban Operasional Unit</SelectItem>
                                                        <SelectItem value="hpp_toko">HPP / Pembelian Barang</SelectItem>
                                                        <SelectItem value="pencairan_pinjaman">Pencairan Pinjaman</SelectItem>
                                                        <SelectItem value="hutang_mitra">Kewajiban Bagi Hasil Mitra</SelectItem>
                                                        <SelectItem value="transfer">Transfer</SelectItem>
                                                        <SelectItem value="lainnya">Lainnya</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Member selector — appears when unit is selected */}
                                    {formData.unitType && formData.unitType !== "none" && (
                                        <div>
                                            <Label>Anggota <span className="text-muted-foreground text-xs">(opsional — untuk tracking SHU)</span></Label>
                                            <Select
                                                value={formData.memberId}
                                                onValueChange={(v) => setFormData(prev => ({ ...prev, memberId: v }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="— Pilih Anggota —" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <div className="p-2">
                                                        <Input
                                                            placeholder="Cari nama / NRP..."
                                                            value={memberSearch}
                                                            onChange={(e) => setMemberSearch(e.target.value)}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                    <SelectItem value="none">— Non-Anggota —</SelectItem>
                                                    {members.map((m) => (
                                                        <SelectItem key={m.id} value={String(m.id)}>
                                                            {m.name} {m.nrp ? `(${m.nrp})` : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Split Preview for Cuci Mobil */}
                                    {splitPreview && (
                                        <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 p-3 space-y-1.5">
                                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                                💡 Kalkulasi Otomatis Split Cuci Mobil
                                            </p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                                <span className="text-muted-foreground">Total Masuk:</span>
                                                <span className="font-semibold text-right">{formatCurrency(splitPreview.totalMasuk)}</span>
                                                <span className="text-muted-foreground">Bagian Mitra (50%):</span>
                                                <span className="font-semibold text-right text-amber-600">-{formatCurrency(splitPreview.mitraShare)}</span>
                                                {splitPreview.shuAnggota > 0 && (
                                                    <>
                                                        <span className="text-muted-foreground">SHU Anggota:</span>
                                                        <span className="font-semibold text-right text-purple-600">-{formatCurrency(splitPreview.shuAnggota)}</span>
                                                    </>
                                                )}
                                                <span className="text-muted-foreground font-medium border-t pt-1">Net Koperasi:</span>
                                                <span className="font-bold text-right text-emerald-600 border-t pt-1">{formatCurrency(splitPreview.netKoperasi)}</span>
                                            </div>
                                            {!formData.memberId && (
                                                <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠️ Pilih Anggota untuk otomatis potong SHU Rp2.000</p>
                                            )}
                                        </div>
                                    )}

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
                                    <Button onClick={handleCreateSubmit} disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Simpan
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                }
            />

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Mutasi Kas</DialogTitle>
                        <DialogDescription>Awas! Perubahan nominal akan dikalkulasi ulang pada saldo berantai.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Jenis</Label>
                            <Select
                                value={editFormData.type}
                                onValueChange={(v: "in" | "out") => setEditFormData(prev => ({ ...prev, type: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="in">Kas Masuk</SelectItem>
                                    <SelectItem value="out">Kas Keluar</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Jumlah Baru</Label>
                            <Input
                                type="number"
                                value={editFormData.amount}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Kategori</Label>
                            <Select
                                value={editFormData.category}
                                onValueChange={(v) => setEditFormData(prev => ({ ...prev, category: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="biaya_operasional">Operasional</SelectItem>
                                    <SelectItem value="pendapatan_unit">Pendapatan Unit Usaha</SelectItem>
                                    <SelectItem value="beban_unit">Beban Operasional Unit</SelectItem>
                                    <SelectItem value="hpp_toko">HPP / Pembelian Barang</SelectItem>
                                    <SelectItem value="hutang_mitra">Kewajiban Bagi Hasil Mitra</SelectItem>
                                    <SelectItem value="simpanan_pokok">Simpanan Pokok</SelectItem>
                                    <SelectItem value="simpanan_wajib">Simpanan Wajib</SelectItem>
                                    <SelectItem value="simpanan_sukarela">Simpanan Sukarela</SelectItem>
                                    <SelectItem value="angsuran_pokok">Angsuran Pinjaman</SelectItem>
                                    <SelectItem value="jasa_pinjaman">Jasa Pinjaman</SelectItem>
                                    <SelectItem value="pencairan_pinjaman">Pencairan Pinjaman</SelectItem>
                                    <SelectItem value="transfer">Transfer</SelectItem>
                                    <SelectItem value="lainnya">Lainnya</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Keterangan Baru</Label>
                            <Textarea
                                value={editFormData.description}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleEditSave} disabled={isSubmitting}>
                           {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                           Simpan Pembaruan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus & Sinkronisasi Ulang Kas</DialogTitle>
                        <DialogDescription className="text-red-600 font-medium pt-2">
                            Peringatan: Menghapus {txToDelete?.transactionNo} akan memaksa sistem untuk 
                            menghitung dan merevisi ulang seluruh {txToDelete?.type === "in" ? "pengurangan" : "penambahan"} 
                            saldo sebelum & sesudah pada BUKU BESAR secara masif.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Hapus & Sinkronkan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                <CardContent className="p-4 space-y-3">
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
                    <DatePeriodFilter onChange={setDateRange} showImportNote />
                    {dateRange.mode !== "all" && (
                        <p className="text-xs text-muted-foreground">
                            Menampilkan data: <strong>{dateRange.label}</strong>
                        </p>
                    )}
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
                <>
                    <DataTable
                        columns={columns}
                        data={transactions.filter(t => matchesDateRange(t.transactionDate, dateRange))}
                        searchColumn="description"
                        searchPlaceholder="Cari transaksi..."
                    />
                    {transactions.filter(t => matchesDateRange(t.transactionDate, dateRange)).length === 0 && !isLoading && dateRange.mode !== "all" && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Tidak ada transaksi pada <strong>{dateRange.label}</strong>.
                            {dateRange.mode === "day" && " Coba filter Bulan untuk melihat data import."}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
