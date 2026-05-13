"use client";

import * as React from "react";
import { useAuth } from "@/lib/hooks";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Plus, Trash2, Save, RotateCcw, GripVertical, Move,
    Table2, CircleDot, Loader2, ArrowLeft,
} from "lucide-react";
import type { FloorTable, FloorPlan, TableShape } from "@/lib/floor-plan";
import { getDefaultFloorPlan, validateFloorPlan } from "@/lib/floor-plan";

const GRID_COLS = 12;
const CELL_PX = 64;

function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = React.useState(false);
    React.useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < breakpoint);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, [breakpoint]);
    return isMobile;
}

export default function FloorPlanEditorPage() {
    const { user } = useAuth();
    const [plan, setPlan] = React.useState<FloorPlan>({ tables: [], areas: [] });
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDirty, setIsDirty] = React.useState(false);
    const [editTable, setEditTable] = React.useState<FloorTable | null>(null);
    const [dragId, setDragId] = React.useState<string | null>(null);
    const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
    const isMobile = useIsMobile();

    // Load floor plan from API
    React.useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/toko/floor-plan?unitType=resto");
                const json = await res.json();
                setPlan(json.plan || getDefaultFloorPlan());
            } catch {
                toast.error("Gagal memuat denah meja");
                setPlan(getDefaultFloorPlan());
            } finally { setIsLoading(false); }
        }
        load();
    }, []);

    const handleSave = async () => {
        const validation = validateFloorPlan(plan);
        if (!validation.valid) {
            toast.error(`Denah tidak valid: ${validation.errors[0]}`);
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch("/api/toko/floor-plan", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ unitType: "resto", plan }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success("Denah meja berhasil disimpan!");
            setIsDirty(false);
        } catch (error: any) {
            toast.error(error.message || "Gagal menyimpan denah");
        } finally { setIsSaving(false); }
    };

    const handleReset = () => {
        if (!confirm("Reset denah ke default 12 meja?")) return;
        setPlan(getDefaultFloorPlan());
        setIsDirty(true);
    };

    const addTable = () => {
        const newId = `t${Date.now()}`;
        const label = `Meja ${plan.tables.length + 1}`;
        setPlan(prev => ({
            ...prev,
            tables: [...prev.tables, { id: newId, label, x: 0, y: Math.max(0, ...prev.tables.map(t => t.y + t.h)), w: 2, h: 2, seats: 4, shape: "rect" }],
        }));
        setIsDirty(true);
    };

    const removeTable = (id: string) => {
        setPlan(prev => ({ ...prev, tables: prev.tables.filter(t => t.id !== id) }));
        setIsDirty(true);
    };

    const updateTable = (id: string, updates: Partial<FloorTable>) => {
        setPlan(prev => ({
            ...prev,
            tables: prev.tables.map(t => t.id === id ? { ...t, ...updates } : t),
        }));
        setIsDirty(true);
    };

    // Drag handlers for canvas
    const handleMouseDown = (e: React.MouseEvent, table: FloorTable) => {
        e.preventDefault();
        setDragId(table.id);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
        if (!dragId) return;
        const canvas = (e.currentTarget as HTMLElement);
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.floor((e.clientX - rect.left - dragOffset.x) / CELL_PX));
        const y = Math.max(0, Math.floor((e.clientY - rect.top - dragOffset.y) / CELL_PX));
        updateTable(dragId, { x, y });
    }, [dragId, dragOffset]);

    const handleMouseUp = React.useCallback(() => {
        setDragId(null);
    }, []);

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
                title="Denah Meja (Floor Plan)"
                description="Atur posisi, ukuran, dan bentuk meja untuk POS Resto"
                actions={
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={handleReset}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Reset</span> Default
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving || !isDirty}>
                            {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                            Simpan
                        </Button>
                    </div>
                }
            />

            {/* Canvas — scrollable on mobile */}
            <Card>
                <CardContent className="p-2 sm:p-6">
                    <div className="overflow-x-auto -mx-2 sm:mx-0">
                        <div
                            className="relative bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl"
                            style={{
                                width: GRID_COLS * CELL_PX,
                                minWidth: GRID_COLS * CELL_PX,
                                height: Math.max(400, Math.max(...plan.tables.map(t => (t.y + t.h) * CELL_PX), 0) + CELL_PX * 2),
                                cursor: dragId ? "grabbing" : "default",
                                touchAction: dragId ? "none" : "auto",
                            }}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchMove={(e) => {
                                if (!dragId) return;
                                e.preventDefault();
                                const touch = e.touches[0];
                                const canvas = e.currentTarget;
                                const rect = canvas.getBoundingClientRect();
                                const x = Math.max(0, Math.floor((touch.clientX - rect.left - dragOffset.x) / CELL_PX));
                                const y = Math.max(0, Math.floor((touch.clientY - rect.top - dragOffset.y) / CELL_PX));
                                updateTable(dragId, { x, y });
                            }}
                            onTouchEnd={() => setDragId(null)}
                        >
                        {/* Grid lines */}
                        {Array.from({ length: GRID_COLS + 1 }, (_, i) => (
                            <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-slate-200/50" style={{ left: i * CELL_PX }} />
                        ))}
                        {Array.from({ length: 8 }, (_, i) => (
                            <div key={`h${i}`} className="absolute left-0 right-0 border-t border-slate-200/50" style={{ top: i * CELL_PX }} />
                        ))}

                        {/* Tables */}
                        {plan.tables.map(table => (
                            <div
                                key={table.id}
                                className={`absolute border-2 flex flex-col items-center justify-center cursor-grab select-none transition-shadow ${
                                    dragId === table.id ? "shadow-xl border-sky-500 z-20" : "border-slate-300 hover:border-sky-400 hover:shadow-md z-10"
                                } ${table.shape === "round" ? "rounded-full" : "rounded-xl"}`}
                                style={{
                                    left: table.x * CELL_PX,
                                    top: table.y * CELL_PX,
                                    width: table.w * CELL_PX,
                                    height: table.h * CELL_PX,
                                    backgroundColor: dragId === table.id ? "rgb(224 242 254)" : "white",
                                }}
                                onMouseDown={e => handleMouseDown(e, table)}
                                onTouchStart={(e) => {
                                    setDragId(table.id);
                                    const touch = e.touches[0];
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setDragOffset({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
                                }}
                                onDoubleClick={() => setEditTable(table)}
                                onClick={() => { if (isMobile) setEditTable(table); }}
                            >
                                <Move className="h-3 w-3 text-slate-400 mb-1" />
                                <span className="font-bold text-sm text-slate-700">{table.label}</span>
                                <span className="text-[10px] text-slate-400">{table.seats} kursi</span>
                            </div>
                        ))}
                    </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table List */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-700">Daftar Meja ({plan.tables.length})</h3>
                        <Button size="sm" variant="outline" onClick={addTable}>
                            <Plus className="h-4 w-4 mr-2" /> Tambah Meja
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {plan.tables.map(table => (
                            <div key={table.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-8 h-8 shrink-0 flex items-center justify-center border ${
                                        table.shape === "round" ? "rounded-full" : "rounded-lg"
                                    }`}>
                                        {table.shape === "round" ? <CircleDot className="h-4 w-4 text-slate-500" /> : <Table2 className="h-4 w-4 text-slate-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{table.label}</p>
                                        <p className="text-xs text-slate-400">
                                            ({table.x},{table.y}) {table.w}×{table.h} • {table.seats} kursi • {table.shape}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 self-end sm:self-auto">
                                    <Button size="sm" variant="ghost" onClick={() => setEditTable(table)}>
                                        Edit
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => removeTable(table.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Edit Table Dialog */}
            <Dialog open={!!editTable} onOpenChange={() => setEditTable(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Meja</DialogTitle>
                    </DialogHeader>
                    {editTable && (
                        <div className="space-y-4">
                            <div>
                                <Label>Nama Meja</Label>
                                <Input value={editTable.label} onChange={e => {
                                    const updated = { ...editTable, label: e.target.value };
                                    setEditTable(updated);
                                    updateTable(editTable.id, { label: e.target.value });
                                }} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Posisi X</Label>
                                    <Input type="number" min={0} value={editTable.x} onChange={e => {
                                        const val = parseInt(e.target.value) || 0;
                                        setEditTable({ ...editTable, x: val });
                                        updateTable(editTable.id, { x: val });
                                    }} />
                                </div>
                                <div>
                                    <Label>Posisi Y</Label>
                                    <Input type="number" min={0} value={editTable.y} onChange={e => {
                                        const val = parseInt(e.target.value) || 0;
                                        setEditTable({ ...editTable, y: val });
                                        updateTable(editTable.id, { y: val });
                                    }} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <Label>Lebar</Label>
                                    <Input type="number" min={1} max={6} value={editTable.w} onChange={e => {
                                        const val = parseInt(e.target.value) || 1;
                                        setEditTable({ ...editTable, w: val });
                                        updateTable(editTable.id, { w: val });
                                    }} />
                                </div>
                                <div>
                                    <Label>Tinggi</Label>
                                    <Input type="number" min={1} max={6} value={editTable.h} onChange={e => {
                                        const val = parseInt(e.target.value) || 1;
                                        setEditTable({ ...editTable, h: val });
                                        updateTable(editTable.id, { h: val });
                                    }} />
                                </div>
                                <div>
                                    <Label>Kursi</Label>
                                    <Input type="number" min={1} max={20} value={editTable.seats} onChange={e => {
                                        const val = parseInt(e.target.value) || 1;
                                        setEditTable({ ...editTable, seats: val });
                                        updateTable(editTable.id, { seats: val });
                                    }} />
                                </div>
                            </div>
                            <div>
                                <Label>Bentuk</Label>
                                <div className="flex gap-2 mt-1">
                                    <Button
                                        size="sm" variant={editTable.shape === "rect" ? "default" : "outline"}
                                        onClick={() => { setEditTable({ ...editTable, shape: "rect" }); updateTable(editTable.id, { shape: "rect" }); }}
                                    >
                                        <Table2 className="mr-2 h-4 w-4" /> Persegi
                                    </Button>
                                    <Button
                                        size="sm" variant={editTable.shape === "round" ? "default" : "outline"}
                                        onClick={() => { setEditTable({ ...editTable, shape: "round" }); updateTable(editTable.id, { shape: "round" }); }}
                                    >
                                        <CircleDot className="mr-2 h-4 w-4" /> Bulat
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTable(null)}>Selesai</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
