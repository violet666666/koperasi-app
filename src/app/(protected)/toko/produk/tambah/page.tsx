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
import { Loader2, Save, Package } from "lucide-react";

export default function TambahProdukPage() {
    const router = useRouter();
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
    });

    const handleChange = (field: string, value: string) => {
        setForm(prev => {
            const next = { ...prev, [field]: value };
            if (field === "costPrice" && value !== "") {
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
                title="Tambah Produk"
                description="Tambah produk baru ke toko PRIMKOPPOL"
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
                                    Include PPN 11% & Markup 2%. (Auto Dibundel saat HPP diisi)
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
