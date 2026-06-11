"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/constants";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface CashBankAccount {
    id: number;
    name: string;
    type: string;
    currentBalance: number;
}

interface AccountInfo {
    id: number;
    accountNo: string;
    balance: number;
    target: number;
    progress: number;
    member: { name: string };
    product: { name: string; type: string; adminFeeType: string | null; adminFeeValue: number | null };
}

export default function SetoranPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.accountId as string;

    const [account, setAccount] = React.useState<AccountInfo | null>(null);
    const [cashAccounts, setCashAccounts] = React.useState<CashBankAccount[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);

    const [formData, setFormData] = React.useState({
        amount: "",
        paymentMethod: "cash",
        cashBankAccountId: "",
        referenceNo: "",
        notes: "",
        transactionDate: new Date().toISOString().split("T")[0],
    });

    // Load account info
    React.useEffect(() => {
        async function loadData() {
            try {
                const [accountRes, cbRes] = await Promise.all([
                    fetch(`/api/haji-umrah/savings/${accountId}`),
                    fetch("/api/cash-bank/accounts"),
                ]);
                if (accountRes.ok) {
                    const json = await accountRes.json();
                    setAccount(json.data);
                }
                if (cbRes.ok) {
                    const json = await cbRes.json();
                    setCashAccounts(json.data || []);
                }
            } catch (err) {
                console.error(err);
                toast.error("Gagal memuat data");
            } finally {
                setLoading(false);
            }
        }
        if (accountId) loadData();
    }, [accountId]);

    // Calculate admin fee preview
    const amount = parseFloat(formData.amount) || 0;
    let adminFeePreview = 0;
    if (account?.product.adminFeeType && account.product.adminFeeValue && amount > 0) {
        if (account.product.adminFeeType === "percent") {
            adminFeePreview = Math.round(amount * Number(account.product.adminFeeValue) / 100);
        } else {
            adminFeePreview = Number(account.product.adminFeeValue);
        }
    }

    const totalAfterDeposit = (account?.balance ?? 0) + amount;
    const target = account?.target ?? 0;
    const willReachTarget = target > 0 && totalAfterDeposit >= target;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!amount || amount <= 0) {
            toast.error("Jumlah setoran harus lebih dari 0");
            return;
        }
        if (!formData.cashBankAccountId) {
            toast.error("Pilih akun kas/bank");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/haji-umrah/savings/${accountId}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount,
                    paymentMethod: formData.paymentMethod,
                    cashBankAccountId: parseInt(formData.cashBankAccountId),
                    referenceNo: formData.referenceNo || null,
                    notes: formData.notes || null,
                    transactionDate: formData.transactionDate,
                }),
            });

            if (res.ok) {
                const json = await res.json();
                toast.success(`Setoran berhasil! ${adminFeePreview > 0 ? `Admin fee: ${formatCurrency(json.meta.adminFee)}` : ""}`);
                router.push(`/haji-umrah/tabungan/${accountId}`);
            } else {
                const json = await res.json();
                toast.error(json.message || "Gagal membuat setoran");
            }
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!account) return null;

    const productLabel = account.product.type === "tabungan_haji" ? "Haji" : "Umrah";

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Setoran Tabungan ${productLabel}`}
                description={`${account.member.name} — ${account.accountNo}`}
                backHref={`/haji-umrah/tabungan/${accountId}`}
                backLabel="Detail Rekening"
            />

            <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
                {/* Form */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div>
                                <Label htmlFor="amount">Jumlah Setoran *</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="0"
                                    value={formData.amount}
                                    onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                                    min={0}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Metode Pembayaran</Label>
                                    <Select value={formData.paymentMethod} onValueChange={(v) => setFormData((f) => ({ ...f, paymentMethod: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Tunai</SelectItem>
                                            <SelectItem value="bank_transfer">Transfer Bank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Akun Kas/Bank *</Label>
                                    <Select value={formData.cashBankAccountId} onValueChange={(v) => setFormData((f) => ({ ...f, cashBankAccountId: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
                                        <SelectContent>
                                            {cashAccounts.map((cb) => (
                                                <SelectItem key={cb.id} value={String(cb.id)}>
                                                    {cb.name} ({formatCurrency(cb.currentBalance)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Tanggal Transaksi</Label>
                                    <Input
                                        type="date"
                                        value={formData.transactionDate}
                                        onChange={(e) => setFormData((f) => ({ ...f, transactionDate: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>No. Referensi</Label>
                                    <Input
                                        value={formData.referenceNo}
                                        onChange={(e) => setFormData((f) => ({ ...f, referenceNo: e.target.value }))}
                                        placeholder="Opsional"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Catatan</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                                    placeholder="Opsional"
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Summary Sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Ringkasan</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Saldo Saat Ini</span>
                                <span className="font-medium">{formatCurrency(account.balance)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Setoran</span>
                                <span className="font-medium">+ {formatCurrency(amount)}</span>
                            </div>
                            {adminFeePreview > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Admin Fee ({account.product.adminFeeType === "percent" ? `${account.product.adminFeeValue}%` : "fixed"})</span>
                                    <span className="text-orange-600">{formatCurrency(adminFeePreview)}</span>
                                </div>
                            )}
                            <hr />
                            <div className="flex justify-between">
                                <span className="font-medium">Saldo Setelah</span>
                                <span className="font-bold">{formatCurrency(totalAfterDeposit)}</span>
                            </div>
                            {target > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Target</span>
                                    <span>{formatCurrency(target)}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {willReachTarget && (
                        <div className="border border-green-500 bg-green-50 rounded-lg p-4 flex items-start gap-3">
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                            <span className="text-green-800">🎉 Setoran ini akan mencapai target!</span>
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Proses Setoran
                    </Button>
                </div>
            </form>
        </div>
    );
}
