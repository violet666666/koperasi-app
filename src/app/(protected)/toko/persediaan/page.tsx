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
    Check, ChevronsUpDown, Ban, RotateCcw, Package, ArrowRightLeft
} from "lucide-react";
import { useSession } from "next-auth/react";

interface StockMovement {
    id: number;
    date: string;
    productSku: string;
    productName: string;
    type: "in" | "out";
    quantity: number;
    notes: string;
    operator: string;
    status: string;
    reference: string | null;
}

function StockColumns({ onVoid, canVoid }: { onVoid: (id: number) => void; canVoid: boolean }): ColumnDef<StockMovement>[] {
    return [
    {
        accessorKey: "date", header: "Tanggal",
        cell: ({ row }) => new Date(row.getValue("date")).toLocaleDateString("id-ID"),
    },
    {
        accessorKey: "productSku", header: "SKU",
        cell: ({ row }) => {
            const isVoided = row.original.status === "voided";
            return <span className={`font-mono text-sm ${isVoided ? "line-through text-muted-foreground" : ""}`}>{row.getValue("productSku")}</span>;
        },
    },
    { 
        accessorKey: "productName", header: "Produk",
        cell: ({ row }) => {
            const isVoided = row.original.status === "voided";
            return <span className={isVoided ? "line-through text-muted-foreground" : ""}>{row.getValue("productName")}</span>;
        },
    },
    {
        accessorKey: "type", header: "Jenis",
        cell: ({ row }) => {
            const isVoided = row.original.status === "voided";
            if (isVoided) return <Badge variant="outline" className="text-muted-foreground"><Ban className="mr-1 h-3 w-3" />Dibatalkan</Badge>;
            return row.getValue("type") === "in"
                ? <Badge className="bg-emerald-100 text-emerald-700"><ArrowDownCircle className="mr-1 h-3 w-3" />Masuk</Badge>
                : <Badge variant="destructive"><ArrowUpCircle className="mr-1 h-3 w-3" />Keluar</Badge>;
        },
    },
    {
        accessorKey: "quantity", header: "Jumlah",
        cell: ({ row }) => {
            const type = row.original.type;
            const qty = row.getValue("quantity") as number;
            const isVoided = row.original.status === "voided";
            return <span className={`font-bold ${isVoided ? "line-through text-muted-foreground" : type === "in" ? "text-emerald-600" : "text-red-600"}`}>{type === "in" ? "+" : "-"}{qty}</span>;
        },
    },
    { accessorKey: "notes", header: "Keterangan" },
    { accessorKey: "operator", header: "Operator" },
    {
        id: "actions", header: "",
        cell: ({ row }) => {
            const m = row.original;
            const isVoided = m.status === "voided";
            const isFromSale = m.reference && m.reference.startsWith("Penjualan ");
            if (isVoided) return <Badge variant="outline" className="bg-red-50 text-red-500 border-red-200 text-xs">VOID</Badge>;
            if (isFromSale || !canVoid) return null;
            return (
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                    onClick={() => onVoid(m.id)}
                >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />Batalkan
                </Button>
            );
        },
    },
];
}

export default function PersediaanPage() {
    const { data: session } = useSession();
    const [movements, setMovements] = React.useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [products, setProducts] = React.useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [movementType, setMovementType] = React.useState<"in" | "out" | "transfer">("in");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [openProductSelect, setOpenProductSelect] = React.useState(false);
    const [formData, setFormData] = React.useState({ productId: "", quantity: "", notes: "", purchasePrice: "", batchNo: "", expiryDate: "", supplierName: "" });
    const [stockLocation, setStockLocation] = React.useState<"gudang" | "toko">("gudang");
    // Writeoff dialog
    const [writeoffDialogOpen, setWriteoffDialogOpen] = React.useState(false);
    const [writeoffData, setWriteoffData] = React.useState({ productId: "", quantity: "", reason: "", reasonNote: "", notes: "", location: "gudang" as "gudang" | "toko" });
    const [isWriteoffSubmitting, setIsWriteoffSubmitting] = React.useState(false);
    const [openWriteoffProductSelect, setOpenWriteoffProductSelect] = React.useState(false);
    // Transfer dialog
    const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);
    const [transferDirection, setTransferDirection] = React.useState<"gudang" | "toko">("gudang"); // from location
    const [transferProductId, setTransferProductId] = React.useState("");
    const [transferQty, setTransferQty] = React.useState("");
    const [transferNotes, setTransferNotes] = React.useState("");
    const [openTransferProductSelect, setOpenTransferProductSelect] = React.useState(false);
    const [isTransferring, setIsTransferring] = React.useState(false);
    const [voidDialogOpen, setVoidDialogOpen] = React.useState(false);
    const [voidTargetId, setVoidTargetId] = React.useState<number | null>(null);
    const [isVoiding, setIsVoiding] = React.useState(false);
    const [voidReason, setVoidReason] = React.useState("");

    // Pagination state for movements
    const [page, setPage] = React.useState(1);
    const [perPage, setPerPage] = React.useState(50);
    const [totalRows, setTotalRows] = React.useState(0);

    // Role check — kasir tidak bisa void
    const roleName = typeof session?.user?.role === "string" 
         ? session.user.role 
         : (session?.user?.role as any)?.name ?? "";
    const canVoid = roleName === "operator" || roleName === "admin";

    const unitType = session?.user?.unitType as string || "toko";
    const isResto = ["resto_cafe", "resto", "coffe_latar"].includes(unitType);
    const productUnitType = isResto ? "resto" : unitType;

    // Filter state
    const [filterType, setFilterType] = React.useState<string>("all");
    const [searchTerm, setSearchTerm] = React.useState("");

    const stats = React.useMemo(() => {
        const today = new Date().toDateString();
        const todayMovements = movements.filter(m => m.status !== "voided" && new Date(m.date).toDateString() === today);
        const todayIn = todayMovements.filter(m => m.type === "in").reduce((sum, m) => sum + m.quantity, 0);
        const todayOut = todayMovements.filter(m => m.type === "out").reduce((sum, m) => sum + m.quantity, 0);
        return { todayIn, todayOut, totalMovements: totalRows };
    }, [movements, totalRows]);

    const fetchMovements = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
            if (filterType && filterType !== "all") params.set("type", filterType);
            if (searchTerm.trim()) params.set("search", searchTerm.trim());
            // Fetch stock movements from DB with pagination
            const [movementsRes, productsRes] = await Promise.all([
                fetch(`/api/toko/movements?${params}`),
                fetch(`/api/toko/products?unitType=${productUnitType}`),
            ]);

            const productsJson = await productsRes.json();
            setProducts(productsJson.data?.products || productsJson.data || []);

            if (movementsRes.ok) {
                const movementsJson = await movementsRes.json();
                setMovements(movementsJson.data || []);
                setTotalRows(movementsJson.pagination?.totalCount || 0);
            }
        } catch (error) {
            console.error("Failed to fetch:", error);
        } finally {
            setIsLoading(false);
        }
    }, [page, perPage, filterType, searchTerm, productUnitType]);

    React.useEffect(() => {
        fetchMovements();
    }, [fetchMovements]);

    // Reset page when filter or perPage changes
    React.useEffect(() => {
        setPage(1);
    }, [filterType, perPage, searchTerm]);

    // Void handler
    const handleVoidClick = (id: number) => {
        setVoidTargetId(id);
        setVoidDialogOpen(true);
    };

    const handleVoidConfirm = async () => {
        if (!voidTargetId) return;
        setIsVoiding(true);
        try {
            const res = await fetch(`/api/toko/movements/${voidTargetId}/void`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: voidReason.trim() }),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal membatalkan");
                return;
            }
            toast.success(json.message || "Mutasi berhasil dibatalkan");
            // Refresh data with current pagination state
            await fetchMovements();
        } catch {
            toast.error("Gagal membatalkan mutasi");
        } finally {
            setIsVoiding(false);
            setVoidDialogOpen(false);
            setVoidTargetId(null);
            setVoidReason("");
        }
    };

    const columns = React.useMemo(() => StockColumns({ onVoid: handleVoidClick, canVoid }), [canVoid]);

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
                    location: stockLocation,
                    ...(movementType === "in" ? {
                        purchasePrice: formData.purchasePrice || null,
                        batchNo: formData.batchNo || null,
                        expiryDate: formData.expiryDate || null,
                        supplierName: formData.supplierName || null,
                    } : {}),
                }),
            });
            const json = await res.json();

            if (!res.ok) {
                toast.error(json.message || "Gagal memperbarui stok");
                return;
            }

            toast.success(json.message || `Stok ${movementType === "in" ? "masuk" : "keluar"} berhasil dicatat`);

            // Refresh daftar agar data terbaru tampil
            await fetchMovements();

            setDialogOpen(false);
            setFormData({ productId: "", quantity: "", notes: "", purchasePrice: "", batchNo: "", expiryDate: "", supplierName: "" });
            setStockLocation("gudang");
        } catch {
            toast.error("Gagal memperbarui stok");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
        <div className="space-y-6">
            <PageHeader title={isResto ? "Manajemen Persediaan Menu" : "Manajemen Persediaan"} description={isResto ? "Kelola stok bahan / menu keluar masuk" : `Kelola stok masuk dan keluar — ${unitType.replace(/_/g, " ")}`}
                actions={
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="secondary" onClick={() => setTransferDialogOpen(true)}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" />Transfer Stok
                        </Button>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setMovementType("in")}><Plus className="mr-2 h-4 w-4" />Stok Masuk</Button>
                            </DialogTrigger>
                            <Button variant="outline" onClick={() => setWriteoffDialogOpen(true)}><Minus className="mr-2 h-4 w-4" />Stok Keluar</Button>
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
                                            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
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
                                    <div>
                                        <Label>Lokasi Stok</Label>
                                        <div className="flex gap-2 mt-1.5">
                                            <Button
                                                type="button"
                                                variant={stockLocation === "gudang" ? "default" : "outline"}
                                                size="sm"
                                                className={stockLocation === "gudang" ? "bg-blue-600 hover:bg-blue-700" : ""}
                                                onClick={() => setStockLocation("gudang")}
                                            >
                                                <Warehouse className="mr-1.5 h-3.5 w-3.5" />Gudang
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={stockLocation === "toko" ? "default" : "outline"}
                                                size="sm"
                                                className={stockLocation === "toko" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                                                onClick={() => setStockLocation("toko")}
                                            >
                                                <Package className="mr-1.5 h-3.5 w-3.5" />Toko
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Stok masuk akan ditambahkan ke {stockLocation === "gudang" ? "Stok Gudang" : "Stok Toko"}
                                        </p>
                                    </div>
                                    {movementType === "in" && (
                                        <>
                                            <div>
                                                <Label>Harga Beli / HPP (Rp)</Label>
                                                <Input type="number" min={0} step="100" value={formData.purchasePrice} onChange={e => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))} placeholder="Harga beli dari supplier" />
                                                <p className="text-xs text-muted-foreground mt-1">Kosongkan jika tidak mengubah HPP</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><Label>No. Batch</Label><Input value={formData.batchNo} onChange={e => setFormData(prev => ({ ...prev, batchNo: e.target.value }))} placeholder="Opsional" /></div>
                                                <div><Label>Tgl. Kadaluarsa</Label><Input type="date" value={formData.expiryDate} onChange={e => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))} /></div>
                                            </div>
                                            <div><Label>Nama Supplier</Label><Input value={formData.supplierName} onChange={e => setFormData(prev => ({ ...prev, supplierName: e.target.value }))} placeholder="Opsional" /></div>
                                        </>
                                    )}
                                    <div><Label>Keterangan</Label><Input value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Pengadaan supplier" /></div>
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

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
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
                        <div className="flex justify-start mb-2 gap-2 flex-wrap">
                            <Input
                                placeholder="Cari produk, SKU, atau referensi..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-10 w-full sm:w-[280px]"
                            />
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
                           data={movements}
                           searchPlaceholder="Scan barcode atau cari produk..."
                           pageSize={perPage}
                           manualPagination={true}
                           pageCount={Math.max(1, Math.ceil(totalRows / perPage))}
                           pagination={{ pageIndex: page - 1, pageSize: perPage }}
                           onPaginationChange={(updater: unknown) => {
                               const newPagination = typeof updater === "function"
                                   ? updater({ pageIndex: page - 1, pageSize: perPage })
                                   : updater;
                               const np = newPagination as { pageIndex: number; pageSize: number };
                               setPage(np.pageIndex + 1);
                               if (np.pageSize !== perPage) {
                                   setPerPage(np.pageSize);
                                   setPage(1);
                               }
                           }}
                           totalRows={totalRows}
                        />
                    </div>
                </>
            )}
        </div>

            {/* Transfer Stock Dialog */}
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                            Transfer Stok
                        </DialogTitle>
                        <DialogDescription>Pindahkan stok antara Gudang dan Toko secara atomik</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label className="mb-1 block">Produk</Label>
                            <Popover open={openTransferProductSelect} onOpenChange={setOpenTransferProductSelect}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                        {transferProductId
                                            ? (() => {
                                                const p = products.find((p) => String(p.id) === transferProductId);
                                                return p ? `${p.sku} - ${p.name} (Gdg: ${p.stockGdg || 0}, Toko: ${p.stockToko || 0})` : "Pilih produk...";
                                            })()
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
                                                            setTransferProductId(String(p.id));
                                                            setOpenTransferProductSelect(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", transferProductId === String(p.id) ? "opacity-100" : "opacity-0")} />
                                                        <span className="font-mono mr-2">{p.sku}</span>
                                                        <span className="flex-1">{p.name}</span>
                                                        <span className="text-xs text-muted-foreground ml-2">Gdg:{p.stockGdg || 0} | Toko:{p.stockToko || 0}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div>
                            <Label>Arah Transfer</Label>
                            <div className="flex gap-2 mt-1.5">
                                <Button
                                    type="button"
                                    variant={transferDirection === "gudang" ? "default" : "outline"}
                                    size="sm"
                                    className={transferDirection === "gudang" ? "bg-blue-600 hover:bg-blue-700 flex-1" : "flex-1"}
                                    onClick={() => setTransferDirection("gudang")}
                                >
                                    <Warehouse className="mr-1.5 h-3.5 w-3.5" />Gudang → Toko
                                </Button>
                                <Button
                                    type="button"
                                    variant={transferDirection === "toko" ? "default" : "outline"}
                                    size="sm"
                                    className={transferDirection === "toko" ? "bg-emerald-600 hover:bg-emerald-700 flex-1" : "flex-1"}
                                    onClick={() => setTransferDirection("toko")}
                                >
                                    <Package className="mr-1.5 h-3.5 w-3.5" />Toko → Gudang
                                </Button>
                            </div>
                            {transferProductId && (() => {
                                const p = products.find((pr) => String(pr.id) === transferProductId);
                                if (!p) return null;
                                const fromStock = transferDirection === "gudang" ? (p.stockGdg || 0) : (p.stockToko || 0);
                                return (
                                    <p className="text-xs text-muted-foreground mt-1.5">
                                        Sumber: <strong>{transferDirection === "gudang" ? "Gudang" : "Toko"}</strong> ({fromStock} tersedia)
                                        → Tujuan: <strong>{transferDirection === "gudang" ? "Toko" : "Gudang"}</strong>
                                    </p>
                                );
                            })()}
                        </div>
                        <div>
                            <Label>Jumlah Transfer</Label>
                            <Input type="number" min={1} value={transferQty} onChange={e => setTransferQty(e.target.value)} placeholder="Masukkan jumlah unit" />
                        </div>
                        <div>
                            <Label>Keterangan (Opsional)</Label>
                            <Input value={transferNotes} onChange={e => setTransferNotes(e.target.value)} placeholder="Contoh: Isi ulang rak toko" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Batal</Button>
                        <Button
                            onClick={async () => {
                                if (!transferProductId || !transferQty) {
                                    toast.error("Lengkapi produk dan jumlah transfer");
                                    return;
                                }
                                const qty = parseInt(transferQty);
                                if (isNaN(qty) || qty <= 0) {
                                    toast.error("Jumlah harus lebih dari 0");
                                    return;
                                }
                                setIsTransferring(true);
                                try {
                                    const res = await fetch(`/api/toko/products/${transferProductId}/stock`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            type: "transfer",
                                            quantity: qty,
                                            location: transferDirection,
                                            notes: transferNotes || `Transfer ${transferDirection === "gudang" ? "Gudang → Toko" : "Toko → Gudang"}`,
                                        }),
                                    });
                                    const json = await res.json();
                                    if (!res.ok) { toast.error(json.message || "Gagal transfer stok"); return; }
                                    toast.success(json.message);
                                    setTransferDialogOpen(false);
                                    setTransferProductId("");
                                    setTransferQty("");
                                    setTransferNotes("");
                                    // Refresh with current pagination state
                                    await fetchMovements();
                                } catch {
                                    toast.error("Gagal transfer stok");
                                } finally {
                                    setIsTransferring(false);
                                }
                            }}
                            disabled={isTransferring || !transferProductId || !transferQty}
                        >
                            {isTransferring ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</> : <><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Stock Write-off Dialog */}
            <Dialog open={writeoffDialogOpen} onOpenChange={setWriteoffDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Minus className="h-5 w-5 text-red-600" />
                            Stok Keluar (Non-Penjualan)
                        </DialogTitle>
                        <DialogDescription>Catat pengurangan stok karena rusak, kadaluarsa, pemakaian internal, atau alasan lainnya</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label className="mb-1 block">Produk</Label>
                            <Popover open={openWriteoffProductSelect} onOpenChange={setOpenWriteoffProductSelect}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                        {writeoffData.productId
                                            ? (() => {
                                                const p = products.find((p) => String(p.id) === writeoffData.productId);
                                                return p ? `${p.sku} - ${p.name} (Stok: Gdg ${p.stockGdg || 0}, Toko ${p.stockToko || 0})` : "Pilih produk...";
                                            })()
                                            : "Pilih produk..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari produk..." autoFocus />
                                        <CommandList>
                                            <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {products.filter((p) => (p.stockGdg || 0) + (p.stockToko || 0) > 0).map((p) => (
                                                    <CommandItem
                                                        key={p.id}
                                                        value={`${p.sku} ${p.name}`}
                                                        onSelect={() => {
                                                            setWriteoffData(prev => ({ ...prev, productId: String(p.id) }));
                                                            setOpenWriteoffProductSelect(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", writeoffData.productId === String(p.id) ? "opacity-100" : "opacity-0")} />
                                                        <span className="font-mono mr-2">{p.sku}</span>
                                                        <span className="flex-1">{p.name}</span>
                                                        <span className="text-xs text-muted-foreground ml-2">Stok: {(p.stockGdg || 0) + (p.stockToko || 0)}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div><Label>Jumlah</Label><Input type="number" min={1} value={writeoffData.quantity} onChange={e => setWriteoffData(prev => ({ ...prev, quantity: e.target.value }))} /></div>
                        <div>
                            <Label>Lokasi</Label>
                            <div className="flex gap-2 mt-1.5">
                                <Button type="button" variant={writeoffData.location === "gudang" ? "default" : "outline"} size="sm" onClick={() => setWriteoffData(prev => ({ ...prev, location: "gudang" }))}>
                                    <Warehouse className="mr-1.5 h-3.5 w-3.5" />Gudang
                                </Button>
                                <Button type="button" variant={writeoffData.location === "toko" ? "default" : "outline"} size="sm" onClick={() => setWriteoffData(prev => ({ ...prev, location: "toko" }))}>
                                    <Package className="mr-1.5 h-3.5 w-3.5" />Toko
                                </Button>
                            </div>
                        </div>
                        <div>
                            <Label>Alasan Stok Keluar <span className="text-destructive">*</span></Label>
                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                                {[
                                    { value: "damaged", label: "Rusak / Hilang", icon: "🗑️" },
                                    { value: "expired", label: "Kadaluarsa", icon: "📅" },
                                    { value: "internal_use", label: "Pemakaian Internal", icon: "🏢" },
                                    { value: "other", label: "Lainnya", icon: "📝" },
                                ].map((r) => (
                                    <Button
                                        key={r.value}
                                        type="button"
                                        variant={writeoffData.reason === r.value ? "default" : "outline"}
                                        size="sm"
                                        className="justify-start"
                                        onClick={() => setWriteoffData(prev => ({ ...prev, reason: r.value }))}
                                    >
                                        <span className="mr-1.5">{r.icon}</span>{r.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        {writeoffData.reason === "other" && (
                            <div>
                                <Label>Catatan Alasan <span className="text-destructive">*</span></Label>
                                <Input value={writeoffData.reasonNote} onChange={e => setWriteoffData(prev => ({ ...prev, reasonNote: e.target.value }))} placeholder="Jelaskan alasan stok keluar" />
                            </div>
                        )}
                        <div>
                            <Label>Keterangan Tambahan</Label>
                            <Input value={writeoffData.notes} onChange={e => setWriteoffData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Opsional" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWriteoffDialogOpen(false)}>Batal</Button>
                        <Button
                            variant="destructive"
                            disabled={isWriteoffSubmitting || !writeoffData.productId || !writeoffData.quantity || !writeoffData.reason || (writeoffData.reason === "other" && !writeoffData.reasonNote.trim())}
                            onClick={async () => {
                                const qty = parseInt(writeoffData.quantity);
                                if (isNaN(qty) || qty <= 0) { toast.error("Jumlah tidak valid"); return; }
                                setIsWriteoffSubmitting(true);
                                try {
                                    const res = await fetch(`/api/toko/products/${writeoffData.productId}/stock`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            type: "out_writeoff",
                                            quantity: qty,
                                            location: writeoffData.location,
                                            reason: writeoffData.reason,
                                            reasonNote: writeoffData.reasonNote || null,
                                            notes: writeoffData.notes || null,
                                        }),
                                    });
                                    const json = await res.json();
                                    if (!res.ok) { toast.error(json.message || "Gagal"); return; }
                                    toast.success(json.message);
                                    setWriteoffDialogOpen(false);
                                    setWriteoffData({ productId: "", quantity: "", reason: "", reasonNote: "", notes: "", location: "gudang" });
                                    // Refresh with current pagination state
                                    await fetchMovements();
                                } catch { toast.error("Gagal mencatat stok keluar"); }
                                finally { setIsWriteoffSubmitting(false); }
                            }}
                        >
                            {isWriteoffSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</> : "Catat Stok Keluar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Void Confirmation Dialog */}
            <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Batalkan Mutasi Stok?</DialogTitle>
                        <DialogDescription>
                            {(() => {
                                const target = movements.find(m => m.id === voidTargetId);
                                if (!target) return "Mutasi tidak ditemukan.";
                                return (
                                    <span>
                                        Anda akan membatalkan entry berikut:<br /><br />
                                        <strong>Produk:</strong> {target.productName}<br />
                                        <strong>Jenis:</strong> {target.type === "in" ? "Stok Masuk" : "Stok Keluar"}<br />
                                        <strong>Jumlah:</strong> {target.quantity}<br /><br />
                                        Stok produk akan otomatis dikembalikan ke nilai sebelumnya. Entry ini tidak dihapus, hanya ditandai sebagai VOID.
                                    </span>
                                );
                            })()}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Label htmlFor="void-reason" className="text-sm text-muted-foreground mb-2 block">Alasan Pembatalan (Opsional)</Label>
                        <textarea
                            id="void-reason"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            rows={2}
                            placeholder="Contoh: Salah input jumlah, produk berbeda, dll..."
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setVoidDialogOpen(false)} disabled={isVoiding}>
                            Tidak, Kembali
                        </Button>
                        <Button variant="destructive" onClick={handleVoidConfirm} disabled={isVoiding}>
                            {isVoiding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</> : "Ya, Batalkan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
