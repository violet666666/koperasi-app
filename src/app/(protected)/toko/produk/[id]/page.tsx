"use client";

import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import * as React from "react";

export default function DetailProdukPage() {
    const params = useParams();
    const productId = params.id;
    const [product, setProduct] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/toko/products/${productId}`);
                if (res.ok) {
                    const data = await res.json();
                    setProduct(data.data);
                }
            } catch {
                // Product API may not exist yet
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [productId]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader title={product?.name || `Produk #${productId}`} description="Detail produk toko PRIMKOPPOL" backHref="/toko/produk" />
            <Card>
                <CardHeader>
                    <CardTitle>{product?.name || "Produk"}</CardTitle>
                </CardHeader>
                <CardContent>
                    {product ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div><p className="text-sm text-muted-foreground">Kode (SKU)</p><p className="font-medium">{product.sku || product.code}</p></div>
                            <div><p className="text-sm text-muted-foreground">Harga Jual</p><p className="font-medium">Rp {Number(product.price || product.sellPrice).toLocaleString("id-ID")}</p></div>
                            <div><p className="text-sm text-muted-foreground">Harga Pokok</p><p className="font-medium">Rp {Number(product.costPrice).toLocaleString("id-ID")}</p></div>
                            <div><p className="text-sm text-muted-foreground">Stock Gudang</p><p className="font-medium">{product.stockGdg || 0}</p></div>
                            <div><p className="text-sm text-muted-foreground">Stock Toko</p><p className="font-medium">{product.stockToko || 0}</p></div>
                            <div><p className="text-sm text-muted-foreground">Total Stock</p><p className="font-medium">{product.stock || 0}</p></div>
                            <div><p className="text-sm text-muted-foreground">Kategori</p><p className="font-medium">{product.category || "-"}</p></div>
                            <div><p className="text-sm text-muted-foreground">Status</p><Badge variant={product.isActive === false ? "secondary" : "default"}>{product.isActive === false ? "Nonaktif" : "Aktif"}</Badge></div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Data produk tidak ditemukan atau API belum tersedia.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
