"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Warehouse, Plus, Minus, ArrowDownCircle, ArrowUpCircle, Loader2,
} from "lucide-react";

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
        accessorKey: "date", header: "Tanggal",
        cell: ({ row }) => new Date(row.getValue("date")).toLocaleDateString("id-ID"),
    },
    {
        accessorKey: "productSku", header: "SKU",
        cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("productSku")}</span>,
    },
    { accessorKey: "productName", header: "Produk" },
    {
        accessorKey: "type", header: "Jenis",
        cell: ({ row }) => row.getValue("type") === "in"
            ? <Badge className="bg-emerald-100 text-emerald-700"><ArrowDownCircle className="mr-1 h-3 w-3" />Masuk</Badge>
            : <Badge variant="destructive"><ArrowUpCircle className="mr-1 h-3 w-3" />Keluar</Badge>,
    },
    {
        accessorKey: "quantity", header: "Jumlah",
        cell: ({ row }) => {
            const type = row.original.type;
            const qty = row.getValue("quantity") as number;
            return <span className={`font-bold ${type === "in" ? "text-emerald-600" : "text-red-600"}`}>{type === "in" ? "+" : "-"}{qty}</span>;
        },
    },
    { accessorKey: "notes", header: "Keterangan" },
    { accessorKey: "operator", header: "Operator" },
];

export default function PersediaanPage() {
    const [movements, setMovements] = React.useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [products, setProducts] = React.useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [movementType, setMovementType] = React.useState<"in" | "out">("in");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [formData, setFormData] = React.useState({ productId: "", quantity: "", notes: "" });
    // Riwayat stok masuk manual (disimpan di state lokal karena belum ada tabel khusus di DB)
    const [manualInLogs, setManualInLogs] = React.useState<StockMovement[]>([]);

    const stats = React.useMemo(() => {
        const today = new Date().toDateString();
        const todayMovements = movements.filter(m => new Date(m.date).toDateString() === today);
        const todayIn = todayMovements.filter(m => m.type === "in").reduce((sum, m) => sum + m.quantity, 0);
        const todayOut = todayMovements.filter(m => m.type === "out").reduce((sum, m) => sum + m.quantity, 0);
        return { todayIn, todayOut, totalMovements: movements.length };
    }, [movements]);

    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Fetch sales data to derive stock movements
                const [salesRes, productsRes] = await Promise.all([
                    fetch("/api/toko/sales"),
                    fetch("/api/toko/products"),
                ]);

                const productsJson = await productsRes.json();
                setProducts(productsJson.data || []);

                // Derive stock-out movements from sales
                const stockMovements: StockMovement[] = [];

                if (salesRes.ok) {
                    const salesJson = await salesRes.json();
                    const sales = salesJson.data || [];

                    for (const sale of sales) {
                        if (sale.items) {
                            for (const item of sale.items) {
                                stockMovements.push({
                                    id: item.id || stockMovements.length + 1,
                                    date: sale.createdAt || sale.date || new Date().toISOString(),
                                    productSku: item.product?.sku || "-",
                                    productName: item.product?.name || `Produk #${item.productId}`,
                                    type: "out",
                                    quantity: item.quantity,
                                    notes: `Penjualan ${sale.saleNo || ""}`,
                                    operator: sale.createdBy?.name || "Kasir",
                                });
                            }
                        }
                    }
                }

                setMovements(stockMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Gabungkan pergerakan stok keluar (dari penjualan) + stok masuk manual
    const allMovements = React.useMemo(() => {
        return [...manualInLogs, ...movements].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [movements, manualInLogs]);

    const handleSubmit = async () => {
        if (!formData.productId || !formData.quantity) {
            toast.error("Lengkapi data produk dan jumlah");
            return;
        }
        const qty = parseInt(formData.quantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Jumlah harus lebih dari 0");
            return;
        }

        setIsSubmitting(true);
        try {
            const product = products.find(p => String(p.id) === formData.productId);
            if (!product) { toast.error("Produk tidak ditemukan"); return; }

            // FIX K-2: Panggil API nyata untuk update stok di database
            const res = await fetch(`/api/toko/products/${formData.productId}/stock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: movementType,
                    quantity: qty,
                    notes: formData.notes,
                }),
            });
            const json = await res.json();

            if (!res.ok) {
                toast.error(json.message || "Gagal memperbarui stok");
                return;
            }

            toast.success(json.message || `Stok ${movementType === "in" ? "masuk" : "keluar"} berhasil dicatat`);

            // Tambahkan ke riwayat lokal agar langsung tampil di tabel
            const newEntry: StockMovement = {
                id: Date.now(),
                date: new Date().toISOString(),
                productSku: product.sku,
                productName: product.name,
                type: movementType,
                quantity: qty,
                notes: formData.notes || (movementType === "in" ? "Stok masuk manual" : "Stok keluar manual"),
                operator: "Operator",
            };

            if (movementType === "in") {
                setManualInLogs(prev => [newEntry, ...prev]);
            } else {
                setMovements(prev => [newEntry, ...prev]);
            }

            // Refresh daftar produk agar stok terbaru tampil
            const productsRes = await fetch("/api/toko/products");
            const productsJson = await productsRes.json();
            setProducts(productsJson.data || []);

            setDialogOpen(false);
            setFormData({ productId: "", quantity: "", notes: "" });
        } catch {
            toast.error("Gagal memperbarui stok");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Manajemen Persediaan" description="Kelola stok masuk dan keluar"
                actions={
                    <div className="flex gap-2">
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setMovementType("in")}><Plus className="mr-2 h-4 w-4" />Stok Masuk</Button>
                            </DialogTrigger>
                            <DialogTrigger asChild>
                                <Button variant="outline" onClick={() => setMovementType("out")}><Minus className="mr-2 h-4 w-4" />Stok Keluar</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{movementType === "in" ? "Stok Masuk" : "Stok Keluar"}</DialogTitle>
                                    <DialogDescription>Catat pergerakan {movementType === "in" ? "penambahan" : "pengurangan"} stok</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div>
                                        <Label>Produk</Label>
                                        <Select value={formData.productId} onValueChange={v => setFormData(prev => ({ ...prev, productId: v }))}>
                                            <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                                            <SelectContent>
                                                {products.map(p => (
                                                    <SelectItem key={p.id} value={String(p.id)}>{p.sku} - {p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div><Label>Jumlah</Label><Input type="number" min={1} value={formData.quantity} onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value }))} /></div>
                                    <div><Label>Keterangan</Label><Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder={movementType === "in" ? "Pengadaan supplier" : "Penjualan/rusak"} /></div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                }
            />

            <div className="grid gap-4 sm:grid-cols-3">
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30"><ArrowDownCircle className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Stok Masuk Hari Ini</p><p className="text-2xl font-bold text-emerald-600">+{stats.todayIn}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30"><ArrowUpCircle className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">Stok Keluar Hari Ini</p><p className="text-2xl font-bold text-red-600">-{stats.todayOut}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-primary/10 p-3"><Warehouse className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Pergerakan</p><p className="text-2xl font-bold">{stats.totalMovements}</p></div></CardContent></Card>
            </div>

            {isLoading ? (
                <Card><CardContent className="p-6 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
            ) : (
                <>
                    {allMovements.length === 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                            <span className="mt-0.5">⚠️</span>
                            <div>
                                <strong>Catatan:</strong> Riwayat di bawah hanya menampilkan <em>Stok Keluar</em> dari transaksi penjualan.
                                Stok masuk yang dicatat di sesi ini akan langsung tampil di sini.
                                Gunakan tombol <strong>Stok Masuk</strong> untuk mencatat pembelian dari supplier.
                            </div>
                        </div>
                    )}
                    <DataTable columns={columns} data={allMovements} searchColumn="productName" searchPlaceholder="Cari produk..." />
                </>
            )}
        </div>
    );
}
