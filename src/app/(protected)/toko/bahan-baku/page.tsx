"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Plus, Search, Pencil, Trash2, Package, FlaskConical, Coffee, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Ingredient {
    id: number;
    sku: string;
    name: string;
    category: string | null;
    unit: string;
    stock: number;
    stockGdg: number;
    stockToko: number;
    minStock: number;
    costPrice: number;
    unitType: string;
}

const UNIT_OPTIONS = [
    { value: "gr", label: "Gram (gr)" },
    { value: "ml", label: "Milliliter (ml)" },
    { value: "pcs", label: "Pieces (pcs)" },
];

const CATEGORY_OPTIONS = ["Syrup", "Base", "Powder", "Coffee", "Other"];

function convertToBaseUnit(quantity: number, unit: string): { quantity: number; baseUnit: string } {
    const conversions: Record<string, { factor: number; baseUnit: string }> = {
        kg: { factor: 1000, baseUnit: "gr" },
        ltr: { factor: 1000, baseUnit: "ml" },
    };
    const conv = conversions[unit.toLowerCase()];
    if (conv) return { quantity: Math.round(quantity * conv.factor), baseUnit: conv.baseUnit };
    return { quantity, baseUnit: unit };
}

export default function TokoBahanBakuPage() {
    const { data: session } = useSession();
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Ingredient | null>(null);
    const [form, setForm] = useState({ name: "", sku: "", unit: "gr", costPrice: "", minStock: "100", category: "Other" });
    const [saving, setSaving] = useState(false);
    const [cupEstimates, setCupEstimates] = useState<{ productName: string; cups: number; limitIngredient: string }[]>([]);

    const unitType = session?.user?.unitType === "resto_cafe" ? "resto" : session?.user?.unitType || "toko";

    const fetchIngredients = useCallback(async () => {
        try {
            const params = new URLSearchParams({ productType: "ingredient", unitType, perPage: "200" });
            if (search) params.set("search", search);
            if (categoryFilter !== "all") params.set("category", categoryFilter);
            const res = await fetch(`/api/toko/products?${params}`);
            if (res.ok) {
                const data = await res.json();
                setIngredients(data.products || data.data || []);
            }
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, [unitType, search, categoryFilter]);

    useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

    useEffect(() => {
        if (ingredients.length === 0) return;
        const fetchCupEstimates = async () => {
            try {
                const params = new URLSearchParams({ unitType, perPage: "200", productType: "finished" });
                const res = await fetch(`/api/toko/products?${params}`);
                if (!res.ok) return;
                const data = await res.json();
                const products = data.products || data.data || [];
                const racikanProducts = products.filter((p: any) => p.trackStock === false);
                const estimates: { productName: string; cups: number; limitIngredient: string }[] = [];

                for (const product of racikanProducts) {
                    const recipeRes = await fetch(`/api/toko/products/${product.id}/recipe`);
                    if (!recipeRes.ok) continue;
                    const recipeJson = await recipeRes.json();
                    const linkedRecipes = (recipeJson.data || []).filter((r: any) => r.ingredientProductId);
                    if (linkedRecipes.length === 0) continue;

                    let minCups = Infinity;
                    let limitIng = "";
                    for (const recipe of linkedRecipes) {
                        const ingredient = ingredients.find((i: any) => i.id === recipe.ingredientProductId);
                        if (!ingredient) continue;
                        const available = ingredient.stockGdg;
                        const needed = Number(recipe.quantity);
                        if (needed <= 0) continue;
                        const possibleCups = Math.floor(available / needed);
                        if (possibleCups < minCups) {
                            minCups = possibleCups;
                            limitIng = ingredient.name;
                        }
                    }
                    if (minCups !== Infinity) {
                        estimates.push({ productName: product.name, cups: minCups, limitIngredient: limitIng });
                    }
                }
                setCupEstimates(estimates.sort((a, b) => a.cups - b.cups));
            } catch { /* ignore */ }
        };
        fetchCupEstimates();
    }, [ingredients, unitType]);

    const openAdd = () => {
        setEditing(null);
        setForm({ name: "", sku: `RM-${unitType.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`, unit: "gr", costPrice: "", minStock: "100", category: "Other" });
        setDialogOpen(true);
    };

    const openEdit = (ing: Ingredient) => {
        setEditing(ing);
        setForm({ name: ing.name, sku: ing.sku, unit: ing.unit, costPrice: String(ing.costPrice), minStock: String(ing.minStock), category: ing.category || "Other" });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.sku) return;
        setSaving(true);
        try {
            const converted = convertToBaseUnit(1, form.unit);
            const body = {
                name: form.name,
                sku: form.sku,
                unit: converted.baseUnit,
                costPrice: Number(form.costPrice) || 0,
                minStock: Number(form.minStock) || 100,
                category: form.category,
                unitType,
                productType: "ingredient",
                trackStock: true,
                isService: false,
                sellPrice: 0,
                stock: 0,
                stockGdg: 0,
                stockToko: 0,
            };

            if (editing) {
                const res = await fetch(`/api/toko/products/${editing.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
            } else {
                const res = await fetch("/api/toko/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
            }
            setDialogOpen(false);
            fetchIngredients();
        } catch (err: any) {
            alert(err.message || "Gagal menyimpan");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (ing: Ingredient) => {
        if (!confirm(`Hapus bahan baku "${ing.name}"?`)) return;
        try {
            await fetch(`/api/toko/products/${ing.id}`, { method: "DELETE" });
            fetchIngredients();
        } catch { /* ignore */ }
    };

    const isFnB = ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"].includes(unitType);
    if (!isFnB) return <div className="p-6 text-center text-muted-foreground">Fitur ini hanya untuk unit F&B</div>;

    const lowStockCount = ingredients.filter(i => i.stockGdg <= i.minStock).length;

    return (
        <div className="p-4 md:p-6 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                        <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-1.5">
                            <FlaskConical className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                        </div>
                        Bahan Baku
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Kelola stok bahan baku untuk produk racikan</p>
                </div>
                <Button onClick={openAdd} size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Tambah
                </Button>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Cari bahan baku..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Kategori" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua</SelectItem>
                        {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* Stats summary */}
            {!loading && ingredients.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-lg font-bold">{ingredients.length}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-lg font-bold text-emerald-600">{ingredients.filter(i => i.stockGdg > i.minStock).length}</p>
                        <p className="text-xs text-muted-foreground">Aman</p>
                    </div>
                    <div className={`rounded-lg border p-3 text-center ${lowStockCount > 0 ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800" : "bg-card"}`}>
                        <p className={`text-lg font-bold ${lowStockCount > 0 ? "text-red-600" : "text-emerald-600"}`}>{lowStockCount}</p>
                        <p className="text-xs text-muted-foreground">Stok Rendah</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
            ) : ingredients.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <div className="rounded-full bg-muted p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                        <FlaskConical className="h-8 w-8 opacity-40" />
                    </div>
                    <p className="font-medium">Belum ada bahan baku</p>
                    <p className="text-xs mt-1">Klik &ldquo;Tambah&rdquo; untuk menambahkan bahan baku pertama</p>
                </div>
            ) : (
                <>
                    {/* Mobile: Card layout */}
                    <div className="sm:hidden space-y-2">
                        {ingredients.map((ing) => {
                            const isLow = ing.stockGdg <= ing.minStock;
                            return (
                                <div key={ing.id} className={`rounded-lg border p-3 space-y-2 transition-colors ${isLow ? "border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/50" : "bg-card"}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{ing.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {ing.category && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{ing.category}</span>}
                                                <span className="text-[10px] text-muted-foreground">{ing.unit}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0 ml-2">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ing)}><Pencil className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(ing)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <span className={`text-sm font-bold tabular-nums ${isLow ? "text-red-600" : ""}`}>
                                                {ing.stockGdg}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{ing.unit}</span>
                                            {isLow && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            Rp{Number(ing.costPrice).toLocaleString("id-ID")}/{ing.unit}
                                        </span>
                                    </div>
                                    {isLow && (
                                        <div className="text-[10px] text-red-600 dark:text-red-400">
                                            Di bawah minimum stok ({ing.minStock} {ing.unit})
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop: Table layout */}
                    <div className="hidden sm:block rounded-lg border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left p-3 font-medium">Nama</th>
                                    <th className="text-left p-3 font-medium hidden md:table-cell">SKU</th>
                                    <th className="text-left p-3 font-medium hidden lg:table-cell">Kategori</th>
                                    <th className="text-left p-3 font-medium">Satuan</th>
                                    <th className="text-right p-3 font-medium">Stok Gudang</th>
                                    <th className="text-right p-3 font-medium hidden md:table-cell">Min</th>
                                    <th className="text-right p-3 font-medium">HPP/Unit</th>
                                    <th className="text-right p-3 font-medium">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {ingredients.map((ing) => {
                                    const isLow = ing.stockGdg <= ing.minStock;
                                    return (
                                        <tr key={ing.id} className={`hover:bg-muted/30 ${isLow ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                                            <td className="p-3">
                                                <div className="font-medium">{ing.name}</div>
                                            </td>
                                            <td className="p-3 text-muted-foreground text-xs font-mono hidden md:table-cell">{ing.sku}</td>
                                            <td className="p-3 hidden lg:table-cell">
                                                {ing.category && <span className="text-xs bg-muted px-2 py-0.5 rounded">{ing.category}</span>}
                                            </td>
                                            <td className="p-3 text-xs">{ing.unit}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isLow && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                                    <span className={`font-mono ${isLow ? "text-red-600 font-bold" : ""}`}>
                                                        {ing.stockGdg}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right text-muted-foreground text-xs hidden md:table-cell">{ing.minStock}</td>
                                            <td className="p-3 text-right text-xs">Rp{Number(ing.costPrice).toLocaleString("id-ID")}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ing)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(ing)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Cup Estimation */}
            {cupEstimates.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2.5 border-b bg-amber-50/50 dark:bg-amber-950/20 flex items-center gap-2">
                        <Coffee className="h-4 w-4 text-amber-600" />
                        <h2 className="text-sm font-semibold">Estimasi Sisa Cup</h2>
                    </div>
                    <div className="divide-y max-h-[280px] overflow-y-auto">
                        {cupEstimates.map((est) => (
                            <div key={est.productName} className="flex items-center justify-between px-3 py-2.5 gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{est.productName}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">limit: {est.limitIngredient}</p>
                                </div>
                                <div className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                                    est.cups <= 10 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : est.cups <= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                }`}>
                                    ~{est.cups}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Low Stock Alert */}
            {lowStockCount > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Stok Menipis ({lowStockCount})</h2>
                    </div>
                    <div className="divide-y divide-red-100 dark:divide-red-900/50">
                        {ingredients.filter(i => i.stockGdg <= i.minStock).map((ing) => (
                            <div key={ing.id} className="flex items-center justify-between px-3 py-2 gap-2">
                                <span className="text-sm truncate">{ing.name}</span>
                                <span className="text-xs font-bold text-red-600 tabular-nums shrink-0">
                                    {ing.stockGdg}/{ing.minStock} {ing.unit}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit" : "Tambah"} Bahan Baku</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Biji Kopi Arabika" /></div>
                        <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Satuan</Label>
                                <Select value={form.unit} onValueChange={(v) => setForm(f => ({ ...f, unit: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {UNIT_OPTIONS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Kategori</Label>
                                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>HPP per Unit (Rp)</Label><Input type="number" value={form.costPrice} onChange={(e) => setForm(f => ({ ...f, costPrice: e.target.value }))} /></div>
                            <div><Label>Min Stok</Label><Input type="number" value={form.minStock} onChange={(e) => setForm(f => ({ ...f, minStock: e.target.value }))} /></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
