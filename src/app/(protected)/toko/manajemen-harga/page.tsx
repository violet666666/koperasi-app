"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Calculator, Percent, Info, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface PricingSetting {
    key: string;
    value: string;
    label: string | null;
}

export default function ManajemenHargaPage() {
    const { data: session } = useSession();
    const unitType = session?.user?.unitType as string || "toko";
    const isResto = ["resto_cafe", "resto", "coffe_latar"].includes(unitType);
    const effectiveUnitType = isResto ? "resto" : unitType;

    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isRecalculating, setIsRecalculating] = React.useState(false);
    const [markupPercent, setMarkupPercent] = React.useState("2");
    const [ppnPercent, setPpnPercent] = React.useState("0");
    const [previewResult, setPreviewResult] = React.useState<any>(null);

    // Fetch current settings
    React.useEffect(() => {
        setIsLoading(true);
        fetch(`/api/settings?unitType=${effectiveUnitType}`)
            .then(r => r.json())
            .then(data => {
                if (data.map) {
                    const mk = data.map[`${effectiveUnitType}_markup_percent`];
                    const pp = data.map[`${effectiveUnitType}_ppn_percent`];
                    if (mk !== undefined) setMarkupPercent(mk);
                    if (pp !== undefined) setPpnPercent(pp);
                }
            })
            .catch(() => toast.error("Gagal memuat pengaturan"))
            .finally(() => setIsLoading(false));
    }, [effectiveUnitType]);

    // Computed formula preview
    const markupNum = parseFloat(markupPercent) || 0;
    const ppnNum = parseFloat(ppnPercent) || 0;
    const markupMul = 1 + markupNum / 100;
    const ppnMul = 1 + ppnNum / 100;

    const exampleHPP = 2800;
    const exampleSellPrice = Math.ceil((exampleHPP * markupMul * ppnMul) / 100) * 100;

    const formulaStr = ppnNum > 0
        ? `ceil((HPP × ${markupMul.toFixed(2)} × ${ppnMul.toFixed(2)}) / 100) × 100`
        : `ceil((HPP × ${markupMul.toFixed(2)}) / 100) × 100`;

    // Save settings
    const handleSave = async () => {
        const mk = parseFloat(markupPercent);
        const pp = parseFloat(ppnPercent);
        if (isNaN(mk) || mk < 0 || mk > 100) {
            toast.error("Markup harus antara 0-100%");
            return;
        }
        if (isNaN(pp) || pp < 0 || pp > 100) {
            toast.error("PPN harus antara 0-100%");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    settings: [
                        { key: `${effectiveUnitType}_markup_percent`, value: markupPercent },
                        { key: `${effectiveUnitType}_ppn_percent`, value: ppnPercent },
                    ],
                }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal"); return; }
            toast.success("Pengaturan harga berhasil disimpan!");
        } catch {
            toast.error("Gagal menyimpan pengaturan");
        } finally {
            setIsSaving(false);
        }
    };

    // Preview recalculate
    const handlePreview = async () => {
        // Save first, then preview
        await handleSave();

        setIsRecalculating(true);
        try {
            const res = await fetch(`/api/toko/products/recalculate-prices?preview=true&unitType=${effectiveUnitType}`, {
                method: "POST",
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal"); return; }
            setPreviewResult(json.data);
        } catch {
            toast.error("Gagal preview harga");
        } finally {
            setIsRecalculating(false);
        }
    };

    // Apply recalculate
    const handleApply = async () => {
        if (!confirm("Yakin ingin menerapkan harga baru ke SEMUA produk?\n\nProduk tanpa HPP & kategori ROKOK tidak akan terpengaruh.")) return;

        setIsRecalculating(true);
        try {
            const res = await fetch(`/api/toko/products/recalculate-prices?unitType=${effectiveUnitType}`, {
                method: "POST",
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal"); return; }
            toast.success(json.message);
            setPreviewResult(json.data);
        } catch {
            toast.error("Gagal menerapkan harga");
        } finally {
            setIsRecalculating(false);
        }
    };

    const unitLabel = isResto ? "Resto" : unitType === "toko" ? "Toko" : unitType.replace(/_/g, " ");

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Manajemen Harga ${unitLabel}`}
                description="Konfigurasi markup dan PPN untuk formula harga jual otomatis"
                backHref="/toko/produk"
            />

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Settings Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Percent className="h-5 w-5" />
                            Pengaturan Markup & PPN
                        </CardTitle>
                        <CardDescription>
                            Atur persentase markup keuntungan dan PPN untuk unit {unitLabel}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="markup" className="text-sm font-semibold">Markup Keuntungan (%)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="markup"
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.5}
                                            value={markupPercent}
                                            onChange={e => setMarkupPercent(e.target.value)}
                                            className="max-w-[120px]"
                                        />
                                        <span className="text-sm text-muted-foreground">%</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Margin keuntungan yang ditambahkan ke HPP (Harga Pokok Penjualan)
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ppn" className="text-sm font-semibold">PPN (%)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="ppn"
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.5}
                                            value={ppnPercent}
                                            onChange={e => setPpnPercent(e.target.value)}
                                            className="max-w-[120px]"
                                        />
                                        <span className="text-sm text-muted-foreground">%</span>
                                        {ppnNum === 0 && (
                                            <Badge variant="secondary" className="text-xs">Tidak aktif</Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Pajak Pertambahan Nilai. Set 0 jika belum dikenakan PPN.
                                    </p>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Simpan Pengaturan
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Formula Preview Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5" />
                            Preview Formula
                        </CardTitle>
                        <CardDescription>
                            Simulasi hasil perhitungan harga jual berdasarkan pengaturan
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                            <div className="text-sm font-medium text-muted-foreground">Formula Aktif:</div>
                            <code className="block text-sm font-mono bg-background px-3 py-2 rounded border">
                                {formulaStr}
                            </code>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                            <div className="text-sm font-medium text-muted-foreground">Contoh Perhitungan:</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-muted-foreground">HPP (contoh):</span>
                                <span className="font-medium">{formatCurrency(exampleHPP)}</span>
                                <span className="text-muted-foreground">+ Markup {markupNum}%:</span>
                                <span className="font-medium">{formatCurrency(Math.round(exampleHPP * markupNum / 100))}</span>
                                {ppnNum > 0 && (
                                    <>
                                        <span className="text-muted-foreground">+ PPN {ppnNum}%:</span>
                                        <span className="font-medium">{formatCurrency(Math.round(exampleHPP * markupMul * ppnNum / 100))}</span>
                                    </>
                                )}
                                <span className="text-muted-foreground font-semibold border-t pt-1">Harga Jual:</span>
                                <span className="font-bold text-emerald-600 border-t pt-1">{formatCurrency(exampleSellPrice)}</span>
                            </div>
                        </div>

                        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                                    <p>• Harga dibulatkan ke atas kelipatan Rp 100</p>
                                    <p>• Produk kategori <strong>ROKOK</strong> menggunakan harga manual (HET)</p>
                                    <p>• Produk tanpa HPP (Rp 0) tidak terpengaruh</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recalculate Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        Hitung Ulang Semua Harga
                    </CardTitle>
                    <CardDescription>
                        Terapkan formula harga baru ke seluruh produk yang memiliki HPP
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={handlePreview} disabled={isRecalculating}>
                            {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                            Preview Perubahan
                        </Button>
                        <Button onClick={handleApply} disabled={isRecalculating} variant="default">
                            {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Terapkan Harga Baru
                        </Button>
                    </div>

                    {previewResult && (
                        <div className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-center gap-4 flex-wrap text-sm">
                                <Badge variant="default">{previewResult.mode === "preview" ? "Preview" : "Diterapkan"}</Badge>
                                <span>Formula: <code className="text-xs bg-muted px-1 py-0.5 rounded">{previewResult.formula}</code></span>
                                <span>Markup: <strong>{previewResult.markupPercent}%</strong></span>
                                {previewResult.ppnPercent > 0 && <span>PPN: <strong>{previewResult.ppnPercent}%</strong></span>}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Dengan HPP</p>
                                    <p className="text-lg font-bold">{previewResult.totalWithHPP}</p>
                                </div>
                                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
                                    <p className="text-xs text-muted-foreground">Akan Berubah</p>
                                    <p className="text-lg font-bold text-emerald-600">{previewResult.updated}</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Sudah Sesuai</p>
                                    <p className="text-lg font-bold">{previewResult.alreadyCorrect}</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Tanpa HPP</p>
                                    <p className="text-lg font-bold text-muted-foreground">{previewResult.noHPP}</p>
                                </div>
                            </div>

                            {previewResult.changes && previewResult.changes.length > 0 && (
                                <div className="max-h-[300px] overflow-y-auto rounded border">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/50 sticky top-0">
                                            <tr>
                                                <th className="text-left px-3 py-2">Produk</th>
                                                <th className="text-right px-3 py-2">HPP</th>
                                                <th className="text-right px-3 py-2">Harga Lama</th>
                                                <th className="text-right px-3 py-2">Harga Baru</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewResult.changes.map((c: any) => (
                                                <tr key={c.id} className="border-t">
                                                    <td className="px-3 py-1.5 font-medium">{c.name}</td>
                                                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(c.costPrice)}</td>
                                                    <td className="px-3 py-1.5 text-right tabular-nums text-red-500 line-through">{formatCurrency(c.oldSellPrice)}</td>
                                                    <td className="px-3 py-1.5 text-right tabular-nums text-emerald-600 font-bold">{formatCurrency(c.newSellPrice)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
