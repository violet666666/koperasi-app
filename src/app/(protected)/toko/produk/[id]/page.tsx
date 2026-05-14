"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as React from "react";
import { Camera, ImagePlus, Loader2, X, Package } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

export default function DetailProdukPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const productId = params.id;
    const isKasir = session?.user?.role === "kasir";
    const [product, setProduct] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // Image edit state
    const [showImageDialog, setShowImageDialog] = React.useState(false);
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const [imageFile, setImageFile] = React.useState("");
    const [isImageSaving, setIsImageSaving] = React.useState(false);
    const imageFileInputRef = React.useRef<HTMLInputElement>(null);

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

    const openImageDialog = () => {
        setImagePreview(product?.imageUrl || null);
        setImageFile("");
        setShowImageDialog(true);
    };

    const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 1 * 1024 * 1024) { toast.error("Ukuran gambar maksimal 1MB"); return; }
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setImageFile(base64);
            setImagePreview(base64);
        };
        reader.readAsDataURL(file);
    };

    const removeImagePreview = () => {
        setImageFile("");
        setImagePreview(null);
        if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    };

    const saveImage = async () => {
        setIsImageSaving(true);
        try {
            const imageUrlValue = imageFile === "REMOVE" ? null : (imageFile || null);
            const res = await fetch(`/api/toko/products/${productId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl: imageUrlValue }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal menyimpan gambar"); return; }
            toast.success(imageUrlValue ? "Gambar berhasil diperbarui" : "Gambar berhasil dihapus");
            setProduct((prev: any) => ({ ...prev, imageUrl: imageUrlValue }));
            setShowImageDialog(false);
        } catch {
            toast.error("Gagal menyimpan gambar");
        } finally {
            setIsImageSaving(false);
        }
    };

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
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {product?.name || "Produk"}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {product ? (
                        <div className="space-y-6">
                            {/* Image Section */}
                            <div className="flex flex-col sm:flex-row gap-4 items-start">
                                <div className="relative group">
                                    {product.imageUrl ? (
                                        <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
                                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                            {!isKasir && (
                                                <button onClick={openImageDialog}
                                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Camera className="h-6 w-6 text-white" />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        !isKasir ? (
                                            <button onClick={openImageDialog}
                                                className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors flex flex-col items-center justify-center text-slate-400 hover:text-blue-600">
                                                <ImagePlus className="h-8 w-8 mb-1" />
                                                <span className="text-xs font-medium">Tambah Foto</span>
                                            </button>
                                        ) : (
                                            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl bg-muted flex items-center justify-center">
                                                <Package className="h-10 w-10 text-muted-foreground" />
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Product Info */}
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
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Data produk tidak ditemukan atau API belum tersedia.</p>
                    )}
                </CardContent>
            </Card>

            {/* Image Edit Dialog */}
            <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-blue-500" />
                            Gambar Menu
                        </DialogTitle>
                        <DialogDescription>
                            {product?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <input
                            ref={imageFileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={handleImageFileSelect}
                        />
                        {imagePreview ? (
                            <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-blue-200 shadow-sm">
                                <img src={imagePreview} alt={product?.name} className="w-full h-full object-cover" />
                                <button type="button" onClick={removeImagePreview}
                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => imageFileInputRef.current?.click()}
                                className="w-full h-48 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors flex flex-col items-center justify-center text-slate-400 hover:text-blue-600">
                                <ImagePlus className="h-10 w-10 mb-2" />
                                <span className="text-sm font-medium">Upload Gambar</span>
                                <span className="text-xs mt-1">PNG, JPG, WebP (maks 1MB)</span>
                            </button>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowImageDialog(false)}>Batal</Button>
                        {imagePreview && imageFile === "" && (
                            <Button variant="destructive" onClick={async () => {
                                setImageFile("REMOVE");
                                setImagePreview(null);
                                if (imageFileInputRef.current) imageFileInputRef.current.value = "";
                            }} disabled={isImageSaving}>
                                Hapus Gambar
                            </Button>
                        )}
                        <Button onClick={saveImage} disabled={isImageSaving || (!imageFile && !imagePreview)}>
                            {isImageSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {imageFile === "REMOVE" ? "Hapus Gambar" : imageFile && imageFile !== "REMOVE" ? "Simpan Gambar" : "Simpan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
