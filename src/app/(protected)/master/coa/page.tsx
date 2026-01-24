"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { toast } from "sonner";
import { Plus, Pencil, ChevronRight, ChevronDown, Loader2, Save, BookOpen } from "lucide-react";
import type { Account } from "@/types";

// Mock data
const MOCK_ACCOUNTS: Account[] = [
    { id: 1, code: "1", name: "ASET", type: "asset", level: 1, is_detail: false, normal_balance: "debit", is_active: true },
    { id: 2, code: "1.1", name: "Aset Lancar", type: "asset", parent_id: 1, level: 2, is_detail: false, normal_balance: "debit", is_active: true },
    { id: 3, code: "1.1.01", name: "Kas", type: "asset", parent_id: 2, level: 3, is_detail: true, normal_balance: "debit", is_active: true },
    { id: 4, code: "1.1.02", name: "Bank", type: "asset", parent_id: 2, level: 3, is_detail: true, normal_balance: "debit", is_active: true },
    { id: 5, code: "1.1.03", name: "Piutang Anggota", type: "asset", parent_id: 2, level: 3, is_detail: true, normal_balance: "debit", is_active: true },
    { id: 6, code: "1.2", name: "Aset Tetap", type: "asset", parent_id: 1, level: 2, is_detail: false, normal_balance: "debit", is_active: true },
    { id: 7, code: "1.2.01", name: "Tanah", type: "asset", parent_id: 6, level: 3, is_detail: true, normal_balance: "debit", is_active: true },
    { id: 8, code: "1.2.02", name: "Bangunan", type: "asset", parent_id: 6, level: 3, is_detail: true, normal_balance: "debit", is_active: true },
    { id: 10, code: "2", name: "KEWAJIBAN", type: "liability", level: 1, is_detail: false, normal_balance: "credit", is_active: true },
    { id: 11, code: "2.1", name: "Simpanan Anggota", type: "liability", parent_id: 10, level: 2, is_detail: false, normal_balance: "credit", is_active: true },
    { id: 12, code: "2.1.01", name: "Simpanan Pokok", type: "liability", parent_id: 11, level: 3, is_detail: true, normal_balance: "credit", is_active: true },
    { id: 13, code: "2.1.02", name: "Simpanan Wajib", type: "liability", parent_id: 11, level: 3, is_detail: true, normal_balance: "credit", is_active: true },
    { id: 20, code: "3", name: "MODAL", type: "equity", level: 1, is_detail: false, normal_balance: "credit", is_active: true },
    { id: 21, code: "3.1", name: "Modal Penyertaan", type: "equity", parent_id: 20, level: 2, is_detail: true, normal_balance: "credit", is_active: true },
    { id: 30, code: "4", name: "PENDAPATAN", type: "income", level: 1, is_detail: false, normal_balance: "credit", is_active: true },
    { id: 31, code: "4.1", name: "Pendapatan Bunga", type: "income", parent_id: 30, level: 2, is_detail: true, normal_balance: "credit", is_active: true },
    { id: 40, code: "5", name: "BEBAN", type: "expense", level: 1, is_detail: false, normal_balance: "debit", is_active: true },
    { id: 41, code: "5.1", name: "Beban Operasional", type: "expense", parent_id: 40, level: 2, is_detail: true, normal_balance: "debit", is_active: true },
];

const ACCOUNT_TYPES = {
    asset: { label: "Aset", color: "blue" },
    liability: { label: "Kewajiban", color: "amber" },
    equity: { label: "Modal", color: "purple" },
    income: { label: "Pendapatan", color: "emerald" },
    expense: { label: "Beban", color: "red" },
};

// Account tree node component
function AccountNode({ account, accounts, onEdit }: { account: Account; accounts: Account[]; onEdit: (a: Account) => void }) {
    const [isOpen, setIsOpen] = React.useState(account.level === 1);
    const children = accounts.filter((a) => a.parent_id === account.id);
    const hasChildren = children.length > 0;
    const paddingLeft = (account.level - 1) * 24;

    return (
        <div>
            <div
                className={`flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg ${!account.is_active ? "opacity-50" : ""}`}
                style={{ paddingLeft }}
            >
                {hasChildren ? (
                    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                        <CollapsibleTrigger className="p-1 hover:bg-muted rounded">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </CollapsibleTrigger>
                    </Collapsible>
                ) : (
                    <div className="w-6" />
                )}
                <span className="font-mono text-sm text-muted-foreground w-20">{account.code}</span>
                <span className={`flex-1 ${account.level === 1 ? "font-bold" : account.is_detail ? "" : "font-medium"}`}>
                    {account.name}
                </span>
                {account.is_detail && (
                    <Badge variant="outline" className="text-xs">Detail</Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                    {account.normal_balance === "debit" ? "D" : "K"}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => onEdit(account)}>
                    <Pencil className="h-3 w-3" />
                </Button>
            </div>
            {hasChildren && isOpen && (
                <div>
                    {children.map((child) => (
                        <AccountNode key={child.id} account={child} accounts={accounts} onEdit={onEdit} />
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
        parent_id: account?.parent_id?.toString() || "",
        is_detail: account?.is_detail ?? true,
        normal_balance: account?.normal_balance || "debit",
        is_active: account?.is_active ?? true,
    });

    const parentAccounts = accounts.filter((a) => !a.is_detail && a.type === formData.type);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                parent_id: formData.parent_id ? parseInt(formData.parent_id) : undefined,
                level: formData.parent_id ? (accounts.find((a) => a.id.toString() === formData.parent_id)?.level || 0) + 1 : 1,
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
                        onValueChange={(value) => setFormData((p) => ({ ...p, type: value as Account["type"], parent_id: "" }))}
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
                        value={formData.parent_id}
                        onValueChange={(value) => setFormData((p) => ({ ...p, parent_id: value }))}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih akun induk" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Tidak ada (Level 1)</SelectItem>
                            {parentAccounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                    {acc.code} - {acc.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="normal_balance">Saldo Normal *</Label>
                    <Select
                        value={formData.normal_balance}
                        onValueChange={(value) => setFormData((p) => ({ ...p, normal_balance: value as "debit" | "credit" }))}
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
                        id="is_detail"
                        checked={formData.is_detail}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_detail: !!checked }))}
                    />
                    <Label htmlFor="is_detail" className="font-normal">Akun Detail (dapat diposting)</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_active: !!checked }))}
                    />
                    <Label htmlFor="is_active" className="font-normal">Aktif</Label>
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
    const [accounts, setAccounts] = React.useState<Account[]>(MOCK_ACCOUNTS);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingAccount, setEditingAccount] = React.useState<Account | undefined>();
    const [searchQuery, setSearchQuery] = React.useState("");

    const handleSave = async (data: Partial<Account>) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (editingAccount) {
            setAccounts((prev) => prev.map((a) => a.id === editingAccount.id ? { ...a, ...data } : a));
            toast.success("Akun berhasil diperbarui");
        } else {
            const newAccount = { ...data, id: Date.now() } as Account;
            setAccounts((prev) => [...prev, newAccount]);
            toast.success("Akun berhasil ditambahkan");
        }
        setDialogOpen(false);
        setEditingAccount(undefined);
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
                title="Chart of Accounts"
                description="Kelola bagan akun akuntansi koperasi"
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
                    {rootAccounts.map((account) => (
                        <AccountNode key={account.id} account={account} accounts={accounts} onEdit={handleEdit} />
                    ))}
                </div>
            </div>
        </div>
    );
}
