"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Gamepad2, Settings } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

interface PSConsoleEntry {
    id: string;
    label: string;
    type: "PS5" | "PS4" | "PS3";
}

interface PSConsoleConfig {
    consoles: PSConsoleEntry[];
    ratePerBlock: number;
    blockDurationMins: number;
    rateByType?: Record<string, number>;
}

export default function PSPengaturanPage() {
    const [config, setConfig] = React.useState<PSConsoleConfig | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        async function loadConfig() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/playstation/config");
                const json = await res.json();
                setConfig(json.data);
            } catch {
                toast.error("Gagal memuat konfigurasi");
            } finally {
                setIsLoading(false);
            }
        }
        loadConfig();
    }, []);

    const addConsole = () => {
        if (!config) return;
        const num = config.consoles.length + 1;
        setConfig({
            ...config,
            consoles: [...config.consoles, { id: `TV-${num}`, label: `TV ${num} (PS5)`, type: "PS5" }],
        });
    };

    const removeConsole = (index: number) => {
        if (!config) return;
        if (config.consoles.length <= 1) {
            toast.error("Minimal 1 console");
            return;
        }
        setConfig({
            ...config,
            consoles: config.consoles.filter((_, i) => i !== index),
        });
    };

    const updateConsole = (index: number, field: keyof PSConsoleEntry, value: string) => {
        if (!config) return;
        const updated = [...config.consoles];
        updated[index] = { ...updated[index], [field]: value };
        if (field === "type") {
            updated[index].label = `${updated[index].label.split("(")[0].trim()} (${value})`;
        }
        setConfig({ ...config, consoles: updated });
    };

    const handleSave = async () => {
        if (!config) return;
        setIsSaving(true);
        try {
            const res = await fetch("/api/playstation/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success("Konfigurasi berhasil disimpan");
            setConfig(json.data);
        } catch (error: any) {
            toast.error(error.message || "Gagal menyimpan");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!config) return null;

    const ratePerHour = config.ratePerBlock * (60 / config.blockDurationMins);

    // Derive rateByType with defaults for all console types (immutable)
    const existingTypes = [...new Set(config.consoles.map(c => c.type))];
    const effectiveRateByType: Record<string, number> = { ...(config.rateByType || {}) };
    for (const type of existingTypes) {
        if (effectiveRateByType[type] === undefined) {
            effectiveRateByType[type] = config.ratePerBlock;
        }
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title="Pengaturan Console"
                description="Atur jumlah console, tipe, dan tarif rental per jam"
                actions={
                    <Button variant="outline" size="sm" asChild>
                        <a href="/play-station/kasir"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Kasir</a>
                    </Button>
                }
            />

            {/* Rate Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Settings className="h-4 w-4" /> Tarif & Durasi Billing
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tarif per Jam (Rp)</Label>
                            <Input
                                type="number"
                                value={ratePerHour}
                                onChange={(e) => {
                                    const perHour = Number(e.target.value);
                                    if (perHour > 0) {
                                        setConfig({
                                            ...config,
                                            ratePerBlock: Math.round(perHour / (60 / config.blockDurationMins)),
                                        });
                                    }
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                Tarif per blok: {formatCurrency(config.ratePerBlock)} / {config.blockDurationMins} menit
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Durasi Blok (menit)</Label>
                            <Select
                                value={String(config.blockDurationMins)}
                                onValueChange={(v) => {
                                    const mins = Number(v);
                                    const currentPerHour = config.ratePerBlock * (60 / config.blockDurationMins);
                                    setConfig({
                                        ...config,
                                        blockDurationMins: mins,
                                        ratePerBlock: Math.round(currentPerHour / (60 / mins)),
                                    });
                                }}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="15">15 menit</SelectItem>
                                    <SelectItem value="30">30 menit</SelectItem>
                                    <SelectItem value="60">60 menit (1 jam)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Pembulatan billing ke kelipatan durasi blok
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Per-Type Rates */}
            {existingTypes.length > 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Gamepad2 className="h-4 w-4" /> Tarif per Tipe Console
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {existingTypes.map(type => (
                            <div key={type} className="flex items-center gap-4">
                                <Badge variant="outline" className="w-16 justify-center">{type}</Badge>
                                <div className="flex-1">
                                    <Label className="text-xs">Tarif per Jam (Rp)</Label>
                                    <Input
                                        type="number"
                                        value={(effectiveRateByType[type] || config.ratePerBlock) * (60 / config.blockDurationMins)}
                                        onChange={(e) => {
                                            const perHour = Number(e.target.value);
                                            if (perHour > 0) {
                                                setConfig({
                                                    ...config,
                                                    rateByType: {
                                                        ...(config.rateByType || {}),
                                                        [type]: Math.round(perHour / (60 / config.blockDurationMins)),
                                                    },
                                                });
                                            }
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground pt-4">
                                    {formatCurrency((effectiveRateByType[type] || config.ratePerBlock) * (60 / config.blockDurationMins))}/jam
                                    ({formatCurrency(effectiveRateByType[type] || config.ratePerBlock)}/{config.blockDurationMins} min)
                                </p>
                            </div>
                        ))}
                        <p className="text-xs text-muted-foreground">
                            Tarif berbeda per tipe console. Default mengikuti tarif utama jika tidak diatur.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Console Management */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                            <Gamepad2 className="h-4 w-4" /> Daftar Console ({config.consoles.length})
                        </span>
                        <Button size="sm" variant="outline" onClick={addConsole}>
                            <Plus className="h-4 w-4 mr-1" /> Tambah
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {config.consoles.map((console, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <div className="w-8 text-center text-sm font-bold text-muted-foreground">{idx + 1}</div>
                            <Input
                                className="w-32"
                                placeholder="ID (TV-1)"
                                value={console.id}
                                onChange={(e) => updateConsole(idx, "id", e.target.value)}
                            />
                            <Input
                                className="flex-1"
                                placeholder="Label console"
                                value={console.label}
                                onChange={(e) => updateConsole(idx, "label", e.target.value)}
                            />
                            <Select
                                value={console.type}
                                onValueChange={(v) => updateConsole(idx, "type", v)}
                            >
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PS5">PS5</SelectItem>
                                    <SelectItem value="PS4">PS4</SelectItem>
                                    <SelectItem value="PS3">PS3</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-500 hover:bg-red-50 h-9 w-9"
                                onClick={() => removeConsole(idx)}
                                disabled={config.consoles.length <= 1}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Separator />

            {/* Summary & Save */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground space-y-1">
                    <p>Total console: <strong>{config.consoles.length}</strong></p>
                    <p>Tarif default: <strong>{formatCurrency(ratePerHour)}/jam</strong> ({formatCurrency(config.ratePerBlock)}/{config.blockDurationMins} menit)</p>
                    {existingTypes.length > 1 && (
                        <p className="text-xs">
                            Per tipe: {existingTypes.map(t => `${t}: ${formatCurrency((effectiveRateByType[t] || config.ratePerBlock) * (60 / config.blockDurationMins))}/jam`).join(" | ")}
                        </p>
                    )}
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Simpan Konfigurasi
                </Button>
            </div>
        </div>
    );
}
