"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
    Loader2,
    CreditCard,
    User,
    Calendar,
    TrendingDown,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Receipt,
    ArrowRight,
    Banknote,
    Shield,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { Switch } from "@/components/ui/switch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoanSchedule {
    id: number;
    installmentNo: number;
    dueDate: string;
    principalAmount: number | string;
    interestAmount: number | string;
    totalAmount: number | string;
    principalPaid: number | string;
    interestPaid: number | string;
    lateFee: number | string;
    lateFeePaid: number | string;
    status: string;
}

interface LoanDetail {
    id: number;
    loanNo: string;
    memberId: number;
    principalAmount: number | string;
    interestAmount: number | string;
    totalAmount: number | string;
    principalPaid: number | string;
    interestPaid: number | string;
    principalOutstanding: number | string;
    interestOutstanding: number | string;
    tenorMonths: number;
    monthlyInstallment: number | string;
    interestRate: number | string;
    status: string;
    member?: { id: number; memberNo: string; name: string; phone?: string };
    schedules: LoanSchedule[];
}

interface ScheduleDue {
    scheduleId: number;
    installmentNo: number;
    dueDate: string;
    principalDue: number;
    interestDue: number;
    totalDue: number;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: number | string): number {
    return typeof v === "string" ? parseFloat(v) : v;
}

function calcScheduleDue(s: LoanSchedule): ScheduleDue {
    const principalDue = toNum(s.principalAmount) - toNum(s.principalPaid);
    const interestDue = toNum(s.interestAmount) - toNum(s.interestPaid);
    return {
        scheduleId: s.id,
        installmentNo: s.installmentNo,
        dueDate: s.dueDate,
        principalDue,
        interestDue,
        totalDue: principalDue + interestDue,
    };
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BayarAngsuranPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const loanId = searchParams.get("loan_id") || searchParams.get("loanId");

    // State
    const [loan, setLoan] = React.useState<LoanDetail | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [payMode, setPayMode] = React.useState<string>("1"); // "1", "2", "3", "settlement"
    const [paymentDate, setPaymentDate] = React.useState(
        new Date().toISOString().split("T")[0]
    );
    const [showConfirm, setShowConfirm] = React.useState(false);
    const [cashBankAccounts, setCashBankAccounts] = React.useState<CashBankAccount[]>([]);
    const [selectedCashBankId, setSelectedCashBankId] = React.useState<string>("");
    const [discountInterest, setDiscountInterest] = React.useState(false);

    // Mode check
    const isSettlementMode = payMode === "settlement";

    // Derived: pending schedules
    const pendingSchedules = React.useMemo(() => {
        if (!loan) return [];
        return loan.schedules
            .filter((s) => ["pending", "partial", "overdue"].includes(s.status))
            .sort((a, b) => a.installmentNo - b.installmentNo)
            .map(calcScheduleDue)
            .filter((s) => s.totalDue > 0);
    }, [loan]);

    // Max pay count
    const maxPayCount = pendingSchedules.length;

    // Selected schedules to pay
    const payCount = isSettlementMode ? maxPayCount : Math.min(parseInt(payMode) || 1, maxPayCount);
    const selectedSchedules = isSettlementMode ? pendingSchedules : pendingSchedules.slice(0, payCount);

    // ═══ Early Settlement Calculations ═══
    // Kebijakan: Pelunasan Dipercepat = Sisa Pokok + Penalti SAJA (tanpa bunga/jasa)
    const earlySettlement = React.useMemo(() => {
        if (!loan || !isSettlementMode) return null;
        const principalAmount = Number(loan.principalAmount);
        const interestRate = Number(loan.interestRate || 1);
        const monthlyInterest = Math.round(principalAmount * (interestRate / 100));
        const penaltyMultiplier = loan.tenorMonths <= 24 ? 1 : 2;
        const penaltyFee = monthlyInterest * penaltyMultiplier;

        const remainingPrincipal = Number(loan.principalOutstanding);

        return {
            remainingPrincipal,
            penaltyFee,
            penaltyMultiplier,
            monthlyInterest,
            total: remainingPrincipal + penaltyFee,
        };
    }, [loan, isSettlementMode]);

    // Totals — different for settlement vs installment
    const totalPrincipal = isSettlementMode
        ? (earlySettlement?.remainingPrincipal || 0)
        : selectedSchedules.reduce((s, x) => s + x.principalDue, 0);
    const totalInterest = isSettlementMode
        ? 0  // Pelunasan dipercepat: TANPA bunga/jasa
        : selectedSchedules.reduce((s, x) => s + x.interestDue, 0);
    const earlySettlementFee = earlySettlement?.penaltyFee || 0;
    const grandTotal = isSettlementMode
        ? (earlySettlement?.total || 0)
        : (totalPrincipal + totalInterest);

    // Progress
    const paidSchedulesCount = loan
        ? loan.schedules.filter((s) => s.status === "paid").length
        : 0;
    const progressPercent = loan
        ? Math.round(
              (toNum(loan.principalPaid) / toNum(loan.principalAmount)) * 100
          )
        : 0;

    // ─── Fetch Loan ─────────────────────────────────────────────────────────

    React.useEffect(() => {
        if (!loanId) {
            setIsLoading(false);
            return;
        }
        (async () => {
            try {
                const res = await fetch(`/api/loans/${loanId}`);
                if (!res.ok) throw new Error("Gagal mengambil data");
                const json = await res.json();
                setLoan(json.data);
            } catch (err) {
                console.error("Failed to fetch loan:", err);
                toast.error("Gagal mengambil data pinjaman");
            } finally {
                setIsLoading(false);
            }
        })();
    }, [loanId]);

    // ─── Fetch Cash/Bank Accounts ────────────────────────────────────────

    React.useEffect(() => {
        fetch("/api/master/cash-bank?perPage=50")
            .then((r) => r.json())
            .then((json) => {
                let accounts: CashBankAccount[] = json.data || [];
                // Filter: only main accounts (not unit-specific, not SHU-specific)
                accounts = accounts.filter(a => !a.unitType && !a.purpose?.startsWith('shu_'));
                setCashBankAccounts(accounts);
                // Auto-select first cash account if available
                const firstCash = accounts.find(a => a.type === "cash");
                if (firstCash) setSelectedCashBankId(String(firstCash.id));
            })
            .catch(() => toast.error("Gagal memuat akun Kas & Bank"));
    }, []);

    // ─── Submit Payment ─────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!loan || grandTotal <= 0) return;
        if (!selectedCashBankId) {
            toast.error("Pilih akun Kas/Bank tujuan terlebih dahulu");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create payment
            const payRes = await fetch(`/api/loans/${loan.id}/payments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: grandTotal,
                    paymentMethod: "cash",
                    cashBankAccountId: Number(selectedCashBankId),
                    paymentDate,
                    paymentType: isSettlementMode ? "early_settlement" : "installment",
                    earlySettlementFee: isSettlementMode ? earlySettlementFee : 0,
                    discountInterest: isSettlementMode ? discountInterest : false,
                }),
            });

            if (!payRes.ok) {
                const errData = await payRes.json().catch(() => ({}));
                throw new Error(errData.message || "Gagal memproses pembayaran");
            }

            const payData = await payRes.json();
            const payment = payData.data;

            toast.success(isSettlementMode
                ? "Pelunasan dipercepat berhasil! Pinjaman telah lunas."
                : "Pembayaran angsuran berhasil dicatat!");

            // 2. Auto-create receipt
            try {
                const scheduleLabel = isSettlementMode
                    ? "PELUNASAN DIPERCEPAT"
                    : payCount === 1
                        ? `Ke-${selectedSchedules[0].installmentNo}`
                        : `Ke-${selectedSchedules[0].installmentNo} s/d ${selectedSchedules[payCount - 1].installmentNo}`;

                const receiptRes = await fetch("/api/receipts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        memberId: loan.memberId,
                        type: isSettlementMode ? "pelunasan" : "angsuran",
                        referenceNo: payment.paymentNo,
                        amount: grandTotal,
                        description: isSettlementMode
                            ? `Pelunasan Dipercepat Pinjaman ${loan.loanNo} (Pokok: ${formatCurrency(totalPrincipal)}, Bunga: ${formatCurrency(totalInterest)}, Penalti: ${formatCurrency(earlySettlementFee)})`
                            : `Pembayaran Angsuran ${scheduleLabel} Pinjaman ${loan.loanNo}`,
                        receivedFrom: loan.member?.name || "-",
                        paymentMethod: "cash",
                        receiptDate: paymentDate,
                    }),
                });

                if (receiptRes.ok) {
                    const receiptData = await receiptRes.json();
                    const receipt = receiptData.data;
                    toast.success("Kwitansi otomatis dibuat");
                    // Redirect to print receipt
                    router.push(`/kwitansi/${receipt.id}/cetak`);
                    return;
                }
            } catch (receiptErr) {
                console.error("Auto-create receipt failed:", receiptErr);
                // Receipt creation is non-blocking — payment already succeeded
                toast.info("Pembayaran berhasil, tapi gagal membuat kwitansi otomatis");
            }

            // Fallback redirect if receipt creation failed
            router.push(`/pinjaman/${loan.id}`);
        } catch (error) {
            console.error("Payment error:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal memproses pembayaran angsuran"
            );
        } finally {
            setIsSubmitting(false);
            setShowConfirm(false);
        }
    };

    // ─── Render: Loading ────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Bayar Angsuran"
                    description="Memuat data pinjaman..."
                    backHref="/pinjaman/angsuran"
                />
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-48 rounded-lg" />
                    <Skeleton className="h-48 rounded-lg" />
                </div>
                <Skeleton className="h-64 rounded-lg" />
            </div>
        );
    }

    // ─── Render: Error / Not Found ──────────────────────────────────────────

    if (!loanId || !loan) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Bayar Angsuran"
                    description="Proses pembayaran angsuran pinjaman"
                    backHref="/pinjaman/angsuran"
                />
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/40" />
                        <h3 className="mt-4 text-lg font-medium">Pinjaman Tidak Ditemukan</h3>
                        <p className="mt-2 text-muted-foreground text-sm">
                            {!loanId
                                ? "Loan ID tidak ditemukan di URL. Silakan kembali ke halaman angsuran."
                                : "Data pinjaman tidak bisa dimuat. Coba lagi atau hubungi admin."}
                        </p>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => router.push("/pinjaman/angsuran")}
                        >
                            Kembali ke Halaman Angsuran
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ─── Render: No pending schedules ────────────────────────────────────────

    if (pendingSchedules.length === 0) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Bayar Angsuran"
                    description="Proses pembayaran angsuran pinjaman"
                    backHref="/pinjaman/angsuran"
                />
                <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10">
                    <CardContent className="py-12 text-center">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                        <h3 className="mt-4 text-lg font-medium text-green-700 dark:text-green-400">
                            Pinjaman Sudah Lunas
                        </h3>
                        <p className="mt-2 text-muted-foreground text-sm">
                            Semua angsuran untuk pinjaman <strong>{loan.loanNo}</strong> sudah
                            dibayar lunas.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => router.push(`/pinjaman/${loan.id}`)}
                        >
                            Lihat Detail Pinjaman
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ─── Render: Main ───────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            <PageHeader
                title="Bayar Angsuran"
                description={`Pembayaran angsuran pinjaman ${loan.loanNo}`}
                backHref="/pinjaman/angsuran"
            />

            {/* ── Info Pinjaman & Progress ─────────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Loan Info */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            Informasi Pinjaman
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">No. Pinjaman</span>
                            <span className="font-mono font-medium text-primary">
                                {loan.loanNo}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Anggota</span>
                            <span className="font-medium">{loan.member?.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">NRP / No. Anggota</span>
                            <span>{loan.member?.memberNo || "-"}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Pokok Awal</span>
                            <span className="font-semibold tabular-nums">
                                {formatCurrency(toNum(loan.principalAmount))}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Bunga/Jasa ({toNum(loan.interestRate)}%)</span>
                            <span className="tabular-nums">
                                {formatCurrency(toNum(loan.interestAmount))}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tenor</span>
                            <span>{loan.tenorMonths} bulan</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Progress */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-primary" />
                            Progress Pembayaran
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-muted-foreground">Pokok Terbayar</span>
                                <span className="font-semibold tabular-nums">
                                    {formatCurrency(toNum(loan.principalPaid))} /{" "}
                                    {formatCurrency(toNum(loan.principalAmount))}
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-500"
                                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 text-right">
                                {progressPercent}%
                            </p>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Bunga/Jasa Terbayar</span>
                            <span className="tabular-nums">
                                {formatCurrency(toNum(loan.interestPaid))} /{" "}
                                {formatCurrency(toNum(loan.interestAmount))}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Angsuran Terbayar</span>
                            <span className="font-semibold">
                                {paidSchedulesCount} / {loan.tenorMonths} bulan
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sisa Pokok</span>
                            <span className="font-bold text-primary tabular-nums">
                                {formatCurrency(toNum(loan.principalOutstanding))}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sisa Bunga/Jasa</span>
                            <span className="font-bold tabular-nums">
                                {formatCurrency(toNum(loan.interestOutstanding))}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Angsuran Berikutnya + Mode Bayar ────────────────────── */}
            <Card className="border-primary/30">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Pembayaran Angsuran
                    </CardTitle>
                    <CardDescription>
                        Sistem otomatis membaca jadwal angsuran berikutnya. Pilih jumlah angsuran yang ingin dibayar.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Mode selection */}
                    <div>
                        <Label className="text-sm font-medium mb-3 block">
                            Jumlah Angsuran yang Dibayar
                        </Label>
                        <RadioGroup
                            value={payMode}
                            onValueChange={(v) => { setPayMode(v); if (v !== "settlement") setDiscountInterest(false); }}
                            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                        >
                            {/* Option: 1 angsuran */}
                            <Label
                                htmlFor="pay-1"
                                className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                                    payMode === "1"
                                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                        : "border-muted hover:border-primary/40"
                                }`}
                            >
                                <RadioGroupItem value="1" id="pay-1" />
                                <div>
                                    <p className="font-medium text-sm">1 Angsuran</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatCurrency(pendingSchedules[0]?.totalDue || 0)}
                                    </p>
                                </div>
                            </Label>

                            {/* Option: 2 angsuran */}
                            {maxPayCount >= 2 && (
                                <Label
                                    htmlFor="pay-2"
                                    className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                                        payMode === "2"
                                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                            : "border-muted hover:border-primary/40"
                                    }`}
                                >
                                    <RadioGroupItem value="2" id="pay-2" />
                                    <div>
                                        <p className="font-medium text-sm">2 Angsuran</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatCurrency(
                                                pendingSchedules
                                                    .slice(0, 2)
                                                    .reduce((s, x) => s + x.totalDue, 0)
                                            )}
                                        </p>
                                    </div>
                                </Label>
                            )}

                            {/* Option: 3 angsuran */}
                            {maxPayCount >= 3 && (
                                <Label
                                    htmlFor="pay-3"
                                    className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                                        payMode === "3"
                                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                            : "border-muted hover:border-primary/40"
                                    }`}
                                >
                                    <RadioGroupItem value="3" id="pay-3" />
                                    <div>
                                        <p className="font-medium text-sm">3 Angsuran</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatCurrency(
                                                pendingSchedules
                                                    .slice(0, 3)
                                                    .reduce((s, x) => s + x.totalDue, 0)
                                            )}
                                        </p>
                                    </div>
                                </Label>
                            )}

                            {/* Option: Pelunasan Dipercepat */}
                            {maxPayCount > 0 && (
                                <Label
                                    htmlFor="pay-settlement"
                                    className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                                        payMode === "settlement"
                                            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-400/50"
                                            : "border-muted hover:border-amber-400/50"
                                    }`}
                                >
                                    <RadioGroupItem value="settlement" id="pay-settlement" />
                                    <div>
                                        <p className="font-medium text-sm flex items-center gap-1">
                                            <Shield className="h-3.5 w-3.5 text-amber-600" />
                                            Pelunasan
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Lunasi semua sisa
                                        </p>
                                    </div>
                                </Label>
                            )}
                        </RadioGroup>
                    </div>

                    {/* ═══ Settlement Breakdown Panel ═══ */}
                    {isSettlementMode && earlySettlement && (
                        <div className="rounded-lg border-2 border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20 p-5 space-y-4">
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-5 w-5" />
                                <h3 className="font-semibold">Pelunasan Dipercepat</h3>
                            </div>

                            <div className="text-xs text-amber-700/80 dark:text-amber-400/70 bg-amber-100/50 dark:bg-amber-900/20 rounded-md p-3">
                                <p className="font-medium mb-1">Aturan Biaya Pelunasan:</p>
                                <p>• Tenor ≤ 24 bulan → Penalti 1× bunga bulanan</p>
                                <p>• Tenor &gt; 24 bulan → Penalti 2× bunga bulanan</p>
                                <p className="mt-1 font-medium">
                                    Pinjaman ini: Tenor {loan?.tenorMonths} bulan → Penalti{" "}
                                    {earlySettlement.penaltyMultiplier}× bunga ({formatCurrency(earlySettlement.monthlyInterest)}/bln)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Sisa Pokok</span>
                                    <span className="font-semibold tabular-nums">{formatCurrency(earlySettlement.remainingPrincipal)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-emerald-600">
                                    <span>Bunga / Jasa</span>
                                    <span className="tabular-nums">Rp 0 (tidak dikenakan)</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                                        Biaya Penalti ({earlySettlement.penaltyMultiplier}× bunga)
                                    </span>
                                    <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                                        {formatCurrency(earlySettlement.penaltyFee)}
                                    </span>
                                </div>
                                <Separator />
                                <div className="flex justify-between text-base font-bold">
                                    <span className="text-primary">TOTAL PELUNASAN</span>
                                    <span className="tabular-nums text-primary">{formatCurrency(earlySettlement.total)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Breakdown table */}
                    <div>
                        <Label className="text-sm font-medium mb-3 block">
                            Rincian Angsuran yang Akan Dibayar
                        </Label>
                        <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50">
                                        <th className="px-4 py-2.5 text-left font-medium">
                                            Angsuran
                                        </th>
                                        <th className="px-4 py-2.5 text-left font-medium">
                                            Jatuh Tempo
                                        </th>
                                        <th className="px-4 py-2.5 text-right font-medium">
                                            Pokok
                                        </th>
                                        <th className="px-4 py-2.5 text-right font-medium">
                                            Bunga/Jasa
                                        </th>
                                        <th className="px-4 py-2.5 text-right font-medium">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedSchedules.map((s, idx) => (
                                        <tr
                                            key={s.scheduleId}
                                            className={
                                                idx % 2 === 0 ? "" : "bg-muted/20"
                                            }
                                        >
                                            <td className="px-4 py-2.5">
                                                <Badge variant="outline" className="font-mono">
                                                    Ke-{s.installmentNo}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2.5 text-muted-foreground">
                                                {formatDate(s.dueDate)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums">
                                                {formatCurrency(s.principalDue)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums">
                                                {formatCurrency(s.interestDue)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                                                {formatCurrency(s.totalDue)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 bg-primary/5 font-semibold">
                                        <td
                                            colSpan={2}
                                            className="px-4 py-3 text-primary"
                                        >
                                            TOTAL PEMBAYARAN
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {formatCurrency(totalPrincipal)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {formatCurrency(totalInterest)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-primary text-base">
                                            {formatCurrency(grandTotal)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Payment date + Kas selector */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="payment-date" className="text-sm font-medium">
                                <Calendar className="inline h-3.5 w-3.5 mr-1" />
                                Tanggal Pembayaran
                            </Label>
                            <Input
                                id="payment-date"
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="mt-1.5"
                            />
                        </div>
                        <div>
                            <Label htmlFor="cash-bank-account" className="text-sm font-medium">
                                <Banknote className="inline h-3.5 w-3.5 mr-1" />
                                Kas/Bank Tujuan *
                            </Label>
                            <Select
                                value={selectedCashBankId}
                                onValueChange={setSelectedCashBankId}
                            >
                                <SelectTrigger className="mt-1.5">
                                    <SelectValue
                                        placeholder={
                                            cashBankAccounts.length === 0
                                                ? "Memuat akun..."
                                                : "Pilih akun kas/bank"
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {cashBankAccounts.map((acc) => (
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
                                Mutasi kas koperasi akan otomatis tercatat
                            </p>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="pt-2 flex justify-end">
                        <Button
                            size="lg"
                            className={`min-w-[240px] ${isSettlementMode ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                            onClick={() => setShowConfirm(true)}
                            disabled={grandTotal <= 0 || !selectedCashBankId}
                        >
                            {isSettlementMode ? (
                                <Shield className="mr-2 h-4 w-4" />
                            ) : (
                                <CreditCard className="mr-2 h-4 w-4" />
                            )}
                            {isSettlementMode ? 'Proses Pelunasan' : 'Bayar'} {formatCurrency(grandTotal)}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* ── Confirmation Dialog ─────────────────────────────────── */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <div className="flex items-start gap-3">
                            <div className="rounded-full p-2 bg-primary/10">
                                <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                                <AlertDialogTitle>
                                    {isSettlementMode ? 'Konfirmasi Pelunasan Dipercepat' : 'Konfirmasi Pembayaran Angsuran'}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="mt-2">
                                    Pastikan data di bawah sudah benar sebelum memproses
                                    pembayaran.
                                </AlertDialogDescription>
                            </div>
                        </div>
                    </AlertDialogHeader>

                    <div className="space-y-3 py-2">
                        <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Anggota</span>
                                <span className="font-medium">
                                    {loan.member?.name}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">No. Pinjaman</span>
                                <span className="font-mono">{loan.loanNo}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{isSettlementMode ? 'Jenis' : 'Angsuran'}</span>
                                <span>
                                    {isSettlementMode
                                        ? <Badge className="bg-amber-600">PELUNASAN DIPERCEPAT</Badge>
                                        : payCount === 1
                                            ? `Ke-${selectedSchedules[0]?.installmentNo}`
                                            : `Ke-${selectedSchedules[0]?.installmentNo} s/d ${selectedSchedules[payCount - 1]?.installmentNo}`}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tanggal</span>
                                <span>{formatDate(paymentDate)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Kas/Bank</span>
                                <span className="font-medium">
                                    {cashBankAccounts.find((a) => String(a.id) === selectedCashBankId)?.name ?? "—"}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-lg border p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Pokok</span>
                                <span className="tabular-nums">
                                    {formatCurrency(totalPrincipal)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Bunga/Jasa</span>
                                <span className="tabular-nums">
                                    {formatCurrency(totalInterest)}
                                </span>
                            </div>
                            {isSettlementMode && earlySettlementFee > 0 && (
                                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                                    <span className="font-medium">Biaya Penalti</span>
                                    <span className="tabular-nums font-medium">
                                        {formatCurrency(earlySettlementFee)}
                                    </span>
                                </div>
                            )}
                            <Separator />
                            <div className="flex justify-between font-bold text-base">
                                <span>Total Bayar</span>
                                <span className="text-primary tabular-nums">
                                    {formatCurrency(grandTotal)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-3">
                            <Receipt className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>
                                Kwitansi akan dibuat otomatis setelah pembayaran berhasil.
                            </span>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>
                            Batal
                        </AlertDialogCancel>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Konfirmasi Bayar
                                </>
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
