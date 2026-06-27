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
import { Loader2, Save, ArrowUpCircle, ArrowDownCircle, Wallet, Building, AlertTriangle } from "lucide-react";
import { formatCurrency, CASH_BANK_CATEGORIES } from "@/lib/constants";
import { detectCategoryMismatch } from "@/lib/services/cash-bank-category-guard";
import { cashBankApi, CashBankAccount } from "@/lib/api";
import { ApiError } from "@/lib/api/client";

export default function TambahTransaksiKasBankPage() {
    const router = useRouter();
    const [accounts, setAccounts] = React.useState<CashBankAccount[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [formData, setFormData] = React.useState({
        account_id: "",
        type: "in" as "in" | "out",
        category: "",
        amount: "",
        description: "",
        reference_no: "",
        transaction_date: new Date().toISOString().split("T")[0],
    });
    const [miscatReason, setMiscatReason] = React.useState("");
    const [confirmMiscat, setConfirmMiscat] = React.useState(false);

    React.useEffect(() => {
        async function fetchAccounts() {
            try {
                const res = await cashBankApi.accounts();
                const accountData = (res as any).data || [];
                setAccounts(accountData as CashBankAccount[]);
            } catch (error) {
                toast.error("Gagal memuat daftar akun kas/bank");
            } finally {
                setIsLoadingAccounts(false);
            }
        }
        fetchAccounts();
    }, []);

    const selectedAccount = accounts.find((a) => a.id.toString() === formData.account_id);
    
    // Filter categories based on transaction type
    const availableCategories = Object.entries(CASH_BANK_CATEGORIES).filter(
        ([_, cat]) => cat.type === formData.type || cat.type === "both"
    );

    // Guard: deteksi salah kategori Kas Keluar (transfer/pencairan yg dicatat sbg biaya
    // operasional → menggelembungkan beban SHU). Lihat cash-bank-category-guard.ts.
    const miscat = formData.type === "out" && formData.category && formData.category !== "none"
        ? detectCategoryMismatch(formData.type, formData.category, formData.description)
        : null;
    const miscatKey = miscat ? miscat.signal : null;
    React.useEffect(() => {
        if (!miscatKey) {
            setConfirmMiscat(false);
            setMiscatReason("");
        }
    }, [miscatKey]);

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
        if (formData.type === "out" && selectedAccount && amount > selectedAccount.currentBalance) {
            toast.error(`Saldo tidak mencukupi. Saldo tersedia: ${formatCurrency(selectedAccount.currentBalance)}`);
            return;
        }

        // Guard kategori — cegah transfer/pencairan dicatat sbg biaya operasional (merusak SHU)
        if (miscat && !confirmMiscat) {
            toast.error(`${miscat.message} Jika yakin, centang konfirmasi paksa & isi alasan di kotak peringatan.`);
            return;
        }
        if (miscat && confirmMiscat && miscatReason.trim().length < 3) {
            toast.error("Isi alasan override (min 3 karakter) di kotak peringatan.");
            return;
        }

        setIsSubmitting(true);
        try {
            await cashBankApi.createTransaction({
                accountId: parseInt(formData.account_id),
                type: formData.type,
                category: formData.category || undefined,
                amount,
                description: formData.description,
                transactionDate: new Date(formData.transaction_date).toISOString(),
                ...(miscat && confirmMiscat ? { confirmMiscat: true, miscatReason: miscatReason.trim() } : {}),
            });

            toast.success(
                formData.type === "in"
                    ? "Transaksi masuk berhasil dicatat"
                    : "Transaksi keluar berhasil dicatat"
            );
            router.push("/kas-bank");
        } catch (error) {
            if (error instanceof ApiError && (error.data as any)?.requiresConfirm) {
                toast.error((error.data as any)?.message || "Kategori tidak sesuai deskripsi. Periksa kotak peringatan.");
            } else {
                toast.error("Gagal menyimpan transaksi");
            }
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
                                        {accounts.map((account) => (
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
                                        Saldo saat ini: <span className="font-medium">{formatCurrency(selectedAccount.currentBalance)}</span>
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
                                            Masuk (Debit)
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="out" id="type-out" />
                                        <Label htmlFor="type-out" className="flex items-center gap-2 font-normal cursor-pointer">
                                            <ArrowDownCircle className="h-4 w-4 text-amber-500" />
                                            Keluar (Kredit)
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* Category Selection */}
                            <div>
                                <Label htmlFor="category">Kategori Transaksi</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(value) => setFormData((p) => ({ ...p, category: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Tanpa Kategori</SelectItem>
                                        {availableCategories.map(([key, cat]) => (
                                            <SelectItem key={key} value={key}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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

                            {/* Guard: peringatan salah kategori (menggelembungkan beban SHU) */}
                            {miscat && (
                                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-3">
                                    <div className="flex items-start gap-2 text-sm text-amber-800">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{miscat.message} Kategori saat ini akan menggelembungkan beban SHU.</span>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setFormData((p) => ({ ...p, category: miscat.suggestedCategory }))}
                                    >
                                        Gunakan kategori: {miscat.suggestedCategory === "transfer" ? "Transfer Antar Kas/Bank" : "Pencairan Pinjaman"}
                                    </Button>
                                    <div className="border-t border-amber-200 pt-2 space-y-2">
                                        <p className="text-xs text-amber-700">
                                            Atau paksa tetap sebagai kategori ini (alasan tercatat di audit):
                                        </p>
                                        <Input
                                            placeholder="Alasan override — mis. 'memang biaya karena...'"
                                            value={miscatReason}
                                            onChange={(e) => setMiscatReason(e.target.value)}
                                        />
                                        <label className="flex items-center gap-2 text-xs font-medium text-amber-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={confirmMiscat}
                                                onChange={(e) => setConfirmMiscat(e.target.checked)}
                                                className="h-4 w-4"
                                            />
                                            Saya yakin — ini bukan transfer/pencairan
                                        </label>
                                    </div>
                                </div>
                            )}
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
                                            <span className="font-medium tabular-nums">{formatCurrency(selectedAccount.currentBalance)}</span>
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
                                                        ? Number(selectedAccount.currentBalance) + (parseFloat(formData.amount) || 0)
                                                        : Number(selectedAccount.currentBalance) - (parseFloat(formData.amount) || 0)
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
