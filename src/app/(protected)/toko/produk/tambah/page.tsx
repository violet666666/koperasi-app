"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, Package, ImagePlus, X } from "lucide-react";
import { useSession } from "next-auth/react";

export default function TambahProdukPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const unitType = session?.user?.unitType as string || "toko";
    const isResto = ["resto_cafe", "resto", "coffe_latar"].includes(unitType);
    const productUnitType = isResto ? "resto" : unitType;
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [form, setForm] = React.useState({
        sku: "",
        name: "",
        category: "",
        costPrice: "",
        sellPrice: "",
        discountType: "none",
        discountValue: "",
        stock: "",
        stockGdg: "",
        stockToko: "",
        minStock: "5",
        unit: "pcs",
        imageUrl: "",
    });
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 1 * 1024 * 1024) { toast.error("Ukuran gambar maksimal 1MB"); return; }
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setForm(prev => ({ ...prev, imageUrl: base64 }));
            setImagePreview(base64);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setForm(prev => ({ ...prev, imageUrl: "" }));
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Kategori yang dikecualikan dari auto-calculate (harga manual)
    const MANUAL_PRICE_CATEGORIES = ["rokok"];
    const isManualPriceCategory = MANUAL_PRICE_CATEGORIES.includes(form.category.toLowerCase());

    const handleChange = (field: string, value: string) => {
        setForm(prev => {
            const next = { ...prev, [field]: value };
            // Skip auto-calculate untuk kategori rokok (harga manual/HET)
            const categoryToCheck = field === "category" ? value : prev.category;
            const skipAutoCalc = MANUAL_PRICE_CATEGORIES.includes(categoryToCheck.toLowerCase());
            if (field === "costPrice" && value !== "" && !skipAutoCalc) {
                const cost = parseFloat(value) || 0;
                // Formula: ceil((HPP * 1.02 * 1.11) / 100) * 100
                const calculated = Math.ceil((cost * 1.02 * 1.11) / 100) * 100;
                next.sellPrice = calculated.toString();
            }
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.sku || !form.name || !form.sellPrice) {
            toast.error("SKU, Nama Produk, dan Harga Jual wajib diisi");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/toko/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sku: form.sku,
                    name: form.name,
                    category: form.category || null,
                    costPrice: parseFloat(form.costPrice) || 0,
                    sellPrice: parseFloat(form.sellPrice),
                    discountType: form.discountType !== "none" ? form.discountType : null,
                    discountValue: parseFloat(form.discountValue) || 0,
                    stock: (parseInt(form.stockGdg) || 0) + (parseInt(form.stockToko) || 0), // Selalu hitung dari Gdg + Toko
                    stockGdg: parseInt(form.stockGdg) || 0,
                    stockToko: parseInt(form.stockToko) || 0,
                    minStock: parseInt(form.minStock) || 5,
                    unit: form.unit || "pcs",
                    imageUrl: form.imageUrl || null,
                    unitType: productUnitType,
                }),
            });

            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal menambahkan produk");
                return;
            }

            toast.success("Produk berhasil ditambahkan!");
            router.push("/toko/produk");
        } catch (error) {
            console.error("Submit error:", error);
            toast.error("Gagal menambahkan produk");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title={isResto ? "Tambah Menu" : `Tambah ${unitType === "toko" ? "Produk" : "Layanan/Produk"}`}
                description={isResto ? "Tambah menu baru ke daftar menu Resto" : `Tambah item baru untuk unit ${unitType.replace(/_/g, " ")}`}
                backHref="/toko/produk"
            />

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Informasi Produk
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="sku">SKU / Kode Produk <span className="text-red-500">*</span></Label>
                                <Input id="sku" placeholder="Contoh: atau Scan Barcode di sini..." value={form.sku}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            document.getElementById('name')?.focus();
                                        }
                                    }}
                                    onChange={e => handleChange("sku", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Produk <span className="text-red-500">*</span></Label>
                                <Input id="name" placeholder="Contoh: Beras Premium 5kg" value={form.name}
                                    onChange={e => handleChange("name", e.target.value)} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="category">Kategori</Label>
                                <Select value={form.category} onValueChange={v => handleChange("category", v)}>
                                    <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="makanan">Makanan</SelectItem>
                                        <SelectItem value="minuman">Minuman</SelectItem>
                                        <SelectItem value="sembako">Sembako</SelectItem>
                                        <SelectItem value="rokok">🚬 Rokok</SelectItem>
                                        <SelectItem value="atk">ATK</SelectItem>
                                        <SelectItem value="elektronik">Elektronik</SelectItem>
                                        <SelectItem value="lainnya">Lainnya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="unit">Satuan</Label>
                                <Select value={form.unit} onValueChange={v => handleChange("unit", v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pcs">Pcs</SelectItem>
                                        <SelectItem value="kg">Kg</SelectItem>
                                        <SelectItem value="liter">Liter</SelectItem>
                                        <SelectItem value="pack">Pack</SelectItem>
                                        <SelectItem value="box">Box</SelectItem>
                                        <SelectItem value="lusin">Lusin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="costPrice">Harga Beli (Modal / HPP)</Label>
                                <Input id="costPrice" type="number" min={0} placeholder="0"
                                    value={form.costPrice} onChange={e => handleChange("costPrice", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sellPrice">Harga Jual Rak <span className="text-red-500">*</span></Label>
                                <Input id="sellPrice" type="number" min={0} placeholder="0"
                                    value={form.sellPrice} onChange={e => handleChange("sellPrice", e.target.value)} />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {isManualPriceCategory
                                        ? "⚠️ Kategori Rokok: Harga jual diisi MANUAL (tidak auto-calculate)"
                                        : "Include PPN 11% & Markup 2%. (Auto Dibundel saat HPP diisi)"}
                                </p>
                            </div>
                        </div>

                        {/* Diskon Section */}
                        <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg border bg-muted/20">
                            <div className="space-y-2">
                                <Label htmlFor="discountType">Diskon Kasir (Marketing)</Label>
                                <Select value={form.discountType} onValueChange={v => handleChange("discountType", v)}>
                                    <SelectTrigger><SelectValue placeholder="Tidak Ada Diskon" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Tidak Ada Diskon</SelectItem>
                                        <SelectItem value="percent">Persentase (%)</SelectItem>
                                        <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {form.discountType !== "none" && (
                                <div className="space-y-2">
                                    <Label htmlFor="discountValue">
                                        Nilai Diskon {form.discountType === "percent" ? "(%)" : "(Rp)"}
                                    </Label>
                                    <Input id="discountValue" type="number" min={0} placeholder="0"
                                        value={form.discountValue} onChange={e => handleChange("discountValue", e.target.value)} />
                                    {form.sellPrice && form.discountValue && (
                                        <p className="text-[10px] text-emerald-600 font-medium mt-1">
                                            Harga setelah diskon: Rp {
                                                form.discountType === "percent" 
                                                    ? Math.round(Number(form.sellPrice) * (1 - (Number(form.discountValue) / 100))).toLocaleString("id-ID")
                                                    : Math.max(0, Number(form.sellPrice) - Number(form.discountValue)).toLocaleString("id-ID")
                                            }
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>


                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="stockGdg">Stock Gdg</Label>
                                <Input id="stockGdg" type="number" min={0} placeholder="0"
                                    value={form.stockGdg} onChange={e => handleChange("stockGdg", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stockToko">Stock Toko</Label>
                                <Input id="stockToko" type="number" min={0} placeholder="0"
                                    value={form.stockToko} onChange={e => handleChange("stockToko", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stock">Total Stock</Label>
                                <Input id="stock" type="number" min={0} placeholder="0"
                                    value={form.stock} onChange={e => handleChange("stock", e.target.value)} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="minStock">Min. Stock (Alert)</Label>
                                <Input id="minStock" type="number" min={0} placeholder="5"
                                    value={form.minStock} onChange={e => handleChange("minStock", e.target.value)} />
                            </div>
                        </div>

                        {/* Gambar Menu */}
                        <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                            <Label className="text-sm font-semibold">Gambar Menu (Opsional)</Label>
                            <p className="text-xs text-muted-foreground -mt-1">Upload foto produk/menu untuk ditampilkan di POS Kasir. Maks 1MB.</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                className="hidden"
                                onChange={handleImageSelect}
                            />
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

                        <div className="flex gap-4 pt-4">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Simpan Produk
                            </Button>
                            <Button type="button" variant="outline" onClick={() => router.push("/toko/produk")}>
                                Batal
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
