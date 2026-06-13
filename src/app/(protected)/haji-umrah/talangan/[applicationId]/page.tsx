"use client";

import React from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/patterns/page-header";
import { formatCurrency } from "@/lib/constants";
import { ArrowLeft, Check, Clock, Loader2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";

interface Schedule {
    id: number;
    installmentNo: number;
    dueDate: string;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
    principalPaid: number;
    interestPaid: number;
    lateFee: number;
    status: string;
    paidDate: string | null;
}

interface Payment {
    id: number;
    paymentNo: string;
    amount: number;
    principalAmount: number;
    interestAmount: number;
    lateFeeAmount: number;
    paymentDate: string;
    paymentMethod: string | null;
    notes: string | null;
    status: string;
    createdAt: string;
}

interface DetailData {
    application: {
        id: number;
        applicationNo: string;
        status: string;
        amount: number;
        tenorMonths: number;
        purpose: string | null;
        notes: string | null;
        deductionSource: string;
        createdAt: string;
        member: { id: number; name: string; nrp: string | null };
        product: { code: string; name: string; type: string | null; interestRate: number | null };
    };
    savingsAccount: {
        accountNo: string;
        balance: number;
        targetAmount: number | null;
        progress: number | null;
        product: { name: string; type: string };
    } | null;
    loan: {
        id: number;
        loanNo: string;
        principalAmount: number;
        interestAmount: number;
        totalAmount: number;
        adminFee: number;
        disbursedAmount: number;
        tenorMonths: number;
        interestRate: number;
        monthlyInstallment: number;
        principalPaid: number;
        interestPaid: number;
        principalOutstanding: number;
        interestOutstanding: number;
        status: string;
        disbursementDate: string;
    } | null;
    schedules: Schedule[];
    payments: Payment[];
    stats: {
        totalPaid: number;
        remainingTotal: number;
        paidInstallments: number;
        totalInstallments: number;
        nextDue: string | null;
    } | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "secondary" },
    submitted: { label: "Menunggu Approval", variant: "outline" },
    approved: { label: "Disetujui", variant: "default" },
    rejected: { label: "Ditolak", variant: "destructive" },
    disbursed: { label: "Dicairkan", variant: "default" },
    cancelled: { label: "Dibatalkan", variant: "secondary" },
};

const scheduleStatusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: "Menunggu", className: "bg-yellow-100 text-yellow-800" },
    partial: { label: "Sebagian", className: "bg-blue-100 text-blue-800" },
    paid: { label: "Lunas", className: "bg-green-100 text-green-800" },
    overdue: { label: "Terlambat", className: "bg-red-100 text-red-800" },
};

export default function TalanganDetailPage() {
    const router = useRouter();
    const params = useParams();
    const applicationId = params.applicationId as string;

    const [data, setData] = React.useState<DetailData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState(false);

    React.useEffect(() => {
        async function fetchDetail() {
            try {
                const res = await fetch(`/api/haji-umrah/talangan/${applicationId}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json.data);
                } else {
                    toast.error("Pengajuan talangan tidak ditemukan");
                    router.push("/haji-umrah/talangan");
                }
            } catch (err) {
                console.error(err);
                toast.error("Gagal memuat detail");
            } finally {
                setLoading(false);
            }
        }
        if (applicationId) fetchDetail();
    }, [applicationId, router]);

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/loans/applications/${applicationId}/approve`, { method: "POST" });
            if (res.ok) {
                toast.success("Pengajuan talangan disetujui");
                window.location.reload();
            } else {
                const json = await res.json();
                toast.error(json.message || "Gagal menyetujui");
            }
        } catch { toast.error("Terjadi kesalahan"); }
        finally { setActionLoading(false); }
    };

    const handleDisburse = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/loans/applications/${applicationId}/disburse`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (res.ok) {
                toast.success("Talangan berhasil dicairkan!");
                window.location.reload();
            } else {
                const json = await res.json();
                toast.error(json.message || "Gagal mencairkan");
            }
        } catch { toast.error("Terjadi kesalahan"); }
        finally { setActionLoading(false); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) return null;

    const app = data.application;
    const loan = data.loan;
    const savings = data.savingsAccount;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <PageHeader
                title={`Talangan ${app.applicationNo}`}
                description={app.purpose || `Pengajuan talangan untuk ${app.member.name}`}
                actions={
                    <Button variant="ghost" onClick={() => router.push("/haji-umrah/talangan")}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                    </Button>
                }
            />

            {/* Status & Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Badge variant={statusConfig[app.status]?.variant || "secondary"}>
                        {statusConfig[app.status]?.label || app.status}
                    </Badge>
                    {loan && (
                        <Badge variant={loan.status === "active" ? "default" : loan.status === "paid_off" ? "secondary" : "outline"}>
                            Pinjaman: {loan.status === "active" ? "Aktif" : loan.status === "paid_off" ? "Lunas" : loan.status}
                        </Badge>
                    )}
                </div>
                <div className="flex gap-2">
                    {app.status === "submitted" && (
                        <Button onClick={handleApprove} disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Setujui
                        </Button>
                    )}
                    {app.status === "approved" && !loan && (
                        <Button onClick={handleDisburse} disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                            Cairkan
                        </Button>
                    )}
                    {loan?.status === "active" && (
                        <Button variant="outline" onClick={() => router.push(`/pinjaman/${loan.id}`)}>
                            Kelola Pinjaman
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            {loan && (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Pokok</p>
                            <p className="text-lg font-bold">{formatCurrency(loan.principalAmount)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Outstanding</p>
                            <p className="text-lg font-bold text-red-600">{formatCurrency(loan.principalOutstanding)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Terbayar</p>
                            <p className="text-lg font-bold text-green-600">{formatCurrency(loan.principalPaid + loan.interestPaid)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Angsuran/Bulan</p>
                            <p className="text-lg font-bold">{formatCurrency(loan.monthlyInstallment)}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Application + Savings Info */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base">Informasi Pengajuan</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Anggota</span><span className="font-medium">{app.member.name}</span></div>
                        {app.member.nrp && <div className="flex justify-between"><span className="text-muted-foreground">NRP</span><span>{app.member.nrp}</span></div>}
                        <div className="flex justify-between"><span className="text-muted-foreground">Produk</span><span>{app.product.name}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Jumlah</span><span className="font-semibold">{formatCurrency(app.amount)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Tenor</span><span>{app.tenorMonths} bulan</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Potongan</span><span>{app.deductionSource === "gaji" ? "Potong Gaji" : app.deductionSource === "tunkin" ? "Tunjangan Kinerja" : "Bayar Sendiri"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Bunga</span><span>{app.product.interestRate}%/bulan</span></div>
                        {app.notes && <div className="pt-2 border-t"><span className="text-muted-foreground">Catatan:</span><p className="mt-1">{app.notes}</p></div>}
                    </CardContent>
                </Card>

                {savings && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">Rekening Tabungan Terkait</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">No. Rekening</span><span className="font-mono">{savings.accountNo}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Jenis</span><Badge variant="outline">{savings.product.type === "tabungan_haji" ? "Haji" : "Umrah"}</Badge></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Saldo</span><span>{formatCurrency(savings.balance)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Target</span><span>{savings.targetAmount ? formatCurrency(savings.targetAmount) : "-"}</span></div>
                            {savings.progress !== null && (
                                <div className="pt-2">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">Progress</span>
                                        <span className="font-medium">{savings.progress}%</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-3">
                                        <div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${Math.min(100, savings.progress)}%` }} />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Schedule Table */}
            {data.schedules && data.schedules.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Jadwal Angsuran
                            {data.stats && (
                                <span className="text-sm font-normal text-muted-foreground">
                                    ({data.stats.paidInstallments}/{data.stats.totalInstallments} lunas)
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2 font-medium">Ke-</th>
                                        <th className="text-left p-2 font-medium">Jatuh Tempo</th>
                                        <th className="text-right p-2 font-medium">Pokok</th>
                                        <th className="text-right p-2 font-medium">Bunga</th>
                                        <th className="text-right p-2 font-medium">Total</th>
                                        <th className="text-center p-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.schedules.map((s) => (
                                        <tr key={s.id} className="border-b hover:bg-muted/50">
                                            <td className="p-2">{s.installmentNo}</td>
                                            <td className="p-2">{new Date(s.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                                            <td className="p-2 text-right">{formatCurrency(s.principalAmount)}</td>
                                            <td className="p-2 text-right">{formatCurrency(s.interestAmount)}</td>
                                            <td className="p-2 text-right font-medium">{formatCurrency(s.totalAmount)}</td>
                                            <td className="p-2 text-center">
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${scheduleStatusConfig[s.status]?.className || "bg-gray-100 text-gray-800"}`}>
                                                    {scheduleStatusConfig[s.status]?.label || s.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Payment History */}
            {data.payments && data.payments.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Riwayat Pembayaran</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.payments.map((p) => (
                                <div key={p.id} className="flex items-center justify-between border-b pb-3">
                                    <div>
                                        <p className="font-medium font-mono text-sm">{p.paymentNo}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(p.paymentDate).toLocaleDateString("id-ID")}
                                            {p.paymentMethod && ` • ${p.paymentMethod}`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{formatCurrency(p.amount)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Pokok: {formatCurrency(p.principalAmount)} + Bunga: {formatCurrency(p.interestAmount)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
