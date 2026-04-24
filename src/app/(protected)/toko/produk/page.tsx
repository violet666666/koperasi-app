"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Plus, Package, TrendingUp, AlertTriangle, Upload,
    Pencil, Check, X, Loader2, Eye, Trash2, RotateCcw, Search,
    CheckSquare, DollarSign, PackageMinus, Calculator, Copy,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface Product {
    id: number;
    sku: string;
    name: string;
    category: string;
    price: number;
    costPrice: number;
    stock: number;
    stockGdg: number;
    stockToko: number;
    unit: string;
    minStock: number;
    isActive?: boolean;
}

export default function TokoProdukPage() {
    const { data: session } = useSession();
    const userRole = session?.user?.role as string || "";
    const unitType = session?.user?.unitType as string || "toko";
    const isResto = ["resto_cafe", "resto", "coffe_latar"].includes(unitType);
    const isToko = unitType === "toko";
    // Dynamic unit type for API calls — use actual unitType instead of hardcoding
    const productUnitType = isResto ? "resto" : unitType;
    const isKasir = userRole === "kasir";

    // Dynamic labels
    const UNIT_PRODUCT_LABELS: Record<string, { title: string; desc: string; itemName: string }> = {
        toko: { title: "Produk Toko", desc: "Kelola produk toko PRIMKOPPOL", itemName: "Produk" },
        resto: { title: "Manajemen Menu", desc: "Kelola menu makanan & minuman Resto", itemName: "Menu" },
        resto_cafe: { title: "Manajemen Menu", desc: "Kelola menu makanan & minuman Resto", itemName: "Menu" },
        coffe_latar: { title: "Manajemen Menu", desc: "Kelola menu makanan & minuman Cafe", itemName: "Menu" },
        barbershop: { title: "Manajemen Layanan", desc: "Kelola layanan pangkas rambut", itemName: "Layanan" },
        playstation: { title: "Manajemen Produk & Jasa", desc: "Kelola produk snack & jasa rental PS", itemName: "Produk" },
        fitness: { title: "Manajemen Layanan", desc: "Kelola paket gym & fitness", itemName: "Layanan" },
        fotocopy: { title: "Manajemen Layanan", desc: "Kelola layanan fotocopy & print", itemName: "Layanan" },
        laundry: { title: "Manajemen Layanan", desc: "Kelola layanan laundry", itemName: "Layanan" },
    };
    const unitLabels = UNIT_PRODUCT_LABELS[unitType] || UNIT_PRODUCT_LABELS["toko"];

    const [products, setProducts] = React.useState<Product[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState("");

    // Inline edit state
    const [editingId, setEditingId] = React.useState<number | null>(null);
    const [editData, setEditData] = React.useState<Partial<Product>>({});
    const [isSaving, setIsSaving] = React.useState(false);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
    const [bulkAction, setBulkAction] = React.useState<string>("");
    const [bulkValue, setBulkValue] = React.useState("");
    const [showBulkDialog, setShowBulkDialog] = React.useState(false);
    const [isBulkProcessing, setIsBulkProcessing] = React.useState(false);

    // Filters
    const [filterCategory, setFilterCategory] = React.useState<string>("all");
    const [filterStatus, setFilterStatus] = React.useState<string>("all");

    // Recalculate & Duplicate detection
    const [isRecalculating, setIsRecalculating] = React.useState(false);
    const [isDuplicateChecking, setIsDuplicateChecking] = React.useState(false);
    const [showResultDialog, setShowResultDialog] = React.useState(false);
    const [resultDialogTitle, setResultDialogTitle] = React.useState("");
    const [resultDialogContent, setResultDialogContent] = React.useState<React.ReactNode>(null);

    const mapProducts = (data: any[]): Product[] => {
        return data.map((p: any) => ({ ...p }));
    };

    const getStatus = (p: Product) => {
        if (p.stock <= 0) return "out_of_stock";
        if (p.stock <= p.minStock) return "low_stock";
        return "available";
    };

    // Stats
    const stats = React.useMemo(() => {
        const total = products.length;
        const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        const outOfStock = products.filter(p => getStatus(p) === "out_of_stock").length;
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
        return { total, totalStock, outOfStock, totalValue };
    }, [products]);

    // Fetch
    const fetchProducts = React.useCallback(async () => {
        try {
            const res = await fetch(`/api/toko/products?unitType=${productUnitType}`);
            if (!res.ok) throw new Error('Failed');
            const result = await res.json();
            setProducts(mapProducts(result.data || []));
        } catch (error) {
            console.error("Failed to fetch products:", error);
        }
    }, [productUnitType]);

    React.useEffect(() => {
        setIsLoading(true);
        fetchProducts().finally(() => setIsLoading(false));
    }, [fetchProducts]);

    const categories = React.useMemo(() => {
        const cats = new Set(products.map(p => p.category).filter(Boolean));
        return Array.from(cats);
    }, [products]);

    const filteredProducts = React.useMemo(() => {
        return products.filter(p => {
            const matchCat = filterCategory === "all" || p.category === filterCategory;
            const status = getStatus(p);
            const matchStatus = filterStatus === "all" || status === filterStatus;
            const matchSearch = !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCat && matchStatus && matchSearch;
        });
    }, [products, filterCategory, filterStatus, searchQuery]);

    // ── Inline Edit ──
    const startEdit = (product: Product) => {
        setEditingId(product.id);
        setEditData({
            name: product.name,
            price: product.price,
            costPrice: product.costPrice,
            stockGdg: product.stockGdg,
            stockToko: product.stockToko,
            category: product.category,
        });
    };

    const cancelEdit = () => { setEditingId(null); setEditData({}); };

    const saveEdit = async () => {
        if (!editingId) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/toko/products/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...editData,
                    stock: Number(editData.stockGdg || 0) + Number(editData.stockToko || 0),
                }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal menyimpan"); return; }
            toast.success("Produk berhasil diperbarui");
            cancelEdit();
            await fetchProducts();
        } catch {
            toast.error("Gagal menyimpan perubahan");
        } finally {
            setIsSaving(false);
        }
    };

    // ── Bulk Selection ──
    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredProducts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const openBulkAction = (action: string) => {
        setBulkAction(action);
        setBulkValue("");
        setShowBulkDialog(true);
    };

    const getBulkActionLabel = () => {
        switch (bulkAction) {
            case "zero_stock": return "Nol-kan Stok";
            case "zero_price": return "Nol-kan Harga";
            case "zero_all": return "Nol-kan Stok & Harga";
            case "set_stock": return "Set Stok";
            case "set_price": return "Set Harga";
            case "deactivate": return "Nonaktifkan";
            default: return "";
        }
    };

    const executeBulk = async () => {
        if (selectedIds.size === 0) return;
        setIsBulkProcessing(true);
        try {
            const body: any = {
                ids: Array.from(selectedIds),
                action: bulkAction,
            };
            if (bulkAction === "set_stock" || bulkAction === "set_price") {
                if (!bulkValue || isNaN(Number(bulkValue))) {
                    toast.error("Masukkan nilai yang valid");
                    setIsBulkProcessing(false);
                    return;
                }
                body.value = Number(bulkValue);
            }

            const res = await fetch("/api/toko/products/bulk", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal"); return; }

            toast.success(json.message);
            setShowBulkDialog(false);
            setSelectedIds(new Set());
            await fetchProducts();
        } catch {
            toast.error("Gagal memproses aksi massal");
        } finally {
            setIsBulkProcessing(false);
        }
    };

    // ── Hitung Ulang Semua Harga ──
    const handleRecalculatePrices = async () => {
        if (!confirm("Hitung ulang SEMUA harga jual berdasarkan formula HPP?\n\nFormula: ceil((HPP × 1.02 × 1.11) / 100) × 100\n\nProduk tanpa HPP & kategori ROKOK tidak akan terpengaruh (harga manual).")) return;
        setIsRecalculating(true);
        try {
            const res = await fetch("/api/toko/products/recalculate-prices", { method: "POST" });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal"); return; }

            const data = json.data;
            toast.success(json.message);

            if (data.changes && data.changes.length > 0) {
                setResultDialogTitle(`✅ ${data.updated} Harga Diperbarui`);
                setResultDialogContent(
                    <div className="max-h-[400px] overflow-y-auto">
                        <p className="text-sm text-muted-foreground mb-3">Formula: {data.formula}</p>
                        <p className="text-sm mb-3">{data.alreadyCorrect} produk sudah sesuai, {data.noHPP} produk tanpa HPP (dilewati).</p>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Produk</TableHead>
                                    <TableHead className="text-xs text-right">HPP</TableHead>
                                    <TableHead className="text-xs text-right">Lama</TableHead>
                                    <TableHead className="text-xs text-right">Baru</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.changes.map((c: any) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="text-xs font-medium">{c.name}</TableCell>
                                        <TableCell className="text-xs text-right">{formatCurrency(c.costPrice)}</TableCell>
                                        <TableCell className="text-xs text-right text-red-500 line-through">{formatCurrency(c.oldSellPrice)}</TableCell>
                                        <TableCell className="text-xs text-right text-emerald-600 font-bold">{formatCurrency(c.newSellPrice)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                );
                setShowResultDialog(true);
            }

            await fetchProducts();
        } catch {
            toast.error("Gagal menghitung ulang harga");
        } finally {
            setIsRecalculating(false);
        }
    };

    // ── Cek Duplikasi Produk ──
    const handleCheckDuplicates = async () => {
        setIsDuplicateChecking(true);
        try {
            const res = await fetch("/api/toko/products/duplicates");
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal"); return; }

            const data = json.data;
            if (data.duplicateGroups === 0) {
                toast.success("Tidak ada produk duplikat ditemukan! ✨");
                return;
            }

            setResultDialogTitle(`⚠️ ${data.duplicateGroups} Grup Duplikat Ditemukan`);
            setResultDialogContent(
                <div className="max-h-[400px] overflow-y-auto space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Total {data.totalDuplicateProducts} produk dalam {data.duplicateGroups} grup duplikat dari {data.totalProducts} produk.
                    </p>
                    {data.groups.map((g: any, idx: number) => (
                        <div key={idx} className="rounded-lg border p-3">
                            <p className="text-sm font-semibold text-amber-600 mb-2">🔁 "{g.normalizedName}" ({g.count} produk)</p>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">SKU</TableHead>
                                        <TableHead className="text-xs">Nama</TableHead>
                                        <TableHead className="text-xs">Rak</TableHead>
                                        <TableHead className="text-xs text-right">Harga</TableHead>
                                        <TableHead className="text-xs text-center">Stok</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {g.products.map((p: any) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="text-xs font-mono">{p.sku}</TableCell>
                                            <TableCell className="text-xs">{p.name}</TableCell>
                                            <TableCell className="text-xs">{p.category || "-"}</TableCell>
                                            <TableCell className="text-xs text-right">{formatCurrency(p.sellPrice)}</TableCell>
                                            <TableCell className="text-xs text-center">{p.totalStock}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ))}
                </div>
            );
            setShowResultDialog(true);
        } catch {
            toast.error("Gagal mendeteksi duplikasi");
        } finally {
            setIsDuplicateChecking(false);
        }
    };

    // ── Render ──
    return (
        <div className="space-y-6">
            <PageHeader
                title={isKasir ? `Daftar ${unitLabels.itemName}` : unitLabels.title}
                description={isKasir ? `Lihat daftar ${unitLabels.itemName.toLowerCase()} dan stok` : unitLabels.desc}
                actions={
                    !isKasir ? (
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={handleCheckDuplicates} disabled={isDuplicateChecking}>
                                {isDuplicateChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                                Cek Duplikat
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleRecalculatePrices} disabled={isRecalculating}>
                                {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                                Hitung Ulang Harga
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href="/toko/produk/import"><Upload className="mr-2 h-4 w-4" />Import</Link>
                            </Button>
                            <Button asChild>
                                <Link href="/toko/produk/tambah"><Plus className="mr-2 h-4 w-4" />Tambah Produk</Link>
                            </Button>
                        </div>
                    ) : (
                        <Badge variant="secondary" className="gap-1.5"><Eye className="h-3.5 w-3.5" />Mode Lihat</Badge>
                    )
                }
            />

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-primary/10 p-3"><Package className="h-5 w-5 text-primary" /></div>
                    <div><p className="text-sm text-muted-foreground">Total Produk</p><p className="text-2xl font-bold">{stats.total}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30"><Package className="h-5 w-5 text-blue-600" /></div>
                    <div><p className="text-sm text-muted-foreground">Total Stok</p><p className="text-2xl font-bold text-blue-600">{stats.totalStock.toLocaleString('id-ID')}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30"><Package className="h-5 w-5 text-red-600" /></div>
                    <div><p className="text-sm text-muted-foreground">Stok Habis</p><p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                    <div><p className="text-sm text-muted-foreground">Nilai Stok</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalValue)}</p></div>
                </CardContent></Card>
            </div>

            {/* Bulk Action Toolbar — only for admin */}
            {!isKasir && selectedIds.size > 0 && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-3 flex flex-wrap items-center gap-2">
                        <Badge variant="default" className="mr-2">
                            <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                            {selectedIds.size} produk dipilih
                        </Badge>
                        <Button size="sm" variant="destructive" onClick={() => openBulkAction("zero_stock")}>
                            <PackageMinus className="mr-1.5 h-3.5 w-3.5" />Nol-kan Stok
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => openBulkAction("zero_price")}>
                            <DollarSign className="mr-1.5 h-3.5 w-3.5" />Nol-kan Harga
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => openBulkAction("zero_all")}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Nol-kan Semua
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openBulkAction("set_stock")}>
                            <Package className="mr-1.5 h-3.5 w-3.5" />Set Stok
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openBulkAction("set_price")}>
                            <DollarSign className="mr-1.5 h-3.5 w-3.5" />Set Harga
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                            <X className="mr-1.5 h-3.5 w-3.5" />Batal
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Filters + Search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama produk atau scan barcode..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <select
                    className="flex h-10 w-full sm:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                >
                    <option value="all">Semua Rak</option>
                    {categories.map(c => (<option key={c} value={c}>{c}</option>))}
                </select>
                <select
                    className="flex h-10 w-full sm:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="all">Semua Status</option>
                    <option value="available">Tersedia</option>
                    <option value="low_stock">Stok Menipis</option>
                    <option value="out_of_stock">Stok Habis</option>
                </select>
            </div>

            {/* Product Table */}
            {isLoading ? (
                <Card><CardContent className="p-6 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
            ) : (
                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {!isKasir && (
                                        <TableHead className="w-[40px]">
                                            <Checkbox
                                                checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                    )}
                                    <TableHead>KODE</TableHead>
                                    <TableHead>Nama Barang</TableHead>
                                    <TableHead>Rak</TableHead>
                                    <TableHead className="text-center">Stok Gdg</TableHead>
                                    <TableHead className="text-center">Stok Toko</TableHead>
                                    <TableHead className="text-center">Total</TableHead>
                                    <TableHead>Sat</TableHead>
                                    <TableHead className="text-right">Harga Jual</TableHead>
                                    <TableHead className="text-right">HrgPokok</TableHead>
                                    {!isKasir && <TableHead className="w-[70px]"></TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isKasir ? 10 : 11} className="text-center text-muted-foreground py-8">
                                            {searchQuery ? "Produk tidak ditemukan" : "Belum ada produk"}
                                        </TableCell>
                                    </TableRow>
                                ) : filteredProducts.map((p) => {
                                    const isEditing = editingId === p.id;
                                    const status = getStatus(p);
                                    return (
                                        <TableRow key={p.id} className={`${selectedIds.has(p.id) ? "bg-primary/5" : ""} ${status === "out_of_stock" ? "opacity-60" : ""}`}>
                                            {!isKasir && (
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedIds.has(p.id)}
                                                        onCheckedChange={() => toggleSelect(p.id)}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                                            <TableCell>
                                                {isEditing ? (
                                                    <Input className="h-8 text-sm w-[180px]" value={editData.name || ""}
                                                        onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))} />
                                                ) : (
                                                    <span className="font-medium text-sm truncate max-w-[200px] block">{p.name}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {isEditing ? (
                                                    <Input className="h-8 text-xs w-[80px]" value={editData.category || ""}
                                                        onChange={(e) => setEditData(prev => ({ ...prev, category: e.target.value }))} />
                                                ) : (
                                                    <span className="text-xs">{p.category || "-"}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {isEditing ? (
                                                    <Input type="number" className="h-8 text-xs w-[70px] text-center" value={editData.stockGdg ?? ""}
                                                        onChange={(e) => setEditData(prev => ({ ...prev, stockGdg: Number(e.target.value) }))} />
                                                ) : (
                                                    <span className="tabular-nums text-xs">{p.stockGdg || 0}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {isEditing ? (
                                                    <Input type="number" className="h-8 text-xs w-[70px] text-center" value={editData.stockToko ?? ""}
                                                        onChange={(e) => setEditData(prev => ({ ...prev, stockToko: Number(e.target.value) }))} />
                                                ) : (
                                                    <span className="tabular-nums text-xs">{p.stockToko || 0}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {isEditing ? (
                                                    <span className="tabular-nums text-xs font-bold">{(editData.stockGdg || 0) + (editData.stockToko || 0)}</span>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className={`font-medium tabular-nums text-xs ${p.stock <= p.minStock ? "text-red-600" : ""}`}>{p.stock}</span>
                                                        {p.stock <= p.minStock && p.stock > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell><span className="text-xs text-muted-foreground">{p.unit || "-"}</span></TableCell>
                                            <TableCell className="text-right">
                                                {isEditing ? (
                                                    <Input type="number" className="h-8 text-xs w-[100px] text-right" value={editData.price ?? ""}
                                                        onChange={(e) => setEditData(prev => ({ ...prev, price: Number(e.target.value) }))} />
                                                ) : (
                                                    <span className="font-medium tabular-nums text-xs">{formatCurrency(p.price)}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isEditing ? (
                                                    <Input type="number" className="h-8 text-xs w-[100px] text-right" value={editData.costPrice ?? ""}
                                                        onChange={(e) => {
                                                            const hpp = Number(e.target.value);
                                                            const isRokokCategory = (editData.category || p.category || "").toLowerCase() === "rokok";
                                                            setEditData(prev => ({
                                                                ...prev,
                                                                costPrice: hpp,
                                                                // Skip auto-calculate untuk kategori rokok (harga jual manual/HET)
                                                                price: (hpp > 0 && !isRokokCategory) ? Math.ceil((hpp * 1.02 * 1.11) / 100) * 100 : prev.price,
                                                            }));
                                                        }} />
                                                ) : (
                                                    <span className="tabular-nums text-xs text-muted-foreground">{formatCurrency(p.costPrice || 0)}</span>
                                                )}
                                            </TableCell>
                                            {!isKasir && (
                                                <TableCell>
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1">
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={saveEdit} disabled={isSaving}>
                                                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={cancelEdit} disabled={isSaving}>
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    {filteredProducts.length > 0 && (
                        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
                            Menampilkan {filteredProducts.length} dari {products.length} produk
                        </div>
                    )}
                </Card>
            )}

            {/* Bulk Action Confirmation Dialog */}
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Konfirmasi: {getBulkActionLabel()}</DialogTitle>
                        <DialogDescription>
                            Aksi ini akan diterapkan ke <strong>{selectedIds.size} produk</strong> yang dipilih.
                            {(bulkAction === "zero_stock" || bulkAction === "zero_price" || bulkAction === "zero_all") && (
                                <span className="block mt-1 text-destructive font-medium">
                                    ⚠️ Perhatian: Aksi ini tidak dapat dibatalkan!
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {(bulkAction === "set_stock" || bulkAction === "set_price") && (
                        <div className="space-y-2 py-2">
                            <Label>{bulkAction === "set_stock" ? "Nilai Stok Baru" : "Harga Baru (Rp)"}</Label>
                            <Input
                                type="number"
                                min={0}
                                value={bulkValue}
                                onChange={(e) => setBulkValue(e.target.value)}
                                placeholder={bulkAction === "set_stock" ? "Contoh: 100" : "Contoh: 15000"}
                                autoFocus
                            />
                        </div>
                    )}

                    {(bulkAction === "zero_stock" || bulkAction === "zero_all") && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm">
                            <p className="font-medium text-amber-800 dark:text-amber-300">Produk yang akan dinolkan stoknya:</p>
                            <div className="mt-2 max-h-[150px] overflow-y-auto space-y-1">
                                {products.filter(p => selectedIds.has(p.id)).slice(0, 20).map(p => (
                                    <div key={p.id} className="flex justify-between text-xs">
                                        <span className="truncate mr-2">{p.sku} - {p.name}</span>
                                        <span className="text-muted-foreground shrink-0">Stok: {p.stock}</span>
                                    </div>
                                ))}
                                {selectedIds.size > 20 && (
                                    <p className="text-xs text-muted-foreground">...dan {selectedIds.size - 20} produk lainnya</p>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkDialog(false)} disabled={isBulkProcessing}>Batal</Button>
                        <Button
                            variant={bulkAction.startsWith("zero") || bulkAction === "deactivate" ? "destructive" : "default"}
                            onClick={executeBulk}
                            disabled={isBulkProcessing || ((bulkAction === "set_stock" || bulkAction === "set_price") && !bulkValue)}
                        >
                            {isBulkProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            {isBulkProcessing ? "Memproses..." : `Ya, ${getBulkActionLabel()}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Result Dialog (Recalculate / Duplicates) */}
            <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{resultDialogTitle}</DialogTitle>
                    </DialogHeader>
                    {resultDialogContent}
                    <DialogFooter>
                        <Button onClick={() => setShowResultDialog(false)}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
