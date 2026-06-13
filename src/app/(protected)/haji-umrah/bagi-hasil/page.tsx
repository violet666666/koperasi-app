"use client";

import React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/constants";
import { Loader2, Eye, Send, History, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface CashBankAccount {
    id: number;
    name: string;
    type: string;
    currentBalance: number;
}

interface Distribution {
    id: number;
    distributionNo: string;
    periodLabel: string;
    totalBsiAmount: number;
    memberRate: number;
    memberPoolAmount: number;
    spreadAmount: number;
    memberCount: number;
    status: string;
    processedAt: string | null;
    voidedAt: string | null;
    itemCount: number;
}

interface PreviewItem {
    memberId: number;
    memberName: string;
    accountNo: string;
    productName: string;
    productType: string;
    balanceSnapshot: number;
    sharePercent: number;
    amount: number;
}

interface Preview {
    summary: {
        totalBsiAmount: number;
        memberRate: number;
        memberPool: number;
        spread: number;
        totalBalanceSnapshot: number;
        memberCount: number;
    };
    items: PreviewItem[];
}

export default function BagiHasilPage() {
    const [cashAccounts, setCashAccounts] = React.useState<CashBankAccount[]>([]);
    const [distributions, setDistributions] = React.useState<Distribution[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [previewing, setPreviewing] = React.useState(false);
    const [processing, setProcessing] = React.useState(false);
    const [preview, setPreview] = React.useState<Preview | null>(null);

    const [form, setForm] = React.useState({
        periodLabel: "",
        periodStart: "",
        periodEnd: "",
        totalBsiAmount: "",
        memberRate: "70",
        cashBankAccountId: "",
        notes: "",
    });

    const loadData = React.useCallback(async () => {
        try {
            const [cbRes, listRes] = await Promise.all([
                fetch("/api/cash-bank/accounts"),
                fetch("/api/haji-umrah/bagi-hasil?perPage=20"),
            ]);
            if (cbRes.ok) {
                const json = await cbRes.json();
                setCashAccounts(json.data || []);
            }
            if (listRes.ok) {
                const json = await listRes.json();
                setDistributions(json.data || []);
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat data");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    function update<K extends keyof typeof form>(key: K, value: string) {
        setForm((f) => ({ ...f, [key]: value }));
        setPreview(null); // invalidate preview when inputs change
    }

    function validateForm(): string | null {
        if (!form.periodLabel.trim()) return "Label periode wajib diisi";
        if (!form.periodStart) return "Tanggal mulai periode wajib diisi";
        if (!form.periodEnd) return "Tanggal akhir periode wajib diisi";
        const amount = parseFloat(form.totalBsiAmount);
        if (!amount || amount <= 0) return "Total bagi hasil BSI harus lebih dari 0";
        const rate = parseFloat(form.memberRate);
        if (isNaN(rate) || rate < 0 || rate > 100) return "Rate anggota harus 0-100";
        return null;
    }

    function buildPayload(dryRun: boolean) {
        return {
            periodLabel: form.periodLabel.trim(),
            periodStart: form.periodStart,
            periodEnd: form.periodEnd,
            totalBsiAmount: parseFloat(form.totalBsiAmount),
            memberRate: parseFloat(form.memberRate),
            cashBankAccountId: form.cashBankAccountId ? parseInt(form.cashBankAccountId) : null,
            notes: form.notes.trim() || null,
            dryRun,
        };
    }

    async function handlePreview() {
        const err = validateForm();
        if (err) {
            toast.error(err);
            return;
        }
        setPreviewing(true);
        try {
            const res = await fetch("/api/haji-umrah/bagi-hasil", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(true)),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal membuat preview");
                setPreview(null);
                return;
            }
            setPreview({ summary: json.summary, items: json.items });
            toast.success(`Preview: ${json.summary.memberCount} anggota, pool ${formatCurrency(json.summary.memberPool)}`);
        } catch (e) {
            console.error(e);
            toast.error("Gagal membuat preview");
        } finally {
            setPreviewing(false);
        }
    }

    async function handleProcess() {
        if (!form.cashBankAccountId) {
            toast.error("Akun kas/bank wajib dipilih untuk memproses distribusi");
            return;
        }
        if (!confirm("Konfirmasi proses distribusi bagi hasil? Saldo tabungan anggota akan dikredit dan spread masuk kas/bank.")) {
            return;
        }
        setProcessing(true);
        try {
            const res = await fetch("/api/haji-umrah/bagi-hasil", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(false)),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal memproses distribusi");
                return;
            }
            toast.success(`Distribusi ${json.data.distributionNo} berhasil diproses`);
            setPreview(null);
            setForm({
                periodLabel: "",
                periodStart: "",
                periodEnd: "",
                totalBsiAmount: "",
                memberRate: "70",
                cashBankAccountId: form.cashBankAccountId,
                notes: "",
            });
            await loadData();
        } catch (e) {
            console.error(e);
            toast.error("Gagal memproses distribusi");
        } finally {
            setProcessing(false);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Spread Bagi Hasil BSI"
                description="Input bagi hasil dari BSI per periode — sistem distribusi ke saldo anggota (proporsional) dan spread masuk kas koperasi."
            />

            {/* New Distribution Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" /> Distribusi Baru
                    </CardTitle>
                    <CardDescription>
                        BSI membayar bagi hasil ke koperasi. Rate anggota menentukan porsi yang didistribusi ke saldo
                        tabungan H&U anggota — sisanya adalah spread (pendapatan koperasi).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="periodLabel">Label Periode *</Label>
                            <Input
                                id="periodLabel"
                                placeholder="cth: Mei 2026"
                                value={form.periodLabel}
                                onChange={(e) => update("periodLabel", e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="periodStart">Periode Mulai *</Label>
                            <Input
                                id="periodStart"
                                type="date"
                                value={form.periodStart}
                                onChange={(e) => update("periodStart", e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="periodEnd">Periode Akhir *</Label>
                            <Input
                                id="periodEnd"
                                type="date"
                                value={form.periodEnd}
                                onChange={(e) => update("periodEnd", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="totalBsi">Total Bagi Hasil BSI (X) *</Label>
                            <Input
                                id="totalBsi"
                                type="number"
                                placeholder="0"
                                value={form.totalBsiAmount}
                                onChange={(e) => update("totalBsiAmount", e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="memberRate">Rate Anggota (%) *</Label>
                            <Input
                                id="memberRate"
                                type="number"
                                min={0}
                                max={100}
                                value={form.memberRate}
                                onChange={(e) => update("memberRate", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Pool anggota = X × rate%. Spread (koperasi) = X − pool.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Akun Kas/Bank (Spread) *</Label>
                            <Select
                                value={form.cashBankAccountId}
                                onValueChange={(v) => update("cashBankAccountId", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih akun..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {cashAccounts.map((acc) => (
                                        <SelectItem key={acc.id} value={String(acc.id)}>
                                            {acc.name} ({formatCurrency(acc.currentBalance)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Catatan (opsional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="cth: Bagi hasil sesuai statement BSI bulan Mei 2026"
                            value={form.notes}
                            onChange={(e) => update("notes", e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        <Button variant="outline" onClick={handlePreview} disabled={previewing}>
                            {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                            Preview Distribusi
                        </Button>
                        {preview && (
                            <Button onClick={handleProcess} disabled={processing}>
                                {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                                Proses Distribusi ({preview.summary.memberCount} anggota)
                            </Button>
                        )}
                    </div>

                    {/* Preview result */}
                    {preview && (
                        <div className="space-y-3 rounded-lg border bg-slate-50/50 p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">Total BSI (X)</p>
                                    <p className="font-bold">{formatCurrency(preview.summary.totalBsiAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Pool Anggota ({preview.summary.memberRate}%)</p>
                                    <p className="font-bold text-emerald-700">{formatCurrency(preview.summary.memberPool)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Spread Koperasi</p>
                                    <p className="font-bold text-blue-700">{formatCurrency(preview.summary.spread)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Saldo Snapshot</p>
                                    <p className="font-bold">{formatCurrency(preview.summary.totalBalanceSnapshot)}</p>
                                </div>
                            </div>

                            <div className="rounded-md border bg-white max-h-80 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Anggota</TableHead>
                                            <TableHead>Rekening</TableHead>
                                            <TableHead>Produk</TableHead>
                                            <TableHead className="text-right">Saldo</TableHead>
                                            <TableHead className="text-right">Share %</TableHead>
                                            <TableHead className="text-right">Bagi Hasil</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {preview.items.map((it) => (
                                            <TableRow key={it.savingsAccountId || it.memberId}>
                                                <TableCell className="font-medium">{it.memberName}</TableCell>
                                                <TableCell className="font-mono text-xs">{it.accountNo}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {it.productType === "tabungan_haji" ? "Haji" : "Umrah"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(it.balanceSnapshot)}</TableCell>
                                                <TableCell className="text-right">{it.sharePercent.toFixed(4)}%</TableCell>
                                                <TableCell className="text-right font-bold text-emerald-700">
                                                    {formatCurrency(it.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* History */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" /> Riwayat Distribusi
                    </CardTitle>
                    <CardDescription>Semua distribusi bagi hasil yang pernah diproses</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : distributions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <TrendingUp className="h-10 w-10 mx-auto opacity-20 mb-2" />
                            <p>Belum ada distribusi bagi hasil.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No. Distribusi</TableHead>
                                        <TableHead>Periode</TableHead>
                                        <TableHead className="text-right">Total BSI</TableHead>
                                        <TableHead className="text-right">Rate</TableHead>
                                        <TableHead className="text-right">Pool Anggota</TableHead>
                                        <TableHead className="text-right">Spread</TableHead>
                                        <TableHead className="text-right">Anggota</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {distributions.map((d) => (
                                        <TableRow key={d.id}>
                                            <TableCell className="font-mono text-xs">{d.distributionNo}</TableCell>
                                            <TableCell className="font-medium">{d.periodLabel}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(d.totalBsiAmount)}</TableCell>
                                            <TableCell className="text-right">{d.memberRate}%</TableCell>
                                            <TableCell className="text-right text-emerald-700">{formatCurrency(d.memberPoolAmount)}</TableCell>
                                            <TableCell className="text-right text-blue-700">{formatCurrency(d.spreadAmount)}</TableCell>
                                            <TableCell className="text-right">{d.memberCount}</TableCell>
                                            <TableCell>
                                                {d.status === "processed" ? (
                                                    <Badge className="bg-green-500 text-white">Processed</Badge>
                                                ) : d.status === "voided" ? (
                                                    <Badge variant="destructive">Voided</Badge>
                                                ) : (
                                                    <Badge variant="secondary">{d.status}</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button asChild variant="ghost" size="sm">
                                                    <Link href={`/haji-umrah/bagi-hasil/${d.id}`}>Detail</Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
