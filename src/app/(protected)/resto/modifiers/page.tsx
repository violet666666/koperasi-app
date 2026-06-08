"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Plus, Trash2, Save, Loader2, GripVertical, Settings2,
    ChevronDown, ChevronUp, X, ToggleLeft, ToggleRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import type { ModifierGroup, ModifierOption } from "@/lib/modifiers";
import { getDefaultModifierGroup, getDefaultModifierOption, validateModifierGroup } from "@/lib/modifiers";

interface Product { id: number; name: string; price: number; category?: string; }

export default function ModifiersAdminPage() {
    const [products, setProducts] = React.useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
    const [groups, setGroups] = React.useState<ModifierGroup[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDirty, setIsDirty] = React.useState(false);
    const [editOption, setEditOption] = React.useState<{ groupIdx: number; optionIdx: number } | null>(null);

    // Takeaway surcharge config
    const [surchargeEnabled, setSurchargeEnabled] = React.useState(true);
    const [surchargeAmount, setSurchargeAmount] = React.useState(1000);
    const [isSavingSurcharge, setIsSavingSurcharge] = React.useState(false);

    // Load products
    React.useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/toko/products?unitType=resto");
                const json = await res.json();
                setProducts(json.data || []);
            } catch { toast.error("Gagal memuat produk"); } finally { setIsLoading(false); }
        }
        load();
    }, []);

    // Load takeaway surcharge config
    React.useEffect(() => {
        async function loadSurcharge() {
            try {
                const res = await fetch("/api/toko/takeaway-surcharge");
                if (res.ok) {
                    const json = await res.json();
                    setSurchargeEnabled(json.data.enabled);
                    setSurchargeAmount(json.data.amountPerItem);
                }
            } catch { /* non-critical */ }
        }
        loadSurcharge();
    }, []);

    const handleSaveSurcharge = async () => {
        setIsSavingSurcharge(true);
        try {
            const res = await fetch("/api/toko/takeaway-surcharge", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: surchargeEnabled, amountPerItem: surchargeAmount }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success("Pengaturan biaya takeaway disimpan!");
        } catch (error: any) {
            toast.error(error.message || "Gagal menyimpan pengaturan");
        } finally { setIsSavingSurcharge(false); }
    };

    // Load modifiers when product selected
    React.useEffect(() => {
        if (!selectedProduct) return;
        async function load() {
            try {
                const res = await fetch(`/api/toko/modifiers?productId=${selectedProduct.id}`);
                const json = await res.json();
                setGroups(json.groups || []);
                setIsDirty(false);
            } catch { toast.error("Gagal memuat modifier"); }
        }
        load();
    }, [selectedProduct]);

    const handleSave = async () => {
        if (!selectedProduct) return;
        for (const group of groups) {
            const v = validateModifierGroup(group);
            if (!v.valid) {
                toast.error(`Group "${group.name}" tidak valid: ${v.errors[0]}`);
                return;
            }
        }
        setIsSaving(true);
        try {
            const res = await fetch("/api/toko/modifiers", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: selectedProduct.id, groups }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success("Modifier berhasil disimpan!");
            setIsDirty(false);
        } catch (error: any) {
            toast.error(error.message || "Gagal menyimpan modifier");
        } finally { setIsSaving(false); }
    };

    const addGroup = () => {
        setGroups(prev => [...prev, getDefaultModifierGroup()]);
        setIsDirty(true);
    };

    const removeGroup = (idx: number) => {
        setGroups(prev => prev.filter((_, i) => i !== idx));
        setIsDirty(true);
    };

    const updateGroup = (idx: number, updates: Partial<ModifierGroup>) => {
        setGroups(prev => prev.map((g, i) => i === idx ? { ...g, ...updates } : g));
        setIsDirty(true);
    };

    const addOption = (groupIdx: number) => {
        const group = groups[groupIdx];
        const newOption = getDefaultModifierOption();
        newOption.sortOrder = group.options.length;
        updateGroup(groupIdx, { options: [...group.options, newOption] });
    };

    const removeOption = (groupIdx: number, optionIdx: number) => {
        const group = groups[groupIdx];
        updateGroup(groupIdx, { options: group.options.filter((_, i) => i !== optionIdx) });
    };

    const updateOption = (groupIdx: number, optionIdx: number, updates: Partial<ModifierOption>) => {
        const group = groups[groupIdx];
        const newOptions = group.options.map((o, i) => i === optionIdx ? { ...o, ...updates } : o);
        updateGroup(groupIdx, { options: newOptions });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Modifier & Add-on"
                description="Kelola opsi modifier per produk (tingkat pedas, tambah protein, ukuran, dll)"
                actions={
                    selectedProduct && isDirty ? (
                        <Button size="sm" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Simpan Modifier
                        </Button>
                    ) : undefined
                }
            />

            {/* ── Takeaway Surcharge Config ──────────────────────────────── */}
            <Card className="border-orange-200 bg-orange-50/30">
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Settings2 className="h-4 w-4 text-orange-600" />
                            <h3 className="font-semibold text-sm">Biaya Tambahan Takeaway</h3>
                        </div>
                        <button
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${surchargeEnabled ? "bg-orange-500" : "bg-slate-300"}`}
                            onClick={() => setSurchargeEnabled(!surchargeEnabled)}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${surchargeEnabled ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                    </div>
                    {surchargeEnabled && (
                        <div className="flex items-center gap-3">
                            <Label className="text-xs text-slate-500 whitespace-nowrap">Nominal per item</Label>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">Rp</span>
                                <Input
                                    type="number"
                                    className="h-8 w-28 text-sm"
                                    min={0}
                                    step={500}
                                    value={surchargeAmount}
                                    onChange={e => setSurchargeAmount(Number(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    )}
                    <p className="text-[11px] text-slate-400">
                        Berlaku untuk semua pesanan takeaway (T-*). Tidak berlaku untuk dine-in.
                    </p>
                    <Button size="sm" onClick={handleSaveSurcharge} disabled={isSavingSurcharge} className="bg-orange-600 hover:bg-orange-700">
                        {isSavingSurcharge ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Simpan Pengaturan
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Product List */}
                <Card className="lg:max-h-[700px] lg:overflow-hidden">
                    <CardContent className="p-3 sm:p-4">
                        <h3 className="font-semibold mb-3">Pilih Produk</h3>
                        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto lg:max-h-[600px] pb-2 lg:pb-0">
                            {products.map(p => (
                                <button
                                    key={p.id}
                                    className={`shrink-0 lg:shrink lg:w-full text-left px-3 py-2 rounded-lg transition-colors text-sm whitespace-nowrap lg:whitespace-normal ${
                                        selectedProduct?.id === p.id ? "bg-sky-50 border border-sky-200 text-sky-800" : "hover:bg-slate-50 border border-transparent"
                                    }`}
                                    onClick={() => setSelectedProduct(p)}
                                >
                                    <div className="font-medium">{p.name}</div>
                                    <div className="text-xs text-slate-400">{formatCurrency(p.price)} {p.category ? `• ${p.category}` : ""}</div>
                                </button>
                            ))}
                            {products.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-8">Belum ada produk. Tambah menu terlebih dahulu.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Modifier Groups */}
                <div className="lg:col-span-2 space-y-4">
                    {!selectedProduct ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
                                <Settings2 className="h-12 w-12 mb-3 opacity-20" />
                                <p className="font-medium">Pilih produk untuk mengatur modifier</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold">{selectedProduct.name}</h3>
                                    <p className="text-xs text-slate-400">Modifier Groups</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={addGroup}>
                                    <Plus className="h-4 w-4 mr-2" /> Tambah Group
                                </Button>
                            </div>

                            {groups.length === 0 && (
                                <Card>
                                    <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <p className="text-sm">Belum ada modifier group. Klik "Tambah Group" untuk mulai.</p>
                                    </CardContent>
                                </Card>
                            )}

                            {groups.map((group, gIdx) => (
                                <Card key={gIdx}>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Input
                                                placeholder="Nama Group (mis: Tingkat Pedas)"
                                                className="font-semibold"
                                                value={group.name}
                                                onChange={e => updateGroup(gIdx, { name: e.target.value })}
                                            />
                                            <Button size="icon" variant="ghost" className="text-red-500 shrink-0" onClick={() => removeGroup(gIdx)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input type="checkbox" checked={group.isRequired} onChange={e => updateGroup(gIdx, { isRequired: e.target.checked })} className="rounded" />
                                                Wajib dipilih
                                            </label>
                                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input type="checkbox" checked={group.multiSelect} onChange={e => updateGroup(gIdx, { multiSelect: e.target.checked })} className="rounded" />
                                                Pilih banyak
                                            </label>
                                        </div>

                                        <Separator />

                                        <div className="space-y-2">
                                            {group.options.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-slate-50 rounded-lg">
                                                    <Input
                                                        placeholder="Nama opsi"
                                                        className="h-8 text-sm flex-1 min-w-0"
                                                        value={opt.name}
                                                        onChange={e => updateOption(gIdx, oIdx, { name: e.target.value })}
                                                    />
                                                    <div className="flex items-center gap-2 sm:gap-1">
                                                        <div className="flex items-center gap-1 flex-1 sm:flex-initial">
                                                            <Label className="text-xs text-slate-400 shrink-0">+Rp</Label>
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-sm w-full sm:w-24"
                                                                value={opt.priceAdjust || ""}
                                                                onChange={e => updateOption(gIdx, oIdx, { priceAdjust: Number(e.target.value) || 0 })}
                                                            />
                                                        </div>
                                                        <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
                                                            <input type="checkbox" checked={opt.isDefault} onChange={e => updateOption(gIdx, oIdx, { isDefault: e.target.checked })} className="rounded" />
                                                            <span className="hidden sm:inline">Default</span>
                                                        </label>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600 shrink-0 touch-target" onClick={() => removeOption(gIdx, oIdx)}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            <Button size="sm" variant="outline" className="w-full" onClick={() => addOption(gIdx)}>
                                                <Plus className="h-3 w-3 mr-2" /> Tambah Opsi
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
