"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import type { ModifierGroup, ModifierGroupWithSelection } from "@/lib/modifiers";
import { calculateModifierPrice } from "@/lib/modifiers";

interface ModifierDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productId: number | null;
    productName: string;
    basePrice: number;
    onConfirm: (selections: ModifierGroupWithSelection[], modifierTotal: number) => void;
}

// Cache modifier groups per product to avoid re-fetching
const modifierCache = new Map<number, ModifierGroup[]>();

export function ModifierDialog({
    open,
    onOpenChange,
    productId,
    productName,
    basePrice,
    onConfirm,
}: ModifierDialogProps) {
    const [groups, setGroups] = React.useState<ModifierGroup[]>([]);
    const [selections, setSelections] = React.useState<Record<string, string[]>>({});
    const [isLoading, setIsLoading] = React.useState(false);

    // Reset state when product changes
    React.useEffect(() => {
        if (!open || !productId) return;
        setSelections({});

        async function loadModifiers() {
            if (!productId) return;
            setIsLoading(true);
            try {
                // Check cache first
                if (modifierCache.has(productId)) {
                    setGroups(modifierCache.get(productId)!);
                    setIsLoading(false);
                    return;
                }
                const res = await fetch(`/api/toko/modifiers?productId=${productId}`);
                const json = await res.json();
                const loadedGroups: ModifierGroup[] = json.groups || [];
                modifierCache.set(productId, loadedGroups);
                setGroups(loadedGroups);
            } catch {
                setGroups([]);
            } finally {
                setIsLoading(false);
            }
        }
        loadModifiers();
    }, [open, productId]);

    // No modifiers — auto-confirm immediately
    React.useEffect(() => {
        if (!open || !productId || isLoading || groups.length > 0) return;
        // Product has no modifier groups — just add to cart directly
        onConfirm([], 0);
        onOpenChange(false);
    }, [open, productId, isLoading, groups.length]);

    const toggleOption = (groupId: string, optionId: string, multiSelect: boolean) => {
        setSelections(prev => {
            const current = prev[groupId] || [];
            if (multiSelect) {
                const next = current.includes(optionId)
                    ? current.filter(id => id !== optionId)
                    : [...current, optionId];
                return { ...prev, [groupId]: next };
            }
            // Single select — toggle off if same, else replace
            return { ...prev, [groupId]: current.includes(optionId) ? [] : [optionId] };
        });
    };

    // Validate: all required groups must have at least one selection
    const validationErrors: string[] = [];
    for (const group of groups) {
        if (group.isRequired && (selections[group.id] || []).length === 0) {
            validationErrors.push(group.name);
        }
    }

    const modifierTotal = calculateModifierPrice(
        groups.map(g => ({ ...g, selectedOptionIds: selections[g.id] || [] }))
    );
    const totalPrice = basePrice + modifierTotal;

    const handleConfirm = () => {
        if (validationErrors.length > 0) return;
        const result: ModifierGroupWithSelection[] = groups.map(g => ({
            ...g,
            selectedOptionIds: selections[g.id] || [],
        }));
        onConfirm(result, modifierTotal);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>{productName}</span>
                        <Badge variant="outline" className="text-xs font-mono ml-2">
                            {formatCurrency(basePrice)}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
                        {groups.map(group => {
                            const selected = selections[group.id] || [];
                            return (
                                <div key={group.id}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <p className="font-semibold text-sm">{group.name}</p>
                                        {group.isRequired && (
                                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Wajib</Badge>
                                        )}
                                        {group.multiSelect && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Multi</Badge>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        {group.options.map(opt => {
                                            const isSelected = selected.includes(opt.id);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => toggleOption(group.id, opt.id, group.multiSelect)}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                                                        isSelected
                                                            ? "bg-primary/5 border-primary/30 text-primary font-medium"
                                                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`h-4 w-4 rounded-${group.multiSelect ? "md" : "full"} border-2 flex items-center justify-center transition-all ${
                                                            isSelected
                                                                ? "border-primary bg-primary"
                                                                : "border-slate-300"
                                                        }`}>
                                                            {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                                                        </div>
                                                        <span>{opt.name}</span>
                                                        {opt.isDefault && (
                                                            <Badge variant="secondary" className="text-[9px] px-1 py-0">Default</Badge>
                                                        )}
                                                    </div>
                                                    {opt.priceAdjust > 0 && (
                                                        <span className="text-xs font-mono text-emerald-600">
                                                            +{formatCurrency(opt.priceAdjust)}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <Separator className="mt-3" />
                                </div>
                            );
                        })}
                    </div>
                )}

                {validationErrors.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>Pilih: {validationErrors.join(", ")}</span>
                    </div>
                )}

                <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground">Total per item</p>
                        <p className="text-xl font-black">{formatCurrency(totalPrice)}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={validationErrors.length > 0}
                        >
                            Tambah ({formatCurrency(totalPrice)})
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Clear modifier cache for a specific product (call after admin updates) */
export function clearModifierCache(productId?: number) {
    if (productId) modifierCache.delete(productId);
    else modifierCache.clear();
}
