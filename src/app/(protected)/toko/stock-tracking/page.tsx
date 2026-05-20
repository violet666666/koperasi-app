"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
    SearchCheck,
    ArrowLeft,
    ArrowRight,
    Download,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ChevronUp,
    Package,
} from "lucide-react";

import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

interface ProductItem {
    id: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    stockSystem: number;
    costPrice: number;
    sellPrice: number;
}

interface CompareResult {
    productId: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    stockSystem: number;
    stockPhysical: number;
    difference: number;
    costPrice: number;
    estimatedLoss: number;
    status: "sesuai" | "kurang" | "lebih";
    suspicious: boolean;
    totalSold: number;
    totalOut: number;
    unaccounted: number;
    suspiciousNote: string | null;
}

interface AnalysisSummary {
    totalChecked: number;
    totalMatch: number;
    totalDiscrepancy: number;
    totalUnitsMissing: number;
    totalUnitsExtra: number;
    estimatedLoss: number;
    suspiciousCount: number;
    dateFrom: string;
    dateTo: string;
}

type Step = "setup" | "input" | "results";
type ScopeType = "all" | "category" | "specific";

const formatRp = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

export default function StockTrackingPage() {
    const { data: session } = useSession();
    const roleName = typeof session?.user?.role === "string"
        ? session.user.role
        : (session?.user?.role as any)?.name ?? "";

    const [step, setStep] = React.useState<Step>("setup");

    const [scope, setScope] = React.useState<ScopeType>("all");
    const [location, setLocation] = React.useState<"toko" | "gudang">("toko");
    const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
    const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
    const [categorySearch, setCategorySearch] = React.useState("");
    const [productSearch, setProductSearch] = React.useState("");
    const [dateFrom, setDateFrom] = React.useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split("T")[0];
    });
    const [dateTo, setDateTo] = React.useState(() => new Date().toISOString().split("T")[0]);

    const [products, setProducts] = React.useState<ProductItem[]>([]);
    const [physicalStocks, setPhysicalStocks] = React.useState<Record<string, number>>({});
    const [results, setResults] = React.useState<CompareResult[]>([]);
    const [summary, setSummary] = React.useState<AnalysisSummary | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [resultFilter, setResultFilter] = React.useState<"all" | "selisih" | "mencurigakan">("all");
    const [tableSearch, setTableSearch] = React.useState("");

    const [availableCategories, setAvailableCategories] = React.useState<string[]>([]);
    const [allProducts, setAllProducts] = React.useState<{ id: string; name: string; sku: string }[]>([]);
    const [catPopoverOpen, setCatPopoverOpen] = React.useState(false);
    const [prodPopoverOpen, setProdPopoverOpen] = React.useState(false);

    React.useEffect(() => {
        if (roleName && ["admin", "operator"].includes(roleName)) {
            fetch("/api/toko/products?perPage=9999&unitType=toko")
                .then((r) => r.json())
                .then((data) => {
                    const prods = data.data?.products || data.data || [];
                    setAllProducts(
                        prods.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku || "" }))
                    );
                    const cats = [...new Set(prods.map((p: any) => p.category).filter(Boolean))] as string[];
                    setAvailableCategories(cats.sort());
                })
                .catch(() => {});
        }
    }, [roleName]);

    const handleStartTracking = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ scope, location });
            if (scope === "category" && selectedCategories.length > 0) {
                params.set("categories", selectedCategories.join(","));
            }
            if (scope === "specific" && selectedProductIds.length > 0) {
                params.set("productIds", selectedProductIds.join(","));
            }

            const res = await fetch(`/api/toko/stock-tracking/products?${params}`);
            if (!res.ok) throw new Error("Gagal memuat produk");
            const data = await res.json();
            setProducts(data.products);
            setPhysicalStocks({});
            setStep("input");
        } catch (err: any) {
            toast.error(err.message || "Gagal memuat data produk");
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyze = async () => {
        const items = products
            .filter((p) => physicalStocks[p.id] !== undefined && physicalStocks[p.id] !== null)
            .map((p) => ({ productId: p.id, physicalStock: physicalStocks[p.id] }));

        if (items.length === 0) {
            toast.error("Belum ada stok fisik yang diisi");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/toko/stock-tracking/compare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items, location, dateFrom, dateTo }),
            });
            if (!res.ok) throw new Error("Gagal menganalisis data");
            const data = await res.json();
            setResults(data.results);
            setSummary(data.summary);
            setStep("results");
        } catch (err: any) {
            toast.error(err.message || "Gagal menganalisis data");
        } finally {
            setLoading(false);
        }
    };

    const getFilteredResults = React.useCallback(() => {
        let filtered = results;
        if (resultFilter === "selisih") filtered = results.filter((r) => r.status !== "sesuai");
        if (resultFilter === "mencurigakan") filtered = results.filter((r) => r.suspicious);
        if (tableSearch) {
            const q = tableSearch.toLowerCase();
            filtered = filtered.filter(
                (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [results, resultFilter, tableSearch]);

    const handleExport = () => {
        const filteredResults = getFilteredResults();
        const daysDiff = summary ? Math.round((new Date(summary.dateTo).getTime() - new Date(summary.dateFrom).getTime()) / 86400000) : 7;
        const columns: ExportColumn[] = [
            { header: "No", key: "no", width: 5 },
            { header: "Produk", key: "name", width: 25 },
            { header: "SKU", key: "sku", width: 12 },
            { header: "Kategori", key: "category", width: 15 },
            { header: "Stok Sistem", key: "stockSystem", width: 12 },
            { header: "Stok Fisik", key: "stockPhysical", width: 12 },
            { header: "Selisih", key: "difference", width: 10 },
            { header: "Estimasi Kerugian (Rp)", key: "estimatedLoss", width: 18, format: (v) => Number(v).toLocaleString("id-ID") },
            { header: "Status", key: "statusLabel", width: 10 },
            { header: "Mencurigakan", key: "suspiciousLabel", width: 14 },
            { header: `Terjual (${daysDiff} hari)`, key: "totalSold", width: 14 },
            { header: "Keluar Lain", key: "totalOut", width: 12 },
            { header: "Potensi Hilang", key: "unaccounted", width: 14 },
            { header: "Detail", key: "suspiciousNote", width: 40 },
        ];

        const exportData = filteredResults.map((r, i) => ({
            ...r,
            no: i + 1,
            statusLabel: r.status === "kurang" ? "Kurang" : r.status === "lebih" ? "Lebih" : "Sesuai",
            suspiciousLabel: r.suspicious ? "YA" : "Tidak",
        }));

        exportToExcel(exportData, columns, `STOCK-CHECK-${location}`, "Stock Tracking");
    };

    const checkedCount = products.filter((p) => physicalStocks[p.id] !== undefined && physicalStocks[p.id] !== null).length;
    const uncheckedCount = products.length - checkedCount;
    const discrepancyCount = products.filter((p) => {
        const phys = physicalStocks[p.id];
        return phys !== undefined && phys !== null && phys !== p.stockSystem;
    }).length;

    if (roleName && !["admin", "operator"].includes(roleName)) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">Akses tidak diizinkan</p>
            </div>
        );
    }

    // ─── STEP: SETUP ──────────────────────────────────────────────
    if (step === "setup") {
        return (
            <div className="space-y-6">
                <PageHeader title="Stock Tracking" description="Deteksi selisih stok fisik vs sistem untuk investigasi kecurangan" backHref="/toko" />

                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <SearchCheck className="h-5 w-5" />
                            Mulai Pengecekan Stok
                        </CardTitle>
                        <CardDescription>Pilih produk yang ingin dicek, lalu bandingkan stok fisik dengan stok sistem</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-base font-medium">Pilih Produk</Label>
                            <RadioGroup value={scope} onValueChange={(v) => setScope(v as ScopeType)} className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="all" id="scope-all" />
                                    <Label htmlFor="scope-all">Semua Produk</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="category" id="scope-category" />
                                    <Label htmlFor="scope-category">Per Kategori</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="specific" id="scope-specific" />
                                    <Label htmlFor="scope-specific">Produk Spesifik</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {scope === "category" && (
                            <div className="space-y-2">
                                <Label>Pilih Kategori</Label>
                                <Popover open={catPopoverOpen} onOpenChange={setCatPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-[40px] flex-wrap gap-1">
                                            {selectedCategories.length === 0 ? (
                                                <span className="text-muted-foreground">Pilih kategori...</span>
                                            ) : (
                                                selectedCategories.map((cat) => (
                                                    <Badge key={cat} variant="secondary" className="mr-1">
                                                        {cat}
                                                        <button className="ml-1 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setSelectedCategories((prev) => prev.filter((c) => c !== cat)); }}>
                                                            ×
                                                        </button>
                                                    </Badge>
                                                ))
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari kategori..." value={categorySearch} onValueChange={setCategorySearch} />
                                            <CommandList>
                                                <CommandEmpty>Tidak ditemukan</CommandEmpty>
                                                <CommandGroup>
                                                    {availableCategories
                                                        .filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase()))
                                                        .map((cat) => (
                                                            <CommandItem
                                                                key={cat}
                                                                onSelect={() => {
                                                                    setSelectedCategories((prev) =>
                                                                        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                                                                    );
                                                                }}
                                                            >
                                                                <div className={cn("mr-2 h-4 w-4 rounded border flex items-center justify-center", selectedCategories.includes(cat) && "bg-primary border-primary")}>
                                                                    {selectedCategories.includes(cat) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                                                                </div>
                                                                {cat}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {scope === "specific" && (
                            <div className="space-y-2">
                                <Label>Pilih Produk</Label>
                                <Popover open={prodPopoverOpen} onOpenChange={setProdPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-[40px] flex-wrap gap-1">
                                            {selectedProductIds.length === 0 ? (
                                                <span className="text-muted-foreground">Cari dan pilih produk...</span>
                                            ) : (
                                                selectedProductIds.map((id) => {
                                                    const prod = allProducts.find((p) => p.id === id);
                                                    return prod ? (
                                                        <Badge key={id} variant="secondary" className="mr-1">
                                                            {prod.name}
                                                            <button className="ml-1 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setSelectedProductIds((prev) => prev.filter((p) => p !== id)); }}>
                                                                ×
                                                            </button>
                                                        </Badge>
                                                    ) : null;
                                                })
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari produk..." value={productSearch} onValueChange={setProductSearch} />
                                            <CommandList>
                                                <CommandEmpty>Tidak ditemukan</CommandEmpty>
                                                <CommandGroup>
                                                    {allProducts
                                                        .filter((p) => {
                                                            if (selectedProductIds.includes(p.id)) return false;
                                                            const q = productSearch.toLowerCase();
                                                            return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
                                                        })
                                                        .slice(0, 50)
                                                        .map((prod) => (
                                                            <CommandItem
                                                                key={prod.id}
                                                                onSelect={() => {
                                                                    setSelectedProductIds((prev) => [...prev, prod.id]);
                                                                    setProductSearch("");
                                                                }}
                                                            >
                                                                <Package className="mr-2 h-4 w-4" />
                                                                <span>{prod.name}</span>
                                                                {prod.sku && <span className="ml-2 text-muted-foreground text-xs">({prod.sku})</span>}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className="space-y-3">
                            <Label className="text-base font-medium">Lokasi Pengecekan</Label>
                            <RadioGroup value={location} onValueChange={(v) => setLocation(v as "toko" | "gudang")} className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="toko" id="loc-toko" />
                                    <Label htmlFor="loc-toko">Toko (Etalase)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="gudang" id="loc-gudang" />
                                    <Label htmlFor="loc-gudang">Gudang</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-base font-medium">Periode Analisis (untuk deteksi mencurigakan)</Label>
                            <div className="flex gap-3">
                                <div className="space-y-1 flex-1">
                                    <Label className="text-xs text-muted-foreground">Dari</Label>
                                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <Label className="text-xs text-muted-foreground">Sampai</Label>
                                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Sistem akan membandingkan selisih stok dengan total penjualan dalam periode ini</p>
                        </div>

                        <Button onClick={handleStartTracking} disabled={loading || (scope === "category" && selectedCategories.length === 0) || (scope === "specific" && selectedProductIds.length === 0)} className="w-full">
                            {loading ? "Memuat..." : "Mulai Pengecekan"}
                            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ─── STEP: INPUT ──────────────────────────────────────────────
    if (step === "input") {
        const filteredProducts = tableSearch
            ? products.filter((p) =>
                p.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
                p.sku.toLowerCase().includes(tableSearch.toLowerCase()) ||
                p.category.toLowerCase().includes(tableSearch.toLowerCase())
            )
            : products;

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep("setup")} className="-ml-2 mb-2">
                        <ArrowLeft className="mr-1 h-4 w-4" />Kembali ke Setup
                    </Button>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight">Stock Tracking — Input Stok Fisik</h1>
                            <p className="text-muted-foreground">Lokasi: {location === "toko" ? "Toko (Etalase)" : "Gudang"} &bull; {products.length} produk</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Total Produk</p>
                            <p className="text-xl font-bold">{products.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Sudah Dicek</p>
                            <p className="text-xl font-bold text-green-600">{checkedCount}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Belum Dicek</p>
                            <p className="text-xl font-bold text-amber-600">{uncheckedCount}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Ada Selisih</p>
                            <p className="text-xl font-bold text-red-600">{discrepancyCount}</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex items-center gap-3">
                    <Input placeholder="Cari produk..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="max-w-sm" />
                    <div className="flex-1" />
                    <Button variant="outline" onClick={() => setStep("setup")}><ArrowLeft className="mr-2 h-4 w-4" />Setup</Button>
                    <Button onClick={handleAnalyze} disabled={loading || checkedCount === 0}>
                        {loading ? "Menganalisis..." : "Analisis Hasil"}
                        {!loading && <SearchCheck className="ml-2 h-4 w-4" />}
                    </Button>
                </div>

                <div className="border rounded-lg overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">No</TableHead>
                                <TableHead>Produk</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead className="text-right">Stok Sistem</TableHead>
                                <TableHead className="text-right w-[120px]">Stok Fisik</TableHead>
                                <TableHead className="text-center">Sat</TableHead>
                                <TableHead className="text-right">Selisih</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProducts.map((product, idx) => {
                                const phys = physicalStocks[product.id];
                                const isFilled = phys !== undefined && phys !== null;
                                const diff = isFilled ? phys - product.stockSystem : null;
                                const status: "sesuai" | "kurang" | "lebih" | null = diff !== null
                                    ? diff === 0 ? "sesuai" : diff < 0 ? "kurang" : "lebih"
                                    : null;

                                return (
                                    <TableRow key={product.id} className={cn(!isFilled && "bg-amber-50 dark:bg-amber-950/20")}>
                                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{product.name}</div>
                                            {product.sku && <div className="text-xs text-muted-foreground">{product.sku}</div>}
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{product.category || "-"}</Badge></TableCell>
                                        <TableCell className="text-right font-mono">{product.stockSystem}</TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                min="0"
                                                className="w-[100px] text-right ml-auto"
                                                placeholder="-"
                                                value={isFilled ? phys : ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "") {
                                                        setPhysicalStocks((prev) => { const next = { ...prev }; delete next[product.id]; return next; });
                                                    } else {
                                                        setPhysicalStocks((prev) => ({ ...prev, [product.id]: parseInt(val, 10) || 0 }));
                                                    }
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center text-muted-foreground">{product.unit}</TableCell>
                                        <TableCell className={cn("text-right font-mono font-bold", diff !== null && diff < 0 && "text-red-600", diff !== null && diff > 0 && "text-blue-600")}>
                                            {diff !== null ? (diff > 0 ? `+${diff}` : diff) : "-"}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {status === "sesuai" && <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Sesuai</Badge>}
                                            {status === "kurang" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Kurang</Badge>}
                                            {status === "lebih" && <Badge variant="secondary" className="bg-blue-100 text-blue-800"><ChevronUp className="h-3 w-3 mr-1" />Lebih</Badge>}
                                            {!status && <span className="text-muted-foreground text-sm">-</span>}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                        Tidak ada produk ditemukan
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    }

    // ─── STEP: RESULTS ────────────────────────────────────────────
    if (step === "results" && summary) {
        const filteredResults = getFilteredResults();

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep("input")} className="-ml-2 mb-2">
                        <ArrowLeft className="mr-1 h-4 w-4" />Kembali ke Input
                    </Button>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight">Stock Tracking — Hasil Analisis</h1>
                            <p className="text-muted-foreground">Lokasi: {location === "toko" ? "Toko" : "Gudang"} &bull; Periode: {new Date(summary.dateFrom).toLocaleDateString("id-ID")} - {new Date(summary.dateTo).toLocaleDateString("id-ID")}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Dicek</p>
                            <p className="text-xl font-bold">{summary.totalChecked}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Sesuai</p>
                            <p className="text-xl font-bold text-green-600">{summary.totalMatch}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Ada Selisih</p>
                            <p className="text-xl font-bold text-amber-600">{summary.totalDiscrepancy}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Unit Hilang</p>
                            <p className="text-xl font-bold text-red-600">{summary.totalUnitsMissing}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Unit Lebih</p>
                            <p className="text-xl font-bold text-blue-600">{summary.totalUnitsExtra}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Est. Kerugian</p>
                            <p className="text-lg font-bold text-red-600">{formatRp(summary.estimatedLoss)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Mencurigakan</p>
                            <p className="text-xl font-bold text-red-700">{summary.suspiciousCount}</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <Input placeholder="Cari produk..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="max-w-xs" />
                    <div className="flex gap-1">
                        <Button variant={resultFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setResultFilter("all")}>Semua ({results.length})</Button>
                        <Button variant={resultFilter === "selisih" ? "default" : "outline"} size="sm" onClick={() => setResultFilter("selisih")}>Selisih ({results.filter((r) => r.status !== "sesuai").length})</Button>
                        <Button variant={resultFilter === "mencurigakan" ? "destructive" : "outline"} size="sm" onClick={() => setResultFilter("mencurigakan")}>
                            <AlertTriangle className="h-3 w-3 mr-1" />Mencurigakan ({results.filter((r) => r.suspicious).length})
                        </Button>
                    </div>
                    <div className="flex-1" />
                    <Button variant="outline" onClick={() => setStep("input")}><ArrowLeft className="mr-2 h-4 w-4" />Input</Button>
                    <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export Excel</Button>
                </div>

                <div className="border rounded-lg overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">No</TableHead>
                                <TableHead>Produk</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead className="text-right">Sistem</TableHead>
                                <TableHead className="text-right">Fisik</TableHead>
                                <TableHead className="text-right">Selisih</TableHead>
                                <TableHead className="text-right">Kerugian</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center">Mencurigakan</TableHead>
                                <TableHead>Detail</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredResults.map((r, idx) => (
                                <TableRow key={r.productId} className={cn(r.suspicious && "bg-red-50 dark:bg-red-950/20")}>
                                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{r.name}</div>
                                        {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{r.category || "-"}</Badge></TableCell>
                                    <TableCell className="text-right font-mono">{r.stockSystem}</TableCell>
                                    <TableCell className="text-right font-mono">{r.stockPhysical}</TableCell>
                                    <TableCell className={cn("text-right font-mono font-bold", r.difference < 0 && "text-red-600", r.difference > 0 && "text-blue-600")}>
                                        {r.difference > 0 ? `+${r.difference}` : r.difference}
                                    </TableCell>
                                    <TableCell className="text-right">{r.estimatedLoss > 0 ? formatRp(r.estimatedLoss) : "-"}</TableCell>
                                    <TableCell className="text-center">
                                        {r.status === "sesuai" && <Badge variant="secondary" className="bg-green-100 text-green-800">Sesuai</Badge>}
                                        {r.status === "kurang" && <Badge variant="destructive">Kurang</Badge>}
                                        {r.status === "lebih" && <Badge variant="secondary" className="bg-blue-100 text-blue-800">Lebih</Badge>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {r.suspicious ? (
                                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />YA</Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                                        {r.suspiciousNote || "-"}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredResults.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                        Tidak ada hasil
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    }

    return null;
}
