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
import { masterApi } from "@/lib/api";

// Product type
interface LoanProduct {
    id: number;
    code: string;
    name: string;
    interestMethod: string;
    interestRate: number;
    minTenorMonths: number;
    maxTenorMonths: number;
    minAmount: number;
    maxAmount: number;
    adminFeeType?: string;
    adminFeeValue?: number;
    isActive: boolean;
}

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
        accessorKey: "interestMethod",
        header: "Metode Bunga",
        cell: ({ row }) => {
            const method = row.getValue("interestMethod") as string;
            const config = INTEREST_METHODS[method as keyof typeof INTEREST_METHODS];
            return <Badge variant="secondary">{config?.label || method}</Badge>;
        },
    },
    {
        accessorKey: "interestRate",
        header: "Bunga",
        cell: ({ row }) => <span className="tabular-nums">{row.getValue("interestRate")}%/bln</span>,
    },
    {
        id: "tenor",
        header: "Tenor",
        cell: ({ row }) => (
            <span className="tabular-nums">{row.original.minTenorMonths}-{row.original.maxTenorMonths} bln</span>
        ),
    },
    {
        id: "amountRange",
        header: "Range Pinjaman",
        cell: ({ row }) => (
            <span className="text-sm tabular-nums">
                {formatCurrency(row.original.minAmount)} - {formatCurrency(row.original.maxAmount)}
            </span>
        ),
    },
    {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
            <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
                {row.getValue("isActive") ? "Aktif" : "Tidak Aktif"}
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
        interestMethod: product?.interestMethod || "flat",
        interestRate: product?.interestRate?.toString() || "1.5",
        minTenorMonths: product?.minTenorMonths?.toString() || "3",
        maxTenorMonths: product?.maxTenorMonths?.toString() || "24",
        minAmount: product?.minAmount?.toString() || "1000000",
        maxAmount: product?.maxAmount?.toString() || "50000000",
        adminFeeType: product?.adminFeeType || "percent",
        adminFeeValue: product?.adminFeeValue?.toString() || "1",
        isActive: product?.isActive ?? true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                interestRate: parseFloat(formData.interestRate),
                minTenorMonths: parseInt(formData.minTenorMonths),
                maxTenorMonths: parseInt(formData.maxTenorMonths),
                minAmount: parseFloat(formData.minAmount),
                maxAmount: parseFloat(formData.maxAmount),
                adminFeeValue: parseFloat(formData.adminFeeValue),
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
                    <Label htmlFor="interestMethod">Metode Bunga *</Label>
                    <Select
                        value={formData.interestMethod}
                        onValueChange={(value) => setFormData((p) => ({ ...p, interestMethod: value }))}
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
                    <Label htmlFor="interestRate">Bunga per Bulan (%)</Label>
                    <Input
                        id="interestRate"
                        type="number"
                        step="0.1"
                        value={formData.interestRate}
                        onChange={(e) => setFormData((p) => ({ ...p, interestRate: e.target.value }))}
                        min="0"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="minTenorMonths">Tenor Min (bulan)</Label>
                    <Input
                        id="minTenorMonths"
                        type="number"
                        value={formData.minTenorMonths}
                        onChange={(e) => setFormData((p) => ({ ...p, minTenorMonths: e.target.value }))}
                        min="1"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="maxTenorMonths">Tenor Max (bulan)</Label>
                    <Input
                        id="maxTenorMonths"
                        type="number"
                        value={formData.maxTenorMonths}
                        onChange={(e) => setFormData((p) => ({ ...p, maxTenorMonths: e.target.value }))}
                        min="1"
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="minAmount">Pinjaman Min</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                        <Input
                            id="minAmount"
                            type="number"
                            value={formData.minAmount}
                            onChange={(e) => setFormData((p) => ({ ...p, minAmount: e.target.value }))}
                            className="pl-10"
                            min="0"
                            required
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="maxAmount">Pinjaman Max</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                        <Input
                            id="maxAmount"
                            type="number"
                            value={formData.maxAmount}
                            onChange={(e) => setFormData((p) => ({ ...p, maxAmount: e.target.value }))}
                            className="pl-10"
                            min="0"
                            required
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="adminFeeType">Tipe Biaya Admin</Label>
                    <Select
                        value={formData.adminFeeType}
                        onValueChange={(value) => setFormData((p) => ({ ...p, adminFeeType: value }))}
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
                    <Label htmlFor="adminFeeValue">
                        Nilai Biaya Admin {formData.adminFeeType === "percent" ? "(%)" : "(Rp)"}
                    </Label>
                    <Input
                        id="adminFeeValue"
                        type="number"
                        step="0.1"
                        value={formData.adminFeeValue}
                        onChange={(e) => setFormData((p) => ({ ...p, adminFeeValue: e.target.value }))}
                        min="0"
                        required
                    />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: !!checked }))}
                />
                <Label htmlFor="isActive" className="font-normal">Produk Aktif</Label>
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

    // Fetch products from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const response = await masterApi.loanProducts.list();
                setProducts(response.data as unknown as LoanProduct[]);
            } catch (error) {
                console.error("Failed to fetch loan products:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    const handleSave = async (data: Partial<LoanProduct>) => {
        try {
            if (editingProduct) {
                await masterApi.loanProducts.update(editingProduct.id, data);
                setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? { ...p, ...data } as LoanProduct : p));
                toast.success("Produk berhasil diperbarui");
            } else {
                const response = await masterApi.loanProducts.create(data);
                setProducts((prev) => [...prev, response.data as unknown as LoanProduct]);
                toast.success("Produk berhasil ditambahkan");
            }
            setDialogOpen(false);
            setEditingProduct(undefined);
        } catch (error) {
            toast.error("Gagal menyimpan produk");
        }
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
                description="Kelola produk pinjaman PRIMKOPPOL"
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
