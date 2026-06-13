"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/patterns/page-header";
import { formatCurrency } from "@/lib/constants";
import { ArrowLeft, ArrowRight, Check, Loader2, HandCoins } from "lucide-react";
import { toast } from "sonner";

interface GapAccount {
    accountId: number;
    accountNo: string;
    memberName: string;
    memberNrp: string | null;
    productType: string;
    productName: string;
    balance: number;
    targetAmount: number;
    gap: number;
    progress: number;
}

interface TalanganProduct {
    id: number;
    code: string;
    name: string;
    type: string;
    interestMethod: string;
    interestRate: number;
    minTenorMonths: number | null;
    maxTenorMonths: number | null;
    minAmount: number | null;
    maxAmount: number | null;
    adminFeeType: string | null;
    adminFeeValue: number | null;
}

export default function TalanganApplyPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedAccountId = searchParams.get("savingsAccountId");

    const [step, setStep] = React.useState(1);
    const [loading, setLoading] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);

    // Step 1 data
    const [accounts, setAccounts] = React.useState<GapAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = React.useState<number | null>(
        preselectedAccountId ? parseInt(preselectedAccountId) : null
    );

    // Step 2 data
    const [products, setProducts] = React.useState<TalanganProduct[]>([]);
    const [selectedProductId, setSelectedProductId] = React.useState<number | null>(null);
    const [amount, setAmount] = React.useState<number>(0);
    const [tenorMonths, setTenorMonths] = React.useState<number>(12);
    const [deductionSource, setDeductionSource] = React.useState<string>("gaji");
    const [autoDisburse, setAutoDisburse] = React.useState(false);

    const selectedAccount = accounts.find((a) => a.accountId === selectedAccountId);
    const selectedProduct = products.find((p) => p.id === selectedProductId);

    // Fetch accounts with gap
    React.useEffect(() => {
        async function fetchGap() {
            setLoading(true);
            try {
                const res = await fetch("/api/haji-umrah/talangan/gap?onlyWithGap=true");
                if (res.ok) {
                    const json = await res.json();
                    setAccounts(json.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchGap();
    }, []);

    // When account selected, auto-fill amount and fetch matching products
    React.useEffect(() => {
        if (selectedAccount) {
            setAmount(selectedAccount.gap);
            // Determine talangan type from savings product type
            const suffix = selectedAccount.productType.replace("tabungan_", ""); // "haji" or "umrah"
            const talType = `talangan_${suffix}`;
            fetch(`/api/haji-umrah/talangan/products?type=${talType}`)
                .then((r) => r.json())
                .then((json) => {
                    setProducts(json.data);
                    if (json.data.length === 1) {
                        setSelectedProductId(json.data[0].id);
                    }
                })
                .catch(console.error);
        }
    }, [selectedAccount]);

    // Simulation calculation
    const simulation = React.useMemo(() => {
        if (!selectedProduct || amount <= 0 || tenorMonths <= 0) return null;
        const rate = selectedProduct.interestRate;
        const interestPerMonth = Math.round(amount * (rate / 100));
        const totalInterest = interestPerMonth * tenorMonths;
        const totalAmount = amount + totalInterest;
        const monthlyInstallment = Math.round(totalAmount / tenorMonths);
        let adminFee = 0;
        if (selectedProduct.adminFeeType === "percent" && selectedProduct.adminFeeValue) {
            adminFee = Math.round(amount * (selectedProduct.adminFeeValue / 100));
        } else if (selectedProduct.adminFeeType === "fixed" && selectedProduct.adminFeeValue) {
            adminFee = selectedProduct.adminFeeValue;
        }
        const disbursed = amount - adminFee;
        return { monthlyInstallment, totalInterest, totalAmount, adminFee, disbursed, interestPerMonth };
    }, [selectedProduct, amount, tenorMonths]);

    const handleSubmit = async () => {
        if (!selectedAccountId || !selectedProductId) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/haji-umrah/talangan/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    savingsAccountId: selectedAccountId,
                    productId: selectedProductId,
                    amount,
                    tenorMonths,
                    deductionSource,
                    autoDisburse,
                    notes: `Pengajuan talangan via H&U dashboard`,
                }),
            });
            const json = await res.json();
            if (res.ok) {
                toast.success(json.message);
                if (json.data?.applicationId) {
                    router.push(`/haji-umrah/talangan/${json.data.applicationId}`);
                } else {
                    router.push("/haji-umrah/talangan");
                }
            } else {
                toast.error(json.message || "Gagal mengajukan talangan");
            }
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title="Pengajuan Talangan"
                description="Buat pengajuan talangan haji/umrah untuk menutup gap tabungan"
                actions={
                    <Button variant="ghost" onClick={() => router.push("/haji-umrah/talangan")}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                    </Button>
                }
            />

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
                {[
                    { n: 1, label: "Pilih Rekening" },
                    { n: 2, label: "Produk & Tenor" },
                    { n: 3, label: "Konfirmasi" },
                ].map((s, i) => (
                    <React.Fragment key={s.n}>
                        <button
                            onClick={() => s.n < step && setStep(s.n)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                step === s.n ? "bg-primary text-primary-foreground" :
                                step > s.n ? "bg-primary/10 text-primary cursor-pointer" :
                                "bg-muted text-muted-foreground"
                            }`}
                        >
                            {step > s.n ? <Check className="h-4 w-4" /> : s.n}
                            <span className="hidden sm:inline">{s.label}</span>
                        </button>
                        {i < 2 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                    </React.Fragment>
                ))}
            </div>

            {/* Step 1: Select Account */}
            {step === 1 && (
                <Card>
                    <CardHeader><CardTitle>Pilih Rekening Tabungan</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <p className="text-muted-foreground">Memuat data rekening...</p>
                        ) : accounts.length === 0 ? (
                            <p className="text-muted-foreground">Tidak ada rekening yang memerlukan talangan.</p>
                        ) : (
                            <div className="space-y-3">
                                <Label>Rekening dengan Gap</Label>
                                <Select
                                    value={selectedAccountId ? String(selectedAccountId) : ""}
                                    onValueChange={(v) => setSelectedAccountId(parseInt(v))}
                                >
                                    <SelectTrigger><SelectValue placeholder="Pilih rekening..." /></SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((a) => (
                                            <SelectItem key={a.accountId} value={String(a.accountId)}>
                                                {a.accountNo} — {a.memberName} (Gap: {formatCurrency(a.gap)})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {selectedAccount && (
                                    <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Anggota</span>
                                            <span className="font-medium">{selectedAccount.memberName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Jenis</span>
                                            <Badge variant="outline">
                                                {selectedAccount.productType === "tabungan_haji" ? "Haji" : "Umrah"}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Saldo</span>
                                            <span>{formatCurrency(selectedAccount.balance)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Target</span>
                                            <span>{formatCurrency(selectedAccount.targetAmount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-muted-foreground">Gap</span>
                                            <span className="text-red-600 font-bold">{formatCurrency(selectedAccount.gap)}</span>
                                        </div>
                                        <div className="pt-2">
                                            <div className="w-full bg-muted rounded-full h-3">
                                                <div
                                                    className="bg-primary h-3 rounded-full transition-all"
                                                    style={{ width: `${Math.min(100, selectedAccount.progress)}%` }}
                                                />
                                            </div>
                                            <p className="text-center text-sm mt-1">{selectedAccount.progress}% tercapai</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex justify-end">
                            <Button disabled={!selectedAccountId} onClick={() => setStep(2)}>
                                Lanjut <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Product & Tenor */}
            {step === 2 && (
                <Card>
                    <CardHeader><CardTitle>Pilih Produk & Tenor</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Produk Talangan</Label>
                            {products.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Tidak ada produk talangan tersedia.</p>
                            ) : (
                                <Select
                                    value={selectedProductId ? String(selectedProductId) : ""}
                                    onValueChange={(v) => setSelectedProductId(parseInt(v))}
                                >
                                    <SelectTrigger><SelectValue placeholder="Pilih produk..." /></SelectTrigger>
                                    <SelectContent>
                                        {products.map((p) => (
                                            <SelectItem key={p.id} value={String(p.id)}>
                                                {p.name} ({p.interestRate}%/bln, {p.minTenorMonths}-{p.maxTenorMonths} bulan)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Jumlah Talangan</Label>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                min={selectedProduct?.minAmount ?? 0}
                                max={selectedAccount?.gap ?? 0}
                            />
                            {selectedAccount && (
                                <p className="text-xs text-muted-foreground">
                                    Maks: {formatCurrency(selectedAccount.gap)} (gap tabungan)
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Tenor (Bulan)</Label>
                            <Input
                                type="number"
                                value={tenorMonths}
                                onChange={(e) => setTenorMonths(Number(e.target.value))}
                                min={selectedProduct?.minTenorMonths ?? 1}
                                max={selectedProduct?.maxTenorMonths ?? 60}
                            />
                            {selectedProduct && (
                                <p className="text-xs text-muted-foreground">
                                    Range: {selectedProduct.minTenorMonths}-{selectedProduct.maxTenorMonths} bulan
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Sumber Potongan</Label>
                            <Select value={deductionSource} onValueChange={setDeductionSource}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gaji">Potong Gaji</SelectItem>
                                    <SelectItem value="tunkin">Potong Tunjangan Kinerja</SelectItem>
                                    <SelectItem value="bs">Bayar Sendiri</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Simulation */}
                        {simulation && (
                            <div className="border rounded-lg p-4 space-y-2 bg-blue-50">
                                <h4 className="font-semibold text-sm">Simulasi Angsuran</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-muted-foreground">Angsuran/Bulan</span>
                                    <span className="font-medium">{formatCurrency(simulation.monthlyInstallment)}</span>
                                    <span className="text-muted-foreground">Total Bunga</span>
                                    <span>{formatCurrency(simulation.totalInterest)}</span>
                                    <span className="text-muted-foreground">Total Bayar</span>
                                    <span className="font-semibold">{formatCurrency(simulation.totalAmount)}</span>
                                    <span className="text-muted-foreground">Admin Fee</span>
                                    <span>{formatCurrency(simulation.adminFee)}</span>
                                    <span className="text-muted-foreground">Dana Cair</span>
                                    <span className="text-green-600 font-medium">{formatCurrency(simulation.disbursed)}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep(1)}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                            </Button>
                            <Button
                                disabled={!selectedProductId || amount <= 0 || tenorMonths <= 0}
                                onClick={() => setStep(3)}
                            >
                                Lanjut <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Confirmation */}
            {step === 3 && (
                <Card>
                    <CardHeader><CardTitle>Konfirmasi Pengajuan</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border rounded-lg p-4 space-y-3">
                            <h4 className="font-semibold">Ringkasan</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-muted-foreground">Anggota</span>
                                <span className="font-medium">{selectedAccount?.memberName}</span>
                                <span className="text-muted-foreground">Rekening</span>
                                <span className="font-mono">{selectedAccount?.accountNo}</span>
                                <span className="text-muted-foreground">Produk</span>
                                <span>{selectedProduct?.name}</span>
                                <span className="text-muted-foreground">Jumlah Talangan</span>
                                <span className="font-semibold">{formatCurrency(amount)}</span>
                                <span className="text-muted-foreground">Tenor</span>
                                <span>{tenorMonths} bulan</span>
                                <span className="text-muted-foreground">Sumber Potongan</span>
                                <span>{deductionSource === "gaji" ? "Potong Gaji" : deductionSource === "tunkin" ? "Tunjangan Kinerja" : "Bayar Sendiri"}</span>
                            </div>

                            {simulation && (
                                <>
                                    <hr />
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <span className="text-muted-foreground">Angsuran/Bulan</span>
                                        <span className="font-bold text-primary">{formatCurrency(simulation.monthlyInstallment)}</span>
                                        <span className="text-muted-foreground">Total Bayar</span>
                                        <span>{formatCurrency(simulation.totalAmount)}</span>
                                        <span className="text-muted-foreground">Dana Cair</span>
                                        <span className="text-green-600">{formatCurrency(simulation.disbursed)}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="autoDisburse"
                                checked={autoDisburse}
                                onChange={(e) => setAutoDisburse(e.target.checked)}
                                className="rounded"
                            />
                            <Label htmlFor="autoDisburse" className="text-sm">
                                Langsung cairkan tanpa approval (jika memenuhi syarat)
                            </Label>
                        </div>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep(2)}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                            </Button>
                            <Button onClick={handleSubmit} disabled={submitting}>
                                {submitting ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</>
                                ) : (
                                    <><HandCoins className="mr-2 h-4 w-4" /> Ajukan Talangan</>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
