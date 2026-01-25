"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    Warehouse,
    Plus,
    Minus,
    ArrowDownCircle,
    ArrowUpCircle,
    Package,
    AlertTriangle,
    Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface StockMovement {
    id: number;
    date: string;
    productSku: string;
    productName: string;
    type: "in" | "out";
    quantity: number;
    notes: string;
    operator: string;
}

const columns: ColumnDef<StockMovement>[] = [
    {
        accessorKey: "date",
        header: "Tanggal",
        cell: ({ row }) => new Date(row.getValue("date")).toLocaleDateString("id-ID"),
    },
    {
        accessorKey: "productSku",
        header: "SKU",
        cell: ({ row }) => (
            <span className="font-mono text-sm">{row.getValue("productSku")}</span>
        ),
    },
    {
        accessorKey: "productName",
        header: "Produk",
    },
    {
        accessorKey: "type",
        header: "Jenis",
        cell: ({ row }) => {
            const type = row.getValue("type") as string;
            return type === "in" ? (
                <Badge className="bg-emerald-100 text-emerald-700">
                    <ArrowDownCircle className="mr-1 h-3 w-3" />
                    Masuk
                </Badge>
            ) : (
                <Badge variant="destructive">
                    <ArrowUpCircle className="mr-1 h-3 w-3" />
                    Keluar
                </Badge>
            );
        },
    },
    {
        accessorKey: "quantity",
        header: "Jumlah",
        cell: ({ row }) => {
            const type = row.original.type;
            const qty = row.getValue("quantity") as number;
            return (
                <span className={`font-bold ${type === "in" ? "text-emerald-600" : "text-red-600"}`}>
                    {type === "in" ? "+" : "-"}{qty}
                </span>
            );
        },
    },
    {
        accessorKey: "notes",
        header: "Keterangan",
    },
    {
        accessorKey: "operator",
        header: "Operator",
    },
];

export default function PersediaanPage() {
    const [movements, setMovements] = React.useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [movementType, setMovementType] = React.useState<"in" | "out">("in");
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Form state
    const [formData, setFormData] = React.useState({
        productId: "",
        quantity: "",
        notes: "",
    });

    // Stats
    const stats = React.useMemo(() => {
        const today = new Date().toDateString();
        const todayMovements = movements.filter(m => new Date(m.date).toDateString() === today);
        const todayIn = todayMovements.filter(m => m.type === "in").reduce((sum, m) => sum + m.quantity, 0);
        const todayOut = todayMovements.filter(m => m.type === "out").reduce((sum, m) => sum + m.quantity, 0);
        return { todayIn, todayOut, totalMovements: movements.length };
    }, [movements]);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                setMovements([
                    { id: 1, date: "2026-01-25", productSku: "BRS-001", productName: "Beras Premium 5kg", type: "in", quantity: 100, notes: "Pengadaan supplier", operator: "Admin" },
                    { id: 2, date: "2026-01-25", productSku: "MGR-001", productName: "Minyak Goreng 2L", type: "out", quantity: 5, notes: "Penjualan kasir", operator: "Kasir 1" },
                    { id: 3, date: "2026-01-24", productSku: "GLP-001", productName: "Gula Pasir 1kg", type: "in", quantity: 50, notes: "Pengadaan", operator: "Admin" },
                    { id: 4, date: "2026-01-24", productSku: "BRS-001", productName: "Beras Premium 5kg", type: "out", quantity: 10, notes: "Penjualan", operator: "Kasir 2" },
                    { id: 5, date: "2026-01-23", productSku: "KPI-001", productName: "Kopi Bubuk 250g", type: "out", quantity: 3, notes: "Rusak/expired", operator: "Admin" },
                ]);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Handle submit
    const handleSubmit = async () => {
        if (!formData.productId || !formData.quantity) {
            toast.error("Lengkapi data");
            return;
        }

        setIsSubmitting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success(`Stok ${movementType === "in" ? "masuk" : "keluar"} berhasil dicatat`);
            setDialogOpen(false);
            setFormData({ productId: "", quantity: "", notes: "" });
        } catch (error) {
            toast.error("Gagal mencatat pergerakan stok");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Manajemen Persediaan"
                description="Kelola stok masuk dan keluar"
                actions={
                    <div className="flex gap-2">
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setMovementType("in")}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Stok Masuk
                                </Button>
                            </DialogTrigger>
                            <DialogTrigger asChild>
                                <Button variant="outline" onClick={() => setMovementType("out")}>
                                    <Minus className="mr-2 h-4 w-4" />
                                    Stok Keluar
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        {movementType === "in" ? "Stok Masuk" : "Stok Keluar"}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Catat pergerakan {movementType === "in" ? "penambahan" : "pengurangan"} stok
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div>
                                        <Label>Produk</Label>
                                        <Select
                                            value={formData.productId}
                                            onValueChange={(v) => setFormData(prev => ({ ...prev, productId: v }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih produk" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">BRS-001 - Beras Premium 5kg</SelectItem>
                                                <SelectItem value="2">MGR-001 - Minyak Goreng 2L</SelectItem>
                                                <SelectItem value="3">GLP-001 - Gula Pasir 1kg</SelectItem>
                                                <SelectItem value="4">KPI-001 - Kopi Bubuk 250g</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Jumlah</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={formData.quantity}
                                            onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Keterangan</Label>
                                        <Input
                                            value={formData.notes}
                                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                            placeholder={movementType === "in" ? "Pengadaan supplier" : "Penjualan/rusak"}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                        Batal
                                    </Button>
                                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Simpan
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Stok Masuk Hari Ini</p>
                            <p className="text-2xl font-bold text-emerald-600">+{stats.todayIn}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <ArrowUpCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Stok Keluar Hari Ini</p>
                            <p className="text-2xl font-bold text-red-600">-{stats.todayOut}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Warehouse className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Pergerakan</p>
                            <p className="text-2xl font-bold">{stats.totalMovements}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

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
                <DataTable
                    columns={columns}
                    data={movements}
                    searchColumn="productName"
                    searchPlaceholder="Cari produk..."
                />
            )}
        </div>
    );
}
