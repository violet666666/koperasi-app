"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Search,
    CreditCard,
    Loader2,
    AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface Loan {
    id: number;
    loanNo: string;
    memberId: number;
    member?: { id: number; memberNo: string; nrp?: string; name: string };
    principalAmount: number;
    principalOutstanding: number;
    interestOutstanding?: number;
    monthlyInstallment?: number;
    status: string;
}

export default function AngsuranPage() {
    const [searchMember, setSearchMember] = React.useState("");
    const [selectedLoan, setSelectedLoan] = React.useState<Loan | null>(null);
    const [loans, setLoans] = React.useState<Loan[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasSearched, setHasSearched] = React.useState(false);

    // Search loans via server-side search
    const handleSearch = async () => {
        const q = searchMember.trim();
        if (!q) return;

        setIsLoading(true);
        setHasSearched(true);
        setSelectedLoan(null);
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

    const handleSelectLoan = (loan: Loan) => {
        setSelectedLoan(loan);
    };

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
                                Tidak ada pinjaman aktif untuk pencarian <strong>"{searchMember}"</strong>.
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

            {/* Selected Loan Details */}
            {selectedLoan && (
                <Card className="border-primary/40">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Detail Pinjaman Dipilih
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

                        {/* Action Bayar */}
                        <div className="mt-6 pt-6 border-t flex justify-end">
                            <Button asChild className="w-full sm:w-auto">
                                <Link href={`/pinjaman/angsuran/bayar?loan_id=${selectedLoan.id}`}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Lanjut ke Proses Pembayaran
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
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
