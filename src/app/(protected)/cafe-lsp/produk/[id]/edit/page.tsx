"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import FbMenuForm from "@/components/forms/fb-menu-form";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

export default function CafeLspEditMenuPage() {
    const { id } = useParams();
    const { data: session } = useSession();
    const unitType = (session?.user as any)?.unitType || "cafe_lsp";
    const [product, setProduct] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!id) return;
        fetch(`/api/toko/products/${id}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.data) setProduct(json.data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!product) {
        return <div className="text-center py-20 text-muted-foreground">Menu tidak ditemukan</div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Edit Menu"
                description={`Mengedit: ${product.name}`}
                backHref="/cafe-lsp/produk"
            />
            <FbMenuForm unitType={unitType} backHref="/cafe-lsp/produk" editProduct={product} />
        </div>
    );
}
