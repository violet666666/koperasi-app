"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    Ban,
    Loader2
} from "lucide-react";
import { formatCurrency, LOAN_STATUS, INSTALLMENT_STATUS } from "@/lib/constants";
import { loansApi } from "@/lib/api";

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
    const router = useRouter();
    const { data: session } = useSession();
    
    const [isLoading, setIsLoading] = React.useState(true);
    const [loan, setLoan] = React.useState<any>(null);
    const [schedule, setSchedule] = React.useState<any[]>([]);

    // Void State
    const [isVoidDialogOpen, setIsVoidDialogOpen] = React.useState(false);
    const [voidConfirmationText, setVoidConfirmationText] = React.useState("");
    const [isVoiding, setIsVoiding] = React.useState(false);

    // Operator Check
    const roleName = typeof session?.user?.role === "string" 
         ? session.user.role 
         : (session?.user?.role as any)?.name ?? "";
    const isOperator = roleName === "operator" || roleName === "superadmin";

    React.useEffect(() => {
        async function fetchLoanData() {
            if (!params.id) return;
            try {
                setIsLoading(true);
                const res = await loansApi.get(Number(params.id));
                const fetchedLoan = res.data as any;
                setLoan({
                     ...fetchedLoan,
                     productSnapshot: typeof fetchedLoan.productSnapshot === 'string' 
                          ? JSON.parse((fetchedLoan.productSnapshot as unknown) as string) 
                          : fetchedLoan.productSnapshot
                });
                setSchedule(fetchedLoan.schedules || []);
            } catch (error) {
                console.error("Failed to fetch loan details", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchLoanData();
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

    const principalPaid = Number(loan.principalPaid || 0);
    const interestPaid = Number(loan.interestPaid || 0);
    const totalPaid = principalPaid + interestPaid;
    const totalAmount = Number(loan.totalAmount || 0);
    
    // Prevent divide by zero
    const progressPercent = totalAmount > 0 
         ? Math.round((totalPaid / totalAmount) * 100) 
         : 0;
         
    const paidInstallments = schedule.filter((s) => s.status === "paid").length;
    const overdueInstallments = schedule.filter((s) => s.status === "overdue").length;
    const statusConfig = LOAN_STATUS[loan.status as keyof typeof LOAN_STATUS] || LOAN_STATUS.active;

    const executeVoid = async () => {
        if (voidConfirmationText !== "VOID") return;
        setIsVoiding(true);
        try {
             const res = await loansApi.voidPinjaman(loan.id);
             toast.success(res.data.message || "Pinjaman berhasil dibatalkan.");
             setIsVoidDialogOpen(false);
             // Pinjaman sudah di wipe, kembali ke daftar
             router.replace("/pinjaman"); 
        } catch (error: any) {
             console.error("Void Error", error);
             toast.error(error.response?.data?.message || "Gagal membatalkan pinjaman. Periksa server.");
        } finally {
             setIsVoiding(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title={`Pinjaman ${loan.loanNo || '-'}`}
                description={`${loan.productSnapshot?.name || 'Pinjaman'} - ${loan.member?.name || 'Anggota'}`}
                backHref="/pinjaman"
                actions={
                    <div className="flex gap-2">
                        {isOperator && loan.status === "active" && totalPaid === 0 && (
                            <Button variant="destructive" onClick={() => setIsVoidDialogOpen(true)}>
                                <Ban className="mr-2 h-4 w-4" />
                                Batalkan (VOID)
                            </Button>
                        )}
                        {loan.status === "active" && (
                            <Button asChild>
                                <Link href={`/pinjaman/angsuran/bayar?loan_id=${loan.id}`}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Bayar Angsuran
                                </Link>
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Void Confirmation Dialog */}
            <Dialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive font-bold flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Peringatan Bahaya (VOID)
                        </DialogTitle>
                        <DialogDescription className="space-y-3 pt-3 text-base">
                            Tindakan ini akan <strong>menghapus seketika</strong> jadwal tagihan Piutang pinjaman {loan.loanNo} secara permanen. <br/><br/>
                            Jurnal Akuntansi dan Saldo Kas Bank yang sebelumnya dikeluarkan untuk menyalurkan pencairan ini akan <strong>DIKEMBALIKAN (+ Tambah)</strong> secara otomatis seolah Pinjaman tidak pernah diajukan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <label className="text-sm font-medium">Ketik kata <strong>VOID</strong> di bawah ini untuk konfirmasi:</label>
                        <Input 
                             value={voidConfirmationText} 
                             onChange={(e) => setVoidConfirmationText(e.target.value)}
                             placeholder="VOID"
                             className="uppercase"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsVoidDialogOpen(false); setVoidConfirmationText(""); }}>
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={executeVoid} disabled={voidConfirmationText !== "VOID" || isVoiding}>
                            {isVoiding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Eksekusi Void
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            <Progress value={progressPercent > 100 ? 100 : progressPercent} className="h-3" />
                            <div className="flex justify-between text-sm">
                                <span>{formatCurrency(totalPaid)} terbayar</span>
                                <span className="font-medium">{progressPercent}%</span>
                                <span>{formatCurrency(totalAmount)} total</span>
                            </div>
                        </div>
                        <Separator orientation="vertical" className="hidden md:block h-20" />
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold text-emerald-600">{paidInstallments}</p>
                                <p className="text-xs text-muted-foreground">Lunas</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{Math.max(0, (loan.tenorMonths || 0) - paidInstallments - overdueInstallments)}</p>
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
                                <InfoItem label="No. Pinjaman" value={loan.loanNo} />
                                <InfoItem label="Produk" value={loan.productSnapshot?.name || '-'} />
                                <InfoItem label="Pokok Pinjaman" value={formatCurrency(Number(loan.principalAmount))} />
                                <InfoItem label="Total Bunga" value={formatCurrency(Number(loan.interestAmount))} />
                                <InfoItem label="Total Pinjaman" value={<span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>} />
                                <InfoItem label="Biaya Admin" value={formatCurrency(Number(loan.adminFee || 0))} />
                                <InfoItem label="Dana Cair" value={formatCurrency(Number(loan.disbursedAmount || 0))} />
                                <InfoItem label="Tenor" value={`${loan.tenorMonths} bulan`} />
                                <InfoItem label="Metode Bunga" value={(loan.interestMethod || loan.productSnapshot?.interestMethod || 'flat').toUpperCase()} />
                                <InfoItem label="Suku Bunga" value={`${loan.interestRate ?? loan.productSnapshot?.interestRate ?? 0}% / bulan`} />
                                <InfoItem label="Angsuran/Bulan" value={<span className="text-lg font-bold text-primary">{formatCurrency(Number(loan.monthlyInstallment || 0))}</span>} />
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
                                            {loan.member?.name ? loan.member.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() : "-"}
                                        </div>
                                        <div>
                                            <Link href={`/anggota/${loan.memberId}`} className="font-medium text-primary hover:underline">
                                                {loan.member?.name || 'Tidak diketahui'}
                                            </Link>
                                            <p className="text-sm text-muted-foreground">{loan.member?.memberNo || '-'}</p>
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
                                    <InfoItem label="Tanggal Cair" value={loan.disbursementDate ? new Date(loan.disbursementDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"} />
                                    <InfoItem label="Jatuh Tempo Pertama" value={loan.firstDueDate ? new Date(loan.firstDueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"} />
                                    <InfoItem label="Jatuh Tempo Terakhir" value={loan.lastDueDate ? new Date(loan.lastDueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"} />
                                    {loan.paidOffDate && (
                                        <InfoItem label="Tanggal Lunas" value={new Date(loan.paidOffDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
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
                                        <span className="font-medium tabular-nums">{formatCurrency(Number(loan.principalOutstanding || 0))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Sisa Bunga</span>
                                        <span className="font-medium tabular-nums">{formatCurrency(Number(loan.interestOutstanding || 0))}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span className="font-semibold">Total Sisa</span>
                                        <span className="text-lg font-bold text-primary tabular-nums">
                                            {formatCurrency(Number(loan.principalOutstanding || 0) + Number(loan.interestOutstanding || 0))}
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
                                        {schedule.length > 0 ? schedule.map((item: any) => {
                                            const statusCfg = INSTALLMENT_STATUS[item.status as keyof typeof INSTALLMENT_STATUS] || INSTALLMENT_STATUS.pending;
                                            return (
                                                <TableRow key={item.id} className={item.status === "overdue" ? "bg-red-50 dark:bg-red-950/20" : ""}>
                                                    <TableCell className="font-medium">{item.installmentNo}</TableCell>
                                                    <TableCell>
                                                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.principalAmount || 0))}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.interestAmount || 0))}</TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(Number(item.totalAmount || 0))}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <StatusIcon status={item.status} />
                                                            <Badge variant={item.status === "paid" ? "default" : item.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                                                                {statusCfg.label}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.paidDate ? new Date(item.paidDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                                    Belum ada jadwal angsuran
                                                </TableCell>
                                            </TableRow>
                                        )}
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
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No. Bukti</TableHead>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead className="text-right">Pokok</TableHead>
                                            <TableHead className="text-right">Bunga</TableHead>
                                            <TableHead className="text-right">Total Dibayar</TableHead>
                                            <TableHead>Metode</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loan.payments && loan.payments.length > 0 ? (
                                            loan.payments.map((payment: any) => (
                                                 <TableRow key={payment.id}>
                                                     <TableCell className="font-medium text-xs font-mono">{payment.paymentNo || '-'}</TableCell>
                                                     <TableCell>
                                                         {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                                                     </TableCell>
                                                     <TableCell className="text-right tabular-nums">{formatCurrency(Number(payment.principalAmount || 0))}</TableCell>
                                                     <TableCell className="text-right tabular-nums">{formatCurrency(Number(payment.interestAmount || 0))}</TableCell>
                                                     <TableCell className="text-right font-medium tabular-nums">{formatCurrency(Number(payment.totalAmount || 0))}</TableCell>
                                                     <TableCell>
                                                         <Badge variant="outline" className="text-xs uppercase">
                                                             {payment.paymentMethod || 'TUNAI'}
                                                         </Badge>
                                                     </TableCell>
                                                 </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                    Belum ada histori pembayaran
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
