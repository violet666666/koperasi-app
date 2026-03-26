"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
    AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Calendar, Lock, CheckCircle2, AlertTriangle, FileText, Calculator, Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface PeriodStatus {
    year: number; month: number; status: "open" | "closed";
    journalCount: number; totalDebit: number; totalCredit: number;
    isBalanced: boolean; closedAt?: string;
}

export default function TutupBukuPage() {
    const router = useRouter();
    const now = new Date();
    const [selectedYear, setSelectedYear] = React.useState<string>(String(now.getFullYear()));
    const [selectedMonth, setSelectedMonth] = React.useState<string>(String(now.getMonth() + 1).padStart(2, "0"));
    const [periodData, setPeriodData] = React.useState<PeriodStatus | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);

    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Fetch journals for this period to compute stats
                const res = await fetch(`/api/journals?period=all`);
                if (!res.ok) throw new Error("Failed");
                const json = await res.json();
                const journals = json.data || [];

                const month = parseInt(selectedMonth);
                const year = parseInt(selectedYear);

                const periodJournals = journals.filter((j: any) => {
                    const d = new Date(j.transactionDate);
                    return d.getMonth() + 1 === month && d.getFullYear() === year;
                });

                const totalDebit = periodJournals.reduce((s: number, j: any) => s + j.totalDebit, 0);
                const totalCredit = periodJournals.reduce((s: number, j: any) => s + j.totalCredit, 0);

                setPeriodData({
                    year, month,
                    status: "open",
                    journalCount: periodJournals.length,
                    totalDebit, totalCredit,
                    isBalanced: Math.abs(totalDebit - totalCredit) < 1,
                });
            } catch (error) {
                console.error("Failed to fetch:", error);
                setPeriodData({
                    year: parseInt(selectedYear), month: parseInt(selectedMonth),
                    status: "open", journalCount: 0, totalDebit: 0, totalCredit: 0, isBalanced: true,
                });
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedYear, selectedMonth]);

    const handleClosePeriod = async () => {
        if (!periodData?.isBalanced) {
            toast.error("Jurnal tidak seimbang, tidak dapat menutup periode");
            return;
        }
        setIsProcessing(true);
        try {
            // In real implementation, this would call an API to close the fiscal period
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success(`Periode ${selectedMonth}/${selectedYear} berhasil ditutup`);
            setPeriodData(prev => prev ? { ...prev, status: "closed", closedAt: new Date().toISOString() } : null);
        } catch {
            toast.error("Gagal menutup periode");
        } finally {
            setIsProcessing(false);
        }
    };

    const monthName = new Date(2000, Number(selectedMonth) - 1).toLocaleDateString("id-ID", { month: "long" });
    const currentYear = new Date().getFullYear();

    return (
        <div className="space-y-6">
            <PageHeader title="Tutup Buku" description="Penutupan periode akuntansi" />

            <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" />Pilih Periode</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 items-center">
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {["01","02","03","04","05","06","07","08","09","10","11","12"].map(m => (
                                    <SelectItem key={m} value={m}>{new Date(2000, parseInt(m) - 1).toLocaleDateString("id-ID", { month: "long" })}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
            ) : periodData ? (
                <div className="space-y-6">
                    <Card className={periodData.status === "closed" ? "border-emerald-200 dark:border-emerald-800" : ""}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div><CardTitle className="text-xl">Periode {monthName} {selectedYear}</CardTitle><CardDescription>Status periode akuntansi</CardDescription></div>
                                {periodData.status === "closed" ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30"><Lock className="mr-1 h-3 w-3" />Ditutup</Badge>
                                ) : (
                                    <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />Terbuka</Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1"><p className="text-sm text-muted-foreground">Jumlah Jurnal</p><p className="text-2xl font-bold">{periodData.journalCount}</p></div>
                                <div className="space-y-1"><p className="text-sm text-muted-foreground">Total Debit</p><p className="text-xl font-bold tabular-nums text-emerald-600">{formatCurrency(periodData.totalDebit)}</p></div>
                                <div className="space-y-1"><p className="text-sm text-muted-foreground">Total Kredit</p><p className="text-xl font-bold tabular-nums text-red-600">{formatCurrency(periodData.totalCredit)}</p></div>
                                <div className="space-y-1"><p className="text-sm text-muted-foreground">Status Balance</p>
                                    {periodData.isBalanced ? (
                                        <p className="text-xl font-bold text-emerald-600 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Seimbang</p>
                                    ) : (
                                        <p className="text-xl font-bold text-red-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Tidak Seimbang</p>
                                    )}
                                </div>
                            </div>
                            {periodData.closedAt && (
                                <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                                    Ditutup pada {new Date(periodData.closedAt).toLocaleString("id-ID")}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {periodData.status === "open" && (
                        <>
                            <Card>
                                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Checklist Tutup Buku</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            {periodData.journalCount > 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                                            <span>Transaksi sudah di-posting ({periodData.journalCount} jurnal)</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {periodData.isBalanced ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
                                            <span>Neraca saldo seimbang (Debit = Kredit)</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex flex-wrap gap-4">
                                <Button variant="outline" onClick={() => router.push("/jurnal/buku-besar")}><FileText className="mr-2 h-4 w-4" />Lihat Jurnal</Button>
                                <Button variant="outline" onClick={() => router.push("/jurnal/penyesuaian")}><Calculator className="mr-2 h-4 w-4" />Jurnal Penyesuaian</Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button disabled={!periodData.isBalanced}><Lock className="mr-2 h-4 w-4" />Tutup Periode</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Konfirmasi Tutup Buku</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Anda akan menutup periode <strong>{monthName} {selectedYear}</strong>.
                                                Setelah ditutup, transaksi pada periode ini tidak dapat diubah lagi.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleClosePeriod} disabled={isProcessing}>
                                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Ya, Tutup Periode
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </>
                    )}
                </div>
            ) : null}
        </div>
    );
}
