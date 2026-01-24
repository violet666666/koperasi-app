"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, ArrowUpCircle, ArrowDownCircle, Wallet, Building } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

// Mock accounts
const MOCK_ACCOUNTS = [
    { id: 1, code: "K-001", name: "Kas Besar", type: "cash", balance: 25000000 },
    { id: 2, code: "K-002", name: "Kas Kecil", type: "cash", balance: 5000000 },
    { id: 3, code: "B-001", name: "Bank BCA", type: "bank", balance: 150000000 },
    { id: 4, code: "B-002", name: "Bank Mandiri", type: "bank", balance: 85000000 },
];

export default function TambahTransaksiKasBankPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [formData, setFormData] = React.useState({
        account_id: "",
        type: "in" as "in" | "out",
        amount: "",
        description: "",
        reference_no: "",
        transaction_date: new Date().toISOString().split("T")[0],
    });

    const selectedAccount = MOCK_ACCOUNTS.find((a) => a.id.toString() === formData.account_id);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.account_id || !formData.amount || !formData.description) {
            toast.error("Mohon lengkapi semua field yang wajib");
            return;
        }

        const amount = parseFloat(formData.amount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Jumlah harus lebih dari 0");
            return;
        }

        // Check balance for outgoing transactions
        if (formData.type === "out" && selectedAccount && amount > selectedAccount.balance) {
            toast.error(`Saldo tidak mencukupi. Saldo tersedia: ${formatCurrency(selectedAccount.balance)}`);
            return;
        }

        setIsSubmitting(true);
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1500));

            toast.success(
                formData.type === "in"
                    ? "Transaksi masuk berhasil dicatat"
                    : "Transaksi keluar berhasil dicatat"
            );
            router.push("/kas-bank");
        } catch (error) {
            toast.error("Gagal menyimpan transaksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Transaksi Kas/Bank Baru"
                description="Catat transaksi masuk atau keluar kas/bank"
                backHref="/kas-bank"
            />

            <form onSubmit={handleSubmit}>
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Transaction Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Detail Transaksi</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Account Selection */}
                            <div>
                                <Label htmlFor="account">Akun Kas/Bank *</Label>
                                <Select
                                    value={formData.account_id}
                                    onValueChange={(value) => setFormData((p) => ({ ...p, account_id: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih akun" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MOCK_ACCOUNTS.map((account) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                <div className="flex items-center gap-2">
                                                    {account.type === "cash" ? (
                                                        <Wallet className="h-4 w-4 text-emerald-500" />
                                                    ) : (
                                                        <Building className="h-4 w-4 text-blue-500" />
                                                    )}
                                                    <span>{account.name}</span>
                                                    <span className="text-muted-foreground">({account.code})</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedAccount && (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Saldo saat ini: <span className="font-medium">{formatCurrency(selectedAccount.balance)}</span>
                                    </p>
                                )}
                            </div>

                            {/* Transaction Type */}
                            <div>
                                <Label>Jenis Transaksi *</Label>
                                <RadioGroup
                                    value={formData.type}
                                    onValueChange={(value: "in" | "out") => setFormData((p) => ({ ...p, type: value }))}
                                    className="mt-2 flex gap-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="in" id="type-in" />
                                        <Label htmlFor="type-in" className="flex items-center gap-2 font-normal cursor-pointer">
                                            <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                                            Masuk
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="out" id="type-out" />
                                        <Label htmlFor="type-out" className="flex items-center gap-2 font-normal cursor-pointer">
                                            <ArrowDownCircle className="h-4 w-4 text-amber-500" />
                                            Keluar
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* Amount */}
                            <div>
                                <Label htmlFor="amount">Jumlah *</Label>
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
                                <Label htmlFor="transaction_date">Tanggal Transaksi *</Label>
                                <Input
                                    id="transaction_date"
                                    type="date"
                                    value={formData.transaction_date}
                                    onChange={(e) => setFormData((p) => ({ ...p, transaction_date: e.target.value }))}
                                />
                            </div>

                            {/* Reference Number */}
                            <div>
                                <Label htmlFor="reference_no">No. Referensi</Label>
                                <Input
                                    id="reference_no"
                                    value={formData.reference_no}
                                    onChange={(e) => setFormData((p) => ({ ...p, reference_no: e.target.value }))}
                                    placeholder="Opsional"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <Label htmlFor="description">Keterangan *</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                                    placeholder="Jelaskan tujuan transaksi"
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary Card */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Ringkasan</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {selectedAccount ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Akun</span>
                                            <span className="font-medium">{selectedAccount.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Saldo Sebelum</span>
                                            <span className="font-medium tabular-nums">{formatCurrency(selectedAccount.balance)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                                {formData.type === "in" ? "Tambah" : "Kurang"}
                                            </span>
                                            <span className={`font-medium tabular-nums ${formData.type === "in" ? "text-emerald-600" : "text-amber-600"}`}>
                                                {formData.type === "in" ? "+" : "-"}{formatCurrency(parseFloat(formData.amount) || 0)}
                                            </span>
                                        </div>
                                        <hr />
                                        <div className="flex justify-between text-lg">
                                            <span className="font-medium">Saldo Setelah</span>
                                            <span className="font-bold tabular-nums">
                                                {formatCurrency(
                                                    formData.type === "in"
                                                        ? selectedAccount.balance + (parseFloat(formData.amount) || 0)
                                                        : selectedAccount.balance - (parseFloat(formData.amount) || 0)
                                                )}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-center text-muted-foreground py-4">
                                        Pilih akun untuk melihat ringkasan
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
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Simpan Transaksi
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
