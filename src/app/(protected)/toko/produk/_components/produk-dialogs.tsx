"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { formatCurrency } from "@/lib/constants";
import { Loader2, PlusCircle, X, Package, ImagePlus, ChefHat, Layers, AlertCircle, Check, Tag, Plus, Pencil, Trash2, BookOpen, Camera } from "lucide-react";
import type { IngredientOption, Product } from "../_types";

// Dipindah VERBATIM dari page.tsx (2026-10-11). Props memakai nama identifier asli
// agar JSX tidak berubah satu karakter pun.

export function ProdukDialogs({showBulkDialog, setShowBulkDialog, filteredProducts, setImagePreview, bulkAction, setBulkAction, bulkValue, setBulkValue, bulkStockGdg, setBulkStockGdg, bulkStockToko, setBulkStockToko, bulkCategory, setBulkCategory, bulkUnit, setBulkUnit, isBulkProcessing, executeBulk, getBulkActionLabel, showCategoryDialog, setShowCategoryDialog, categoryList, editingCategory, setEditingCategory, newCategoryName, setNewCategoryName, newCategoryInput, setNewCategoryInput, isCategoryProcessing, isFnB, handleCreateCategory, handleRenameCategory, handleDeleteCategory, categories, showResultDialog, setShowResultDialog, resultDialogTitle, setResultDialogTitle, resultDialogContent, setResultDialogContent, showRecipeDialog, setShowRecipeDialog, recipeProductName, recipeItems, setRecipeItems, isRecipeSaving, isRecipeLoading, ingredientOptions, addRecipeRow, removeRecipeRow, updateRecipeRow, calcRecipeTotal, saveRecipe, showImageDialog, setShowImageDialog, imageProductName, imagePreview, imageFile, setImageFile, isImageSaving, imageFileInputRef, handleImageFileSelect, removeImagePreview, saveImage, selectedIds, products, unitList, unitType, isManualPriceCategory}: {
    showBulkDialog: boolean;
    setShowBulkDialog: (v: boolean) => void;
    bulkAction: string;
    setBulkAction: (v: string) => void;
    bulkValue: string;
    setBulkValue: (v: string) => void;
    bulkStockGdg: string;
    setBulkStockGdg: (v: string) => void;
    bulkStockToko: string;
    setBulkStockToko: (v: string) => void;
    bulkCategory: string;
    setBulkCategory: (v: string) => void;
    bulkUnit: string;
    setBulkUnit: (v: string) => void;
    isBulkProcessing: boolean;
    executeBulk: () => void;
    getBulkActionLabel: () => string;
    showCategoryDialog: boolean;
    setShowCategoryDialog: (v: boolean) => void;
    categoryList: { id?: number; name: string; count: number }[];
    editingCategory: string | null;
    setEditingCategory: (v: string | null) => void;
    newCategoryName: string;
    setNewCategoryName: (v: string) => void;
    newCategoryInput: string;
    setNewCategoryInput: (v: string) => void;
    isCategoryProcessing: boolean;
    isFnB: boolean;
    handleCreateCategory: () => void;
    handleRenameCategory: (oldName: string) => void;
    handleDeleteCategory: (name: string) => void;
    categories: string[];
    showResultDialog: boolean;
    setShowResultDialog: (v: boolean) => void;
    resultDialogTitle: string;
    setResultDialogTitle: (v: string) => void;
    resultDialogContent: React.ReactNode;
    setResultDialogContent: (v: React.ReactNode) => void;
    showRecipeDialog: boolean;
    setShowRecipeDialog: (v: boolean) => void;
    recipeProductName: string;
    recipeItems: { id?: number; ingredientName: string; quantity: string; unit: string; unitCost: string; ingredientProductId?: number | null }[];
    setRecipeItems: React.Dispatch<React.SetStateAction<{ id?: number; ingredientName: string; quantity: string; unit: string; unitCost: string; ingredientProductId?: number | null }[]>>;
    isRecipeSaving: boolean;
    isRecipeLoading: boolean;
    ingredientOptions: IngredientOption[];
    addRecipeRow: () => void;
    removeRecipeRow: (index: number) => void;
    updateRecipeRow: (index: number, field: string, value: string) => void;
    calcRecipeTotal: () => number;
    saveRecipe: () => void;
    showImageDialog: boolean;
    setShowImageDialog: (v: boolean) => void;
    imageProductName: string;
    imagePreview: string | null;
    setImagePreview: (v: string | null) => void;
    imageFile: string;
    setImageFile: (v: string) => void;
    isImageSaving: boolean;
    imageFileInputRef: React.RefObject<HTMLInputElement | null>;
    handleImageFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeImagePreview: () => void;
    saveImage: () => void;
    selectedIds: Set<number>;
    products: Product[];
    filteredProducts: Product[];
    unitList: string[];
    unitType: string;
    isManualPriceCategory: (cat: string | null | undefined) => boolean;
}) {
    return (
        <>
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Konfirmasi: {getBulkActionLabel()}</DialogTitle>
                        <DialogDescription>
                            Aksi ini akan diterapkan ke <strong>{selectedIds.size} produk</strong> yang dipilih.
                            {(bulkAction === "zero_stock" || bulkAction === "zero_price" || bulkAction === "zero_all") && (
                                <span className="block mt-1 text-destructive font-medium">
                                    ⚠️ Perhatian: Aksi ini tidak dapat dibatalkan!
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {bulkAction === "set_stock" && (
                        <div className="space-y-3 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Stok Gudang</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={bulkStockGdg}
                                        onChange={(e) => setBulkStockGdg(e.target.value)}
                                        placeholder="Contoh: 50"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Stok Toko / Etalase</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={bulkStockToko}
                                        onChange={(e) => setBulkStockToko(e.target.value)}
                                        placeholder="Contoh: 30"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Total stok per produk: <strong>{(Number(bulkStockGdg) || 0) + (Number(bulkStockToko) || 0)}</strong> pcs</p>
                        </div>
                    )}

                    {bulkAction === "set_price" && (
                        <div className="space-y-2 py-2">
                            <Label>Harga Baru (Rp)</Label>
                            {(() => {
                                const manualProducts = filteredProducts.filter(p => selectedIds.has(p.id) && isManualPriceCategory(p.category));
                                return manualProducts.length > 0 ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-2.5 text-xs">
                                        <p className="font-medium text-amber-800 dark:text-amber-300">⚠️ {manualProducts.length} produk kategori manual akan terpengaruh:</p>
                                        <div className="mt-1 max-h-[80px] overflow-y-auto space-y-0.5">
                                            {manualProducts.slice(0, 10).map(p => (
                                                <div key={p.id} className="text-amber-700 dark:text-amber-400">{p.name} ({p.category})</div>
                                            ))}
                                            {manualProducts.length > 10 && <div className="text-amber-600">...dan {manualProducts.length - 10} lainnya</div>}
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                            <Input
                                type="number"
                                min={0}
                                value={bulkValue}
                                onChange={(e) => setBulkValue(e.target.value)}
                                placeholder="Contoh: 15000"
                                autoFocus
                            />
                        </div>
                    )}

                    {bulkAction === "set_category" && (
                        <div className="space-y-3 py-2">
                            <Label>Kategori Baru</Label>
                            {categories.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground">Pilih kategori yang sudah ada:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {categories.map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setBulkCategory(c)}
                                                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                                                    bulkCategory === c
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background hover:bg-accent border-input"
                                                }`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <p className="text-xs text-muted-foreground">Atau ketik kategori baru:</p>
                                <Input
                                    value={bulkCategory}
                                    onChange={(e) => setBulkCategory(e.target.value)}
                                    placeholder="Contoh: Minuman, Snack, Alat Tulis..."
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Akan diterapkan ke <strong>{selectedIds.size} produk</strong> yang dipilih.
                            </p>
                        </div>
                    )}

                    {bulkAction === "set_unit" && (
                        <div className="space-y-3 py-2">
                            <Label>Satuan Baru</Label>
                            {unitList.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground">Pilih satuan yang sudah ada:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {unitList.map(u => (
                                            <button
                                                key={u}
                                                type="button"
                                                onClick={() => setBulkUnit(u)}
                                                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                                                    bulkUnit === u
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background hover:bg-accent border-input"
                                                }`}
                                            >
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <p className="text-xs text-muted-foreground">Atau ketik satuan baru:</p>
                                <Input
                                    value={bulkUnit}
                                    onChange={(e) => setBulkUnit(e.target.value)}
                                    placeholder="Contoh: pcs, kg, liter, lusin, pack..."
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Akan diterapkan ke <strong>{selectedIds.size} produk</strong> yang dipilih.
                            </p>
                        </div>
                    )}

                    {(bulkAction === "zero_stock" || bulkAction === "zero_all") && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm">
                            <p className="font-medium text-amber-800 dark:text-amber-300">Produk yang akan dinolkan stoknya:</p>
                            <div className="mt-2 max-h-[150px] overflow-y-auto space-y-1">
                                {products.filter(p => selectedIds.has(p.id)).slice(0, 20).map(p => (
                                    <div key={p.id} className="flex justify-between text-xs">
                                        <span className="truncate mr-2">{p.sku} - {p.name}</span>
                                        <span className="text-muted-foreground shrink-0">Stok: {p.stock}</span>
                                    </div>
                                ))}
                                {selectedIds.size > 20 && (
                                    <p className="text-xs text-muted-foreground">...dan {selectedIds.size - 20} produk lainnya</p>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkDialog(false)} disabled={isBulkProcessing}>Batal</Button>
                        <Button
                            variant={bulkAction.startsWith("zero") || bulkAction === "deactivate" ? "destructive" : "default"}
                            onClick={executeBulk}
                            disabled={isBulkProcessing || (bulkAction === "set_stock" && !bulkStockGdg && !bulkStockToko) || (bulkAction === "set_price" && !bulkValue) || (bulkAction === "set_category" && !bulkCategory.trim()) || (bulkAction === "set_unit" && !bulkUnit.trim())}
                        >
                            {isBulkProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            {isBulkProcessing ? "Memproses..." : `Ya, ${getBulkActionLabel()}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Category Management Dialog */}
            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary" />
                            Kelola Kategori
                        </DialogTitle>
                        <DialogDescription>
                            {isFnB
                                ? "Tambah, ubah nama, atau hapus kategori menu."
                                : "Kelola kategori produk untuk unit Toko. Kategori otomatis hilang jika tidak ada produk yang menggunakannya."}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Add Category (F&B only) */}
                    {isFnB && (
                        <div className="flex gap-2 p-3 rounded-lg bg-muted/50 border border-dashed">
                            <Input
                                className="flex-1 h-9 bg-background"
                                placeholder="Nama kategori baru..."
                                value={newCategoryInput}
                                onChange={(e) => setNewCategoryInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
                                disabled={isCategoryProcessing}
                            />
                            <Button size="sm" className="h-9 shrink-0" onClick={handleCreateCategory}
                                disabled={isCategoryProcessing || !newCategoryInput.trim()}>
                                {isCategoryProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Tambah
                            </Button>
                        </div>
                    )}

                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                        {categoryList.length === 0 ? (
                            <div className="text-center py-10">
                                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                    <Tag className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {isFnB ? "Belum ada kategori. Tambahkan di atas." : "Belum ada kategori."}
                                </p>
                            </div>
                        ) : categoryList.map((cat) => (
                            <div key={cat.id ?? cat.name}
                                className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
                                    editingCategory === cat.name
                                        ? "border-primary/50 bg-primary/5"
                                        : "border-transparent hover:border-border bg-card hover:bg-accent/50"
                                }`}>
                                {editingCategory === cat.name ? (
                                    <>
                                        <Input
                                            className="flex-1 h-8 text-sm"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder={cat.name}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleRenameCategory(cat.name);
                                                if (e.key === "Escape") { setEditingCategory(null); setNewCategoryName(""); }
                                            }}
                                            disabled={isCategoryProcessing}
                                        />
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0"
                                            onClick={() => handleRenameCategory(cat.name)} disabled={isCategoryProcessing || !newCategoryName.trim()}>
                                            <Check className="h-4 w-4 text-green-600" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0"
                                            onClick={() => { setEditingCategory(null); setNewCategoryName(""); }} disabled={isCategoryProcessing}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 text-sm truncate">{cat.name}</span>
                                        <Badge variant="secondary" className="text-xs shrink-0">{cat.count}</Badge>
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                            onClick={() => { setEditingCategory(cat.name); setNewCategoryName(cat.name); }}>
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:!text-destructive transition-opacity shrink-0"
                                            onClick={() => {
                                                const msg = cat.count > 0
                                                    ? `Hapus kategori "${cat.name}"? ${cat.count} produk akan dipindahkan ke "Tanpa Kategori".`
                                                    : `Hapus kategori "${cat.name}"?`;
                                                if (confirm(msg)) handleDeleteCategory(cat.name);
                                            }}
                                            disabled={isCategoryProcessing}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Result Dialog (Recalculate / Duplicates) */}
            <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{resultDialogTitle}</DialogTitle>
                    </DialogHeader>
                    {resultDialogContent}
                    <DialogFooter>
                        <Button onClick={() => setShowResultDialog(false)}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Recipe / HPP Dialog */}
            <Dialog open={showRecipeDialog} onOpenChange={setShowRecipeDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-amber-600" />
                            Resep & HPP — {recipeProductName}
                        </DialogTitle>
                        <DialogDescription>
                            Kelola bahan baku per menu. HPP dihitung otomatis dari total resep.
                            Pilih bahan baku yang terdaftar untuk menghubungkan ke stok gudang.
                        </DialogDescription>
                    </DialogHeader>

                    {isRecipeLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : (
                        <div className="space-y-3">
                            {/* Mobile: stacked rows. Desktop: grid */}
                            <div className="hidden sm:grid grid-cols-[1fr_80px_60px_100px_80px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                                <span>Nama Bahan</span>
                                <span>Qty</span>
                                <span>Satuan</span>
                                <span>HPP/Unit</span>
                                <span>Subtotal</span>
                                <span></span>
                            </div>
                            {recipeItems.map((item, idx) => {
                                const subtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
                                const linkedIngredient = item.ingredientProductId
                                    ? ingredientOptions.find(o => o.id === item.ingredientProductId)
                                    : null;
                                return (
                                    <div key={idx} className="space-y-1.5 sm:space-y-0 sm:grid sm:grid-cols-[1fr_80px_60px_100px_80px_32px] sm:gap-2 sm:items-center p-2 sm:p-0 rounded-lg border sm:border-0 bg-muted/30 sm:bg-transparent">
                                        {/* Ingredient selector + name */}
                                        <div className="space-y-1">
                                            <select
                                                className="w-full h-7 text-xs border rounded px-1 bg-amber-50 border-amber-200 text-amber-800"
                                                value={item.ingredientProductId || ""}
                                                onChange={e => {
                                                    const selectedId = e.target.value ? Number(e.target.value) : null;
                                                    const selected = selectedId ? ingredientOptions.find(o => o.id === selectedId) : null;
                                                    setRecipeItems(prev => prev.map((it, i) => i === idx ? {
                                                        ...it,
                                                        ingredientProductId: selectedId,
                                                        ingredientName: selected ? selected.name : it.ingredientName,
                                                        unit: selected ? selected.unit : it.unit,
                                                        unitCost: selected ? String(selected.costPrice) : it.unitCost,
                                                    } : it));
                                                }}
                                            >
                                                <option value="">— Pilih Bahan Baku —</option>
                                                {ingredientOptions.map(o => (
                                                    <option key={o.id} value={o.id}>
                                                        {o.name} ({o.stockGdg} {o.unit}) — Rp{o.costPrice.toLocaleString("id-ID")}/{o.unit}
                                                    </option>
                                                ))}
                                            </select>
                                            <Input className="h-7 text-xs" placeholder="Nama bahan (manual)" value={item.ingredientName}
                                                onChange={e => updateRecipeRow(idx, "ingredientName", e.target.value)} />
                                        </div>
                                        <div className="flex items-center gap-2 sm:contents">
                                            <div className="flex-1 sm:hidden">
                                                <Input className="h-7 text-xs text-center" type="number" placeholder="0" value={item.quantity}
                                                    onChange={e => updateRecipeRow(idx, "quantity", e.target.value)} />
                                            </div>
                                            <Input className="hidden sm:block h-7 text-xs text-center" type="number" placeholder="0" value={item.quantity}
                                                onChange={e => updateRecipeRow(idx, "quantity", e.target.value)} />
                                            <div className="flex-1 sm:hidden">
                                                <select className="h-7 text-xs border rounded px-1 bg-background w-full"
                                                    value={item.unit} onChange={e => updateRecipeRow(idx, "unit", e.target.value)}>
                                                    <option value="ml">ml</option>
                                                    <option value="gr">gr</option>
                                                    <option value="pcs">pcs</option>
                                                </select>
                                            </div>
                                            <select className="hidden sm:block h-7 text-xs border rounded px-1 bg-background"
                                                value={item.unit} onChange={e => updateRecipeRow(idx, "unit", e.target.value)}>
                                                <option value="ml">ml</option>
                                                <option value="gr">gr</option>
                                                <option value="pcs">pcs</option>
                                            </select>
                                            <div className="flex-1 sm:hidden">
                                                <Input className="h-7 text-xs text-right" type="number" placeholder="0" value={item.unitCost}
                                                    onChange={e => updateRecipeRow(idx, "unitCost", e.target.value)} />
                                            </div>
                                            <Input className="hidden sm:block h-7 text-xs text-right" type="number" placeholder="0" value={item.unitCost}
                                                onChange={e => updateRecipeRow(idx, "unitCost", e.target.value)} />
                                            <span className="text-xs text-right tabular-nums flex-1 sm:block">{formatCurrency(subtotal)}</span>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 shrink-0" onClick={() => removeRecipeRow(idx)} disabled={recipeItems.length <= 1}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        {linkedIngredient && (
                                            <div className="text-[10px] text-muted-foreground sm:col-span-6">
                                                Stok gudang: {linkedIngredient.stockGdg} {linkedIngredient.unit}
                                                {linkedIngredient.stockGdg <= 100 && <span className="text-amber-600 ml-1">(menipis)</span>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <Button variant="outline" size="sm" className="w-full" onClick={addRecipeRow}>
                                <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Bahan
                            </Button>
                            {ingredientOptions.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center">
                                    Belum ada bahan baku terdaftar.{" "}
                                    <Link href={unitType === "cafe_lsp" ? "/cafe-lsp/bahan-baku" : "/resto/bahan-baku"} className="text-primary underline">
                                        Daftarkan bahan baku
                                    </Link>{" "}
                                    agar bisa dihubungkan ke resep.
                                </p>
                            )}
                            <div className="flex items-center justify-between pt-3 border-t">
                                <div className="text-sm">
                                    <span className="text-muted-foreground">Total HPP:</span>{" "}
                                    <span className="font-bold text-lg">{formatCurrency(calcRecipeTotal())}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {recipeItems.filter(i => i.ingredientProductId).length}/{recipeItems.filter(i => i.ingredientName.trim()).length} bahan terhubung
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRecipeDialog(false)}>Batal</Button>
                        <Button onClick={saveRecipe} disabled={isRecipeSaving}>
                            {isRecipeSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Simpan Resep
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Edit Dialog */}
            <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-blue-500" />
                            Gambar Menu
                        </DialogTitle>
                        <DialogDescription>
                            {imageProductName}
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
                                <img src={imagePreview} alt={imageProductName} className="w-full h-full object-cover" />
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
        </>
    );
}
