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
import { Input } from "@/components/ui/input";
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
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Wallet, Loader2, Save } from "lucide-react";
import { formatCurrency, SAVINGS_PRODUCT_TYPES } from "@/lib/constants";
import type { SavingsProduct } from "@/types";

// Mock data
const MOCK_PRODUCTS: SavingsProduct[] = [
    { id: 1, code: "SP", name: "Simpanan Pokok", type: "pokok", is_mandatory: true, deposit_period: "once", minimum_amount: 100000, can_withdraw: false, is_active: true },
    { id: 2, code: "SW", name: "Simpanan Wajib", type: "wajib", is_mandatory: true, deposit_period: "monthly", minimum_amount: 50000, can_withdraw: false, is_active: true },
    { id: 3, code: "SS", name: "Simpanan Sukarela", type: "sukarela", is_mandatory: false, deposit_period: "optional", minimum_amount: 10000, can_withdraw: true, is_active: true },
    { id: 4, code: "SB", name: "Simpanan Berjangka", type: "lainnya", is_mandatory: false, deposit_period: "optional", minimum_amount: 1000000, can_withdraw: true, is_active: true },
];

// Table columns
const columns: ColumnDef<SavingsProduct>[] = [
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
        header: "Nama Produk",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{row.getValue("name")}</span>
            </div>
        ),
    },
    {
        accessorKey: "type",
        header: "Jenis",
        cell: ({ row }) => {
            const type = row.getValue("type") as keyof typeof SAVINGS_PRODUCT_TYPES;
            return <span>{SAVINGS_PRODUCT_TYPES[type]?.label || type}</span>;
        },
    },
    {
        accessorKey: "minimum_amount",
        header: "Min. Setoran",
        cell: ({ row }) => (
            <span className="tabular-nums">{formatCurrency(row.getValue("minimum_amount"))}</span>
        ),
    },
    {
        accessorKey: "is_mandatory",
        header: "Wajib",
        cell: ({ row }) => (
            <Badge variant={row.getValue("is_mandatory") ? "default" : "secondary"}>
                {row.getValue("is_mandatory") ? "Ya" : "Tidak"}
            </Badge>
        ),
    },
    {
        accessorKey: "can_withdraw",
        header: "Bisa Ditarik",
        cell: ({ row }) => (
            <Badge variant={row.getValue("can_withdraw") ? "default" : "secondary"}>
                {row.getValue("can_withdraw") ? "Ya" : "Tidak"}
            </Badge>
        ),
    },
    {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
            <Badge variant={row.getValue("is_active") ? "default" : "secondary"}>
                {row.getValue("is_active") ? "Aktif" : "Tidak Aktif"}
            </Badge>
        ),
    },
];

// Product form component
function ProductForm({
    product,
    onSave,
    onCancel
}: {
    product?: SavingsProduct;
    onSave: (data: Partial<SavingsProduct>) => Promise<void>;
    onCancel: () => void;
}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        code: product?.code || "",
        name: product?.name || "",
        type: product?.type || "sukarela",
        is_mandatory: product?.is_mandatory || false,
        deposit_period: product?.deposit_period || "optional",
        minimum_amount: product?.minimum_amount?.toString() || "10000",
        can_withdraw: product?.can_withdraw ?? true,
        is_active: product?.is_active ?? true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                minimum_amount: parseFloat(formData.minimum_amount),
            } as Partial<SavingsProduct>);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="code">Kode Produk *</Label>
                    <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                        placeholder="SP"
                        maxLength={5}
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="name">Nama Produk *</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Simpanan Pokok"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="type">Jenis *</Label>
                    <Select
                        value={formData.type}
                        onValueChange={(value) => setFormData((p) => ({ ...p, type: value as SavingsProduct["type"] }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(SAVINGS_PRODUCT_TYPES).map(([key, val]) => (
                                <SelectItem key={key} value={key}>{val.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="deposit_period">Periode Setoran *</Label>
                    <Select
                        value={formData.deposit_period}
                        onValueChange={(value) => setFormData((p) => ({ ...p, deposit_period: value as SavingsProduct["deposit_period"] }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="once">Sekali (Saat Pendaftaran)</SelectItem>
                            <SelectItem value="monthly">Bulanan</SelectItem>
                            <SelectItem value="optional">Bebas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="sm:col-span-2">
                    <Label htmlFor="minimum_amount">Minimal Setoran *</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                        <Input
                            id="minimum_amount"
                            type="number"
                            value={formData.minimum_amount}
                            onChange={(e) => setFormData((p) => ({ ...p, minimum_amount: e.target.value }))}
                            className="pl-10"
                            min="0"
                            required
                        />
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="is_mandatory"
                        checked={formData.is_mandatory}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_mandatory: !!checked }))}
                    />
                    <Label htmlFor="is_mandatory" className="font-normal">Wajib untuk semua anggota</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="can_withdraw"
                        checked={formData.can_withdraw}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, can_withdraw: !!checked }))}
                    />
                    <Label htmlFor="can_withdraw" className="font-normal">Dapat ditarik</Label>
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

export default function MasterProdukSimpananPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [products, setProducts] = React.useState<SavingsProduct[]>([]);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingProduct, setEditingProduct] = React.useState<SavingsProduct | undefined>();

    // Simulate loading
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setProducts(MOCK_PRODUCTS);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleSave = async (data: Partial<SavingsProduct>) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (editingProduct) {
            setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? { ...p, ...data } : p));
            toast.success("Produk berhasil diperbarui");
        } else {
            const newProduct = { ...data, id: Date.now() } as SavingsProduct;
            setProducts((prev) => [...prev, newProduct]);
            toast.success("Produk berhasil ditambahkan");
        }
        setDialogOpen(false);
        setEditingProduct(undefined);
    };

    const handleEdit = (product: SavingsProduct) => {
        setEditingProduct(product);
        setDialogOpen(true);
    };

    const handleAdd = () => {
        setEditingProduct(undefined);
        setDialogOpen(true);
    };

    // Add edit action column
    const columnsWithActions: ColumnDef<SavingsProduct>[] = [
        ...columns,
        {
            id: "actions",
            cell: ({ row }) => (
                <Button size="sm" variant="ghost" onClick={() => handleEdit(row.original)}>
                    <Pencil className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Produk Simpanan"
                description="Kelola produk simpanan koperasi"
                backHref="/master"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleAdd}>
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Produk
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                                <DialogTitle>{editingProduct ? "Edit Produk" : "Tambah Produk Simpanan"}</DialogTitle>
                                <DialogDescription>
                                    {editingProduct ? "Perbarui informasi produk" : "Buat produk simpanan baru"}
                                </DialogDescription>
                            </DialogHeader>
                            <ProductForm
                                product={editingProduct}
                                onSave={handleSave}
                                onCancel={() => setDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                }
            />

            <DataTable
                columns={columnsWithActions}
                data={products}
                isLoading={isLoading}
                searchPlaceholder="Cari produk..."
                searchColumn="name"
            />
        </div>
    );
}
