"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Send, Wallet, CreditCard, AlertTriangle, DollarSign, Award } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { toast } from "sonner";

interface OutstandingBill {
    id: number;
    type: string;
    unit: string;
    description: string;
    amount: number;
    dueDate: string;
    status: string;
}

interface LoanProduct {
    id: number;
    code: string;
    name: string;
    interestRate: number;
    minAmount: number | null;
    maxAmount: number | null;
    minTenor: number;
    maxTenor: number;
    interestMethod: string;
    adminFeeType: string;
    adminFeeValue: number;
    minTenorMonths: number;
    maxTenorMonths: number;
}

export default function PengajuanPinjamanPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [salary, setSalary] = React.useState<number>(0);
    const [outstandingBills, setOutstandingBills] = React.useState<OutstandingBill[]>([]);
    const [loanProducts, setLoanProducts] = React.useState<LoanProduct[]>([]);
    const [selectedProduct, setSelectedProduct] = React.useState<string>("");
    const [amount, setAmount] = React.useState<string>("");
    const [tenor, setTenor] = React.useState<string>("");
    const [purpose, setPurpose] = React.useState<string>("");
    const [tunkin, setTunkin] = React.useState<number>(0);
    const [deductionSource, setDeductionSource] = React.useState<string>("gaji");

    React.useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const memberRes = await fetch("/api/member-portal/profile");
            if (memberRes.ok) {
                const memberData = await memberRes.json();
                setSalary(Number(memberData.data?.salary || 0));
                setTunkin(Number(memberData.data?.tunlesKinerja || 0));
            }

            const billsRes = await fetch("/api/member-portal/outstanding-bills");
            if (billsRes.ok) {
                const billsData = await billsRes.json();
                setOutstandingBills(billsData.data || []);
            }

            // Fetch loan products
            const productsRes = await fetch("/api/master/loan-products");
            if (productsRes.ok) {
                const productsData = await productsRes.json();
                const rawProducts = productsData.data || [];
                // Normalize field names from Prisma camelCase to expected interface
                const products: LoanProduct[] = rawProducts.map((p: any) => ({
                    id: p.id,
                    code: p.code,
                    name: p.name,
                    interestRate: Number(p.interestRate),
                    interestMethod: p.interestMethod || "flat",
                    minAmount: p.minAmount ? Number(p.minAmount) : null,
                    maxAmount: p.maxAmount ? Number(p.maxAmount) : null,
                    minTenor: p.minTenorMonths || 1,
                    maxTenor: p.maxTenorMonths || 36,
                    minTenorMonths: p.minTenorMonths || 1,
                    maxTenorMonths: p.maxTenorMonths || 36,
                    adminFeeType: p.adminFeeType || "percent",
                    adminFeeValue: p.adminFeeValue ? Number(p.adminFeeValue) : 2,
                }));
                setLoanProducts(products);
                if (products.length > 0) {
                    setSelectedProduct(String(products[0].id));
                }
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const totalOutstanding = outstandingBills.reduce((sum, bill) => sum + bill.amount, 0);
    const selectedProductData = loanProducts.find(p => String(p.id) === selectedProduct);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || !amount || !tenor) {
            toast.error("Mohon lengkapi semua field yang diperlukan");
            return;
        }

        const parsedAmount = parseFloat(amount);
        const parsedTenor = parseInt(tenor);

        // Validate against selected product limits
        if (selectedProductData) {
            if (selectedProductData.minAmount && parsedAmount < selectedProductData.minAmount) {
                toast.error(`Jumlah minimal untuk ${selectedProductData.name}: Rp ${selectedProductData.minAmount.toLocaleString('id-ID')}`);
                return;
            }
            if (selectedProductData.maxAmount && parsedAmount > selectedProductData.maxAmount) {
                toast.error(`Jumlah melebihi plafon maksimum ${selectedProductData.name}: Rp ${selectedProductData.maxAmount.toLocaleString('id-ID')}`);
                return;
            }
            if (parsedTenor > (selectedProductData.maxTenor || 36)) {
                toast.error(`Tenor melebihi maksimum ${selectedProductData.name}: ${selectedProductData.maxTenor} bulan`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/member-portal/loan-application", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: selectedProduct ? parseInt(selectedProduct) : 1, // Fallback to 1 if no product exists
                    amount: parseFloat(amount),
                    tenorMonths: parseInt(tenor),
                    purpose,
                    deductionSource,
                }),
            });

            if (res.ok) {
                toast.success("Pengajuan pinjaman berhasil dikirim! Menunggu persetujuan admin.");
                setSelectedProduct("");
                setAmount("");
                setTenor("");
                setPurpose("");
            } else {
                const errorData = await res.json();
                toast.error(errorData.message || "Gagal mengirim pengajuan");
            }
        } catch {
            toast.error("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Pengajuan Pinjaman</h1>
                <p className="text-muted-foreground">
                    Ajukan pinjaman baru ke unit Simpan Pinjam koperasi
                </p>
            </div>

            {/* Info Cards Row */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Salary Card */}
                <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2 text-emerald-700">
                            <DollarSign className="h-4 w-4" />
                            Gaji Per Bulan
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-emerald-800 tabular-nums">
                            {salary > 0 ? formatCurrency(salary) : "Belum diisi"}
                        </p>
                        {salary === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Hubungi admin untuk mengisi data gaji Anda
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Tunkin Card */}
                {tunkin > 0 && (
                    <Card className="border-violet-200 bg-violet-50/50">
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-2 text-violet-700">
                                <Award className="h-4 w-4" />
                                Tunjangan Kinerja
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-violet-800 tabular-nums">
                                {formatCurrency(tunkin)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Dapat digunakan untuk pemotongan
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Outstanding Bills Card */}
                <Card className={totalOutstanding > 0 ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50"}>
                    <CardHeader className="pb-2">
                        <CardDescription className={`flex items-center gap-2 ${totalOutstanding > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                            <AlertTriangle className="h-4 w-4" />
                            Total Tagihan Belum Lunas
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold tabular-nums ${totalOutstanding > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                            {formatCurrency(totalOutstanding)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {outstandingBills.length} tagihan tertunda
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Outstanding Bills Detail */}
            {outstandingBills.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Daftar Tagihan Belum Lunas
                        </CardTitle>
                        <CardDescription>
                            Berikut adalah tagihan Anda yang belum diselesaikan dari berbagai unit
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {outstandingBills.map((bill) => (
                                <div
                                    key={bill.id}
                                    className="flex items-center justify-between rounded-lg border p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="uppercase text-xs">
                                            {bill.unit}
                                        </Badge>
                                        <div>
                                            <p className="text-sm font-medium">{bill.description}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Jatuh tempo: {new Date(bill.dueDate).toLocaleDateString("id-ID")}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="font-semibold text-sm tabular-nums text-destructive">
                                        {formatCurrency(bill.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Separator />

            {/* Loan Application Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Form Pengajuan Pinjaman
                    </CardTitle>
                    <CardDescription>
                        Isi form berikut untuk mengajukan pinjaman baru. Pengajuan akan di-review oleh Admin Simpan Pinjam.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {totalOutstanding > 0 && (
                        <Alert className="mb-6 border-amber-200 bg-amber-50">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertTitle className="text-amber-800">Perhatian</AlertTitle>
                            <AlertDescription className="text-amber-700">
                                Anda memiliki {outstandingBills.length} tagihan belum lunas senilai{" "}
                                <strong>{formatCurrency(totalOutstanding)}</strong>. Tagihan ini akan menjadi pertimbangan dalam persetujuan pinjaman.
                            </AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Pilihan Produk Pinjaman */}
                        <div className="space-y-3 mb-4">
                            <Label>Pilih Produk Pinjaman *</Label>
                            <div className="grid gap-3">
                                {loanProducts.map((product) => {
                                    const isSelected = selectedProduct === String(product.id);
                                    const maxLabel = product.maxAmount
                                        ? formatCurrency(product.maxAmount)
                                        : "Tidak Terbatas";
                                    return (
                                        <div
                                            key={product.id}
                                            className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                                                isSelected
                                                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                                            }`}
                                            onClick={() => {
                                                setSelectedProduct(String(product.id));
                                                setAmount("");
                                                setTenor("");
                                            }}
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
                                                        Limit: {product.minAmount ? formatCurrency(product.minAmount) : "–"} s/d {maxLabel}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Tenor: {product.minTenor || 1}–{product.maxTenor} bulan &nbsp;·&nbsp;
                                                        Bunga: {product.interestRate}% flat/bln &nbsp;·&nbsp;
                                                        Resiko: {product.adminFeeValue}% (dipotong di muka)
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
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Amount */}
                        <div className="space-y-2">
                            <Label htmlFor="amount">Jumlah Pinjaman (Rp) *</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder={selectedProductData?.maxAmount
                                    ? `Maks: ${formatCurrency(selectedProductData.maxAmount)}`
                                    : "Tidak ada batas maksimal"
                                }
                                value={amount}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const maxVal = selectedProductData?.maxAmount || null;
                                    if (maxVal && val > maxVal) {
                                        setAmount(String(maxVal));
                                    } else {
                                        setAmount(e.target.value);
                                    }
                                }}
                                min={selectedProductData?.minAmount || 0}
                                max={selectedProductData?.maxAmount || undefined}
                                required
                            />
                            {selectedProductData && (
                                <p className="text-xs text-muted-foreground">
                                    {selectedProductData.minAmount ? `Min: ${formatCurrency(selectedProductData.minAmount)}` : ""}
                                    {selectedProductData.maxAmount ? ` · Maks: ${formatCurrency(selectedProductData.maxAmount)}` : " · Tidak ada batas maksimal"}
                                </p>
                            )}
                        </div>

                        {/* Tenor */}
                        <div className="space-y-2">
                            <Label htmlFor="tenor">Jangka Waktu (Bulan) *</Label>
                            <Input
                                id="tenor"
                                type="number"
                                placeholder={`Maks: ${selectedProductData?.maxTenor || 36} Bulan`}
                                value={tenor}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const maxTenor = selectedProductData?.maxTenor || 36;
                                    if (val <= maxTenor) {
                                        setTenor(e.target.value);
                                    } else {
                                        setTenor(String(maxTenor));
                                    }
                                }}
                                min={1}
                                max={selectedProductData?.maxTenor || 36}
                                required
                            />
                            {selectedProductData && (
                                <p className="text-xs text-muted-foreground">
                                    Maks tenor: {selectedProductData.maxTenor} bulan
                                </p>
                            )}
                        </div>

                        {/* Purpose */}
                        <div className="space-y-2">
                            <Label htmlFor="purpose">Tujuan Pinjaman</Label>
                            <Input
                                id="purpose"
                                type="text"
                                placeholder="Contoh: Modal usaha, Biaya pendidikan"
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                            />
                        </div>

                        {/* Deduction Source Selector */}
                        <div className="space-y-3">
                            <Label>Sumber Pemotongan Angsuran *</Label>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div
                                    className={`relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                                        deductionSource === "gaji"
                                            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                                            : "hover:bg-muted/50"
                                    }`}
                                    onClick={() => setDeductionSource("gaji")}
                                >
                                    <input
                                        type="radio"
                                        name="deductionSource"
                                        value="gaji"
                                        checked={deductionSource === "gaji"}
                                        onChange={() => setDeductionSource("gaji")}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="h-4 w-4 text-emerald-600" />
                                            <span className="text-sm font-semibold">Gaji</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Angsuran dipotong dari gaji bersih bulanan
                                            {salary > 0 && (
                                                <span className="font-medium"> ({formatCurrency(salary)})</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div
                                    className={`relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                                        deductionSource === "tunkin"
                                            ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200"
                                            : tunkin > 0 ? "hover:bg-muted/50" : "opacity-50 cursor-not-allowed"
                                    }`}
                                    onClick={() => tunkin > 0 && setDeductionSource("tunkin")}
                                >
                                    <input
                                        type="radio"
                                        name="deductionSource"
                                        value="tunkin"
                                        checked={deductionSource === "tunkin"}
                                        onChange={() => setDeductionSource("tunkin")}
                                        disabled={tunkin <= 0}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Award className="h-4 w-4 text-violet-600" />
                                            <span className="text-sm font-semibold">Tunjangan Kinerja</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {tunkin > 0
                                                ? <>Angsuran dipotong dari tunkin<span className="font-medium"> ({formatCurrency(tunkin)})</span></>
                                                : "Data tunkin belum tersedia"
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Estimated Monthly Installment */}
                        {amount && tenor && selectedProductData && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                                <p className="text-sm font-semibold text-emerald-800">Estimasi Angsuran Per Bulan</p>
                                <div className="grid grid-cols-2 gap-2 text-sm text-emerald-700">
                                    <div>Angsuran Pokok:</div>
                                    <div className="text-right font-medium">{formatCurrency(Math.ceil(parseFloat(amount) / parseInt(tenor)))}</div>
                                    <div>Angsuran Bunga ({selectedProductData.interestRate}%):</div>
                                    <div className="text-right font-medium">{formatCurrency(Math.ceil(parseFloat(amount) * (selectedProductData.interestRate / 100)))}</div>
                                    <div className="col-span-2 border-t border-emerald-200 my-1"></div>
                                    <div className="font-semibold text-emerald-900">Total Potongan /Bulan:</div>
                                    <div className="text-right font-bold text-lg text-emerald-900 tabular-nums">
                                        {formatCurrency(
                                            Math.ceil(parseFloat(amount) / parseInt(tenor)) + 
                                            Math.ceil(parseFloat(amount) * (selectedProductData.interestRate / 100))
                                        )}
                                    </div>
                                </div>
                                <div className="border-t border-emerald-200 my-2"></div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-violet-800">
                                    <div className="font-semibold">Biaya Resiko ({selectedProductData.adminFeeValue}%):</div>
                                    <div className="text-right font-bold tabular-nums">
                                        {formatCurrency(Math.ceil(parseFloat(amount) * (selectedProductData.adminFeeValue / 100)))}
                                    </div>
                                    <div className="col-span-2 text-xs opacity-80">
                                        *Biaya resiko {selectedProductData.adminFeeValue}% dipotong langsung di awal saat pencairan pinjaman.
                                    </div>
                                </div>
                                <div className="border-t border-emerald-200 my-2"></div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                                    <div className="font-semibold">Dana Cair (Bersih):</div>
                                    <div className="text-right font-bold text-lg tabular-nums text-blue-900">
                                        {formatCurrency(Math.ceil(parseFloat(amount) - (parseFloat(amount) * (selectedProductData.adminFeeValue / 100))))}
                                    </div>
                                </div>
                                <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <p>Sistem ini menggunakan metode <strong>kredit otomatis</strong>. Total angsuran per bulan di atas akan langsung <strong>memotong {deductionSource === "tunkin" ? "Tunjangan Kinerja" : "Gaji Netto"} Anda</strong> setiap bulannya.</p>
                                </div>
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Mengirim Pengajuan...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Kirim Pengajuan Pinjaman
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
