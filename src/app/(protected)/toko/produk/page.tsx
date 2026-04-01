"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Plus,
    Package,
    ShoppingCart,
    Warehouse,
    TrendingUp,
    AlertTriangle,
    Upload,
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

const columns: ColumnDef<Product>[] = [
    {
        accessorKey: "sku",
        header: "KODE",
        cell: ({ row }) => (
            <span className="font-mono text-xs">{row.getValue("sku")}</span>
        ),
    },
    {
        accessorKey: "name",
        header: "Nama Barang",
        cell: ({ row }) => (
            <Link href={`/toko/produk/${row.original.id}`} className="font-medium hover:underline text-sm truncate max-w-[200px] block">
                {row.getValue("name")}
            </Link>
        ),
    },
    {
        accessorKey: "category",
        header: "Rak",
        cell: ({ row }) => (
            <span className="text-xs">{row.getValue("category") || "-"}</span>
        ),
    },
    {
        accessorKey: "stockGdg",
        header: "Stock Gdg",
        cell: ({ row }) => (
            <span className="tabular-nums text-xs">{row.original.stockGdg || 0}</span>
        ),
    },
    {
        accessorKey: "stockToko",
        header: "Stock Toko",
        cell: ({ row }) => (
            <span className="tabular-nums text-xs">{row.original.stockToko || 0}</span>
        ),
    },
    {
        accessorKey: "stock",
        header: "Total Stock",
        cell: ({ row }) => {
            const stock = row.getValue("stock") as number;
            const minStock = row.original.minStock;
            return (
                <div className="flex items-center gap-1">
                    <span className={`font-medium tabular-nums text-xs ${stock <= minStock ? "text-red-600" : ""}`}>
                        {stock}
                    </span>
                    {stock <= minStock && stock > 0 && (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "unit",
        header: "Sat",
        cell: ({ row }) => (
            <span className="text-xs text-muted-foreground">{row.original.unit || "-"}</span>
        ),
    },
    {
        accessorKey: "price",
        header: "@ Harga Sat",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums text-xs">
                {formatCurrency(row.getValue("price"))}
            </span>
        ),
    },
    {
        accessorKey: "costPrice",
        header: "HrgPokok",
        cell: ({ row }) => (
            <span className="tabular-nums text-xs text-muted-foreground block">
                {formatCurrency(row.original.costPrice || 0)}
            </span>
        ),
    },
];

export default function TokoProdukPage() {
    const [products, setProducts] = React.useState<Product[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    // Stats
    const stats = React.useMemo(() => {
        const total = products.length;
        const lowStock = products.filter(p => p.status === "low_stock").length;
        const outOfStock = products.filter(p => p.status === "out_of_stock").length;
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
        return { total, lowStock, outOfStock, totalValue };
    }, [products]);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const res = await fetch('/api/toko/products');
                if (!res.ok) throw new Error('Failed to fetch data');
                const result = await res.json();
                
                // Add status logic to the fetched products
                const mappedProducts = result.data.map((p: any) => {
                    let status = "available";
                    if (p.stock <= 0) {
                        status = "out_of_stock";
                    } else if (p.stock <= p.minStock) {
                        status = "low_stock";
                    }
                    return { ...p, status };
                });
                
                setProducts(mappedProducts);
            } catch (error) {
                console.error("Failed to fetch products:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Produk Toko"
                description="Kelola produk toko PRIMKOPPOL"
                actions={
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
                }
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
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Stok Menipis</p>
                            <p className="text-2xl font-bold text-amber-600">{stats.lowStock}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <Package className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Stok Habis</p>
                            <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Nilai Stok</p>
                            <p className="text-lg font-bold text-emerald-600">
                                {formatCurrency(stats.totalValue)}
                            </p>
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
                    data={products}
                    searchColumn="name"
                    searchPlaceholder="Cari produk..."
                />
            )}
        </div>
    );
}
