"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, ArrowRight, Wallet, Building } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

// Will map from API response
type AccountType = {
    id: number;
    code: string;
    name: string;
    type: string;
    currentBalance: string | number;
};

export default function TransferKasBankPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [formData, setFormData] = React.useState({
        from_account_id: "",
        to_account_id: "",
        amount: "",
        description: "",
        transaction_date: new Date().toISOString().split("T")[0],
    });

    const [accounts, setAccounts] = React.useState<AccountType[]>([]);
    
    React.useEffect(() => {
        async function fetchAccounts() {
            try {
                const res = await fetch("/api/cash-bank/accounts");
                if (res.ok) {
                    const json = await res.json();
                    setAccounts(json.data || []);
                }
            } catch (error) {
                toast.error("Gagal memuat daftar akun");
            }
        }
        fetchAccounts();
    }, []);

    const fromAccount = accounts.find((a) => a.id.toString() === formData.from_account_id);
    const toAccount = accounts.find((a) => a.id.toString() === formData.to_account_id);
    
    const getBalance = (acc?: AccountType) => acc ? Number(acc.currentBalance || 0) : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.from_account_id || !formData.to_account_id || !formData.amount) {
            toast.error("Mohon lengkapi semua field yang wajib");
            return;
        }

        if (formData.from_account_id === formData.to_account_id) {
            toast.error("Akun sumber dan tujuan tidak boleh sama");
            return;
        }

        const amount = parseFloat(formData.amount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Jumlah harus lebih dari 0");
            return;
        }

        const fromBal = getBalance(fromAccount);
        if (fromAccount && amount > fromBal) {
            toast.error(`Saldo tidak mencukupi. Saldo tersedia: ${formatCurrency(fromBal)}`);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/cash-bank/transfers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fromAccountId: Number(formData.from_account_id),
                    toAccountId: Number(formData.to_account_id),
                    amount,
                    description: formData.description,
                    transactionDate: formData.transaction_date ? new Date(formData.transaction_date).toISOString() : new Date().toISOString(),
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal melakukan transfer");

            toast.success("Transfer berhasil dilakukan");
            router.push("/kas-bank");
        } catch (error: any) {
            toast.error(error.message || "Gagal melakukan transfer");
        } finally {
            setIsSubmitting(false);
        }
    };

    const availableToAccounts = accounts.filter((a) => a.id.toString() !== formData.from_account_id);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Transfer Antar Kas/Bank"
                description="Pindahkan dana antar rekening kas atau bank"
                backHref="/kas-bank"
            />

            <form onSubmit={handleSubmit}>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Detail Transfer</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Transfer Flow */}
                            <div className="grid gap-4 sm:grid-cols-[1fr,auto,1fr] items-end">
                                <div>
                                    <Label htmlFor="from_account">Dari Akun *</Label>
                                    <Select
                                        value={formData.from_account_id}
                                        onValueChange={(value) => setFormData((p) => ({ ...p, from_account_id: value, to_account_id: "" }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih akun sumber" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts.map((account) => (
                                                <SelectItem key={account.id} value={account.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                        {account.type === "cash" ? (
                                                            <Wallet className="h-4 w-4 text-emerald-500" />
                                                        ) : (
                                                            <Building className="h-4 w-4 text-blue-500" />
                                                        )}
                                                        <span>{account.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fromAccount && (
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Saldo: <span className="font-medium">{formatCurrency(getBalance(fromAccount))}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-center pb-6">
                                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                                </div>

                                <div>
                                    <Label htmlFor="to_account">Ke Akun *</Label>
                                    <Select
                                        value={formData.to_account_id}
                                        onValueChange={(value) => setFormData((p) => ({ ...p, to_account_id: value }))}
                                        disabled={!formData.from_account_id}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih akun tujuan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableToAccounts.map((account) => (
                                                <SelectItem key={account.id} value={account.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                        {account.type === "cash" ? (
                                                            <Wallet className="h-4 w-4 text-emerald-500" />
                                                        ) : (
                                                            <Building className="h-4 w-4 text-blue-500" />
                                                        )}
                                                        <span>{account.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {toAccount && (
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Saldo: <span className="font-medium">{formatCurrency(getBalance(toAccount))}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <Label htmlFor="amount">Jumlah Transfer *</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                                    <Input
                                        id="amount"
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                                        className="pl-10"
                                        placeholder="0"
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Transaction Date */}
                            <div>
                                <Label htmlFor="transaction_date">Tanggal Transfer *</Label>
                                <Input
                                    id="transaction_date"
                                    type="date"
                                    value={formData.transaction_date}
                                    onChange={(e) => setFormData((p) => ({ ...p, transaction_date: e.target.value }))}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <Label htmlFor="description">Keterangan</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                                    placeholder="Keterangan transfer (opsional)"
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary Card */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Ringkasan Transfer</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {fromAccount && toAccount ? (
                                    <>
                                        <div className="p-4 rounded-lg bg-muted space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Dari</span>
                                                <span className="font-medium">{fromAccount.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Saldo Sebelum</span>
                                                <span className="tabular-nums">{formatCurrency(getBalance(fromAccount))}</span>
                                            </div>
                                            <div className="flex justify-between text-amber-600">
                                                <span>Dikurangi</span>
                                                <span className="font-medium tabular-nums">-{formatCurrency(parseFloat(formData.amount) || 0)}</span>
                                            </div>
                                            <hr />
                                            <div className="flex justify-between font-medium">
                                                <span>Saldo Setelah</span>
                                                <span className="tabular-nums">{formatCurrency(getBalance(fromAccount) - (parseFloat(formData.amount) || 0))}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-center">
                                            <ArrowRight className="h-6 w-6 text-primary" />
                                        </div>

                                        <div className="p-4 rounded-lg bg-muted space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Ke</span>
                                                <span className="font-medium">{toAccount.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Saldo Sebelum</span>
                                                <span className="tabular-nums">{formatCurrency(getBalance(toAccount))}</span>
                                            </div>
                                            <div className="flex justify-between text-emerald-600">
                                                <span>Ditambah</span>
                                                <span className="font-medium tabular-nums">+{formatCurrency(parseFloat(formData.amount) || 0)}</span>
                                            </div>
                                            <hr />
                                            <div className="flex justify-between font-medium">
                                                <span>Saldo Setelah</span>
                                                <span className="tabular-nums">{formatCurrency(getBalance(toAccount) + (parseFloat(formData.amount) || 0))}</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">
                                        Pilih akun sumber dan tujuan untuk melihat ringkasan
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Submit Button */}
                        <div className="flex gap-4">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                                Batal
                            </Button>
                            <Button type="submit" className="flex-1" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Transfer
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
