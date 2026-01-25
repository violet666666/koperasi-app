"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Receipt,
    Search,
    CreditCard,
    Calendar,
    Loader2,
    CheckCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { loansApi, membersApi } from "@/lib/api/services";

interface Loan {
    id: number;
    loanNo: string;
    memberId: number;
    member?: { id: number; memberNo: string; name: string };
    principalAmount: number;
    principalOutstanding: number;
    interestOutstanding?: number;
    monthlyInstallment?: number;
    status: string;
}

interface LoanSchedule {
    id: number;
    installmentNo: number;
    dueDate: string;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
    principalPaid: number;
    interestPaid: number;
    status: string;
}

export default function AngsuranPage() {
    const [searchMember, setSearchMember] = React.useState("");
    const [selectedLoan, setSelectedLoan] = React.useState<Loan | null>(null);
    const [loans, setLoans] = React.useState<Loan[]>([]);
    const [schedules, setSchedules] = React.useState<LoanSchedule[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingSchedules, setIsLoadingSchedules] = React.useState(false);
    const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
    const [selectedSchedule, setSelectedSchedule] = React.useState<LoanSchedule | null>(null);
    const [paymentAmount, setPaymentAmount] = React.useState("");
    const [isProcessing, setIsProcessing] = React.useState(false);

    // Search loans for member
    const handleSearch = async () => {
        if (!searchMember.trim()) return;

        setIsLoading(true);
        try {
            const response = await loansApi.list({ status: "active" });
            // Filter by member (in real implementation, API should support this)
            const filtered = ((response.data as any).data || []).filter(
                (loan: Loan) =>
                    loan.member?.memberNo?.toLowerCase().includes(searchMember.toLowerCase()) ||
                    loan.member?.name?.toLowerCase().includes(searchMember.toLowerCase()) ||
                    loan.loanNo?.toLowerCase().includes(searchMember.toLowerCase())
            );
            setLoans(filtered);
        } catch (error) {
            console.error("Failed to search loans:", error);
            toast.error("Gagal mencari pinjaman");
        } finally {
            setIsLoading(false);
        }
    };

    // Load schedules when loan is selected
    const handleSelectLoan = async (loan: Loan) => {
        setSelectedLoan(loan);
        setIsLoadingSchedules(true);
        try {
            const response = await loansApi.payments(loan.id);
            // For now, simulate schedules since API may not have endpoint
            // In real implementation, fetch from /loans/:id/schedules
            setSchedules([]);
        } catch (error) {
            console.error("Failed to load schedules:", error);
        } finally {
            setIsLoadingSchedules(false);
        }
    };

    // Open payment dialog
    const handlePayment = (schedule: LoanSchedule) => {
        setSelectedSchedule(schedule);
        const remaining = schedule.totalAmount - schedule.principalPaid - schedule.interestPaid;
        setPaymentAmount(remaining.toString());
        setPaymentDialogOpen(true);
    };

    // Process payment
    const handleSubmitPayment = async () => {
        if (!selectedLoan || !selectedSchedule) return;

        setIsProcessing(true);
        try {
            await loansApi.createPayment(selectedLoan.id, {
                amount: Number(paymentAmount),
                paymentMethod: "cash",
            });
            toast.success("Pembayaran berhasil dicatat");
            setPaymentDialogOpen(false);
            // Refresh data
            handleSelectLoan(selectedLoan);
        } catch (error) {
            toast.error("Gagal memproses pembayaran");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pembayaran Angsuran"
                description="Catat pembayaran angsuran pinjaman anggota"
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
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Cari no. anggota, nama, atau no. pinjaman..."
                                value={searchMember}
                                onChange={(e) => setSearchMember(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={isLoading}>
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Cari"
                            )}
                        </Button>
                    </div>

                    {/* Search Results */}
                    {loans.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <Label>Pilih Pinjaman:</Label>
                            <div className="grid gap-2">
                                {loans.map((loan) => (
                                    <div
                                        key={loan.id}
                                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedLoan?.id === loan.id
                                            ? "border-primary bg-primary/5"
                                            : "hover:border-primary/50"
                                            }`}
                                        onClick={() => handleSelectLoan(loan)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-mono text-sm text-primary">
                                                    {loan.loanNo}
                                                </p>
                                                <p className="font-medium">{loan.member?.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {loan.member?.memberNo}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Sisa Pokok</p>
                                                <p className="font-bold tabular-nums">
                                                    {formatCurrency(loan.principalOutstanding)}
                                                </p>
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
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Detail Pinjaman
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

                        {/* Quick Payment */}
                        <div className="mt-6 pt-6 border-t">
                            <h4 className="font-medium mb-4">Pembayaran Cepat</h4>
                            <div className="flex gap-4 flex-wrap">
                                <div className="flex-1 min-w-[200px]">
                                    <Label>Jumlah Bayar</Label>
                                    <Input
                                        type="number"
                                        placeholder="Masukkan jumlah"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <Label>Metode Pembayaran</Label>
                                    <Select defaultValue="cash">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Tunai</SelectItem>
                                            <SelectItem value="transfer">Transfer Bank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end">
                                    <Button
                                        onClick={() => {
                                            if (Number(paymentAmount) > 0) {
                                                handleSubmitPayment();
                                            } else {
                                                toast.error("Masukkan jumlah pembayaran");
                                            }
                                        }}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Receipt className="mr-2 h-4 w-4" />
                                        )}
                                        Bayar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {!selectedLoan && loans.length === 0 && !isLoading && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-medium">Cari Pinjaman</h3>
                        <p className="mt-2 text-muted-foreground">
                            Masukkan nomor anggota, nama, atau nomor pinjaman untuk mencari
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
