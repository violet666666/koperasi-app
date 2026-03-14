"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    ShoppingBag,
    TrendingUp,
    Package,
    ShoppingCart,
    ArrowRight,
    Warehouse,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface TokoStats {
    totalProducts: number;
    totalSales: number;
    totalStock: number;
    todaySales: number;
}

export default function TokoPage() {
    const [stats, setStats] = React.useState<TokoStats>({
        totalProducts: 0,
        totalSales: 0,
        totalStock: 0,
        todaySales: 0,
    });

    // Fetch real stats from API
    React.useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch("/api/toko/stats");
                const json = await res.json();
                const d = json.data || {};
                setStats({
                    totalProducts: d.totalProducts || 0,
                    totalSales: d.totalSales || 0,
                    totalStock: d.totalStock || 0,
                    todaySales: d.todaySales || 0,
                });
            } catch (error) {
                console.error("Failed to fetch toko stats:", error);
            }
        }
        fetchStats();
    }, []);

    const menuItems = [
        {
            title: "Produk",
            description: "Kelola daftar produk toko",
            icon: Package,
            href: "/toko/produk",
            color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
        },
        {
            title: "Kasir / POS",
            description: "Point of Sale penjualan",
            icon: ShoppingCart,
            href: "/toko/kasir",
            color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30",
        },
        {
            title: "Persediaan",
            description: "Manajemen stok barang",
            icon: Warehouse,
            href: "/toko/persediaan",
            color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Toko Koperasi"
                description="Kelola toko/sembako koperasi"
            />

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                            <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Produk</p>
                            <p className="text-2xl font-bold">{stats.totalProducts}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <Warehouse className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Stok</p>
                            <p className="text-2xl font-bold text-amber-600">{stats.totalStock}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Penjualan Hari Ini</p>
                            <p className="text-lg font-bold text-emerald-600">
                                {formatCurrency(stats.todaySales)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900/30">
                            <ShoppingBag className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Penjualan</p>
                            <p className="text-lg font-bold text-purple-600">
                                {formatCurrency(stats.totalSales)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Menu Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                {menuItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                        <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className={`rounded-lg p-3 ${item.color}`}>
                                        <item.icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold">{item.title}</h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {item.description}
                                        </p>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Quick Actions */}
            <Card>
                <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Aksi Cepat</h3>
                    <div className="flex gap-4 flex-wrap">
                        <Button asChild>
                            <Link href="/toko/kasir">
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Buka Kasir
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/toko/produk">
                                <Package className="mr-2 h-4 w-4" />
                                Tambah Produk
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/toko/persediaan">
                                <Warehouse className="mr-2 h-4 w-4" />
                                Input Stok
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
