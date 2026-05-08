"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Search, X, Banknote, Building2, AlertTriangle, Wallet, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/constants";

interface MemberOption {
    id: number;
    memberNo: string;
    name: string;
    nrp?: string;
    category?: string;
}

interface SavingsProduct {
    id: number;
    code: string;
    name: string;
    type: string;
    canWithdraw: boolean;
}

interface CashBankAccount {
    id: number;
    code: string;
    name: string;
    type: "cash" | "bank";
    bankName?: string | null;
    currentBalance: number;
    unitType?: string | null;
    purpose?: string | null;
}

export default function TambahSimpananPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = React.useState(false);

    // Member autocomplete
    const [memberQuery, setMemberQuery] = React.useState("");
    const [memberOptions, setMemberOptions] = React.useState<MemberOption[]>([]);
    const [memberSearching, setMemberSearching] = React.useState(false);
    const [showDropdown, setShowDropdown] = React.useState(false);
    const [selectedMember, setSelectedMember] = React.useState<MemberOption | null>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Master data
    const [products, setProducts] = React.useState<SavingsProduct[]>([]);
    const [cashAccounts, setCashAccounts] = React.useState<CashBankAccount[]>([]);
    const [bankAccounts, setBankAccounts] = React.useState<CashBankAccount[]>([]);

    // Member balance for selected product
    const [memberBalance, setMemberBalance] = React.useState<number | null>(null);
    const [balanceLoading, setBalanceLoading] = React.useState(false);

    // Form state
    const [formData, setFormData] = React.useState({
        type: "deposit",
        productId: "",
        amount: "",
        paymentMethod: "cash",
        cashBankAccountId: "",
        referenceNo: "",
        notes: "",
        transactionDate: (() => { const now = new Date(); const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000); return wib.toISOString().split("T")[0]; })(),
    });

    // Derived: selected product details
    const selectedProduct = products.find((p) => String(p.id) === formData.productId) ?? null;
    const isWithdrawBlocked = selectedProduct ? !selectedProduct.canWithdraw : false;

    // ── Load master data on mount ──────────────────────────────────────────
    React.useEffect(() => {
        // Load savings products
        fetch("/api/master/savings-products?perPage=50")
            .then((r) => r.json())
            .then((json) => setProducts(json.data || []))
            .catch(() => toast.error("Gagal memuat produk simpanan"));

        // Load cash/bank accounts
        fetch("/api/master/cash-bank?perPage=50")
            .then((r) => r.json())
            .then((json) => {
                let accounts: CashBankAccount[] = json.data || [];
                // Hanya gunakan akun kas/bank utama yang bukan milik unit usaha spesifik (toko/cuci mobil dll)
                accounts = accounts.filter(a => !a.unitType && !a.purpose?.startsWith('shu_'));
                setCashAccounts(accounts.filter((a) => a.type === "cash"));
                setBankAccounts(accounts.filter((a) => a.type === "bank"));
            })
            .catch(() => toast.error("Gagal memuat akun Kas & Bank simpanan"));
    }, []);

    // ── Auto-fetch member savings balance when member + product changes ───
    React.useEffect(() => {
        if (!selectedMember || !formData.productId) {
            setMemberBalance(null);
            return;
        }
        setBalanceLoading(true);
        fetch(`/api/savings/accounts?memberId=${selectedMember.id}&productId=${formData.productId}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.data?.balance !== undefined) {
                    setMemberBalance(Number(json.data.balance));
                } else {
                    setMemberBalance(0); // No account yet
                }
            })
            .catch(() => setMemberBalance(null))
            .finally(() => setBalanceLoading(false));
    }, [selectedMember, formData.productId]);

    // ── Auto-force deposit when product can't withdraw ────────────────────
    React.useEffect(() => {
        if (isWithdrawBlocked && formData.type === "withdrawal") {
            setFormData((prev) => ({ ...prev, type: "deposit" }));
        }
    }, [isWithdrawBlocked, formData.type]);

    // ── Auto-select member from URL param ─────────────────────────────────
    React.useEffect(() => {
        const memberId = searchParams.get("member_id");
        if (!memberId) return;
        fetch(`/api/members/${memberId}`)
            .then((r) => r.json())
            .then((json) => {
                const d = json.data ?? json;
                if (d?.id) {
                    setSelectedMember({
                        id: d.id,
                        memberNo: d.memberNo ?? d.member_no,
                        name: d.name,
                        nrp: d.nrp,
                        category: d.category,
                    });
                }
            })
            .catch(() => {/* silent */});
    }, [searchParams]);

    // ── Member autocomplete search ──────────────────────────────────────────
    React.useEffect(() => {
        if (memberQuery.length < 2) { setMemberOptions([]); setShowDropdown(false); return; }
        const timer = setTimeout(async () => {
            setMemberSearching(true);
            try {
                const res = await fetch(`/api/members?search=${encodeURIComponent(memberQuery)}&perPage=8`);
                const json = await res.json();
                setMemberOptions(json.data || []);
                setShowDropdown(true);
            } catch {
                setMemberOptions([]);
            } finally {
                setMemberSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [memberQuery]);

    // Close dropdown on outside click
    React.useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // ── Handlers ────────────────────────────────────────────────────────────
    const handleSelectMember = (m: MemberOption) => {
        setSelectedMember(m);
        setMemberQuery("");
        setShowDropdown(false);
        setMemberOptions([]);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            // Reset cashBankAccountId when payment method changes
            if (name === "paymentMethod") next.cashBankAccountId = "";
            return next;
        });
    };

    // ── Submit ────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedMember) { toast.error("Pilih anggota terlebih dahulu"); return; }
        if (!formData.productId) { toast.error("Pilih produk simpanan"); return; }
        if (!formData.amount || Number(formData.amount) <= 0) { toast.error("Masukkan jumlah yang valid"); return; }
        if (!formData.cashBankAccountId) {
            toast.error("Pilih akun Kas/Bank untuk transaksi ini");
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                memberId: selectedMember.id,
                productId: Number(formData.productId),
                type: formData.type,
                amount: Number(formData.amount),
                paymentMethod: formData.paymentMethod || undefined,
                cashBankAccountId: formData.cashBankAccountId ? Number(formData.cashBankAccountId) : undefined,
                referenceNo: formData.referenceNo || undefined,
                notes: formData.notes || undefined,
                transactionDate: formData.transactionDate,
            };

            const res = await fetch("/api/savings/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal mencatat transaksi");
                return;
            }

            const typeLabel = formData.type === "deposit" ? "Setoran" : "Penarikan";
            toast.success(`${typeLabel} simpanan ${formatCurrency(Number(formData.amount))} berhasil dicatat`);
            router.push("/simpanan/transaksi");
        } catch (error) {
            toast.error("Gagal mencatat transaksi");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    const relevantCashBankAccounts =
        formData.paymentMethod === "bank_transfer" ? bankAccounts : cashAccounts;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Transaksi Simpanan Baru"
                description="Catat setoran atau penarikan simpanan anggota"
                backHref="/simpanan/transaksi"
            />

            <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
                {/* ── Member Selection ── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Anggota</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!selectedMember ? (
                            <div className="relative" ref={dropdownRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    {memberSearching && (
                                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                    )}
                                    <Input
                                        placeholder="Cari nama atau NRP anggota (min 2 karakter)..."
                                        value={memberQuery}
                                        onChange={(e) => setMemberQuery(e.target.value)}
                                        className="pl-9 pr-9"
                                        autoComplete="off"
                                    />
                                </div>
                                {showDropdown && memberOptions.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                                        {memberOptions.map((m) => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted text-left transition-colors"
                                                onClick={() => handleSelectMember(m)}
                                            >
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                                    {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{m.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {m.nrp ?? m.memberNo}
                                                        {m.category && <span className="ml-1 text-primary">· {m.category}</span>}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showDropdown && memberOptions.length === 0 && !memberSearching && memberQuery.length >= 2 && (
                                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg p-3 text-sm text-muted-foreground text-center">
                                        Anggota tidak ditemukan
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                                        {selectedMember.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                    </div>
                                    <div>
                                        <p className="font-semibold">{selectedMember.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            NRP: {selectedMember.nrp ?? selectedMember.memberNo}
                                            {selectedMember.category && (
                                                <Badge variant="outline" className="ml-2 text-xs">{selectedMember.category}</Badge>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedMember(null)}
                                >
                                    <X className="h-4 w-4 mr-1" /> Ganti
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Produk Simpanan ── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Produk Simpanan</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        {/* Pilih Produk */}
                        <div>
                            <Label htmlFor="productId">Produk Simpanan *</Label>
                            <Select
                                value={formData.productId}
                                onValueChange={(value) => handleSelectChange("productId", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={products.length === 0 ? "Memuat..." : "Pilih produk"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => (
                                        <SelectItem key={p.id} value={String(p.id)}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Saldo Saat Ini */}
                        {selectedMember && formData.productId ? (
                            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                                <Wallet className="h-5 w-5 text-primary shrink-0" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Saldo {selectedProduct?.name ?? "Simpanan"} saat ini</p>
                                    {balanceLoading ? (
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span className="text-sm">Memuat saldo...</span>
                                        </div>
                                    ) : (
                                        <p className="text-base font-bold text-primary">
                                            {memberBalance !== null ? formatCurrency(memberBalance) : "—"}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="hidden sm:block"></div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Transaction Type ── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Jenis Transaksi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <RadioGroup
                            value={formData.type}
                            onValueChange={(value) => handleSelectChange("type", value)}
                            className="flex gap-6"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="deposit" id="deposit" />
                                <Label htmlFor="deposit" className="cursor-pointer font-medium text-emerald-600">
                                    ↑ Setoran
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="withdrawal" id="withdrawal" disabled={isWithdrawBlocked} />
                                <Label htmlFor="withdrawal" className={`cursor-pointer font-medium ${isWithdrawBlocked ? "text-muted-foreground line-through" : "text-red-600"}`}>
                                    ↓ Penarikan
                                </Label>
                            </div>
                        </RadioGroup>
                        {isWithdrawBlocked && (
                            <Alert className="border-amber-300 bg-amber-50">
                                <ShieldAlert className="h-4 w-4 text-amber-600" />
                                <AlertDescription className="text-amber-800 text-xs">
                                    <strong>{selectedProduct?.name}</strong> tidak dapat ditarik selama anggota masih aktif (sesuai AD/ART Pasal 26).
                                    Hanya <strong>Simpanan Sukarela</strong> yang dapat ditarik sewaktu-waktu.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* ── Transaction Details ── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Detail Transaksi</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">

                        {/* Jumlah */}
                        <div>
                            <Label htmlFor="amount">Jumlah *</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                                    Rp
                                </span>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    placeholder="0"
                                    min="1"
                                    required
                                    className="pl-10"
                                />
                            </div>
                            {formData.amount && Number(formData.amount) > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatCurrency(Number(formData.amount))}
                                </p>
                            )}
                        </div>

                        {/* Metode Pembayaran */}
                        <div>
                            <Label htmlFor="paymentMethod">Metode Pembayaran *</Label>
                            <Select
                                value={formData.paymentMethod}
                                onValueChange={(value) => handleSelectChange("paymentMethod", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih metode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">
                                        <span className="flex items-center gap-2">
                                            <Banknote className="h-4 w-4" /> Tunai
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="bank_transfer">
                                        <span className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4" /> Transfer Bank
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Akun Kas / Bank */}
                        <div>
                            <Label htmlFor="cashBankAccountId">
                                {formData.paymentMethod === "bank_transfer" ? "Rekening Bank Koperasi *" : "Kas Koperasi *"}
                            </Label>
                            <Select
                                value={formData.cashBankAccountId}
                                onValueChange={(value) => handleSelectChange("cashBankAccountId", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={
                                            relevantCashBankAccounts.length === 0
                                                ? "Memuat akun..."
                                                : formData.paymentMethod === "bank_transfer"
                                                    ? "Pilih rekening bank"
                                                    : "Pilih kas tunai"
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {relevantCashBankAccounts.map((acc) => (
                                        <SelectItem key={acc.id} value={String(acc.id)}>
                                            <span className="flex flex-col">
                                                <span className="font-medium text-sm">{acc.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    Saldo: {formatCurrency(Number(acc.currentBalance))}
                                                </span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                {formData.type === "deposit"
                                    ? "Uang masuk akan otomatis dicatat di kas/bank terpilih"
                                    : "Mutasi kas koperasi akan otomatis diperbarui"}
                            </p>
                        </div>

                        {/* Tanggal */}
                        <div>
                            <Label htmlFor="transactionDate">Tanggal Transaksi *</Label>
                            <Input
                                id="transactionDate"
                                name="transactionDate"
                                type="date"
                                value={formData.transactionDate}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* No Referensi */}
                        <div>
                            <Label htmlFor="referenceNo">No. Referensi</Label>
                            <Input
                                id="referenceNo"
                                name="referenceNo"
                                value={formData.referenceNo}
                                onChange={handleChange}
                                placeholder="No. bukti setor/slip (opsional)"
                            />
                        </div>

                        {/* Catatan */}
                        <div className="sm:col-span-2">
                            <Label htmlFor="notes">Catatan</Label>
                            <Textarea
                                id="notes"
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                placeholder="Catatan tambahan (opsional)"
                                rows={2}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* ── Summary Preview ── */}
                {selectedMember && formData.amount && Number(formData.amount) > 0 && formData.productId && (
                    <Card className={`border-2 ${formData.type === "deposit" ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-red-300 bg-red-50/50 dark:bg-red-950/20"}`}>
                        <CardContent className="p-4">
                            <p className="text-sm font-semibold mb-2">
                                {formData.type === "deposit" ? "✅ Ringkasan Setoran" : "⚠️ Ringkasan Penarikan"}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                <span className="text-muted-foreground">Anggota</span>
                                <span className="font-medium">{selectedMember.name}</span>
                                <span className="text-muted-foreground">Produk</span>
                                <span className="font-medium">
                                    {products.find((p) => String(p.id) === formData.productId)?.name ?? "-"}
                                </span>
                                <span className="text-muted-foreground">Jumlah</span>
                                <span className={`font-bold text-base ${formData.type === "deposit" ? "text-emerald-600" : "text-red-600"}`}>
                                    {formData.type === "deposit" ? "+" : "-"}{formatCurrency(Number(formData.amount))}
                                </span>
                                <span className="text-muted-foreground">Kas/Bank</span>
                                <span className="font-medium text-xs">
                                    {relevantCashBankAccounts.find((a) => String(a.id) === formData.cashBankAccountId)?.name ?? "—"}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ── Actions ── */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Batal
                    </Button>
                    <Button type="submit" disabled={isLoading || !selectedMember}>
                        {isLoading ? (
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
            </form>
        </div>
    );
}
