"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, ChevronRight, ChevronDown, Loader2, Save, BookOpen } from "lucide-react";
import { masterApi } from "@/lib/api";

// Account type
interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
    parentId?: number;
    level: number;
    isDetail: boolean;
    normalBalance: "debit" | "credit";
    isActive: boolean;
}

const ACCOUNT_TYPES = {
    asset: { label: "Aset", color: "blue" },
    liability: { label: "Kewajiban", color: "amber" },
    equity: { label: "Modal", color: "purple" },
    income: { label: "Pendapatan", color: "emerald" },
    expense: { label: "Beban", color: "red" },
};

// Account tree node component
function AccountNode({ account, accounts, onEdit, searchQuery }: { account: Account; accounts: Account[]; onEdit: (a: Account) => void; searchQuery?: string }) {
    const [isOpen, setIsOpen] = React.useState(account.level <= 2);
    const children = accounts.filter((a) => a.parentId === account.id);
    const hasChildren = children.length > 0;
    const paddingLeft = (account.level - 1) * 24;

    const matchesSearch = !searchQuery ||
        account.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch && !hasChildren) return null;

    return (
        <div>
            <div
                className={`flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg ${
                    !account.isActive ? "opacity-50" : ""
                } ${matchesSearch ? "" : "opacity-60"}`}
                style={{ paddingLeft }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        className="p-1 hover:bg-muted rounded"
                        onClick={() => setIsOpen((v) => !v)}
                        aria-label={isOpen ? "Tutup" : "Buka"}
                    >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                ) : (
                    <div className="w-6" />
                )}
                <span className="font-mono text-sm text-muted-foreground w-20">{account.code}</span>
                <span className={`flex-1 ${account.level === 1 ? "font-bold" : account.isDetail ? "" : "font-medium"}`}>
                    {account.name}
                </span>
                {account.isDetail && (
                    <Badge variant="outline" className="text-xs">Detail</Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                    {account.normalBalance === "debit" ? "D" : "K"}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => onEdit(account)}>
                    <Pencil className="h-3 w-3" />
                </Button>
            </div>
            {hasChildren && isOpen && (
                <div>
                    {children.map((child) => (
                        <AccountNode key={child.id} account={child} accounts={accounts} onEdit={onEdit} searchQuery={searchQuery} />
                    ))}
                </div>
            )}
        </div>
    );
}

// Account form
function AccountForm({
    account,
    accounts,
    onSave,
    onCancel
}: {
    account?: Account;
    accounts: Account[];
    onSave: (data: Partial<Account>) => Promise<void>;
    onCancel: () => void;
}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        code: account?.code || "",
        name: account?.name || "",
        type: account?.type || "asset",
        parentId: account?.parentId?.toString() || "none",
        isDetail: account?.isDetail ?? true,
        normalBalance: account?.normalBalance || "debit",
        isActive: account?.isActive ?? true,
    });

    const parentAccounts = accounts.filter((a) => !a.isDetail && a.type === formData.type);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                parentId: formData.parentId && formData.parentId !== "none" ? parseInt(formData.parentId) : null,
                level: formData.parentId && formData.parentId !== "none" ? (accounts.find((a) => a.id.toString() === formData.parentId)?.level || 0) + 1 : 1,
            } as Partial<Account>);
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
                        onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                        placeholder="1.1.01"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="name">Nama Akun *</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Kas"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="type">Tipe Akun *</Label>
                    <Select
                        value={formData.type}
                        onValueChange={(value) => setFormData((p) => ({ ...p, type: value, parentId: "" }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(ACCOUNT_TYPES).map(([key, val]) => (
                                <SelectItem key={key} value={key}>{val.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="parent">Induk</Label>
                    <Select
                        value={formData.parentId}
                        onValueChange={(value) => setFormData((p) => ({ ...p, parentId: value }))}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih akun induk" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Tidak ada (Level 1)</SelectItem>
                            {parentAccounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                    {acc.code} - {acc.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="normalBalance">Saldo Normal *</Label>
                    <Select
                        value={formData.normalBalance}
                        onValueChange={(value) => setFormData((p) => ({ ...p, normalBalance: value as "debit" | "credit" }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="debit">Debit</SelectItem>
                            <SelectItem value="credit">Kredit</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="isDetail"
                        checked={formData.isDetail}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, isDetail: !!checked }))}
                    />
                    <Label htmlFor="isDetail" className="font-normal">Akun Detail (dapat diposting)</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: !!checked }))}
                    />
                    <Label htmlFor="isActive" className="font-normal">Aktif</Label>
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Simpan
                </Button>
            </DialogFooter>
        </form>
    );
}

export default function MasterCOAPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [accounts, setAccounts] = React.useState<Account[]>([]);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingAccount, setEditingAccount] = React.useState<Account | undefined>();
    const [searchQuery, setSearchQuery] = React.useState("");

    // Fetch accounts from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const response = await masterApi.accounts.list("flat");
                setAccounts(response.data as unknown as Account[]);
            } catch (error) {
                console.error("Failed to fetch accounts:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    const handleSave = async (data: Partial<Account>) => {
        try {
            if (editingAccount) {
                await masterApi.accounts.update(editingAccount.id, data as Record<string, unknown>);
                setAccounts((prev) => prev.map((a) => a.id === editingAccount.id ? { ...a, ...data } as Account : a));
                toast.success("Akun berhasil diperbarui");
            } else {
                const response = await masterApi.accounts.create(data as Record<string, unknown>);
                setAccounts((prev) => [...prev, response.data as unknown as Account]);
                toast.success("Akun berhasil ditambahkan");
            }
            setDialogOpen(false);
            setEditingAccount(undefined);
        } catch (error) {
            toast.error("Gagal menyimpan akun");
        }
    };

    const handleEdit = (account: Account) => {
        setEditingAccount(account);
        setDialogOpen(true);
    };

    const handleAdd = () => {
        setEditingAccount(undefined);
        setDialogOpen(true);
    };

    // Get root accounts by type
    const rootAccounts = accounts.filter((a) => a.level === 1);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Bagan Akun (COA)"
                description="Kelola bagan akun akuntansi PRIMKOPPOL"
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
                                <DialogTitle>{editingAccount ? "Edit Akun" : "Tambah Akun Baru"}</DialogTitle>
                                <DialogDescription>
                                    {editingAccount ? "Perbarui informasi akun" : "Buat akun baru untuk bagan akun"}
                                </DialogDescription>
                            </DialogHeader>
                            <AccountForm
                                account={editingAccount}
                                accounts={accounts}
                                onSave={handleSave}
                                onCancel={() => setDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                }
            />

            {/* Search */}
            <div className="max-w-sm">
                <Input
                    placeholder="Cari akun..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Account Tree */}
            <div className="rounded-lg border bg-card">
                <div className="p-4 border-b bg-muted/50 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <span className="font-medium">Bagan Akun</span>
                    <Badge variant="outline" className="ml-auto">{accounts.length} akun</Badge>
                </div>
                <div className="p-2">
                    {isLoading ? (
                        <div className="space-y-2 p-4">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : rootAccounts.length > 0 ? (
                        rootAccounts.map((account) => (
                            <AccountNode key={account.id} account={account} accounts={accounts} onEdit={handleEdit} searchQuery={searchQuery || undefined} />
                        ))
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Tidak ada data akun
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
