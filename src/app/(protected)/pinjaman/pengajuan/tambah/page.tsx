"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Search, Calculator, AlertCircle, Info, Banknote, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface LoanProduct {
    id: number;
    code: string;
    name: string;
    interest_method: string;
    interest_rate: number;
    min_amount: number;
    max_amount: number | null;
    min_tenor: number;
    max_tenor: number;
    admin_fee_type: string;
    admin_fee_value: number;
}

interface MemberResult {
    id: number;
    member_no: string;
    name: string;
    savings_balance: number;
}

function TambahPengajuanContent() {
    const { data: session } = useSession();
    const isOperator = !!(session?.user as any)?.permissions?.includes("manage_all");
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedMember, setSelectedMember] = React.useState<MemberResult | null>(null);
    const [selectedProduct, setSelectedProduct] = React.useState<LoanProduct | null>(null);
    const [products, setProducts] = React.useState<LoanProduct[]>([]);
    const [searchResults, setSearchResults] = React.useState<MemberResult[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = React.useState(true);

    // Form state
    const [formData, setFormData] = React.useState({
        product_id: "",
        amount: "",
        tenor_months: "",
        purpose: "",
        deductionSource: "gaji",
        backdatedDate: "",
    });

    // Calculation state — extended with per-day and per-year
    const [calculation, setCalculation] = React.useState<{
        principal: number;
        interest: number;
        interest_per_month: number;
        interest_per_day: number;
        interest_per_year: number;
        total: number;
        admin_fee: number;
        disbursed: number;
        monthly: number;
        principal_per_month: number;
    } | null>(null);

    // Validation errors
    const [amountError, setAmountError] = React.useState<string | null>(null);
    const [tenorError, setTenorError] = React.useState<string | null>(null);

    // Kompen mode state
    const [isKompenMode, setIsKompenMode] = React.useState(false);
    const [eligibleLoans, setEligibleLoans] = React.useState<any[]>([]);
    const [selectedExistingLoanId, setSelectedExistingLoanId] = React.useState("");
    const [kompenSimulasi, setKompenSimulasi] = React.useState<any>(null);

    // Fetch loan products from DB
    React.useEffect(() => {
        const loadProducts = async () => {
            setIsLoadingProducts(true);
            try {
                const res = await fetch("/api/loans/products");
                if (res.ok) {
                    const json = await res.json();
                    const prodData = json.data || [];
                    setProducts(prodData);
                    // Default to first product
                    if (prodData.length > 0) {
                        setFormData((prev) => ({ ...prev, product_id: String(prodData[0].id) }));
                        setSelectedProduct(prodData[0]);
                    }
                }
            } catch (e) {
                toast.error("Gagal memuat produk pinjaman");
            } finally {
                setIsLoadingProducts(false);
            }
        };
        loadProducts();
    }, []);

    // Auto-select member from URL params
    React.useEffect(() => {
        const memberId = searchParams.get("member_id");
        if (memberId) {
            const loadMember = async () => {
                try {
                    const res = await fetch(`/api/members/${memberId}`);
                    if (res.ok) {
                        const json = await res.json();
                        const m = json.data;
                        setSelectedMember({
                            id: m.id,
                            member_no: m.memberNo || m.nrp,
                            name: m.name,
                            savings_balance: 0,
                        });
                    }
                } catch (e) { /* silent */ }
            };
            loadMember();
        }
    }, [searchParams]);

    // Sync selectedProduct when product_id changes
    React.useEffect(() => {
        const product = products.find((p) => p.id.toString() === formData.product_id);
        setSelectedProduct(product || null);
        // Reset amount and tenor when product changes
        setFormData((prev) => ({ ...prev, amount: "", tenor_months: "" }));
        setAmountError(null);
        setTenorError(null);
    }, [formData.product_id, products]);

    // Validate amount against product limits
    const validateAmount = (val: string, product: LoanProduct | null) => {
        if (!val || !product) { setAmountError(null); return; }
        const amt = parseFloat(val);
        if (isNaN(amt) || amt <= 0) { setAmountError("Jumlah tidak valid"); return; }
        if (product.min_amount && amt < product.min_amount) {
            setAmountError(`Minimal ${formatCurrency(product.min_amount)} untuk ${product.name}`);
            return;
        }
        if (product.max_amount && amt > product.max_amount) {
            setAmountError(`Maksimal ${formatCurrency(product.max_amount)} untuk ${product.name}`);
            return;
        }
        setAmountError(null);
    };

    // Calculate loan details (uses product's actual interest_rate)
    React.useEffect(() => {
        if (!selectedProduct || !formData.amount || !formData.tenor_months) {
            setCalculation(null);
            return;
        }

        const principal = parseFloat(formData.amount);
        const tenor = parseInt(formData.tenor_months);
        if (isNaN(principal) || isNaN(tenor) || principal <= 0 || tenor <= 0) {
            setCalculation(null);
            return;
        }

        const ratePerMonth = selectedProduct.interest_rate / 100; // e.g. 1% → 0.01
        const admin_fee_rate = selectedProduct.admin_fee_value / 100; // 2% → 0.02

        const admin_fee = principal * admin_fee_rate;
        const interest_per_month = principal * ratePerMonth;
        const interest_per_day = interest_per_month / 30;
        const interest_per_year = interest_per_month * 12;
        const interest = interest_per_month * tenor;
        const total = principal + interest;
        const principal_per_month = principal / tenor;
        const monthly = principal_per_month + interest_per_month;
        const disbursed = principal - admin_fee;

        setCalculation({
            principal,
            interest: Math.round(interest),
            interest_per_month: Math.round(interest_per_month),
            interest_per_day: Math.round(interest_per_day),
            interest_per_year: Math.round(interest_per_year),
            total: Math.round(total),
            admin_fee: Math.round(admin_fee),
            disbursed: Math.round(disbursed),
            monthly: Math.round(monthly),
            principal_per_month: Math.round(principal_per_month),
        });
    }, [selectedProduct, formData.amount, formData.tenor_months]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (name === "amount") validateAmount(value, selectedProduct);
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleMemberSearch = async () => {
        if (!searchQuery.trim()) return;
        try {
            const res = await fetch(`/api/members?search=${encodeURIComponent(searchQuery)}&limit=5`);
            if (res.ok) {
                const json = await res.json();
                const members = (json.data || []).map((m: any) => ({
                    id: m.id, member_no: m.memberNo || m.nrp, name: m.name, savings_balance: 0,
                }));
                if (members.length === 1) {
                    setSelectedMember(members[0]);
                    setSearchResults([]);
                } else if (members.length > 1) {
                    setSearchResults(members);
                } else {
                    toast.error("Anggota tidak ditemukan");
                    setSearchResults([]);
                }
            }
        } catch (e) {
            toast.error("Gagal mencari anggota");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedMember) {
            toast.error("Pilih anggota terlebih dahulu");
            return;
        }
        if (!formData.product_id || !formData.amount || !formData.tenor_months) {
            toast.error("Lengkapi semua field yang wajib");
            return;
        }
        if (amountError) {
            toast.error(amountError);
            return;
        }

        const amt = parseFloat(formData.amount);
        const tnr = parseInt(formData.tenor_months);

        // Double-check against product limits
        if (selectedProduct) {
            if (selectedProduct.min_amount && amt < selectedProduct.min_amount) {
                toast.error(`Jumlah minimal ${formatCurrency(selectedProduct.min_amount)}`);
                return;
            }
            if (selectedProduct.max_amount && amt > selectedProduct.max_amount) {
                toast.error(`Jumlah melebihi plafon maks ${formatCurrency(selectedProduct.max_amount)}`);
                return;
            }
            if (tnr > selectedProduct.max_tenor) {
                toast.error(`Tenor melebihi maks ${selectedProduct.max_tenor} bulan`);
                return;
            }
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/loans/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memberId: selectedMember.id,
                    productId: parseInt(formData.product_id),
                    amount: amt,
                    tenorMonths: tnr,
                    purpose: formData.purpose || "Keperluan pribadi",
                    deductionSource: formData.deductionSource,
                    ...(isOperator && formData.backdatedDate ? { backdatedDate: formData.backdatedDate } : {}),
                }),
            });

            const json = await res.json();
            if (res.ok) {
                toast.success("Pengajuan pinjaman berhasil dibuat");
                router.push("/pinjaman/pengajuan");
            } else {
                toast.error(json.message || "Gagal membuat pengajuan");
            }
        } catch (error) {
            toast.error("Gagal membuat pengajuan");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // untuk Operator: Buat pengajuan DAN langsung cairkan dalam satu klik
    const handleDirectDisburse = async () => {
        if (!selectedMember) { toast.error("Pilih anggota terlebih dahulu"); return; }
        if (!formData.product_id || !formData.amount || !formData.tenor_months) { toast.error("Lengkapi semua field"); return; }
        if (amountError) { toast.error(amountError); return; }

        const amt = parseFloat(formData.amount);
        const tnr = parseInt(formData.tenor_months);

        setIsLoading(true);
        try {
            const res = await fetch("/api/loans/applications/direct-disburse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memberId: selectedMember.id,
                    productId: parseInt(formData.product_id),
                    amount: amt,
                    tenorMonths: tnr,
                    purpose: formData.purpose || "Pencairan Pinjaman",
                    deductionSource: formData.deductionSource,
                    ...(formData.backdatedDate ? { backdatedDate: formData.backdatedDate } : {}),
                }),
            });

            const json = await res.json();
            if (res.ok) {
                toast.success(`✅ Berhasil! Pinjaman ${json.loanNo} dicairkan & Kwitansi diterbitkan.`);
                // Langsung buka halaman cetak kwitansi
                router.push(`/kwitansi/${json.receiptId}/cetak`);
            } else {
                toast.error(json.message || "Gagal memproses direct disburse");
            }
        } catch (error) {
            toast.error("Gagal memproses. Cek koneksi.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch eligible loans when member selected in kompen mode
    React.useEffect(() => {
        if (isKompenMode && selectedMember) {
            fetch(`/api/loans/kompen/eligible?memberId=${selectedMember.id}`)
                .then(r => r.json())
                .then(j => setEligibleLoans(j.data || []))
                .catch(() => setEligibleLoans([]));
        } else {
            setEligibleLoans([]);
            setSelectedExistingLoanId("");
            setKompenSimulasi(null);
        }
    }, [isKompenMode, selectedMember]);

    const handleKompenSimulate = async () => {
        if (!selectedMember || !selectedExistingLoanId || !formData.amount || !formData.product_id || !formData.tenor_months) {
            toast.error("Lengkapi semua field dan pilih pinjaman yang dikompen");
            return;
        }
        try {
            const params = new URLSearchParams({
                memberId: String(selectedMember.id),
                existingLoanId: selectedExistingLoanId,
                newAmount: formData.amount,
                newProductId: formData.product_id,
                newTenor: formData.tenor_months,
            });
            const res = await fetch(`/api/loans/kompen/simulate?${params}`);
            const json = await res.json();
            if (res.ok) {
                setKompenSimulasi(json.data);
            } else {
                toast.error(json.message || "Gagal simulasi kompen");
            }
        } catch { toast.error("Gagal simulasi kompen"); }
    };

    const handleKompenDisburse = async () => {
        if (!selectedMember || !selectedExistingLoanId) { toast.error("Data tidak lengkap"); return; }
        setIsLoading(true);
        try {
            const res = await fetch("/api/loans/kompen/disburse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memberId: selectedMember.id,
                    existingLoanId: parseInt(selectedExistingLoanId),
                    productId: parseInt(formData.product_id),
                    amount: parseFloat(formData.amount),
                    tenorMonths: parseInt(formData.tenor_months),
                    paymentMethod: "bank_transfer",
                    cashBankAccountId: 1,
                    ...(formData.backdatedDate ? { backdatedDate: formData.backdatedDate } : {}),
                }),
            });
            const json = await res.json();
            if (res.ok) {
                toast.success(`Kompen berhasil! ${json.data.newLoanNo} dicairkan, ${json.data.existingLoanNo} dilunasi.`);
                router.push("/pinjaman");
            } else {
                toast.error(json.message || "Gagal memproses kompen");
            }
        } catch { toast.error("Gagal memproses kompen"); }
        finally { setIsLoading(false); }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pengajuan Pinjaman Baru"
                description="Buat pengajuan pinjaman untuk anggota"
                backHref="/pinjaman/pengajuan"
            />

            {/* Kompen Toggle */}
            {isOperator && (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => { setIsKompenMode(false); setKompenSimulasi(null); setSelectedExistingLoanId(""); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isKompenMode ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                        Mode Normal
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsKompenMode(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${isKompenMode ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                        <Zap className="h-3.5 w-3.5" /> Mode Kompen
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Left Column - Form */}
                    <div className="space-y-6">
                        {/* Member Selection */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Anggota</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {!selectedMember ? (
                                    <>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    placeholder="Cari nama atau no. anggota..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleMemberSearch())}
                                                    className="pl-9"
                                                />
                                            </div>
                                            <Button type="button" onClick={handleMemberSearch}>Cari</Button>
                                        </div>
                                        {searchResults.length > 1 && (
                                            <div className="border rounded-lg divide-y">
                                                {searchResults.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                                                        onClick={() => { setSelectedMember(m); setSearchResults([]); }}
                                                    >
                                                        <p className="font-medium">{m.name}</p>
                                                        <p className="text-xs text-muted-foreground">{m.member_no}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                                                {selectedMember.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                            </div>
                                            <div>
                                                <p className="font-medium">{selectedMember.name}</p>
                                                <p className="text-sm text-muted-foreground">{selectedMember.member_no}</p>
                                            </div>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                                            Ganti
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Kompen: Pinjaman yang dikompen */}
                        {isKompenMode && selectedMember && (
                            <Card className="border-violet-200 dark:border-violet-800">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-violet-600" />
                                        Pinjaman yang Dikompen
                                    </CardTitle>
                                    <CardDescription>Pilih pinjaman aktif yang akan dilunasi dari akad baru</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {eligibleLoans.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-2">Tidak ada pinjaman aktif untuk anggota ini</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {eligibleLoans.map((loan: any) => (
                                                <button
                                                    key={loan.id}
                                                    type="button"
                                                    onClick={() => { setSelectedExistingLoanId(String(loan.id)); setKompenSimulasi(null); }}
                                                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${selectedExistingLoanId === String(loan.id) ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30" : "border-border hover:border-violet-300"}`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="font-medium text-sm">{loan.loanNo}</p>
                                                            <p className="text-xs text-muted-foreground">{loan.productName}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-semibold">{formatCurrency(loan.principalOutstanding)}</p>
                                                            <p className="text-xs text-muted-foreground">Sisa pokok</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                                        <span>Penalti: {formatCurrency(loan.penaltyFee)}</span>
                                                        <span>Total kompen: {formatCurrency(loan.totalKompen)}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Loan Product Selection */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Produk Pinjaman</CardTitle>
                                <CardDescription>Pilih jenis pinjaman sesuai kebutuhan</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {isLoadingProducts ? (
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Memuat produk pinjaman...
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {products.map((product) => {
                                            const isSelected = formData.product_id === String(product.id);
                                            const maxLabel = product.max_amount
                                                ? formatCurrency(product.max_amount)
                                                : "Tidak Terbatas";
                                            return (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    onClick={() => handleSelectChange("product_id", String(product.id))}
                                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${isSelected
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{product.name}</span>
                                                                <Badge variant={isSelected ? "default" : "outline"} className="text-[10px]">
                                                                    {product.code}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Limit: {product.min_amount ? formatCurrency(product.min_amount) : "–"} s/d {maxLabel}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Tenor: {product.min_tenor || 1}–{product.max_tenor} bulan &nbsp;·&nbsp;
                                                                Bunga: {product.interest_rate}% flat/bln &nbsp;·&nbsp;
                                                                Resiko: {product.admin_fee_value}% (dipotong di muka)
                                                            </p>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Loan Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Detail Pinjaman</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="amount">Jumlah Pinjaman *</Label>
                                    <div className="relative mt-1.5">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                                        <Input
                                            id="amount"
                                            name="amount"
                                            type="number"
                                            value={formData.amount}
                                            onChange={handleChange}
                                            placeholder="0"
                                            min={selectedProduct?.min_amount || 0}
                                            max={selectedProduct?.max_amount || undefined}
                                            className={`pl-10 ${amountError ? "border-red-500" : ""}`}
                                        />
                                    </div>
                                    {amountError ? (
                                        <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                            <AlertCircle className="h-3 w-3" /> {amountError}
                                        </p>
                                    ) : selectedProduct && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {selectedProduct.min_amount ? `Min: ${formatCurrency(selectedProduct.min_amount)}` : ""}
                                            {selectedProduct.max_amount ? ` · Maks: ${formatCurrency(selectedProduct.max_amount)}` : " · Tidak ada batas maksimal"}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="tenor_months">Tenor (Bulan) *</Label>
                                    <div className="relative mt-1.5">
                                        <Input
                                            id="tenor_months"
                                            name="tenor_months"
                                            type="number"
                                            value={formData.tenor_months}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                const maxT = selectedProduct?.max_tenor || 360;
                                                const minT = selectedProduct?.min_tenor || 1;
                                                if (val > maxT) {
                                                    handleSelectChange("tenor_months", String(maxT));
                                                } else {
                                                    handleSelectChange("tenor_months", e.target.value);
                                                }
                                            }}
                                            placeholder={selectedProduct ? `${selectedProduct.min_tenor || 1} – ${selectedProduct.max_tenor} bulan` : "Contoh: 12"}
                                            min={selectedProduct?.min_tenor || 1}
                                            max={selectedProduct?.max_tenor || 360}
                                            className="pr-16"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">bulan</span>
                                    </div>
                                    {selectedProduct && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Min: {selectedProduct.min_tenor || 1} bulan · Maks: {selectedProduct.max_tenor} bulan
                                            {formData.tenor_months && parseInt(formData.tenor_months) >= 12 && (
                                                <span className="ml-1 text-primary font-medium">
                                                    ({Math.floor(parseInt(formData.tenor_months) / 12)} thn
                                                    {parseInt(formData.tenor_months) % 12 > 0 ? ` ${parseInt(formData.tenor_months) % 12} bln` : ""})
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="deductionSource">Sumber Pemotongan Angsuran *</Label>
                                    {isOperator ? (
                                        <Select
                                            value={formData.deductionSource}
                                            onValueChange={(value) => handleSelectChange("deductionSource", value)}
                                        >
                                            <SelectTrigger className="mt-1.5">
                                                <SelectValue placeholder="Pilih sumber potongan" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="gaji">Potongan Gaji</SelectItem>
                                                <SelectItem value="tunkin">Potongan Tunjangan Kinerja (Tunkin)</SelectItem>
                                                <SelectItem value="bs">BS (Bayar Sendiri)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="mt-1.5 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2.5 text-sm">
                                            <Banknote className="h-4 w-4 text-emerald-600" />
                                            <span className="font-medium">Potongan Gaji</span>
                                            <Badge variant="secondary" className="ml-auto text-[10px]">Default</Badge>
                                        </div>
                                    )}
                                    {formData.deductionSource === "bs" && (
                                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Anggota membayar angsuran sendiri (tidak dipotong dari gaji/tunkin). Validasi pendapatan tidak berlaku.
                                        </p>
                                    )}
                                </div>

                                {isOperator && (
                                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-900">
                                        <Label htmlFor="backdatedDate" className="text-amber-800 dark:text-amber-400 font-semibold flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Tanggal Pelaksanaan Pinjaman (Mundur)
                                        </Label>
                                        <Input
                                            id="backdatedDate"
                                            name="backdatedDate"
                                            type="date"
                                            value={formData.backdatedDate}
                                            onChange={handleChange}
                                            className="mt-1.5 border-amber-300 dark:border-amber-800 focus-visible:ring-amber-500"
                                        />
                                        <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-1">
                                            Biarkan KOSONG untuk pinjaman hari ini. Isi HANYA JIKA Anda mendata pinjaman yang telah berjalan di masa lalu. (Fitur Khusus Operator)
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="purpose">Tujuan Pinjaman</Label>
                                    <Textarea
                                        id="purpose"
                                        name="purpose"
                                        value={formData.purpose}
                                        onChange={handleChange}
                                        placeholder="Jelaskan tujuan penggunaan pinjaman..."
                                        rows={3}
                                        className="mt-1.5"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Calculation */}
                    <div>
                        <Card className="sticky top-20">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Calculator className="h-5 w-5" />
                                    Simulasi Pinjaman
                                </CardTitle>
                                {selectedProduct && (
                                    <CardDescription>
                                        Berdasarkan: <strong>{selectedProduct.name}</strong>
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                {calculation ? (
                                    <div className="space-y-4">
                                        {/* Dana Cair Section */}
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-muted-foreground">Plafon Pinjaman</span>
                                                <span className="font-medium tabular-nums">{formatCurrency(calculation.principal)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-muted-foreground">
                                                    Potongan Resiko ({selectedProduct?.admin_fee_value || 2}%)
                                                </span>
                                                <span className="font-medium tabular-nums text-red-600">
                                                    − {formatCurrency(calculation.admin_fee)}
                                                </span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold">Dana Cair (Bersih)</span>
                                                <span className="text-xl font-bold text-emerald-600 tabular-nums">
                                                    {formatCurrency(calculation.disbursed)}
                                                </span>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Bunga Akumulatif */}
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                                                <Info className="h-3 w-3" />
                                                Akumulasi Bunga ({selectedProduct?.interest_rate || 1}% Flat)
                                            </p>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/30 rounded-md px-3 py-2">
                                                    <span className="text-muted-foreground">Per Hari (~1/30 bln)</span>
                                                    <span className="font-medium tabular-nums text-blue-700 dark:text-blue-400">
                                                        {formatCurrency(calculation.interest_per_day)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-950/30 rounded-md px-3 py-2">
                                                    <span className="text-muted-foreground">Per Bulan (1%)</span>
                                                    <span className="font-medium tabular-nums text-indigo-700 dark:text-indigo-400">
                                                        {formatCurrency(calculation.interest_per_month)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center bg-violet-50 dark:bg-violet-950/30 rounded-md px-3 py-2">
                                                    <span className="text-muted-foreground">Per Tahun (12%)</span>
                                                    <span className="font-medium tabular-nums text-violet-700 dark:text-violet-400">
                                                        {formatCurrency(calculation.interest_per_year)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Angsuran Bulanan */}
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Angsuran Pokok /bln</span>
                                                <span className="tabular-nums">{formatCurrency(calculation.principal_per_month)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Bunga /bln</span>
                                                <span className="tabular-nums">{formatCurrency(calculation.interest_per_month)}</span>
                                            </div>
                                        </div>

                                        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-center">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Angsuran per Bulan</p>
                                            <p className="text-3xl font-bold text-primary tabular-nums">
                                                {formatCurrency(calculation.monthly)}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                selama {formData.tenor_months} bulan
                                            </p>
                                            <Separator className="my-3" />
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Keseluruhan</span>
                                                <span className="font-semibold tabular-nums">{formatCurrency(calculation.total)}</span>
                                            </div>
                                        </div>

                                        <p className="text-xs text-muted-foreground text-center">
                                            Bunga Flat {selectedProduct?.interest_rate || 1}%/bln · Resiko {selectedProduct?.admin_fee_value || 2}% dipotong di muka
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground space-y-2">
                                        <Calculator className="h-12 w-12 mx-auto opacity-30" />
                                        <p className="text-sm">Pilih produk, jumlah, dan tenor</p>
                                        <p className="text-xs opacity-70">untuk melihat simulasi lengkap</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-4">
                    {/* Tombol Cairkan Langsung — hanya untuk Operator */}
                    {isOperator && isKompenMode && selectedExistingLoanId && (
                        <div className="rounded-lg border border-violet-300 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-700 p-4 space-y-3">
                            <div className="flex items-start gap-2">
                                <Zap className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-violet-800 dark:text-violet-400">Mode Kompen: Simulasi & Cairkan</p>
                                    <p className="text-xs text-violet-700/80 dark:text-violet-500/80 mt-0.5">
                                        Akad baru akan melunasi pinjaman lama secara otomatis. Anggota menerima selisih setelah dikurangi pelunasan + admin.
                                    </p>
                                </div>
                            </div>

                            {!kompenSimulasi ? (
                                <Button type="button" onClick={handleKompenSimulate} disabled={!selectedMember || !formData.amount || !formData.product_id || !formData.tenor_months} className="w-full bg-violet-600 hover:bg-violet-700 text-white" size="lg">
                                    Lihat Simulasi Kompen
                                </Button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Plafon Baru</span><span className="font-medium">{formatCurrency(kompenSimulasi.summary.plafonBaru)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Total Kompen</span><span className="font-medium text-red-600">− {formatCurrency(kompenSimulasi.summary.totalKompen)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Biaya Admin</span><span className="font-medium text-red-600">− {formatCurrency(kompenSimulasi.summary.biayaAdmin)}</span></div>
                                        <Separator />
                                        <div className="flex justify-between"><span className="font-semibold">Dana Diterima Anggota</span><span className="text-xl font-bold text-emerald-600">{formatCurrency(kompenSimulasi.summary.danaDiterimaAnggota)}</span></div>
                                        <Separator />
                                        <div className="flex justify-between text-xs text-muted-foreground"><span>Angsuran/bln ({kompenSimulasi.newLoan.tenorMonths}x)</span><span>{formatCurrency(kompenSimulasi.newLoan.monthlyInstallment)}</span></div>
                                    </div>
                                    <Button type="button" onClick={handleKompenDisburse} disabled={isLoading} className="w-full bg-violet-600 hover:bg-violet-700 text-white" size="lg">
                                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses Kompen...</> : <><Zap className="mr-2 h-4 w-4" />Proses Kompen & Cairkan</>}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {isOperator && !isKompenMode && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 space-y-3">
                            <div className="flex items-start gap-2">
                                <Zap className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Mode Operator: Cairkan Langsung</p>
                                    <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-0.5">
                                        Buat pengajuan, ACC, dan cairkan sekaligus dalam satu klik. Kwitansi otomatis diterbitkan & Jadwal Angsuran langsung terbuat.
                                        {formData.backdatedDate && ` Tanggal akan di-set ke ${new Date(formData.backdatedDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}.`}
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                onClick={handleDirectDisburse}
                                disabled={isLoading || !selectedMember || !calculation || !!amountError}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                                size="lg"
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses Pencairan...</>
                                ) : (
                                    <><Banknote className="mr-2 h-5 w-5" />Cairkan Langsung & Terbitkan Kwitansi</>
                                )}
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={isLoading || !selectedMember || !calculation || !!amountError}
                        >
                            {isLoading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                            ) : (
                                <><Save className="mr-2 h-4 w-4" />{isOperator ? "Ajukan Dulu (Draft)" : "Ajukan Pinjaman"}</>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default function TambahPengajuanPage() {
    return (
        <React.Suspense fallback={
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <TambahPengajuanContent />
        </React.Suspense>
    );
}
