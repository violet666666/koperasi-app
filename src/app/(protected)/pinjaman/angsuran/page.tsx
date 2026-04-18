"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Search,
    CreditCard,
    Loader2,
    AlertCircle,
    TrendingDown,
    Calendar,
    ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Loan {
    id: number;
    loanNo: string;
    memberId: number;
    member?: { id: number; memberNo: string; nrp?: string; name: string };
    principalAmount: number;
    principalOutstanding: number;
    interestAmount?: number;
    interestOutstanding?: number;
    principalPaid?: number;
    interestPaid?: number;
    tenorMonths?: number;
    monthlyInstallment?: number;
    status: string;
}

interface LoanSchedule {
    id: number;
    installmentNo: number;
    dueDate: string;
    principalAmount: number | string;
    interestAmount: number | string;
    totalAmount: number | string;
    principalPaid: number | string;
    interestPaid: number | string;
    status: string;
}

interface LoanDetailFull extends Loan {
    schedules: LoanSchedule[];
}

function toNum(v: number | string | undefined): number {
    if (v === undefined || v === null) return 0;
    return typeof v === "string" ? parseFloat(v) : v;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AngsuranPage() {
    const [searchMember, setSearchMember] = React.useState("");
    const [selectedLoan, setSelectedLoan] = React.useState<Loan | null>(null);
    const [loans, setLoans] = React.useState<Loan[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasSearched, setHasSearched] = React.useState(false);

    // Detail data for selected loan (schedules, etc.)
    const [loanDetail, setLoanDetail] = React.useState<LoanDetailFull | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);

    // Search loans via server-side search
    const handleSearch = async () => {
        const q = searchMember.trim();
        if (!q) return;

        setIsLoading(true);
        setHasSearched(true);
        setSelectedLoan(null);
        setLoanDetail(null);
        try {
            const response = await fetch(
                `/api/loans?search=${encodeURIComponent(q)}&status=active&perPage=50`
            );
            if (!response.ok) throw new Error("Gagal mengambil data");
            const json = await response.json();
            setLoans(json.data || []);
        } catch (error) {
            console.error("Failed to search loans:", error);
            toast.error("Gagal mencari pinjaman. Coba lagi.");
        } finally {
            setIsLoading(false);
        }
    };

    // When a loan is selected, fetch full detail with schedules
    const handleSelectLoan = async (loan: Loan) => {
        setSelectedLoan(loan);
        setLoanDetail(null);
        setIsLoadingDetail(true);
        try {
            const res = await fetch(`/api/loans/${loan.id}`);
            if (!res.ok) throw new Error("Gagal");
            const json = await res.json();
            setLoanDetail(json.data);
        } catch (err) {
            console.error("Failed to fetch loan detail:", err);
            toast.error("Gagal mengambil detail pinjaman");
        } finally {
            setIsLoadingDetail(false);
        }
    };

    // Computed: next due schedule
    const nextSchedule = React.useMemo(() => {
        if (!loanDetail?.schedules) return null;
        const pending = loanDetail.schedules
            .filter((s) => ["pending", "partial", "overdue"].includes(s.status))
            .sort((a, b) => a.installmentNo - b.installmentNo);
        if (pending.length === 0) return null;
        const s = pending[0];
        const principalDue = toNum(s.principalAmount) - toNum(s.principalPaid);
        const interestDue = toNum(s.interestAmount) - toNum(s.interestPaid);
        return {
            installmentNo: s.installmentNo,
            dueDate: s.dueDate,
            principalDue,
            interestDue,
            totalDue: principalDue + interestDue,
            isOverdue: s.status === "overdue",
        };
    }, [loanDetail]);

    // Computed: progress stats
    const progress = React.useMemo(() => {
        if (!loanDetail) return null;
        const principalAmount = toNum(loanDetail.principalAmount);
        const principalPaid = toNum(loanDetail.principalPaid);
        const interestAmount = toNum(loanDetail.interestAmount);
        const interestPaid = toNum(loanDetail.interestPaid);
        const paidCount = loanDetail.schedules?.filter(
            (s) => s.status === "paid"
        ).length ?? 0;
        const totalCount = loanDetail.tenorMonths ?? loanDetail.schedules?.length ?? 0;
        const percent =
            principalAmount > 0
                ? Math.round((principalPaid / principalAmount) * 100)
                : 0;

        return {
            principalPaid,
            principalAmount,
            interestPaid,
            interestAmount,
            paidCount,
            totalCount,
            percent,
        };
    }, [loanDetail]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pembayaran Angsuran"
                description="Cari pinjaman anggota lalu lanjut ke proses pembayaran"
            />

            {/* Search Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Cari Pinjaman
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                id="search-pinjaman"
                                placeholder="Cari nama, NRP/NIP, no. anggota, atau no. pinjaman..."
                                value={searchMember}
                                onChange={(e) => setSearchMember(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                autoComplete="off"
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={isLoading || !searchMember.trim()}>
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Search className="mr-2 h-4 w-4" />
                                    Cari
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Loading skeleton */}
                    {isLoading && (
                        <div className="mt-4 space-y-2">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-20 w-full rounded-lg" />
                            ))}
                        </div>
                    )}

                    {/* Tidak ditemukan */}
                    {!isLoading && hasSearched && loans.length === 0 && (
                        <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed p-4 text-muted-foreground">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm">
                                Tidak ada pinjaman aktif untuk pencarian <strong>&quot;{searchMember}&quot;</strong>.
                                Coba dengan nama lengkap, NRP, atau nomor anggota.
                            </p>
                        </div>
                    )}

                    {/* Search Results */}
                    {!isLoading && loans.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <Label>
                                {loans.length} pinjaman aktif ditemukan — pilih salah satu:
                            </Label>
                            <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
                                {loans.map((loan) => (
                                    <div
                                        key={loan.id}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                            selectedLoan?.id === loan.id
                                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                : "hover:border-primary/50 hover:bg-muted/40"
                                        }`}
                                        onClick={() => handleSelectLoan(loan)}
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="min-w-0">
                                                <p className="font-mono text-sm text-primary font-medium">
                                                    {loan.loanNo}
                                                </p>
                                                <p className="font-semibold truncate">{loan.member?.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    NRP: {loan.member?.nrp || loan.member?.memberNo || "-"}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs text-muted-foreground">Sisa Pokok</p>
                                                <p className="font-bold tabular-nums text-sm">
                                                    {formatCurrency(loan.principalOutstanding)}
                                                </p>
                                                {loan.monthlyInstallment && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Cicilan: {formatCurrency(loan.monthlyInstallment)}/bln
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Selected Loan Details + Akumulasi */}
            {selectedLoan && (
                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Detail Pinjaman */}
                    <Card className="border-primary/40">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Detail Pinjaman Dipilih
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-sm text-muted-foreground">No. Pinjaman</p>
                                    <p className="font-mono font-medium">{selectedLoan.loanNo}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Anggota</p>
                                    <p className="font-medium">{selectedLoan.member?.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        NRP: {selectedLoan.member?.nrp || selectedLoan.member?.memberNo || "-"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Pokok Awal</p>
                                    <p className="font-bold tabular-nums">
                                        {formatCurrency(selectedLoan.principalAmount)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Sisa Pokok</p>
                                    <p className="font-bold tabular-nums text-primary">
                                        {formatCurrency(selectedLoan.principalOutstanding)}
                                    </p>
                                </div>
                            </div>

                            {/* Angsuran Berikutnya */}
                            {isLoadingDetail && (
                                <div className="mt-4 pt-4 border-t">
                                    <Skeleton className="h-20 w-full rounded-lg" />
                                </div>
                            )}

                            {!isLoadingDetail && nextSchedule && (
                                <div className="mt-4 pt-4 border-t">
                                    <Label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                                        <Calendar className="h-3.5 w-3.5" />
                                        Angsuran Berikutnya
                                    </Label>
                                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={nextSchedule.isOverdue ? "destructive" : "outline"}
                                                className="font-mono"
                                            >
                                                Ke-{nextSchedule.installmentNo}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                Jatuh tempo: {formatDate(nextSchedule.dueDate)}
                                            </span>
                                            {nextSchedule.isOverdue && (
                                                <Badge variant="destructive" className="text-[10px]">
                                                    TERLAMBAT
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Pokok</p>
                                                <p className="font-semibold tabular-nums">
                                                    {formatCurrency(nextSchedule.principalDue)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Bunga/Jasa</p>
                                                <p className="font-semibold tabular-nums">
                                                    {formatCurrency(nextSchedule.interestDue)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Total</p>
                                                <p className="font-bold tabular-nums text-primary">
                                                    {formatCurrency(nextSchedule.totalDue)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Bayar */}
                            <div className="mt-6 pt-4 border-t flex justify-end">
                                <Button asChild className="w-full sm:w-auto">
                                    <Link href={`/pinjaman/angsuran/bayar?loan_id=${selectedLoan.id}`}>
                                        <CreditCard className="mr-2 h-4 w-4" />
                                        Lanjut ke Proses Pembayaran
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Akumulasi Pembayaran */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <TrendingDown className="h-5 w-5" />
                                Akumulasi Pembayaran
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingDetail && (
                                <div className="space-y-3">
                                    <Skeleton className="h-6 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-6 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            )}

                            {!isLoadingDetail && progress && (
                                <div className="space-y-4">
                                    {/* Progress Bar */}
                                    <div>
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <span className="text-muted-foreground">
                                                Progress Pelunasan
                                            </span>
                                            <span className="font-bold text-primary">
                                                {progress.percent}%
                                            </span>
                                        </div>
                                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out"
                                                style={{
                                                    width: `${Math.min(progress.percent, 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Pokok */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">
                                                Total Pokok Dibayar
                                            </span>
                                            <span className="font-semibold tabular-nums">
                                                {formatCurrency(progress.principalPaid)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>dari total pokok</span>
                                            <span className="tabular-nums">
                                                {formatCurrency(progress.principalAmount)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bunga */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">
                                                Total Bunga/Jasa Dibayar
                                            </span>
                                            <span className="font-semibold tabular-nums">
                                                {formatCurrency(progress.interestPaid)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>dari total bunga/jasa</span>
                                            <span className="tabular-nums">
                                                {formatCurrency(progress.interestAmount)}
                                            </span>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Angsuran count */}
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            Angsuran Terbayar
                                        </span>
                                        <span className="font-bold">
                                            {progress.paidCount} / {progress.totalCount} bulan
                                        </span>
                                    </div>

                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            Sisa Angsuran
                                        </span>
                                        <span className="font-bold text-primary">
                                            {progress.totalCount - progress.paidCount} bulan
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!isLoadingDetail && !progress && (
                                <div className="py-6 text-center text-muted-foreground text-sm">
                                    Data akumulasi tidak tersedia
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Initial empty state */}
            {!hasSearched && !isLoading && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Search className="mx-auto h-12 w-12 text-muted-foreground/40" />
                        <h3 className="mt-4 text-lg font-medium">Mulai Pencarian</h3>
                        <p className="mt-2 text-muted-foreground text-sm max-w-sm mx-auto">
                            Ketik nama anggota, NRP/NIP, nomor anggota, atau nomor pinjaman pada kotak di atas, lalu tekan{" "}
                            <kbd className="px-1 py-0.5 text-xs border rounded">Enter</kbd>.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
