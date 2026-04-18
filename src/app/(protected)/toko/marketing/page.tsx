"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    Tag,
    Percent,
    DollarSign,
    TrendingDown,
    Package,
    Search,
    Trash2,
    Edit,
    Zap,
    ToggleLeft,
    ToggleRight,
    CheckCircle2,
    AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";

interface Product {
    id: number;
    sku: string;
    name: string;
    category: string;
    price: number;
    costPrice: number;
    discountType: string | null;
    discountValue: number;
    stock: number;
}

function getEffectivePrice(p: Product): number {
    if (!p.discountType || p.discountValue <= 0) return p.price;
    if (p.discountType === "percent") {
        return Math.round(p.price * (1 - p.discountValue / 100));
    }
    return Math.max(0, p.price - p.discountValue);
}

function getDiscountLabel(p: Product): string {
    if (!p.discountType || p.discountValue <= 0) return "-";
    if (p.discountType === "percent") return `${p.discountValue}%`;
    return `Rp ${p.discountValue.toLocaleString("id-ID")}`;
}

export default function MarketingPage() {
    const [products, setProducts] = React.useState<Product[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [filterMode, setFilterMode] = React.useState<"all" | "active" | "none">("all");

    // Batch selection
    const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());

    // Edit dialog
    const [editDialog, setEditDialog] = React.useState(false);
    const [editTarget, setEditTarget] = React.useState<Product | null>(null);
    const [editDiscountType, setEditDiscountType] = React.useState("none");
    const [editDiscountValue, setEditDiscountValue] = React.useState("");

    // Batch dialog
    const [batchDialog, setBatchDialog] = React.useState(false);
    const [batchDiscountType, setBatchDiscountType] = React.useState("percent");
    const [batchDiscountValue, setBatchDiscountValue] = React.useState("");

    const [saving, setSaving] = React.useState(false);

    // === Fetch products ===
    const fetchProducts = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/toko/products");
            if (!res.ok) throw new Error();
            const json = await res.json();
            setProducts(json.data || []);
        } catch {
            toast.error("Gagal memuat data produk");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchProducts(); }, [fetchProducts]);

    // === Filtered products ===
    const filtered = React.useMemo(() => {
        return products.filter(p => {
            const matchSearch = !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchQuery.toLowerCase());
            const hasDiscount = p.discountType && p.discountValue > 0;
            const matchFilter =
                filterMode === "all" ? true :
                filterMode === "active" ? hasDiscount :
                !hasDiscount;
            return matchSearch && matchFilter;
        });
    }, [products, searchQuery, filterMode]);

    // === Stats ===
    const stats = React.useMemo(() => {
        const withDiscount = products.filter(p => p.discountType && p.discountValue > 0);
        const totalEstPotongan = withDiscount.reduce((sum, p) => {
            return sum + (p.price - getEffectivePrice(p));
        }, 0);
        return {
            total: products.length,
            activePromo: withDiscount.length,
            noPromo: products.length - withDiscount.length,
            totalEstPotongan,
        };
    }, [products]);

    // === Select all (filtered) ===
    const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(p => p.id)));
        }
    };
    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // === Save discount for one product ===
    const saveDiscount = async (productId: number, discountType: string | null, discountValue: number) => {
        const res = await fetch(`/api/toko/products/${productId}/discount`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ discountType, discountValue }),
        });
        if (!res.ok) throw new Error("Gagal menyimpan diskon");
        return res.json();
    };

    // === Handle single edit ===
    const openEdit = (p: Product) => {
        setEditTarget(p);
        setEditDiscountType(p.discountType || "none");
        setEditDiscountValue(p.discountValue > 0 ? p.discountValue.toString() : "");
        setEditDialog(true);
    };

    const handleSaveEdit = async () => {
        if (!editTarget) return;
        setSaving(true);
        try {
            const dtype = editDiscountType === "none" ? null : editDiscountType;
            const dval = parseFloat(editDiscountValue) || 0;
            await saveDiscount(editTarget.id, dtype, dval);
            toast.success(`Diskon ${editTarget.name} berhasil diperbarui`);
            setEditDialog(false);
            fetchProducts();
        } catch {
            toast.error("Gagal menyimpan diskon");
        } finally {
            setSaving(false);
        }
    };

    // === Handle quick toggle (remove discount) ===
    const handleQuickRemove = async (p: Product) => {
        setSaving(true);
        try {
            await saveDiscount(p.id, null, 0);
            toast.success(`Diskon ${p.name} dinonaktifkan`);
            fetchProducts();
        } catch {
            toast.error("Gagal menonaktifkan diskon");
        } finally {
            setSaving(false);
        }
    };

    // === Batch apply ===
    const handleBatchApply = async () => {
        if (selectedIds.size === 0) return;
        setSaving(true);
        try {
            const dtype = batchDiscountType;
            const dval = parseFloat(batchDiscountValue) || 0;
            const promises = Array.from(selectedIds).map(id =>
                saveDiscount(id, dtype, dval)
            );
            await Promise.all(promises);
            toast.success(`Diskon berhasil diterapkan ke ${selectedIds.size} produk`);
            setBatchDialog(false);
            setSelectedIds(new Set());
            setBatchDiscountValue("");
            fetchProducts();
        } catch {
            toast.error("Gagal menerapkan diskon batch");
        } finally {
            setSaving(false);
        }
    };

    // === Batch remove ===
    const handleBatchRemove = async () => {
        if (selectedIds.size === 0) return;
        setSaving(true);
        try {
            const promises = Array.from(selectedIds).map(id =>
                saveDiscount(id, null, 0)
            );
            await Promise.all(promises);
            toast.success(`Diskon dihapus dari ${selectedIds.size} produk`);
            setSelectedIds(new Set());
            fetchProducts();
        } catch {
            toast.error("Gagal menghapus diskon batch");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Promo & Diskon"
                description="Kelola diskon dan promosi produk toko PRIMKOPPOL"
                backHref="/toko"
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Produk</p>
                            <p className="text-2xl font-bold">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <Tag className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Promo Aktif</p>
                            <p className="text-2xl font-bold text-emerald-600">{stats.activePromo}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                            <Package className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Tanpa Promo</p>
                            <p className="text-2xl font-bold text-slate-500">{stats.noPromo}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Est. Potongan / Unit</p>
                            <p className="text-lg font-bold text-red-600">
                                {formatCurrency(stats.totalEstPotongan)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Toolbar */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
                            <div className="relative flex-1 sm:max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari produk / SKU..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={filterMode} onValueChange={(v: any) => setFilterMode(v)}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Produk</SelectItem>
                                    <SelectItem value="active">Promo Aktif</SelectItem>
                                    <SelectItem value="none">Tanpa Promo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Batch Actions */}
                        {selectedIds.size > 0 && (
                            <div className="flex gap-2 items-center flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                    {selectedIds.size} dipilih
                                </Badge>
                                <Button
                                    size="sm"
                                    onClick={() => setBatchDialog(true)}
                                    className="gap-1"
                                >
                                    <Zap className="h-3.5 w-3.5" />
                                    Terapkan Diskon
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={handleBatchRemove}
                                    disabled={saving}
                                    className="gap-1"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Hapus Diskon
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Product Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox
                                            checked={allFilteredSelected}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="w-[100px]">SKU</TableHead>
                                    <TableHead>Nama Produk</TableHead>
                                    <TableHead className="text-right">Harga Asli</TableHead>
                                    <TableHead className="text-center">Diskon</TableHead>
                                    <TableHead className="text-right">Harga Final</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-center w-[120px]">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                                            Tidak ada produk ditemukan
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map(p => {
                                        const hasDiscount = p.discountType && p.discountValue > 0;
                                        const effectivePrice = getEffectivePrice(p);
                                        return (
                                            <TableRow key={p.id} className={hasDiscount ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedIds.has(p.id)}
                                                        onCheckedChange={() => toggleSelect(p.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                                                <TableCell>
                                                    <span className="font-medium text-sm">{p.name}</span>
                                                    {p.category && (
                                                        <span className="text-xs text-muted-foreground ml-2">({p.category})</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-sm">
                                                    {hasDiscount ? (
                                                        <span className="line-through text-muted-foreground">{formatCurrency(p.price)}</span>
                                                    ) : (
                                                        formatCurrency(p.price)
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {hasDiscount ? (
                                                        <Badge variant="destructive" className="text-xs gap-1">
                                                            {p.discountType === "percent" ? (
                                                                <><Percent className="h-3 w-3" /> {p.discountValue}%</>
                                                            ) : (
                                                                <><DollarSign className="h-3 w-3" /> {formatCurrency(p.discountValue)}</>
                                                            )}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-sm">
                                                    {hasDiscount ? (
                                                        <span className="font-bold text-emerald-600">{formatCurrency(effectivePrice)}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">{formatCurrency(p.price)}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {hasDiscount ? (
                                                        <Badge variant="default" className="text-xs gap-1 bg-emerald-600">
                                                            <CheckCircle2 className="h-3 w-3" /> Aktif
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-xs">Tidak</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8"
                                                            onClick={() => openEdit(p)}
                                                            title="Edit Diskon"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        {hasDiscount ? (
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-red-500 hover:text-red-700"
                                                                onClick={() => handleQuickRemove(p)}
                                                                disabled={saving}
                                                                title="Nonaktifkan Diskon"
                                                            >
                                                                <ToggleRight className="h-4 w-4" />
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-muted-foreground"
                                                                onClick={() => openEdit(p)}
                                                                title="Aktifkan Diskon"
                                                            >
                                                                <ToggleLeft className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* === Edit Single Product Dialog === */}
            <Dialog open={editDialog} onOpenChange={setEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Diskon — {editTarget?.name}</DialogTitle>
                        <DialogDescription>
                            Atur tipe dan nilai diskon untuk produk ini.
                            {editTarget && (
                                <span className="block mt-1 font-medium">
                                    Harga Asli: {formatCurrency(editTarget.price)}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-2">
                            <Label>Tipe Diskon</Label>
                            <Select value={editDiscountType} onValueChange={setEditDiscountType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Tidak Ada Diskon</SelectItem>
                                    <SelectItem value="percent">Persentase (%)</SelectItem>
                                    <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {editDiscountType !== "none" && (
                            <div className="space-y-2">
                                <Label>
                                    Nilai Diskon {editDiscountType === "percent" ? "(%)" : "(Rp)"}
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={editDiscountValue}
                                    onChange={e => setEditDiscountValue(e.target.value)}
                                />
                                {editTarget && editDiscountValue && (
                                    <p className="text-sm text-emerald-600 font-medium">
                                        Harga Final: {formatCurrency(
                                            editDiscountType === "percent"
                                                ? Math.round(editTarget.price * (1 - (Number(editDiscountValue) / 100)))
                                                : Math.max(0, editTarget.price - Number(editDiscountValue))
                                        )}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialog(false)}>Batal</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? "Menyimpan..." : "Simpan Diskon"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* === Batch Apply Dialog === */}
            <Dialog open={batchDialog} onOpenChange={setBatchDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            <div className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-amber-500" />
                                Terapkan Diskon Massal
                            </div>
                        </DialogTitle>
                        <DialogDescription>
                            Diskon ini akan diterapkan ke <strong>{selectedIds.size} produk</strong> yang dipilih.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-2">
                            <Label>Tipe Diskon</Label>
                            <Select value={batchDiscountType} onValueChange={setBatchDiscountType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percent">Persentase (%)</SelectItem>
                                    <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>
                                Nilai Diskon {batchDiscountType === "percent" ? "(%)" : "(Rp)"}
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={batchDiscountValue}
                                onChange={e => setBatchDiscountValue(e.target.value)}
                            />
                        </div>
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                    Diskon yang sudah ada pada produk terpilih akan <strong>ditimpa</strong> dengan nilai baru ini.
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBatchDialog(false)}>Batal</Button>
                        <Button onClick={handleBatchApply} disabled={saving || !batchDiscountValue}>
                            {saving ? "Menerapkan..." : `Terapkan ke ${selectedIds.size} Produk`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
