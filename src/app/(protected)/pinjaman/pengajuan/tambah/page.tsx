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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, Search, Calculator } from "lucide-react";
import { formatCurrency, INTEREST_METHODS } from "@/lib/constants";

interface LoanProduct {
    id: number;
    code: string;
    name: string;
    interest_method: string;
    interest_rate: number;
    min_amount: number;
    max_amount: number;
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

export default function TambahPengajuanPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedMember, setSelectedMember] = React.useState<MemberResult | null>(null);
    const [selectedProduct, setSelectedProduct] = React.useState<LoanProduct | null>(null);
    const [products, setProducts] = React.useState<LoanProduct[]>([]);
    const [searchResults, setSearchResults] = React.useState<MemberResult[]>([]);

    // Form state
    const [formData, setFormData] = React.useState({
        product_id: "",
        amount: "",
        tenor_months: "",
        purpose: "",
    });

    // Calculation state
    const [calculation, setCalculation] = React.useState<{
        principal: number;
        interest: number;
        total: number;
        admin_fee: number;
        disbursed: number;
        monthly: number;
    } | null>(null);

    // Fetch loan products from DB
    React.useEffect(() => {
        const loadProducts = async () => {
            try {
                const res = await fetch("/api/loans/products");
                if (res.ok) {
                    const json = await res.json();
                    const prodData = json.data || [];
                    setProducts(prodData);
                    if (prodData.length > 0 && !formData.product_id) {
                        setFormData((prev) => ({ ...prev, product_id: String(prodData[0].id) }));
                        setSelectedProduct(prodData[0]);
                    }
                }
            } catch (e) {
                // Fallback: use safe defaults
                const defaultProd = {
                    id: 1, code: "PR", name: "Pinjaman Reguler",
                    interest_method: "flat", interest_rate: 0,
                    min_amount: 1000000, max_amount: 20000000,
                    min_tenor: 1, max_tenor: 36,
                    admin_fee_type: "percent", admin_fee_value: 1,
                };
                setProducts([defaultProd]);
                if (!formData.product_id) {
                    setFormData((prev) => ({ ...prev, product_id: String(defaultProd.id) }));
                    setSelectedProduct(defaultProd);
                }
            }
        };
        loadProducts();
    }, [formData.product_id]);

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

    // Update selected product when product_id changes
    React.useEffect(() => {
        const product = products.find((p) => p.id.toString() === formData.product_id);
        setSelectedProduct(product || null);
    }, [formData.product_id, products]);

    // Calculate loan details
    React.useEffect(() => {
        if (!selectedProduct || !formData.amount || !formData.tenor_months) {
            setCalculation(null);
            return;
        }

        const principal = parseFloat(formData.amount);
        const tenor = parseInt(formData.tenor_months);

        // Logika Baru (Sesuai Atasan)
        // Bunga = 1% Flat per bulan dari Plafon
        // Potongan Resiko = 2% dari Plafon, dipotong di depan
        const admin_fee = principal * 0.02; // Potongan resiko 2%
        const interestPerMonth = principal * 0.01; // Bunga 1% per bulan
        const interest = interestPerMonth * tenor;
        const total = principal + interest;
        const monthly = total / tenor; // (Pokok/Tenor) + Bunga per bulan
        const disbursed = principal - admin_fee; // Dana cair bersih

        setCalculation({
            principal,
            interest: Math.round(interest),
            total: Math.round(total),
            admin_fee: Math.round(admin_fee),
            disbursed: Math.round(disbursed),
            monthly: Math.round(monthly),
        });
    }, [selectedProduct, formData.amount, formData.tenor_months]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
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

        const amt = parseFloat(formData.amount);
        const tnr = parseInt(formData.tenor_months);

        if (selectedProduct && amt > selectedProduct.max_amount) {
            toast.error(`Jumlah melebihi plafon maks ${formatCurrency(selectedProduct.max_amount)}`);
            return;
        }
        if (selectedProduct && tnr > selectedProduct.max_tenor) {
            toast.error(`Tenor melebihi maks ${selectedProduct.max_tenor} bulan`);
            return;
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

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pengajuan Pinjaman Baru"
                description="Buat pengajuan pinjaman untuk anggota"
                backHref="/pinjaman"
            />

            <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
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
                                ) : (
                                    <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                                                {selectedMember.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                            </div>
                                            <div>
                                                <p className="font-medium">{selectedMember.name}</p>
                                                <p className="text-sm text-muted-foreground">{selectedMember.member_no}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-muted-foreground">Simpanan</p>
                                            <p className="font-bold text-emerald-600 tabular-nums">
                                                {formatCurrency(selectedMember.savings_balance)}
                                            </p>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                                            Ganti
                                        </Button>
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
                                {/* Form Input - Produk Pinjaman di-hide karena sudah auto-select via AD-ART logic */}
                                <div>
                                    <Label htmlFor="amount">Jumlah Pinjaman *</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                                        <Input
                                            id="amount"
                                            name="amount"
                                            type="number"
                                            value={formData.amount}
                                            onChange={handleChange}
                                            placeholder="0"
                                            min={selectedProduct?.min_amount || 0}
                                            max={selectedProduct?.max_amount}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="tenor_months">Tenor (Bulan) *</Label>
                                    <Select
                                        value={formData.tenor_months}
                                        onValueChange={(value) => handleSelectChange("tenor_months", value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih tenor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedProduct ? (
                                                Array.from(
                                                    { length: selectedProduct.max_tenor - selectedProduct.min_tenor + 1 },
                                                    (_, i) => selectedProduct.min_tenor + i
                                                ).map((tenor) => (
                                                    <SelectItem key={tenor} value={tenor.toString()}>
                                                        {tenor} bulan
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                [3, 6, 12, 18, 24, 36].map((tenor) => (
                                                    <SelectItem key={tenor} value={tenor.toString()}>
                                                        {tenor} bulan
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="purpose">Tujuan Pinjaman</Label>
                                    <Textarea
                                        id="purpose"
                                        name="purpose"
                                        value={formData.purpose}
                                        onChange={handleChange}
                                        placeholder="Jelaskan tujuan penggunaan pinjaman..."
                                        rows={3}
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
                            </CardHeader>
                            <CardContent>
                                {calculation ? (
                                    <div className="space-y-4">
                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Plafon Pinjaman</span>
                                                <span className="font-medium tabular-nums">{formatCurrency(calculation.principal)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Potongan Resiko (2%)</span>
                                                <span className="font-medium tabular-nums text-red-600">- {formatCurrency(calculation.admin_fee)}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between">
                                                <span className="font-semibold">Dana Cair (Bersih)</span>
                                                <span className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(calculation.disbursed)}</span>
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Angsuran Pokok /bln</span>
                                                <span className="tabular-nums">{formatCurrency(calculation.principal / parseInt(formData.tenor_months))}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Bunga (1%) /bln</span>
                                                <span className="tabular-nums">{formatCurrency(calculation.interest / parseInt(formData.tenor_months))}</span>
                                            </div>
                                        </div>

                                        <div className="rounded-lg bg-primary/10 p-4 text-center mt-2">
                                            <p className="text-sm text-muted-foreground">Total Angsuran per Bulan</p>
                                            <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(calculation.monthly)}</p>
                                            <p className="text-xs text-muted-foreground">Selama {formData.tenor_months} bulan</p>
                                        </div>

                                        <p className="text-xs text-muted-foreground text-center">
                                            (Plafon - 2% Resiko) | Bunga Flat 1%/bln
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>Pilih produk, jumlah, dan tenor untuk melihat simulasi</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
                        Batal
                    </Button>
                    <Button type="submit" disabled={isLoading || !selectedMember || !calculation}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Menyimpan...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Ajukan Pinjaman
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
