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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Warehouse, Plus, Minus, ArrowDownCircle, ArrowUpCircle, Loader2,
    Check, ChevronsUpDown
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
    const [openProductSelect, setOpenProductSelect] = React.useState(false);
    const [formData, setFormData] = React.useState({ productId: "", quantity: "", notes: "" });

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
                // Fetch stock movements directly from DB
                const [movementsRes, productsRes] = await Promise.all([
                    fetch("/api/toko/movements"),
                    fetch("/api/toko/products"),
                ]);

                const productsJson = await productsRes.json();
                setProducts(productsJson.data || []);

                if (movementsRes.ok) {
                    const movementsJson = await movementsRes.json();
                    setMovements(movementsJson.data || []);
                }
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Filter states
    const [filterType, setFilterType] = React.useState<string>("all");

    // Derived filtered data
    const filteredMovements = React.useMemo(() => {
        return movements.filter(m => filterType === "all" || m.type === filterType);
    }, [movements, filterType]);

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

            // Refresh daftar agar data terbaru tampil
            const [productsRes, movementsRes] = await Promise.all([
                 fetch("/api/toko/products"),
                 fetch("/api/toko/movements")
            ]);
            if (productsRes.ok) setProducts((await productsRes.json()).data || []);
            if (movementsRes.ok) setMovements((await movementsRes.json()).data || []);

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
                                        <Label className="mb-1 block">Produk (Cari / Scan Barcode)</Label>
                                        <Popover open={openProductSelect} onOpenChange={setOpenProductSelect}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openProductSelect}
                                                    className="w-full justify-between"
                                                >
                                                    {formData.productId
                                                        ? `${products.find((p) => String(p.id) === formData.productId)?.sku} - ${products.find((p) => String(p.id) === formData.productId)?.name}`
                                                        : "Pilih atau scan produk..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[400px] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Ketik nama produk atau scan barcode..." autoFocus />
                                                    <CommandList>
                                                        <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                                        <CommandGroup>
                                                            {products.map((p) => (
                                                                <CommandItem
                                                                    key={p.id}
                                                                    value={`${p.sku} ${p.name}`}
                                                                    onSelect={() => {
                                                                        setFormData(prev => ({ ...prev, productId: String(p.id) }));
                                                                        setOpenProductSelect(false);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            formData.productId === String(p.id) ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <span className="font-mono mr-2">{p.sku}</span>
                                                                    <span>{p.name}</span>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
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
                    {movements.length === 0 && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm flex items-start gap-2 mb-4">
                            <span className="mt-0.5">ℹ️</span>
                            <div>
                                <strong>Belum ada riwayat:</strong> Belum ada pergerakan stok (Penjualan / Stok Masuk / Keluar) yang tercatat.
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-4">
                        <div className="flex justify-start mb-2">
                            <select
                                className="flex h-10 w-full sm:w-[200px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                            >
                                <option value="all">Semua Jenis Pergerakan</option>
                                <option value="in">Hanya Stok Masuk</option>
                                <option value="out">Hanya Stok Keluar</option>
                            </select>
                        </div>
                        <DataTable 
                           columns={columns} 
                           data={filteredMovements} 
                           searchPlaceholder="Scan barcode atau cari produk..." 
                        />
                    </div>
                </>
            )}
        </div>
    );
}
