"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/hooks";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    ClipboardCheck,
    Search,
    Loader2,
    Save,
    CheckCircle2,
    AlertTriangle,
    ArrowDownCircle,
    ArrowUpCircle,
    Package,
    FlaskConical,
} from "lucide-react";

interface ProductItem {
    id: number;
    name: string;
    sku: string;
    category: string;
    unit: string;
    stockSystem: number;
    costPrice: number;
    productType?: string;
}

interface OpnameEntry {
    productId: number;
    physicalStock: number;
}

type OpnameStatus = "idle" | "loading" | "counting" | "reviewing" | "saving";

export default function TokoOpnamePage() {
    const { user } = useAuth();
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [entries, setEntries] = useState<Map<number, number>>(new Map());
    const [status, setStatus] = useState<OpnameStatus>("idle");
    const [scope, setScope] = useState<"finished" | "ingredient" | "all">("all");
    const [location, setLocation] = useState<"gudang" | "toko">("gudang");
    const [searchQuery, setSearchQuery] = useState("");
    const [resultDialog, setResultDialog] = useState<{
        open: boolean;
        results: any[];
        summary: any;
    }>({ open: false, results: [], summary: null });

    const unitType = (user as any)?.unitType || "toko";

    const fetchProducts = useCallback(async () => {
        setStatus("loading");
        try {
            const res = await fetch(
                `/api/toko/stock-tracking/products?scope=all&location=${location}`
            );
            if (!res.ok) throw new Error("Failed to fetch products");
            const data = await res.json();
            let filtered = data.products || [];

            if (scope === "finished") {
                filtered = filtered.filter(
                    (p: ProductItem) =>
                        !["Base", "Powder", "Syrup", "Other"].includes(p.category) ||
                        p.productType !== "ingredient"
                );
            } else if (scope === "ingredient") {
                filtered = filtered.filter((p: ProductItem) =>
                    ["Base", "Powder", "Syrup", "Other"].includes(p.category)
                );
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                filtered = filtered.filter(
                    (p: ProductItem) =>
                        p.name.toLowerCase().includes(q) ||
                        p.sku.toLowerCase().includes(q)
                );
            }

            setProducts(filtered);
            setStatus("counting");
        } catch (err) {
            toast.error("Gagal memuat data produk");
            setStatus("idle");
        }
    }, [location, scope, searchQuery]);

    useEffect(() => {
        if (status === "idle" || status === "loading") return;
    }, []);

    const handlePhysicalStockChange = (productId: number, value: string) => {
        const num = parseInt(value) || 0;
        setEntries((prev) => new Map(prev).set(productId, num));
    };

    const startOpname = () => {
        setEntries(new Map());
        setResultDialog({ open: false, results: [], summary: null });
        fetchProducts();
    };

    const countedProducts = products.filter((p) => entries.has(p.id));

    const saveOpname = async () => {
        const items = Array.from(entries.entries()).map(
            ([productId, physicalStock]) => ({
                productId,
                physicalStock,
            })
        );

        if (items.length === 0) {
            toast.error("Belum ada produk yang dihitung");
            return;
        }

        setStatus("saving");
        try {
            const res = await fetch("/api/toko/stock-tracking/opname", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items, location }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Gagal menyimpan opname");
            }

            const data = await res.json();
            setResultDialog({
                open: true,
                results: data.results || [],
                summary: data.summary || {},
            });
            setStatus("idle");
            toast.success("Opname berhasil disimpan");
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan opname");
            setStatus("reviewing");
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <PageHeader
                title="Opname Stok"
                description={`Hitung fisik stok vs sistem — ${unitType.replace("_", " ")}`}
            />

            {/* Config Bar */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="text-sm font-medium mb-1 block">
                                Jenis Produk
                            </label>
                            <Select
                                value={scope}
                                onValueChange={(v) =>
                                    setScope(v as typeof scope)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Semua Produk
                                    </SelectItem>
                                    <SelectItem value="finished">
                                        <Package className="inline w-4 h-4 mr-1" />
                                        Produk Jadi
                                    </SelectItem>
                                    <SelectItem value="ingredient">
                                        <FlaskConical className="inline w-4 h-4 mr-1" />
                                        Bahan Baku
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium mb-1 block">
                                Lokasi Stok
                            </label>
                            <Select
                                value={location}
                                onValueChange={(v) =>
                                    setLocation(v as typeof location)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gudang">
                                        Gudang
                                    </SelectItem>
                                    <SelectItem value="toko">
                                        Toko
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-[2]">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari produk..."
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    className="pl-8"
                                />
                            </div>
                        </div>
                        <Button onClick={startOpname} disabled={status === "loading"}>
                            {status === "loading" ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <ClipboardCheck className="w-4 h-4 mr-2" />
                            )}
                            Mulai Opname
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            {status !== "idle" && products.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-sm text-muted-foreground">Total Produk</p>
                            <p className="text-2xl font-bold">{products.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-sm text-muted-foreground">Sudah Dihitung</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {countedProducts.length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-sm text-muted-foreground">Belum Dihitung</p>
                            <p className="text-2xl font-bold text-orange-600">
                                {products.length - countedProducts.length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-sm text-muted-foreground">Progress</p>
                            <p className="text-2xl font-bold">
                                {products.length > 0
                                    ? Math.round(
                                          (countedProducts.length /
                                              products.length) *
                                              100
                                      )
                                    : 0}
                                %
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Product List for Counting */}
            {status !== "idle" && products.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                            Input Hasil Hitung Fisik
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2">SKU</th>
                                        <th className="text-left p-2">Nama Produk</th>
                                        <th className="text-left p-2">Kategori</th>
                                        <th className="text-right p-2">Stok Sistem</th>
                                        <th className="text-right p-2">Stok Fisik</th>
                                        <th className="text-right p-2">Selisih</th>
                                        <th className="text-center p-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((p) => {
                                        const physical =
                                            entries.get(p.id) ?? undefined;
                                        const diff =
                                            physical !== undefined
                                                ? physical - p.stockSystem
                                                : null;

                                        return (
                                            <tr
                                                key={p.id}
                                                className="border-b hover:bg-muted/50"
                                            >
                                                <td className="p-2 font-mono text-xs">
                                                    {p.sku || "-"}
                                                </td>
                                                <td className="p-2 font-medium">
                                                    {p.name}
                                                </td>
                                                <td className="p-2">
                                                    <Badge variant="outline">
                                                        {p.category || "-"}
                                                    </Badge>
                                                </td>
                                                <td className="p-2 text-right font-mono">
                                                    {p.stockSystem}
                                                </td>
                                                <td className="p-2">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        className="w-24 text-right ml-auto"
                                                        placeholder="0"
                                                        value={
                                                            physical ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            handlePhysicalStockChange(
                                                                p.id,
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="p-2 text-right font-mono">
                                                    {diff !== null ? (
                                                        <span
                                                            className={
                                                                diff === 0
                                                                    ? "text-green-600"
                                                                    : diff > 0
                                                                    ? "text-blue-600"
                                                                    : "text-red-600"
                                                            }
                                                        >
                                                            {diff > 0
                                                                ? `+${diff}`
                                                                : diff}
                                                        </span>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {physical !== undefined ? (
                                                        diff === 0 ? (
                                                            <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                                                        ) : diff > 0 ? (
                                                            <ArrowUpCircle className="w-5 h-5 text-blue-600 mx-auto" />
                                                        ) : (
                                                            <ArrowDownCircle className="w-5 h-5 text-red-600 mx-auto" />
                                                        )
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">
                                                            Pending
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-3 mt-4">
                            <Button
                                variant="outline"
                                onClick={() => setStatus("idle")}
                            >
                                Batal
                            </Button>
                            <Button
                                onClick={saveOpname}
                                disabled={
                                    countedProducts.length === 0 ||
                                    status === "saving"
                                }
                            >
                                {status === "saving" ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Simpan Opname ({countedProducts.length}/
                                {products.length})
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {status === "idle" && (
                <Card>
                    <CardContent className="py-16 text-center">
                        <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">
                            Mulai Opname Stok
                        </h3>
                        <p className="text-muted-foreground mb-4">
                            Pilih jenis produk dan lokasi, lalu klik "Mulai
                            Opname" untuk mulai menghitung stok fisik
                        </p>
                        <Button onClick={startOpname}>
                            <ClipboardCheck className="w-4 h-4 mr-2" />
                            Mulai Opname
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Result Dialog */}
            <Dialog
                open={resultDialog.open}
                onOpenChange={(open) =>
                    setResultDialog((prev) => ({ ...prev, open }))
                }
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Hasil Opname Stok</DialogTitle>
                    </DialogHeader>
                    {resultDialog.summary && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 bg-muted rounded-lg">
                                    <p className="text-2xl font-bold">
                                        {resultDialog.summary.totalChecked}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Diperiksa
                                    </p>
                                </div>
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                    <p className="text-2xl font-bold text-green-600">
                                        {resultDialog.summary.matched}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Sesuai
                                    </p>
                                </div>
                                <div className="text-center p-3 bg-orange-50 rounded-lg">
                                    <p className="text-2xl font-bold text-orange-600">
                                        {resultDialog.summary.adjusted}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Disesuaikan
                                    </p>
                                </div>
                            </div>

                            {resultDialog.results.filter(
                                (r: any) => r.status !== "sesuai"
                            ).length > 0 && (
                                <div>
                                    <h4 className="font-medium mb-2">
                                        Penyesuaian:
                                    </h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {resultDialog.results
                                            .filter(
                                                (r: any) =>
                                                    r.status !== "sesuai"
                                            )
                                            .map((r: any) => (
                                                <div
                                                    key={r.productId}
                                                    className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                                                >
                                                    <span>{r.name}</span>
                                                    <Badge
                                                        variant={
                                                            r.difference > 0
                                                                ? "default"
                                                                : "destructive"
                                                        }
                                                    >
                                                        {r.difference > 0
                                                            ? `+${r.difference}`
                                                            : r.difference}{" "}
                                                        {r.adjustmentType ===
                                                        "in"
                                                            ? "masuk"
                                                            : "keluar"}
                                                    </Badge>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            onClick={() =>
                                setResultDialog({
                                    open: false,
                                    results: [],
                                    summary: null,
                                })
                            }
                        >
                            Tutup
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
