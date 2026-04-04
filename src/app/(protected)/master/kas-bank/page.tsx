"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Wallet, Building, Save, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

// Types
interface CashBankAccountFull {
    id: number;
    code: string;
    name: string;
    type: "cash" | "bank";
    bankName?: string | null;
    accountNumber?: string | null;
    branchId: number;
    glAccountId?: number | null;
    unitType?: string | null;
    currentBalance: number;
    isActive: boolean;
    branch?: { id: number; name: string; code: string };
    glAccount?: { id: number; code: string; name: string } | null;
    _count?: { transactions: number };
}

interface COAAccount {
    id: number;
    code: string;
    name: string;
}

interface Branch {
    id: number;
    code: string;
    name: string;
}

// --------------------------------------------------
// Form Component
// --------------------------------------------------
function CashBankForm({
    account,
    branches,
    coaAccounts,
    onSave,
    onCancel,
}: {
    account?: CashBankAccountFull;
    branches: Branch[];
    coaAccounts: COAAccount[];
    onSave: (data: Record<string, unknown>) => Promise<void>;
    onCancel: () => void;
}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        code: account?.code || "",
        name: account?.name || "",
        type: account?.type || "cash",
        bankName: account?.bankName || "",
        accountNumber: account?.accountNumber || "",
        branchId: account?.branchId?.toString() || "",
        glAccountId: account?.glAccountId?.toString() || "",
        unitType: account?.unitType || "simpan_pinjam",
        isActive: account?.isActive ?? true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name || !formData.branchId) {
            toast.error("Kode, Nama, dan Cabang wajib diisi.");
            return;
        }
        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                glAccountId: formData.glAccountId ? parseInt(formData.glAccountId) : null,
                branchId: parseInt(formData.branchId),
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="code">Kode Akun *</Label>
                    <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) =>
                            setFormData((p) => ({
                                ...p,
                                code: e.target.value.toUpperCase(),
                            }))
                        }
                        placeholder="KAS-001"
                        maxLength={20}
                        required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        Contoh: KAS-001, B-001
                    </p>
                </div>
                <div>
                    <Label htmlFor="name">Nama Akun *</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                            setFormData((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="Kas Tunai / Bank BRI"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="type">Tipe *</Label>
                    <Select
                        value={formData.type}
                        onValueChange={(val) =>
                            setFormData((p) => ({ ...p, type: val as "cash" | "bank" }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cash">
                                <div className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-emerald-600" />
                                    Kas (Tunai)
                                </div>
                            </SelectItem>
                            <SelectItem value="bank">
                                <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-blue-600" />
                                    Bank (Rekening)
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="branchId">Cabang *</Label>
                    <Select
                        value={formData.branchId}
                        onValueChange={(val) =>
                            setFormData((p) => ({ ...p, branchId: val }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih cabang..." />
                        </SelectTrigger>
                        <SelectContent>
                            {branches.map((b) => (
                                <SelectItem key={b.id} value={b.id.toString()}>
                                    {b.name} ({b.code})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {formData.type === "bank" && (
                    <>
                        <div>
                            <Label htmlFor="bankName">Nama Bank</Label>
                            <Input
                                id="bankName"
                                value={formData.bankName}
                                onChange={(e) =>
                                    setFormData((p) => ({
                                        ...p,
                                        bankName: e.target.value,
                                    }))
                                }
                                placeholder="BRI / JATIM / BCA"
                            />
                        </div>
                        <div>
                            <Label htmlFor="accountNumber">No. Rekening</Label>
                            <Input
                                id="accountNumber"
                                value={formData.accountNumber}
                                onChange={(e) =>
                                    setFormData((p) => ({
                                        ...p,
                                        accountNumber: e.target.value,
                                    }))
                                }
                                placeholder="001201003456789"
                            />
                        </div>
                    </>
                )}

                <div className="sm:col-span-2">
                    <Label htmlFor="glAccountId">Tautkan ke Bagan Akun (COA)</Label>
                    <Select
                        value={formData.glAccountId}
                        onValueChange={(val) =>
                            setFormData((p) => ({
                                ...p,
                                glAccountId: val === "none" ? "" : val,
                            }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Opsional – pilih akun COA..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">— Tidak ditautkan —</SelectItem>
                            {coaAccounts.map((a) => (
                                <SelectItem key={a.id} value={a.id.toString()}>
                                    {a.code} - {a.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                        Hubungkan dengan akun Bagan Akun agar saldo otomatis tercatat di jurnal.
                    </p>
                </div>
                <div className="sm:col-span-2">
                    <Label htmlFor="unitType">Unit Usaha / Alokasi Rekening</Label>
                    <Select
                        value={formData.unitType}
                        onValueChange={(val) =>
                            setFormData((p) => ({ ...p, unitType: val }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih unit usaha..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="simpan_pinjam">Simpan Pinjam (Sentral)</SelectItem>
                            <SelectItem value="toko">Toko</SelectItem>
                            <SelectItem value="play_station">Play Station</SelectItem>
                            <SelectItem value="fitness">Fitnes</SelectItem>
                            <SelectItem value="coffe_latar">Coffe Latar</SelectItem>
                            <SelectItem value="barbershop">Barbershop</SelectItem>
                            <SelectItem value="carwash">Carwash</SelectItem>
                            <SelectItem value="resto">Resto</SelectItem>
                            <SelectItem value="properti">Properti</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                        Pilih unit agar sistem POS otomatis melakukan routing ke rekening ini.
                    </p>
                </div>
            </div>

            {account && (
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) =>
                            setFormData((p) => ({ ...p, isActive: !!checked }))
                        }
                    />
                    <Label htmlFor="isActive" className="font-normal">
                        Aktif
                    </Label>
                </div>
            )}

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isLoading}
                >
                    Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Simpan
                </Button>
            </DialogFooter>
        </form>
    );
}

// --------------------------------------------------
// Main Page
// --------------------------------------------------
export default function MasterKasBankPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [accounts, setAccounts] = React.useState<CashBankAccountFull[]>([]);
    const [branches, setBranches] = React.useState<Branch[]>([]);
    const [coaAccounts, setCoaAccounts] = React.useState<COAAccount[]>([]);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingAccount, setEditingAccount] = React.useState<
        CashBankAccountFull | undefined
    >();
    const [deleteTarget, setDeleteTarget] = React.useState<CashBankAccountFull | null>(null);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [accRes, branchRes, coaRes] = await Promise.all([
                    fetch("/api/master/cash-bank").then((r) => r.json()),
                    fetch("/api/master/branches").then((r) => r.json()),
                    fetch("/api/master/accounts?format=flat").then((r) => r.json()),
                ]);
                setAccounts(accRes.data || []);
                setBranches(branchRes.data || []);
                // Filter COA to only show asset-type, detail accounts under parent "Kas & Bank" (1100 range)
                const allCoa = (coaRes.data || []) as COAAccount[];
                setCoaAccounts(allCoa);
            } catch (error) {
                console.error("Failed to fetch master kas bank data:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleSave = async (data: Record<string, unknown>) => {
        try {
            if (editingAccount) {
                const res = await fetch(
                    `/api/master/cash-bank/${editingAccount.id}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                    }
                );
                const json = await res.json();
                if (!res.ok) throw new Error(json.message);
                setAccounts((prev) =>
                    prev.map((a) =>
                        a.id === editingAccount.id ? { ...a, ...json.data } : a
                    )
                );
                toast.success("Akun Kas/Bank berhasil diperbarui.");
            } else {
                const res = await fetch("/api/master/cash-bank", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.message);
                setAccounts((prev) => [...prev, json.data]);
                toast.success("Akun Kas/Bank berhasil ditambahkan!");
            }
            setDialogOpen(false);
            setEditingAccount(undefined);
        } catch (error: any) {
            toast.error(error.message || "Gagal menyimpan akun.");
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(
                `/api/master/cash-bank/${deleteTarget.id}`,
                { method: "DELETE" }
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            // If soft-deleted (has transactions), update in-place
            if (deleteTarget._count && deleteTarget._count.transactions > 0) {
                setAccounts((prev) =>
                    prev.map((a) =>
                        a.id === deleteTarget.id
                            ? { ...a, isActive: false, deletedAt: new Date() as any }
                            : a
                    )
                );
            } else {
                setAccounts((prev) =>
                    prev.filter((a) => a.id !== deleteTarget.id)
                );
            }
            toast.success(json.message || "Akun berhasil dihapus.");
        } catch (error: any) {
            toast.error(error.message || "Gagal menghapus akun.");
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleEdit = (account: CashBankAccountFull) => {
        setEditingAccount(account);
        setDialogOpen(true);
    };

    const handleAdd = () => {
        setEditingAccount(undefined);
        setDialogOpen(true);
    };

    // Table columns
    const columns: ColumnDef<CashBankAccountFull>[] = [
        {
            accessorKey: "code",
            header: "Kode",
            cell: ({ row }) => (
                <Badge variant="outline" className="font-mono">
                    {row.getValue("code")}
                </Badge>
            ),
        },
        {
            accessorKey: "name",
            header: "Nama Akun",
            cell: ({ row }) => {
                const isCash = row.original.type === "cash";
                return (
                    <div className="flex items-center gap-2">
                        <div
                            className={`rounded-md p-1.5 ${
                                isCash
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                            }`}
                        >
                            {isCash ? (
                                <Wallet className="h-3.5 w-3.5" />
                            ) : (
                                <Building className="h-3.5 w-3.5" />
                            )}
                        </div>
                        <div>
                            <p className="font-medium">{row.getValue("name")}</p>
                            {row.original.bankName && (
                                <p className="text-xs text-muted-foreground">
                                    {row.original.bankName}
                                    {row.original.accountNumber
                                        ? ` - ${row.original.accountNumber}`
                                        : ""}
                                </p>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "type",
            header: "Tipe",
            cell: ({ row }) => (
                <Badge
                    variant={row.original.type === "cash" ? "default" : "secondary"}
                    className={
                        row.original.type === "cash"
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                    }
                >
                    {row.original.type === "cash" ? "Kas" : "Bank"}
                </Badge>
            ),
        },
        {
            id: "glAccount",
            header: "Bagan Akun (COA)",
            cell: ({ row }) => {
                const gl = row.original.glAccount;
                if (!gl) return <span className="text-muted-foreground text-xs">—</span>;
                return (
                    <span className="text-xs">
                        {gl.code} - {gl.name}
                    </span>
                );
            },
        },
        {
            accessorKey: "currentBalance",
            header: "Saldo",
            cell: ({ row }) => (
                <span className="font-bold tabular-nums text-primary">
                    {formatCurrency(Number(row.original.currentBalance))}
                </span>
            ),
        },
        {
            id: "txCount",
            header: "Transaksi",
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm tabular-nums">
                    {row.original._count?.transactions || 0}
                </span>
            ),
        },
        {
            accessorKey: "isActive",
            header: "Status",
            cell: ({ row }) => (
                <Badge
                    variant={row.getValue("isActive") ? "default" : "secondary"}
                >
                    {row.getValue("isActive") ? "Aktif" : "Nonaktif"}
                </Badge>
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(row.original)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(row.original)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Master Kas & Bank"
                description="Kelola daftar rekening kas tunai dan rekening bank PRIMKOPPOL"
                backHref="/master"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleAdd}>
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Akun
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingAccount
                                        ? "Edit Akun Kas/Bank"
                                        : "Tambah Akun Kas/Bank Baru"}
                                </DialogTitle>
                                <DialogDescription>
                                    {editingAccount
                                        ? "Perbarui informasi rekening kas atau bank."
                                        : "Daftarkan rekening kas tunai atau bank baru untuk menampung saldo koperasi."}
                                </DialogDescription>
                            </DialogHeader>
                            <CashBankForm
                                account={editingAccount}
                                branches={branches}
                                coaAccounts={coaAccounts}
                                onSave={handleSave}
                                onCancel={() => setDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                }
            />

            <DataTable
                columns={columns}
                data={accounts}
                isLoading={isLoading}
                searchPlaceholder="Cari kas/bank..."
                searchColumn="name"
            />

            {/* Delete Confirmation */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Akun Kas/Bank?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget &&
                            deleteTarget._count &&
                            deleteTarget._count.transactions > 0 ? (
                                <>
                                    Akun <strong>{deleteTarget?.name}</strong>{" "}
                                    memiliki{" "}
                                    <strong>
                                        {deleteTarget._count.transactions}{" "}
                                        transaksi
                                    </strong>{" "}
                                    terkait. Akun ini akan{" "}
                                    <strong>dinonaktifkan</strong> (bukan dihapus
                                    permanen) untuk menjaga integritas data.
                                </>
                            ) : (
                                <>
                                    Akun <strong>{deleteTarget?.name}</strong>{" "}
                                    akan dihapus secara permanen. Tindakan ini
                                    tidak dapat dibatalkan.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                            {deleteTarget?._count &&
                            deleteTarget._count.transactions > 0
                                ? "Nonaktifkan"
                                : "Hapus Permanen"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
