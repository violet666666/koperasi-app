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
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface Product {
    id: number;
    sku: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    minStock: number;
    status: "available" | "low_stock" | "out_of_stock";
}

const columns: ColumnDef<Product>[] = [
    {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
            <span className="font-mono text-sm">{row.getValue("sku")}</span>
        ),
    },
    {
        accessorKey: "name",
        header: "Nama Produk",
        cell: ({ row }) => (
            <Link href={`/toko/produk/${row.original.id}`} className="font-medium hover:underline">
                {row.getValue("name")}
            </Link>
        ),
    },
    {
        accessorKey: "category",
        header: "Kategori",
        cell: ({ row }) => (
            <Badge variant="outline">{row.getValue("category")}</Badge>
        ),
    },
    {
        accessorKey: "price",
        header: "Harga",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums">
                {formatCurrency(row.getValue("price"))}
            </span>
        ),
    },
    {
        accessorKey: "stock",
        header: "Stok",
        cell: ({ row }) => {
            const stock = row.getValue("stock") as number;
            const minStock = row.original.minStock;
            return (
                <div className="flex items-center gap-2">
                    <span className={`font-medium tabular-nums ${stock <= minStock ? "text-red-600" : ""}`}>
                        {stock}
                    </span>
                    {stock <= minStock && stock > 0 && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
                available: { label: "Tersedia", variant: "default" },
                low_stock: { label: "Stok Menipis", variant: "secondary" },
                out_of_stock: { label: "Habis", variant: "destructive" },
            };
            const { label, variant } = statusMap[status] || { label: status, variant: "default" };
            return <Badge variant={variant}>{label}</Badge>;
        },
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
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                setProducts([
                    { id: 1, sku: "BRS-001", name: "Beras Premium 5kg", category: "Sembako", price: 75000, stock: 50, minStock: 20, status: "available" },
                    { id: 2, sku: "MGR-001", name: "Minyak Goreng 2L", category: "Sembako", price: 35000, stock: 15, minStock: 20, status: "low_stock" },
                    { id: 3, sku: "GLP-001", name: "Gula Pasir 1kg", category: "Sembako", price: 18000, stock: 80, minStock: 30, status: "available" },
                    { id: 4, sku: "TEP-001", name: "Tepung Terigu 1kg", category: "Sembako", price: 15000, stock: 0, minStock: 25, status: "out_of_stock" },
                    { id: 5, sku: "KPI-001", name: "Kopi Bubuk 250g", category: "Minuman", price: 25000, stock: 40, minStock: 15, status: "available" },
                    { id: 6, sku: "TEH-001", name: "Teh Celup 25s", category: "Minuman", price: 12000, stock: 60, minStock: 20, status: "available" },
                    { id: 7, sku: "SBN-001", name: "Sabun Mandi 100g", category: "Toiletries", price: 8000, stock: 100, minStock: 30, status: "available" },
                    { id: 8, sku: "SMO-001", name: "Shampoo 170ml", category: "Toiletries", price: 22000, stock: 18, minStock: 20, status: "low_stock" },
                    { id: 9, sku: "MIE-001", name: "Mie Instan (box)", category: "Sembako", price: 120000, stock: 25, minStock: 10, status: "available" },
                    { id: 10, sku: "SUS-001", name: "Susu UHT 1L", category: "Minuman", price: 18000, stock: 35, minStock: 15, status: "available" },
                ]);
            } catch (error) {
                console.error("Failed to fetch:", error);
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
                description="Kelola produk toko koperasi"
                actions={
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Produk
                    </Button>
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
