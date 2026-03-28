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
        stock: "",
        stockGdg: "",
        stockToko: "",
        minStock: "5",
        unit: "pcs",
    });

    const handleChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
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
                    stock: parseInt(form.stock) || ((parseInt(form.stockGdg) || 0) + (parseInt(form.stockToko) || 0)),
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
                description="Tambah produk baru ke toko koperasi"
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
                                <Input id="sku" placeholder="Contoh: BRS-001" value={form.sku}
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
                                <Label htmlFor="costPrice">Harga Beli (Modal)</Label>
                                <Input id="costPrice" type="number" min={0} placeholder="0"
                                    value={form.costPrice} onChange={e => handleChange("costPrice", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sellPrice">Harga Jual <span className="text-red-500">*</span></Label>
                                <Input id="sellPrice" type="number" min={0} placeholder="0"
                                    value={form.sellPrice} onChange={e => handleChange("sellPrice", e.target.value)} />
                            </div>
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
