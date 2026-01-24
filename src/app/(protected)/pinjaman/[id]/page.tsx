"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    CreditCard,
    Calendar,
    Receipt,
    CheckCircle,
    Clock,
    AlertTriangle,
    User,
    Building,
} from "lucide-react";
import type { Loan, LoanSchedule } from "@/types";
import { formatCurrency, LOAN_STATUS, INSTALLMENT_STATUS } from "@/lib/constants";

// Mock data
const MOCK_LOAN: Loan = {
    id: 1,
    loan_no: "PJM-2024-00001",
    application_id: 1,
    member_id: 1,
    member: { member_no: "A-001", name: "Budi Santoso" },
    branch_id: 1,
    product_snapshot: {
        product_id: 1,
        code: "PJM-REG",
        name: "Pinjaman Reguler",
        interest_method: "flat",
        interest_rate: 1.5,
    },
    principal_amount: 10000000,
    interest_amount: 1800000,
    total_amount: 11800000,
    admin_fee: 100000,
    disbursed_amount: 9900000,
    tenor_months: 12,
    monthly_installment: 983333,
    principal_paid: 2500000,
    interest_paid: 450000,
    late_fee_paid: 0,
    principal_outstanding: 7500000,
    interest_outstanding: 1350000,
    disbursement_date: "2024-06-15",
    first_due_date: "2024-07-15",
    last_due_date: "2025-06-15",
    status: "active",
    created_at: "2024-06-15T10:00:00Z",
};

const MOCK_SCHEDULE: LoanSchedule[] = [
    { id: 1, loan_id: 1, installment_no: 1, due_date: "2024-07-15", principal_amount: 833333, interest_amount: 150000, total_amount: 983333, principal_paid: 833333, interest_paid: 150000, late_fee: 0, late_fee_paid: 0, status: "paid", paid_date: "2024-07-14" },
    { id: 2, loan_id: 1, installment_no: 2, due_date: "2024-08-15", principal_amount: 833333, interest_amount: 150000, total_amount: 983333, principal_paid: 833333, interest_paid: 150000, late_fee: 0, late_fee_paid: 0, status: "paid", paid_date: "2024-08-15" },
    { id: 3, loan_id: 1, installment_no: 3, due_date: "2024-09-15", principal_amount: 833334, interest_amount: 150000, total_amount: 983334, principal_paid: 833334, interest_paid: 150000, late_fee: 0, late_fee_paid: 0, status: "paid", paid_date: "2024-09-13" },
    { id: 4, loan_id: 1, installment_no: 4, due_date: "2024-10-15", principal_amount: 833333, interest_amount: 150000, total_amount: 983333, principal_paid: 0, interest_paid: 0, late_fee: 0, late_fee_paid: 0, status: "pending" },
    { id: 5, loan_id: 1, installment_no: 5, due_date: "2024-11-15", principal_amount: 833333, interest_amount: 150000, total_amount: 983333, principal_paid: 0, interest_paid: 0, late_fee: 0, late_fee_paid: 0, status: "pending" },
    { id: 6, loan_id: 1, installment_no: 6, due_date: "2024-12-15", principal_amount: 833334, interest_amount: 150000, total_amount: 983334, principal_paid: 0, interest_paid: 0, late_fee: 0, late_fee_paid: 0, status: "pending" },
    { id: 7, loan_id: 1, installment_no: 7, due_date: "2025-01-15", principal_amount: 833333, interest_amount: 150000, total_amount: 983333, principal_paid: 0, interest_paid: 0, late_fee: 0, late_fee_paid: 0, status: "overdue" },
    { id: 8, loan_id: 1, installment_no: 8, due_date: "2025-02-15", principal_amount: 833333, interest_amount: 150000, total_amount: 983333, principal_paid: 0, interest_paid: 0, late_fee: 0, late_fee_paid: 0, status: "pending" },
    { id: 9, loan_id: 1, installment_no: 9, due_date: "2025-03-15", principal_amount: 833334, interest_amount: 150000, total_amount: 983334, principal_paid: 0, interest_paid: 0, late_fee: 0, late_fee_paid: 0, status: "pending" },
    { id: 10, loan_id: 1, installment_no: 10, due_date: "2025-04-15", principal_amount: 833333, interest_amount: 150000, total_amount: 983333, principal_paid: 0, interest_paid: 0, late_fee: 0, late_fee_paid: 0, status: "pending" },
    { id: 11, loan_id: 1, installment_no: 11, due_date: "2025-05-15", principal_amount: 833333, interest_amount: 150000, total_amount: 983333, principal_paid: 0, interest_paid: 0, late_fee: 0, late_fee_paid: 0, status: "pending" },
    { id: 12, loan_id: 1, installment_no: 12, due_date: "2025-06-15", principal_amount: 833334, interest_amount: 150000, total_amount: 983334, principal_paid: 0, interest_paid: 0, late_fee: 0, late_fee_paid: 0, status: "pending" },
];

// Info item component
function InfoItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-medium">{value}</p>
        </div>
    );
}

// Status icon
function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case "paid":
            return <CheckCircle className="h-4 w-4 text-emerald-500" />;
        case "overdue":
            return <AlertTriangle className="h-4 w-4 text-red-500" />;
        case "partial":
            return <Clock className="h-4 w-4 text-amber-500" />;
        default:
            return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
}

export default function PinjamanDetailPage() {
    const params = useParams();
    const [isLoading, setIsLoading] = React.useState(true);
    const [loan, setLoan] = React.useState<Loan | null>(null);
    const [schedule, setSchedule] = React.useState<LoanSchedule[]>([]);

    // Simulate data loading
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setLoan(MOCK_LOAN);
            setSchedule(MOCK_SCHEDULE);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [params.id]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-4 sm:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!loan) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Pinjaman tidak ditemukan</p>
                <Button variant="link" asChild>
                    <Link href="/pinjaman">Kembali ke daftar pinjaman</Link>
                </Button>
            </div>
        );
    }

    const totalPaid = loan.principal_paid + loan.interest_paid;
    const progressPercent = Math.round((totalPaid / loan.total_amount) * 100);
    const paidInstallments = schedule.filter((s) => s.status === "paid").length;
    const overdueInstallments = schedule.filter((s) => s.status === "overdue").length;
    const statusConfig = LOAN_STATUS[loan.status];

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title={`Pinjaman ${loan.loan_no}`}
                description={`${loan.product_snapshot.name} - ${loan.member?.name}`}
                backHref="/pinjaman"
                actions={
                    loan.status === "active" && (
                        <Button asChild>
                            <Link href={`/pinjaman/angsuran/bayar?loan_id=${loan.id}`}>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Bayar Angsuran
                            </Link>
                        </Button>
                    )
                }
            />

            {/* Progress Card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="space-y-2 flex-1">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Progress Pelunasan</span>
                                <Badge variant={statusConfig.color === "success" ? "default" : "secondary"}>
                                    {statusConfig.label}
                                </Badge>
                            </div>
                            <Progress value={progressPercent} className="h-3" />
                            <div className="flex justify-between text-sm">
                                <span>{formatCurrency(totalPaid)} terbayar</span>
                                <span className="font-medium">{progressPercent}%</span>
                                <span>{formatCurrency(loan.total_amount)} total</span>
                            </div>
                        </div>
                        <Separator orientation="vertical" className="hidden md:block h-20" />
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold text-emerald-600">{paidInstallments}</p>
                                <p className="text-xs text-muted-foreground">Lunas</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{loan.tenor_months - paidInstallments - overdueInstallments}</p>
                                <p className="text-xs text-muted-foreground">Tersisa</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-red-600">{overdueInstallments}</p>
                                <p className="text-xs text-muted-foreground">Jatuh Tempo</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="detail" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="detail">Detail Pinjaman</TabsTrigger>
                    <TabsTrigger value="jadwal">Jadwal Angsuran</TabsTrigger>
                    <TabsTrigger value="pembayaran">Riwayat Pembayaran</TabsTrigger>
                </TabsList>

                {/* Detail Tab */}
                <TabsContent value="detail" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Loan Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Informasi Pinjaman
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <InfoItem label="No. Pinjaman" value={loan.loan_no} />
                                <InfoItem label="Produk" value={loan.product_snapshot.name} />
                                <InfoItem label="Pokok Pinjaman" value={formatCurrency(loan.principal_amount)} />
                                <InfoItem label="Total Bunga" value={formatCurrency(loan.interest_amount)} />
                                <InfoItem label="Total Pinjaman" value={<span className="text-lg font-bold">{formatCurrency(loan.total_amount)}</span>} />
                                <InfoItem label="Biaya Admin" value={formatCurrency(loan.admin_fee)} />
                                <InfoItem label="Dana Cair" value={formatCurrency(loan.disbursed_amount)} />
                                <InfoItem label="Tenor" value={`${loan.tenor_months} bulan`} />
                                <InfoItem label="Metode Bunga" value={loan.product_snapshot.interest_method.toUpperCase()} />
                                <InfoItem label="Suku Bunga" value={`${loan.product_snapshot.interest_rate}% / bulan`} />
                                <InfoItem label="Angsuran/Bulan" value={<span className="text-lg font-bold text-primary">{formatCurrency(loan.monthly_installment)}</span>} />
                            </CardContent>
                        </Card>

                        {/* Member & Date Info */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <User className="h-5 w-5" />
                                        Informasi Anggota
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                                            {loan.member?.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                        </div>
                                        <div>
                                            <Link href={`/anggota/${loan.member_id}`} className="font-medium text-primary hover:underline">
                                                {loan.member?.name}
                                            </Link>
                                            <p className="text-sm text-muted-foreground">{loan.member?.member_no}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Calendar className="h-5 w-5" />
                                        Tanggal Penting
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-4 sm:grid-cols-2">
                                    <InfoItem label="Tanggal Cair" value={new Date(loan.disbursement_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
                                    <InfoItem label="Jatuh Tempo Pertama" value={new Date(loan.first_due_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
                                    <InfoItem label="Jatuh Tempo Terakhir" value={new Date(loan.last_due_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
                                    {loan.paid_off_date && (
                                        <InfoItem label="Tanggal Lunas" value={new Date(loan.paid_off_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Receipt className="h-5 w-5" />
                                        Sisa Kewajiban
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Sisa Pokok</span>
                                        <span className="font-medium tabular-nums">{formatCurrency(loan.principal_outstanding)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Sisa Bunga</span>
                                        <span className="font-medium tabular-nums">{formatCurrency(loan.interest_outstanding)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span className="font-semibold">Total Sisa</span>
                                        <span className="text-lg font-bold text-primary tabular-nums">
                                            {formatCurrency(loan.principal_outstanding + loan.interest_outstanding)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="jadwal">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Jadwal Angsuran</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">#</TableHead>
                                            <TableHead>Jatuh Tempo</TableHead>
                                            <TableHead className="text-right">Pokok</TableHead>
                                            <TableHead className="text-right">Bunga</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-center">Status</TableHead>
                                            <TableHead>Tgl Bayar</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {schedule.map((item) => {
                                            const statusCfg = INSTALLMENT_STATUS[item.status];
                                            return (
                                                <TableRow key={item.id} className={item.status === "overdue" ? "bg-red-50 dark:bg-red-950/20" : ""}>
                                                    <TableCell className="font-medium">{item.installment_no}</TableCell>
                                                    <TableCell>
                                                        {new Date(item.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">{formatCurrency(item.principal_amount)}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{formatCurrency(item.interest_amount)}</TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.total_amount)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <StatusIcon status={item.status} />
                                                            <Badge variant={item.status === "paid" ? "default" : item.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                                                                {statusCfg.label}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.paid_date ? new Date(item.paid_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Payment History Tab */}
                <TabsContent value="pembayaran">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Riwayat Pembayaran</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-center text-muted-foreground py-8">
                                Fitur riwayat pembayaran akan segera hadir
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
