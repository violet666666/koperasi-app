"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Package, ChefHat, ImagePlus, X, Palette } from "lucide-react";

interface Category {
    id: number;
    name: string;
    sortOrder: number;
}

interface FbMenuFormProps {
    unitType: string;
    backHref: string;
    editProduct?: any;
}

const TAX_OPTIONS = [
    { value: "inclusive", label: "Termasuk PPN (Harga sudah termasuk pajak)" },
    { value: "exclusive", label: "Belum Termasuk PPN (Pajak ditambahkan saat transaksi)" },
    { value: "none", label: "Tanpa PPN" },
] as const;

export default function FbMenuForm({ unitType, backHref, editProduct }: FbMenuFormProps) {
    const router = useRouter();
    const isEdit = !!editProduct;
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [categories, setCategories] = React.useState<Category[]>([]);

    const [form, setForm] = React.useState({
        sku: editProduct?.sku || "",
        name: editProduct?.name || "",
        categoryId: editProduct?.categoryId?.toString() || "",
        description: "",
        imageUrl: editProduct?.imageUrl || "",
        menuType: editProduct?.menuType || "inventory",
        costPrice: editProduct?.costPrice ? String(editProduct.costPrice) : "",
        sellPrice: editProduct?.sellPrice ? String(editProduct.sellPrice) : "",
        taxType: editProduct?.taxType || "inclusive",
        taxRate: editProduct?.taxRate ? String(editProduct.taxRate) : "11",
        variantGroupId: editProduct?.variantGroupId || "",
        posColor: editProduct?.posColor || "",
        unit: editProduct?.unit || "pcs",
        isActive: editProduct?.isActive ?? true,
        stockGdg: editProduct?.stockGdg ? String(editProduct.stockGdg) : "0",
        stockToko: editProduct?.stockToko ? String(editProduct.stockToko) : "0",
        minStock: editProduct?.minStock ? String(editProduct.minStock) : "0",
    });

    const [imagePreview, setImagePreview] = React.useState<string | null>(
        editProduct?.imageUrl || null
    );
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const isKitchen = form.menuType === "kitchen";

    // Fetch F&B categories from StoreCategory API
    React.useEffect(() => {
        fetch(`/api/toko/products/categories?unitType=${unitType}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.data) setCategories(data.data);
            })
            .catch(() => {});
    }, [unitType]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 1 * 1024 * 1024) {
            toast.error("Ukuran gambar maksimal 1MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setForm((prev) => ({ ...prev, imageUrl: base64 }));
            setImagePreview(base64);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setForm((prev) => ({ ...prev, imageUrl: "" }));
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.name.trim()) {
            toast.error("Nama Menu wajib diisi");
            return;
        }

        const sellPriceNum = parseFloat(form.sellPrice);
        if (!form.sellPrice || isNaN(sellPriceNum) || sellPriceNum < 0) {
            toast.error("Harga Jual harus berupa angka yang valid");
            return;
        }

        const selectedCat = categories.find((c) => c.id.toString() === form.categoryId);

        setIsSubmitting(true);
        try {
            const stockGdgVal = parseInt(form.stockGdg) || 0;
            const stockTokoVal = parseInt(form.stockToko) || 0;

            const payload: Record<string, unknown> = {
                sku: form.sku.trim() || `MENU-${Date.now()}`,
                name: form.name.trim(),
                category: selectedCat?.name || null,
                categoryId: form.categoryId ? parseInt(form.categoryId) : null,
                costPrice: parseFloat(form.costPrice) || 0,
                sellPrice: sellPriceNum,
                unit: form.unit || "pcs",
                imageUrl: form.imageUrl || null,
                unitType,
                productType: "finished",
                menuType: form.menuType,
                trackStock: !isKitchen,
                taxType: form.taxType,
                taxRate: parseFloat(form.taxRate) || 11,
                posColor: form.posColor || null,
                variantGroupId: form.variantGroupId.trim() || null,
                isActive: form.isActive,
            };

            if (isKitchen) {
                payload.stock = 0;
                payload.stockGdg = 0;
                payload.stockToko = 0;
                payload.minStock = 0;
            } else {
                payload.stock = stockGdgVal + stockTokoVal;
                payload.stockGdg = stockGdgVal;
                payload.stockToko = stockTokoVal;
                payload.minStock = parseInt(form.minStock) || 0;
            }

            const url = isEdit ? `/api/toko/products/${editProduct.id}` : "/api/toko/products";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal menyimpan menu");
                return;
            }

            toast.success(isEdit ? "Menu berhasil diperbarui!" : "Menu berhasil ditambahkan!");
            router.push(backHref);
        } catch (error) {
            console.error("Submit error:", error);
            toast.error("Gagal menyimpan menu. Periksa koneksi internet Anda.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* Section A: Info Menu */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Informasi Menu
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Menu <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                placeholder="Contoh: Kopi Latte"
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sku">SKU / Kode Menu</Label>
                            <Input
                                id="sku"
                                placeholder="Auto-generated jika kosong"
                                value={form.sku}
                                onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="categoryId">Kategori</Label>
                            <Select
                                value={form.categoryId}
                                onValueChange={(v) => setForm((p) => ({ ...p, categoryId: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id.toString()}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unit">Satuan</Label>
                            <Select
                                value={form.unit}
                                onValueChange={(v) => setForm((p) => ({ ...p, unit: v }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pcs">Pcs</SelectItem>
                                    <SelectItem value="cup">Cup</SelectItem>
                                    <SelectItem value="glass">Glass</SelectItem>
                                    <SelectItem value="plate">Plate</SelectItem>
                                    <SelectItem value="bowl">Bowl</SelectItem>
                                    <SelectItem value="portion">Portion</SelectItem>
                                    <SelectItem value="bottle">Bottle</SelectItem>
                                    <SelectItem value="pack">Pack</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Deskripsi (Opsional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Deskripsi singkat menu..."
                            value={form.description}
                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            rows={2}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Section B: Jenis Menu */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ChefHat className="h-5 w-5" />
                        Jenis Menu
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, menuType: "inventory" }))}
                            className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                                !isKitchen
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                            <div className="font-semibold">Produk Inventaris</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Stok di-track, berkurang saat transaksi
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, menuType: "kitchen" }))}
                            className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                                isKitchen
                                    ? "border-orange-500 bg-orange-50"
                                    : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                            <div className="font-semibold">Menu Dapur</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Tanpa tracking stok, toggle Available / 86&apos;d
                            </div>
                        </button>
                    </div>

                    {isKitchen && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                            <div>
                                <Label className="font-medium">Status Ketersediaan</Label>
                                <p className="text-sm text-muted-foreground">
                                    {form.isActive ? "Available — bisa dipesan" : "86'd (Sold Out) — tidak bisa dipesan"}
                                </p>
                            </div>
                            <Switch
                                checked={form.isActive}
                                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                            />
                        </div>
                    )}

                    {!isKitchen && (
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="stockGdg">Stock Gdg</Label>
                                <Input id="stockGdg" type="number" min={0} value={form.stockGdg}
                                    onChange={(e) => setForm((p) => ({ ...p, stockGdg: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stockToko">Stock Toko</Label>
                                <Input id="stockToko" type="number" min={0} value={form.stockToko}
                                    onChange={(e) => setForm((p) => ({ ...p, stockToko: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="minStock">Min. Stock</Label>
                                <Input id="minStock" type="number" min={0} value={form.minStock}
                                    onChange={(e) => setForm((p) => ({ ...p, minStock: e.target.value }))} />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Section C: Harga & Pajak */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-lg">Harga & Pajak</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="costPrice">HPP (Harga Pokok)</Label>
                            <Input id="costPrice" type="number" min={0} placeholder="0" value={form.costPrice}
                                onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sellPrice">Harga Jual <span className="text-red-500">*</span></Label>
                            <Input id="sellPrice" type="number" min={0} placeholder="0" value={form.sellPrice}
                                onChange={(e) => setForm((p) => ({ ...p, sellPrice: e.target.value }))} />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="taxType">Pengaturan Pajak</Label>
                            <Select value={form.taxType} onValueChange={(v) => setForm((p) => ({ ...p, taxType: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TAX_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="taxRate">Tarif PPN (%)</Label>
                            <Input id="taxRate" type="number" min={0} max={100} step="0.1" value={form.taxRate}
                                onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value }))} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Section D: Varian */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-lg">Varian (Opsional)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="variantGroupId">Grup Varian</Label>
                        <Input id="variantGroupId" placeholder='Contoh: "latte" untuk grup Latte S/M/L'
                            value={form.variantGroupId}
                            onChange={(e) => setForm((p) => ({ ...p, variantGroupId: e.target.value }))} />
                        <p className="text-xs text-muted-foreground">
                            Produk dengan grup varian yang sama akan ditampilkan bersama di POS
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Section E: Tampilan POS */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Tampilan POS
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Warna di POS</Label>
                            <div className="flex gap-2 items-center">
                                <input type="color" value={form.posColor || "#6366f1"}
                                    onChange={(e) => setForm((p) => ({ ...p, posColor: e.target.value }))}
                                    className="h-10 w-14 rounded border cursor-pointer" />
                                <Input placeholder="#FF5722" value={form.posColor}
                                    onChange={(e) => setForm((p) => ({ ...p, posColor: e.target.value }))}
                                    className="flex-1" />
                                {form.posColor && (
                                    <button type="button"
                                        onClick={() => setForm((p) => ({ ...p, posColor: "" }))}
                                        className="text-muted-foreground hover:text-foreground">
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                        <Label className="text-sm font-semibold">Foto Menu (Opsional)</Label>
                        <p className="text-xs text-muted-foreground -mt-1">Upload foto menu untuk ditampilkan di POS. Maks 1MB.</p>
                        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden" onChange={handleImageSelect} />
                        {imagePreview ? (
                            <div className="relative w-40 h-28 rounded-lg overflow-hidden border-2 border-sky-200 shadow-sm">
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                <button type="button" onClick={removeImage}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors shadow">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                className="w-40 h-28 rounded-lg border-2 border-dashed border-slate-300 hover:border-sky-400 transition-colors flex flex-col items-center justify-center text-slate-400 hover:text-sky-600">
                                <ImagePlus className="h-8 w-8 mb-1" />
                                <span className="text-xs font-medium">Upload Foto</span>
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-4 pt-6">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isEdit ? "Simpan Perubahan" : "Tambah Menu"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
                    Batal
                </Button>
            </div>
        </form>
    );
}
