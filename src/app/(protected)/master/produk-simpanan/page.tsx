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
import { masterApi } from "@/lib/api";

// Product type
interface SavingsProduct {
    id: number;
    code: string;
    name: string;
    type: string;
    isMandatory?: boolean;
    depositPeriod?: string;
    minimumAmount?: number;
    canWithdraw?: boolean;
    interestRate?: number;
    isActive: boolean;
}

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
            const type = row.getValue("type") as string;
            const config = SAVINGS_PRODUCT_TYPES[type as keyof typeof SAVINGS_PRODUCT_TYPES];
            return <span>{config?.label || type}</span>;
        },
    },
    {
        accessorKey: "minimumAmount",
        header: "Min. Setoran",
        cell: ({ row }) => {
            const amount = row.getValue("minimumAmount") as number | undefined;
            return <span className="tabular-nums">{amount ? formatCurrency(amount) : "-"}</span>;
        },
    },
    {
        accessorKey: "interestRate",
        header: "Bunga (%)",
        cell: ({ row }) => {
            const rate = row.getValue("interestRate") as number | undefined;
            return <span className="tabular-nums">{rate !== undefined ? `${rate}%` : "-"}</span>;
        },
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
    product?: SavingsProduct;
    onSave: (data: Partial<SavingsProduct>) => Promise<void>;
    onCancel: () => void;
}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        code: product?.code || "",
        name: product?.name || "",
        type: product?.type || "sukarela",
        isMandatory: product?.isMandatory || false,
        depositPeriod: product?.depositPeriod || "optional",
        minimumAmount: product?.minimumAmount?.toString() || "10000",
        interestRate: product?.interestRate?.toString() || "0",
        canWithdraw: product?.canWithdraw ?? true,
        isActive: product?.isActive ?? true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                minimumAmount: parseFloat(formData.minimumAmount),
                interestRate: parseFloat(formData.interestRate),
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
                        onValueChange={(value) => setFormData((p) => ({ ...p, type: value }))}
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
                    <Label htmlFor="depositPeriod">Periode Setoran *</Label>
                    <Select
                        value={formData.depositPeriod}
                        onValueChange={(value) => setFormData((p) => ({ ...p, depositPeriod: value }))}
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
                <div>
                    <Label htmlFor="minimumAmount">Minimal Setoran *</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                        <Input
                            id="minimumAmount"
                            type="number"
                            value={formData.minimumAmount}
                            onChange={(e) => setFormData((p) => ({ ...p, minimumAmount: e.target.value }))}
                            className="pl-10"
                            min="0"
                            required
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="interestRate">Bunga per Tahun (%)</Label>
                    <Input
                        id="interestRate"
                        type="number"
                        step="0.1"
                        value={formData.interestRate}
                        onChange={(e) => setFormData((p) => ({ ...p, interestRate: e.target.value }))}
                        min="0"
                    />
                </div>
            </div>
            <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="isMandatory"
                        checked={formData.isMandatory}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, isMandatory: !!checked }))}
                    />
                    <Label htmlFor="isMandatory" className="font-normal">Wajib untuk semua anggota</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="canWithdraw"
                        checked={formData.canWithdraw}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, canWithdraw: !!checked }))}
                    />
                    <Label htmlFor="canWithdraw" className="font-normal">Dapat ditarik</Label>
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

export default function MasterProdukSimpananPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [products, setProducts] = React.useState<SavingsProduct[]>([]);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingProduct, setEditingProduct] = React.useState<SavingsProduct | undefined>();

    // Fetch products from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const response = await masterApi.savingsProducts.list();
                setProducts(response.data as unknown as SavingsProduct[]);
            } catch (error) {
                console.error("Failed to fetch savings products:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    const handleSave = async (data: Partial<SavingsProduct>) => {
        try {
            if (editingProduct) {
                await masterApi.savingsProducts.update(editingProduct.id, data);
                setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? { ...p, ...data } as SavingsProduct : p));
                toast.success("Produk berhasil diperbarui");
            } else {
                const response = await masterApi.savingsProducts.create(data);
                setProducts((prev) => [...prev, response.data as unknown as SavingsProduct]);
                toast.success("Produk berhasil ditambahkan");
            }
            setDialogOpen(false);
            setEditingProduct(undefined);
        } catch (error) {
            toast.error("Gagal menyimpan produk");
        }
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
