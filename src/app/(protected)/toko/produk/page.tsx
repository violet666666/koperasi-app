"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Plus, Package, Warehouse, TrendingUp, AlertTriangle, Upload,
    Pencil, Check, X, Loader2, Eye,
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
    status: "available" | "low_stock" | "out_of_stock";
}

export default function TokoProdukPage() {
    const { data: session } = useSession();
    const userRole = session?.user?.role as string || "";
    const isKasir = userRole === "kasir";

    const [products, setProducts] = React.useState<Product[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    // Inline edit state
    const [editingId, setEditingId] = React.useState<number | null>(null);
    const [editData, setEditData] = React.useState<Partial<Product>>({});
    const [isSaving, setIsSaving] = React.useState(false);

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

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

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
            setEditingId(null);
            setEditData({});
            // Refresh
            const productsRes = await fetch("/api/toko/products");
            const productsJson = await productsRes.json();
            setProducts(mapProducts(productsJson.data || []));
        } catch {
            toast.error("Gagal menyimpan perubahan");
        } finally {
            setIsSaving(false);
        }
    };

    const mapProducts = (data: any[]): Product[] => {
        return data.map((p: any) => {
            let status: Product["status"] = "available";
            if (p.stock <= 0) status = "out_of_stock";
            else if (p.stock <= p.minStock) status = "low_stock";
            return { ...p, status };
        });
    };

    // Stats
    const stats = React.useMemo(() => {
        const total = products.length;
        const lowStock = products.filter(p => p.status === "low_stock").length;
        const outOfStock = products.filter(p => p.status === "out_of_stock").length;
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
        return { total, lowStock, outOfStock, totalValue };
    }, [products]);

    // Fetch
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const res = await fetch('/api/toko/products');
                if (!res.ok) throw new Error('Failed');
                const result = await res.json();
                setProducts(mapProducts(result.data || []));
            } catch (error) {
                console.error("Failed to fetch products:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Filters
    const [filterCategory, setFilterCategory] = React.useState<string>("all");
    const [filterStatus, setFilterStatus] = React.useState<string>("all");

    const categories = React.useMemo(() => {
        const cats = new Set(products.map(p => p.category).filter(Boolean));
        return Array.from(cats);
    }, [products]);

    const filteredProducts = React.useMemo(() => {
        return products.filter(p => {
            const matchCat = filterCategory === "all" || p.category === filterCategory;
            const matchStatus = filterStatus === "all" || p.status === filterStatus;
            return matchCat && matchStatus;
        });
    }, [products, filterCategory, filterStatus]);

    // Build columns dynamically based on role
    const columns: ColumnDef<Product>[] = React.useMemo(() => {
        const baseCols: ColumnDef<Product>[] = [
            {
                accessorKey: "sku", header: "KODE",
                cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("sku")}</span>,
            },
            {
                accessorKey: "name", header: "Nama Barang",
                cell: ({ row }) => {
                    if (editingId === row.original.id) {
                        return (
                            <Input
                                className="h-8 text-sm w-[180px]"
                                value={editData.name || ""}
                                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                            />
                        );
                    }
                    return <span className="font-medium text-sm truncate max-w-[200px] block">{row.getValue("name")}</span>;
                },
            },
            {
                accessorKey: "category", header: "Rak",
                cell: ({ row }) => {
                    if (editingId === row.original.id) {
                        return (
                            <Input
                                className="h-8 text-xs w-[80px]"
                                value={editData.category || ""}
                                onChange={(e) => setEditData(prev => ({ ...prev, category: e.target.value }))}
                            />
                        );
                    }
                    return <span className="text-xs">{row.getValue("category") || "-"}</span>;
                },
            },
            {
                accessorKey: "stockGdg", header: "Stok Gdg",
                cell: ({ row }) => {
                    if (editingId === row.original.id) {
                        return (
                            <Input
                                type="number" className="h-8 text-xs w-[70px] text-center"
                                value={editData.stockGdg ?? ""}
                                onChange={(e) => setEditData(prev => ({ ...prev, stockGdg: Number(e.target.value) }))}
                            />
                        );
                    }
                    return <span className="tabular-nums text-xs">{row.original.stockGdg || 0}</span>;
                },
            },
            {
                accessorKey: "stockToko", header: "Stok Toko",
                cell: ({ row }) => {
                    if (editingId === row.original.id) {
                        return (
                            <Input
                                type="number" className="h-8 text-xs w-[70px] text-center"
                                value={editData.stockToko ?? ""}
                                onChange={(e) => setEditData(prev => ({ ...prev, stockToko: Number(e.target.value) }))}
                            />
                        );
                    }
                    return <span className="tabular-nums text-xs">{row.original.stockToko || 0}</span>;
                },
            },
            {
                accessorKey: "stock", header: "Total",
                cell: ({ row }) => {
                    const stock = row.getValue("stock") as number;
                    const minStock = row.original.minStock;
                    if (editingId === row.original.id) {
                        const total = (editData.stockGdg || 0) + (editData.stockToko || 0);
                        return <span className="tabular-nums text-xs font-bold">{total}</span>;
                    }
                    return (
                        <div className="flex items-center gap-1">
                            <span className={`font-medium tabular-nums text-xs ${stock <= minStock ? "text-red-600" : ""}`}>{stock}</span>
                            {stock <= minStock && stock > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                        </div>
                    );
                },
            },
            {
                accessorKey: "unit", header: "Sat",
                cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.unit || "-"}</span>,
            },
            {
                accessorKey: "price", header: "Harga Jual",
                cell: ({ row }) => {
                    if (editingId === row.original.id) {
                        return (
                            <Input
                                type="number" className="h-8 text-xs w-[100px] text-right"
                                value={editData.price ?? ""}
                                onChange={(e) => setEditData(prev => ({ ...prev, price: Number(e.target.value) }))}
                            />
                        );
                    }
                    return <span className="font-medium tabular-nums text-xs">{formatCurrency(row.getValue("price"))}</span>;
                },
            },
            {
                accessorKey: "costPrice", header: "HrgPokok",
                cell: ({ row }) => {
                    if (editingId === row.original.id) {
                        return (
                            <Input
                                type="number" className="h-8 text-xs w-[100px] text-right"
                                value={editData.costPrice ?? ""}
                                onChange={(e) => setEditData(prev => ({ ...prev, costPrice: Number(e.target.value) }))}
                            />
                        );
                    }
                    return <span className="tabular-nums text-xs text-muted-foreground">{formatCurrency(row.original.costPrice || 0)}</span>;
                },
            },
        ];

        // Admin/operator: add edit action column
        if (!isKasir) {
            baseCols.push({
                id: "actions", header: "",
                cell: ({ row }) => {
                    if (editingId === row.original.id) {
                        return (
                            <div className="flex items-center gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={saveEdit} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={cancelEdit} disabled={isSaving}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        );
                    }
                    return (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(row.original)}>
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    );
                },
            });
        }

        return baseCols;
    }, [editingId, editData, isSaving, isKasir]);

    return (
        <div className="space-y-6">
            <PageHeader
                title={isKasir ? "Daftar Produk" : "Produk Toko"}
                description={isKasir ? "Lihat daftar produk dan stok toko" : "Kelola produk toko PRIMKOPPOL"}
                actions={
                    !isKasir ? (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" asChild>
                                <Link href="/toko/produk/import">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import Data
                                </Link>
                            </Button>
                            <Button asChild>
                                <Link href="/toko/produk/tambah">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Tambah Produk
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <Badge variant="secondary" className="gap-1.5">
                            <Eye className="h-3.5 w-3.5" />
                            Mode Lihat
                        </Badge>
                    )
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3"><Package className="h-5 w-5 text-primary" /></div>
                        <div><p className="text-sm text-muted-foreground">Total Produk</p><p className="text-2xl font-bold">{stats.total}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                        <div><p className="text-sm text-muted-foreground">Stok Menipis</p><p className="text-2xl font-bold text-amber-600">{stats.lowStock}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30"><Package className="h-5 w-5 text-red-600" /></div>
                        <div><p className="text-sm text-muted-foreground">Stok Habis</p><p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                        <div><p className="text-sm text-muted-foreground">Nilai Stok</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalValue)}</p></div>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            {isLoading ? (
                <Card><CardContent className="p-6 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 mb-2">
                        <select
                            className="flex h-10 w-full sm:w-[200px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                        >
                            <option value="all">Semua Rak / Kategori</option>
                            {categories.map(c => (<option key={c} value={c}>{c}</option>))}
                        </select>
                        <select
                            className="flex h-10 w-full sm:w-[200px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">Semua Status Stok</option>
                            <option value="available">Tersedia</option>
                            <option value="low_stock">Stok Menipis</option>
                            <option value="out_of_stock">Stok Habis</option>
                        </select>
                    </div>

                    <DataTable
                        columns={columns}
                        data={filteredProducts}
                        searchPlaceholder="Scan barcode atau cari produk..."
                    />
                </div>
            )}
        </div>
    );
}
