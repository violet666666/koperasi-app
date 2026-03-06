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
                const res = await fetch(`/api/shop/products/${productId}`);
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
            <PageHeader title={product?.name || `Produk #${productId}`} description="Detail produk toko koperasi" backHref="/toko/produk" />
            <Card>
                <CardHeader>
                    <CardTitle>{product?.name || "Produk"}</CardTitle>
                </CardHeader>
                <CardContent>
                    {product ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div><p className="text-sm text-muted-foreground">Kode</p><p className="font-medium">{product.code}</p></div>
                            <div><p className="text-sm text-muted-foreground">Harga</p><p className="font-medium">Rp {Number(product.price).toLocaleString("id-ID")}</p></div>
                            <div><p className="text-sm text-muted-foreground">Stok</p><p className="font-medium">{product.stock}</p></div>
                            <div><p className="text-sm text-muted-foreground">Status</p><Badge variant={product.isActive ? "default" : "secondary"}>{product.isActive ? "Aktif" : "Nonaktif"}</Badge></div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Data produk tidak ditemukan atau API belum tersedia.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
