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
import { Plus, Pencil, CreditCard, Loader2, Save } from "lucide-react";
import { formatCurrency, INTEREST_METHODS } from "@/lib/constants";
import type { LoanProduct } from "@/types";

// Mock data
const MOCK_PRODUCTS: LoanProduct[] = [
    { id: 1, code: "PR", name: "Pinjaman Reguler", interest_method: "flat", interest_rate: 1.5, min_tenor_months: 3, max_tenor_months: 24, min_amount: 1000000, max_amount: 50000000, admin_fee_type: "percent", admin_fee_value: 1, is_active: true },
    { id: 2, code: "PU", name: "Pinjaman Usaha", interest_method: "annuity", interest_rate: 1.2, min_tenor_months: 6, max_tenor_months: 60, min_amount: 5000000, max_amount: 200000000, admin_fee_type: "percent", admin_fee_value: 0.5, is_active: true },
    { id: 3, code: "PD", name: "Pinjaman Darurat", interest_method: "flat", interest_rate: 2, min_tenor_months: 1, max_tenor_months: 12, min_amount: 500000, max_amount: 10000000, admin_fee_type: "fixed", admin_fee_value: 50000, is_active: true },
    { id: 4, code: "PM", name: "Pinjaman Multiguna", interest_method: "effective", interest_rate: 1.8, min_tenor_months: 3, max_tenor_months: 36, min_amount: 2000000, max_amount: 100000000, admin_fee_type: "percent", admin_fee_value: 1.5, is_active: false },
];

// Table columns
const columns: ColumnDef<LoanProduct>[] = [
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
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{row.getValue("name")}</span>
            </div>
        ),
    },
    {
        accessorKey: "interest_method",
        header: "Metode Bunga",
        cell: ({ row }) => {
            const method = row.getValue("interest_method") as keyof typeof INTEREST_METHODS;
            return <Badge variant="secondary">{INTEREST_METHODS[method]?.label || method}</Badge>;
        },
    },
    {
        accessorKey: "interest_rate",
        header: "Bunga",
        cell: ({ row }) => <span className="tabular-nums">{row.getValue("interest_rate")}%/bln</span>,
    },
    {
        id: "tenor",
        header: "Tenor",
        cell: ({ row }) => (
            <span className="tabular-nums">{row.original.min_tenor_months}-{row.original.max_tenor_months} bln</span>
        ),
    },
    {
        id: "amount_range",
        header: "Range Pinjaman",
        cell: ({ row }) => (
            <span className="text-sm tabular-nums">
                {formatCurrency(row.original.min_amount)} - {formatCurrency(row.original.max_amount)}
            </span>
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
    product?: LoanProduct;
    onSave: (data: Partial<LoanProduct>) => Promise<void>;
    onCancel: () => void;
}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        code: product?.code || "",
        name: product?.name || "",
        interest_method: product?.interest_method || "flat",
        interest_rate: product?.interest_rate?.toString() || "1.5",
        min_tenor_months: product?.min_tenor_months?.toString() || "3",
        max_tenor_months: product?.max_tenor_months?.toString() || "24",
        min_amount: product?.min_amount?.toString() || "1000000",
        max_amount: product?.max_amount?.toString() || "50000000",
        admin_fee_type: product?.admin_fee_type || "percent",
        admin_fee_value: product?.admin_fee_value?.toString() || "1",
        is_active: product?.is_active ?? true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                interest_rate: parseFloat(formData.interest_rate),
                min_tenor_months: parseInt(formData.min_tenor_months),
                max_tenor_months: parseInt(formData.max_tenor_months),
                min_amount: parseFloat(formData.min_amount),
                max_amount: parseFloat(formData.max_amount),
                admin_fee_value: parseFloat(formData.admin_fee_value),
            } as Partial<LoanProduct>);
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
                        placeholder="PR"
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
                        placeholder="Pinjaman Reguler"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="interest_method">Metode Bunga *</Label>
                    <Select
                        value={formData.interest_method}
                        onValueChange={(value) => setFormData((p) => ({ ...p, interest_method: value as LoanProduct["interest_method"] }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(INTEREST_METHODS).map(([key, val]) => (
                                <SelectItem key={key} value={key}>
                                    <div>
                                        <span>{val.label}</span>
                                        <p className="text-xs text-muted-foreground">{val.description}</p>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="interest_rate">Bunga per Bulan (%)</Label>
                    <Input
                        id="interest_rate"
                        type="number"
                        step="0.1"
                        value={formData.interest_rate}
                        onChange={(e) => setFormData((p) => ({ ...p, interest_rate: e.target.value }))}
                        min="0"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="min_tenor_months">Tenor Min (bulan)</Label>
                    <Input
                        id="min_tenor_months"
                        type="number"
                        value={formData.min_tenor_months}
                        onChange={(e) => setFormData((p) => ({ ...p, min_tenor_months: e.target.value }))}
                        min="1"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="max_tenor_months">Tenor Max (bulan)</Label>
                    <Input
                        id="max_tenor_months"
                        type="number"
                        value={formData.max_tenor_months}
                        onChange={(e) => setFormData((p) => ({ ...p, max_tenor_months: e.target.value }))}
                        min="1"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="min_amount">Pinjaman Min</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                        <Input
                            id="min_amount"
                            type="number"
                            value={formData.min_amount}
                            onChange={(e) => setFormData((p) => ({ ...p, min_amount: e.target.value }))}
                            className="pl-10"
                            min="0"
                            required
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="max_amount">Pinjaman Max</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                        <Input
                            id="max_amount"
                            type="number"
                            value={formData.max_amount}
                            onChange={(e) => setFormData((p) => ({ ...p, max_amount: e.target.value }))}
                            className="pl-10"
                            min="0"
                            required
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="admin_fee_type">Tipe Biaya Admin</Label>
                    <Select
                        value={formData.admin_fee_type}
                        onValueChange={(value) => setFormData((p) => ({ ...p, admin_fee_type: value as LoanProduct["admin_fee_type"] }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="percent">Persen (%)</SelectItem>
                            <SelectItem value="fixed">Nominal Tetap</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="admin_fee_value">
                        Nilai Biaya Admin {formData.admin_fee_type === "percent" ? "(%)" : "(Rp)"}
                    </Label>
                    <Input
                        id="admin_fee_value"
                        type="number"
                        step="0.1"
                        value={formData.admin_fee_value}
                        onChange={(e) => setFormData((p) => ({ ...p, admin_fee_value: e.target.value }))}
                        min="0"
                        required
                    />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_active: !!checked }))}
                />
                <Label htmlFor="is_active" className="font-normal">Produk Aktif</Label>
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

export default function MasterProdukPinjamanPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [products, setProducts] = React.useState<LoanProduct[]>([]);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingProduct, setEditingProduct] = React.useState<LoanProduct | undefined>();

    // Simulate loading
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setProducts(MOCK_PRODUCTS);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleSave = async (data: Partial<LoanProduct>) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (editingProduct) {
            setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? { ...p, ...data } : p));
            toast.success("Produk berhasil diperbarui");
        } else {
            const newProduct = { ...data, id: Date.now() } as LoanProduct;
            setProducts((prev) => [...prev, newProduct]);
            toast.success("Produk berhasil ditambahkan");
        }
        setDialogOpen(false);
        setEditingProduct(undefined);
    };

    const handleEdit = (product: LoanProduct) => {
        setEditingProduct(product);
        setDialogOpen(true);
    };

    const handleAdd = () => {
        setEditingProduct(undefined);
        setDialogOpen(true);
    };

    // Add edit action column
    const columnsWithActions: ColumnDef<LoanProduct>[] = [
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
                title="Produk Pinjaman"
                description="Kelola produk pinjaman koperasi"
                backHref="/master"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleAdd}>
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Produk
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>{editingProduct ? "Edit Produk" : "Tambah Produk Pinjaman"}</DialogTitle>
                                <DialogDescription>
                                    {editingProduct ? "Perbarui informasi produk" : "Buat produk pinjaman baru"}
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
