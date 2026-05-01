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
    CheckSquare, DollarSign, PackageMinus, Calculator, Copy, Tag, Ruler,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
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
        cafe_lsp: { title: "Manajemen Menu", desc: "Kelola menu makanan & minuman Cafe LSP", itemName: "Menu" },
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
    const [totalProducts, setTotalProducts] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const perPage = 50;

    // Inline edit state
    const [editingId, setEditingId] = React.useState<number | null>(null);
    const [editData, setEditData] = React.useState<Partial<Product>>({});
    const [isSaving, setIsSaving] = React.useState(false);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
    const [bulkAction, setBulkAction] = React.useState<string>("");
    const [bulkValue, setBulkValue] = React.useState("");
    const [bulkCategory, setBulkCategory] = React.useState("");
    const [bulkUnit, setBulkUnit] = React.useState("");
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

    // Category management
    const [showCategoryDialog, setShowCategoryDialog] = React.useState(false);
    const [categoryList, setCategoryList] = React.useState<{ name: string; count: number }[]>([]);
    const [editingCategory, setEditingCategory] = React.useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = React.useState("");
    const [isCategoryProcessing, setIsCategoryProcessing] = React.useState(false);

    const fetchCategories = React.useCallback(async () => {
        try {
            const res = await fetch(`/api/toko/products/categories?unitType=${productUnitType}`);
            const json = await res.json();
            if (res.ok) setCategoryList(json.data || []);
        } catch {}
    }, [productUnitType]);

    const openCategoryDialog = () => {
        fetchCategories();
        setShowCategoryDialog(true);
    };

    const handleRenameCategory = async (oldName: string) => {
        const trimmed = newCategoryName.trim();
        if (!trimmed) { toast.error("Nama kategori baru tidak boleh kosong"); return; }
        setIsCategoryProcessing(true);
        try {
            const res = await fetch("/api/toko/products/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "rename", category: oldName, newCategory: trimmed }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message); return; }
            toast.success(json.message);
            setEditingCategory(null);
            setNewCategoryName("");
            fetchCategories();
            fetchCategoriesList();
            fetchProducts();
        } catch { toast.error("Gagal mengubah kategori"); }
        finally { setIsCategoryProcessing(false); }
    };

    const handleDeleteCategory = async (name: string) => {
        setIsCategoryProcessing(true);
        try {
            const res = await fetch("/api/toko/products/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "delete", category: name }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message); return; }
            toast.success(json.message);
            fetchCategories();
            fetchCategoriesList();
            fetchProducts();
        } catch { toast.error("Gagal menghapus kategori"); }
        finally { setIsCategoryProcessing(false); }
    };

    // Pricing settings from DB
    const [markupPercent, setMarkupPercent] = React.useState(2);
    const [ppnPercent, setPpnPercent] = React.useState(0);
    const [excludedCategories, setExcludedCategories] = React.useState<string[]>([]);
    React.useEffect(() => {
        fetch(`/api/settings?unitType=${productUnitType}`)
            .then(r => r.json())
            .then(data => {
                if (data.map) {
                    const mk = parseFloat(data.map[`${productUnitType}_markup_percent`]);
                    const pp = parseFloat(data.map[`${productUnitType}_ppn_percent`]);
                    if (!isNaN(mk)) setMarkupPercent(mk);
                    if (!isNaN(pp)) setPpnPercent(pp);
                    try {
                        const exc = data.map[`${productUnitType}_excluded_categories`];
                        if (exc) setExcludedCategories(JSON.parse(exc).map((c: string) => c.toLowerCase()));
                    } catch {}
                }
            })
            .catch(() => {});
    }, [productUnitType]);

    const isManualPriceCategory = (cat: string | null | undefined) =>
        !!cat && excludedCategories.includes(cat.toLowerCase());

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
        const total = totalProducts;
        const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        const outOfStock = products.filter(p => getStatus(p) === "out_of_stock").length;
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
        return { total, totalStock, outOfStock, totalValue };
    }, [products, totalProducts]);

    // Fetch
    const fetchProducts = React.useCallback(async () => {
        try {
            const params = new URLSearchParams({ unitType: productUnitType, page: String(page), perPage: String(perPage) });
            if (searchQuery) params.set("search", searchQuery);
            if (filterCategory && filterCategory !== "all") params.set("category", filterCategory);
            const res = await fetch(`/api/toko/products?${params}`);
            if (!res.ok) throw new Error('Failed');
            const result = await res.json();
            setProducts(mapProducts(result.data?.products || []));
            setTotalProducts(result.data?.pagination?.totalCount || 0);
        } catch (error) {
            console.error("Failed to fetch products:", error);
        }
    }, [productUnitType, page, searchQuery, filterCategory]);

    React.useEffect(() => {
        setIsLoading(true);
        fetchProducts().finally(() => setIsLoading(false));
    }, [fetchProducts]);

    // Reset page when filters change
    React.useEffect(() => {
        setPage(1);
    }, [searchQuery, filterCategory, filterStatus]);

    const [categories, setCategories] = React.useState<string[]>([]);

    // Fetch categories list separately (not from paginated products)
    const fetchCategoriesList = React.useCallback(async () => {
        try {
            const res = await fetch(`/api/toko/products/categories?unitType=${productUnitType}`);
            const json = await res.json();
            if (res.ok) {
                setCategories((json.data || []).map((c: { name: string }) => c.name));
            }
        } catch {}
    }, [productUnitType]);

    React.useEffect(() => {
        fetchCategoriesList();
    }, [fetchCategoriesList]);

    const unitList = React.useMemo(() => {
        const units = new Set(products.map(p => p.unit).filter(Boolean));
        return Array.from(units);
    }, [products]);

    const filteredProducts = React.useMemo(() => {
        return products.filter(p => {
            const status = getStatus(p);
            const matchStatus = filterStatus === "all" || status === filterStatus;
            return matchStatus;
        });
    }, [products, filterStatus]);

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
            unit: product.unit,
        });
    };

    const cancelEdit = () => { setEditingId(null); setEditData({}); };

    const saveEdit = async () => {
        if (!editingId) return;
        setIsSaving(true);
        try {
            // Cek apakah field stok berubah
            const original = products.find(p => p.id === editingId);
            const newGdg = Number(editData.stockGdg ?? 0);
            const newToko = Number(editData.stockToko ?? 0);
            const stockChanged = original && (original.stockGdg !== newGdg || original.stockToko !== newToko);

            // 1. Update field non-stok via PUT
            const { stockGdg, stockToko, stock, ...nonStockFields } = editData as any;
            const res = await fetch(`/api/toko/products/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nonStockFields),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal menyimpan"); return; }

            // 2. Jika stok berubah, update via /stock endpoint
            if (stockChanged && original) {
                const diffGdg = newGdg - original.stockGdg;
                const diffToko = newToko - original.stockToko;

                // Update stok gudang jika berubah
                if (diffGdg !== 0) {
                    const stockRes = await fetch(`/api/toko/products/${editingId}/stock`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: diffGdg > 0 ? "in" : "out",
                            quantity: Math.abs(diffGdg),
                            location: "gudang",
                            notes: "Edit produk (inline)",
                        }),
                    });
                    if (!stockRes.ok) {
                        const stockJson = await stockRes.json();
                        toast.error(stockJson.message || "Gagal update stok gudang");
                    }
                }
                // Update stok toko jika berubah
                if (diffToko !== 0) {
                    const stockRes = await fetch(`/api/toko/products/${editingId}/stock`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: diffToko > 0 ? "in" : "out",
                            quantity: Math.abs(diffToko),
                            location: "toko",
                            notes: "Edit produk (inline)",
                        }),
                    });
                    if (!stockRes.ok) {
                        const stockJson = await stockRes.json();
                        toast.error(stockJson.message || "Gagal update stok toko");
                    }
                }
            }

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
        setBulkCategory("");
        setBulkUnit("");
        setShowBulkDialog(true);
    };

    const getBulkActionLabel = () => {
        switch (bulkAction) {
            case "zero_stock": return "Nol-kan Stok";
            case "zero_price": return "Nol-kan Harga";
            case "zero_all": return "Nol-kan Stok & Harga";
            case "set_stock": return "Set Stok";
            case "set_price": return "Set Harga";
            case "set_category": return "Set Kategori";
            case "set_unit": return "Edit Satuan";
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
            if (bulkAction === "set_category") {
                const cat = bulkCategory.trim();
                if (!cat) {
                    toast.error("Masukkan atau pilih kategori");
                    setIsBulkProcessing(false);
                    return;
                }
                body.category = cat;
            }
            if (bulkAction === "set_unit") {
                const unitVal = bulkUnit.trim();
                if (!unitVal) {
                    toast.error("Masukkan atau pilih satuan");
                    setIsBulkProcessing(false);
                    return;
                }
                body.value = unitVal;
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
        const formulaDesc = ppnPercent > 0
            ? `ceil((HPP × ${(1 + markupPercent/100).toFixed(2)} × ${(1 + ppnPercent/100).toFixed(2)}) / 100) × 100`
            : `ceil((HPP × ${(1 + markupPercent/100).toFixed(2)}) / 100) × 100`;
        if (!confirm(`Hitung ulang SEMUA harga jual berdasarkan formula HPP?\n\nFormula: ${formulaDesc}\nMarkup: ${markupPercent}%${ppnPercent > 0 ? `, PPN: ${ppnPercent}%` : ' (tanpa PPN)'}\n\nProduk tanpa HPP & kategori manual tidak akan terpengaruh.`)) return;
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
                                        <TableHead className="text-xs">Kategori</TableHead>
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

    // ── Hapus Produk (Soft Delete) ──
    const handleDeleteProduct = async (product: Product) => {
        if (!confirm(`Yakin ingin menghapus produk "${product.name}" (${product.sku})?\n\nProduk akan dinonaktifkan dan tidak tampil lagi di daftar.`)) return;
        try {
            const res = await fetch(`/api/toko/products/${product.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal menghapus produk"); return; }
            toast.success(`Produk "${product.name}" berhasil dihapus`);
            await fetchProducts();
        } catch {
            toast.error("Gagal menghapus produk");
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
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
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
                        <Button size="sm" variant="outline" onClick={() => openBulkAction("set_category")}>
                            <Tag className="mr-1.5 h-3.5 w-3.5" />Set Kategori
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openBulkAction("set_unit")}>
                            <Ruler className="mr-1.5 h-3.5 w-3.5" />Edit Satuan
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
                    <option value="all">Semua Kategori</option>
                    {categories.map(c => (<option key={c} value={c}>{c}</option>))}
                </select>
                {!isKasir && (
                    <Button size="sm" variant="outline" className="h-10 shrink-0" onClick={openCategoryDialog}>
                        <Tag className="mr-1.5 h-3.5 w-3.5" />Kelola
                    </Button>
                )}
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
                                    <TableHead>Kategori</TableHead>
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
                                                    <span className="font-medium text-sm break-words whitespace-normal">{p.name}</span>
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
                                            <TableCell>
                                                {isEditing ? (
                                                    <Input className="h-8 text-xs w-[70px]" value={editData.unit || ""}
                                                        onChange={(e) => setEditData(prev => ({ ...prev, unit: e.target.value }))} />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">{p.unit || "-"}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isEditing ? (
                                                    <Input type="number" className="h-8 text-xs w-[100px] text-right" value={editData.price ?? ""}
                                                        onChange={(e) => setEditData(prev => ({ ...prev, price: Number(e.target.value) }))} />
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <span className="font-medium tabular-nums text-xs">{formatCurrency(p.price)}</span>
                                                        {isManualPriceCategory(p.category) && (
                                                            <Badge variant="outline" className="h-4 text-[9px] border-amber-300 text-amber-700 bg-amber-50 px-1">Manual</Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isEditing ? (
                                                    <Input type="number" className="h-8 text-xs w-[100px] text-right" value={editData.costPrice ?? ""}
                                                        onChange={(e) => {
                                                            const hpp = Number(e.target.value);
                                                            const isManualCat = isManualPriceCategory(editData.category || p.category);
                                                            const markupMul = 1 + markupPercent / 100;
                                                            const ppnMul = 1 + ppnPercent / 100;
                                                            setEditData(prev => ({
                                                                ...prev,
                                                                costPrice: hpp,
                                                                price: (hpp > 0 && !isManualCat) ? Math.ceil((hpp * markupMul * ppnMul) / 100) * 100 : prev.price,
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
                                                        <div className="flex items-center gap-0.5">
                                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)} title="Edit Produk">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteProduct(p)} title="Hapus Produk">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    {totalProducts > 0 && (
                        <div className="px-4 py-2 border-t flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs text-muted-foreground">
                                Menampilkan {((page - 1) * perPage) + 1} - {Math.min(page * perPage, totalProducts)} dari {totalProducts} produk
                            </div>
                            {(() => {
                                const totalPages = Math.max(1, Math.ceil(totalProducts / perPage));
                                return totalPages > 1 ? (
                                    <div className="flex items-center gap-1">
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page <= 1}>
                                            <ChevronsLeft className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="px-2 text-sm tabular-nums">{page} / {totalPages}</span>
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
                                            <ChevronsRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : null;
                            })()}
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
                            {bulkAction === "set_price" && (() => {
                                const manualProducts = filteredProducts.filter(p => selectedIds.has(p.id) && isManualPriceCategory(p.category));
                                return manualProducts.length > 0 ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-2.5 text-xs">
                                        <p className="font-medium text-amber-800 dark:text-amber-300">⚠️ {manualProducts.length} produk kategori manual akan terpengaruh:</p>
                                        <div className="mt-1 max-h-[80px] overflow-y-auto space-y-0.5">
                                            {manualProducts.slice(0, 10).map(p => (
                                                <div key={p.id} className="text-amber-700 dark:text-amber-400">{p.name} ({p.category})</div>
                                            ))}
                                            {manualProducts.length > 10 && <div className="text-amber-600">...dan {manualProducts.length - 10} lainnya</div>}
                                        </div>
                                    </div>
                                ) : null;
                            })()}
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

                    {bulkAction === "set_category" && (
                        <div className="space-y-3 py-2">
                            <Label>Kategori Baru</Label>
                            {categories.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground">Pilih kategori yang sudah ada:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {categories.map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setBulkCategory(c)}
                                                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                                                    bulkCategory === c
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background hover:bg-accent border-input"
                                                }`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <p className="text-xs text-muted-foreground">Atau ketik kategori baru:</p>
                                <Input
                                    value={bulkCategory}
                                    onChange={(e) => setBulkCategory(e.target.value)}
                                    placeholder="Contoh: Minuman, Snack, Alat Tulis..."
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Akan diterapkan ke <strong>{selectedIds.size} produk</strong> yang dipilih.
                            </p>
                        </div>
                    )}

                    {bulkAction === "set_unit" && (
                        <div className="space-y-3 py-2">
                            <Label>Satuan Baru</Label>
                            {unitList.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground">Pilih satuan yang sudah ada:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {unitList.map(u => (
                                            <button
                                                key={u}
                                                type="button"
                                                onClick={() => setBulkUnit(u)}
                                                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                                                    bulkUnit === u
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background hover:bg-accent border-input"
                                                }`}
                                            >
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <p className="text-xs text-muted-foreground">Atau ketik satuan baru:</p>
                                <Input
                                    value={bulkUnit}
                                    onChange={(e) => setBulkUnit(e.target.value)}
                                    placeholder="Contoh: pcs, kg, liter, lusin, pack..."
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Akan diterapkan ke <strong>{selectedIds.size} produk</strong> yang dipilih.
                            </p>
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
                            disabled={isBulkProcessing || ((bulkAction === "set_stock" || bulkAction === "set_price") && !bulkValue) || (bulkAction === "set_category" && !bulkCategory.trim()) || (bulkAction === "set_unit" && !bulkUnit.trim())}
                        >
                            {isBulkProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            {isBulkProcessing ? "Memproses..." : `Ya, ${getBulkActionLabel()}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Category Management Dialog */}
            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Kelola Kategori</DialogTitle>
                        <DialogDescription>Kelola kategori produk untuk unit {productUnitType}. Kategori otomatis hilang jika tidak ada produk yang menggunakannya.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {categoryList.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Belum ada kategori. Kategori muncul otomatis saat produk diberi kategori.</p>
                        ) : categoryList.map((cat) => (
                            <div key={cat.name} className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                                {editingCategory === cat.name ? (
                                    <>
                                        <Input
                                            className="flex-1 h-8 text-sm"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder={cat.name}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleRenameCategory(cat.name);
                                                if (e.key === "Escape") { setEditingCategory(null); setNewCategoryName(""); }
                                            }}
                                            disabled={isCategoryProcessing}
                                        />
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                                            onClick={() => handleRenameCategory(cat.name)} disabled={isCategoryProcessing || !newCategoryName.trim()}>
                                            <Check className="h-4 w-4 text-green-600" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                                            onClick={() => { setEditingCategory(null); setNewCategoryName(""); }} disabled={isCategoryProcessing}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="flex-1 text-sm font-medium">{cat.name}</span>
                                        <Badge variant="secondary" className="text-xs">{cat.count} produk</Badge>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                                            onClick={() => { setEditingCategory(cat.name); setNewCategoryName(cat.name); }}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:text-destructive"
                                            onClick={() => {
                                                const msg = cat.count > 0
                                                    ? `Hapus kategori "${cat.name}"? ${cat.count} produk akan dipindahkan ke "Tanpa Kategori".`
                                                    : `Hapus kategori "${cat.name}"?`;
                                                if (confirm(msg)) handleDeleteCategory(cat.name);
                                            }}
                                            disabled={isCategoryProcessing}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Tutup</Button>
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
