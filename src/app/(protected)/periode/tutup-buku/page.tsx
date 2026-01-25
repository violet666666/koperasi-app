"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Calendar,
    Lock,
    CheckCircle2,
    AlertTriangle,
    FileText,
    Calculator,
    Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface PeriodStatus {
    year: number;
    month: number;
    status: "open" | "closed" | "pending";
    journalCount: number;
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
    closedAt?: string;
    closedBy?: { id: number; name: string };
}

export default function TutupBukuPage() {
    const router = useRouter();
    const [selectedYear, setSelectedYear] = React.useState<string>("2026");
    const [selectedMonth, setSelectedMonth] = React.useState<string>("01");
    const [periodData, setPeriodData] = React.useState<PeriodStatus | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);

    // Fetch period data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                setPeriodData({
                    year: Number(selectedYear),
                    month: Number(selectedMonth),
                    status: Number(selectedMonth) < 1 ? "closed" : "open",
                    journalCount: 127,
                    totalDebit: 285500000,
                    totalCredit: 285500000,
                    isBalanced: true,
                    closedAt: Number(selectedMonth) < 1 ? "2026-01-31T23:59:59" : undefined,
                    closedBy: Number(selectedMonth) < 1 ? { id: 1, name: "Admin" } : undefined,
                });
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedYear, selectedMonth]);

    // Handle closing the period
    const handleClosePeriod = async () => {
        if (!periodData?.isBalanced) {
            toast.error("Jurnal tidak seimbang, tidak dapat menutup periode");
            return;
        }

        setIsProcessing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            toast.success(`Periode ${selectedMonth}/${selectedYear} berhasil ditutup`);
            setPeriodData(prev => prev ? { ...prev, status: "closed", closedAt: new Date().toISOString() } : null);
        } catch (error) {
            toast.error("Gagal menutup periode");
        } finally {
            setIsProcessing(false);
        }
    };

    const monthName = new Date(2000, Number(selectedMonth) - 1).toLocaleDateString("id-ID", { month: "long" });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tutup Buku"
                description="Penutupan periode akuntansi"
            />

            {/* Period Selector */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Pilih Periode
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 items-center">
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {new Date(2000, parseInt(m) - 1).toLocaleDateString("id-ID", { month: "long" })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Period Status */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            ) : periodData ? (
                <div className="space-y-6">
                    {/* Status Card */}
                    <Card className={periodData.status === "closed" ? "border-emerald-200 dark:border-emerald-800" : ""}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl">
                                        Periode {monthName} {selectedYear}
                                    </CardTitle>
                                    <CardDescription>
                                        Status periode akuntansi
                                    </CardDescription>
                                </div>
                                {periodData.status === "closed" ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">
                                        <Lock className="mr-1 h-3 w-3" />
                                        Ditutup
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        Terbuka
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Jumlah Jurnal</p>
                                    <p className="text-2xl font-bold">{periodData.journalCount}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Total Debit</p>
                                    <p className="text-xl font-bold tabular-nums text-emerald-600">
                                        {formatCurrency(periodData.totalDebit)}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Total Kredit</p>
                                    <p className="text-xl font-bold tabular-nums text-red-600">
                                        {formatCurrency(periodData.totalCredit)}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Status Balance</p>
                                    {periodData.isBalanced ? (
                                        <p className="text-xl font-bold text-emerald-600 flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5" />
                                            Seimbang
                                        </p>
                                    ) : (
                                        <p className="text-xl font-bold text-red-600 flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5" />
                                            Tidak Seimbang
                                        </p>
                                    )}
                                </div>
                            </div>

                            {periodData.status === "closed" && periodData.closedAt && (
                                <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                                    Ditutup pada {new Date(periodData.closedAt).toLocaleString("id-ID")}
                                    {periodData.closedBy && ` oleh ${periodData.closedBy.name}`}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Checklist */}
                    {periodData.status === "open" && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Checklist Tutup Buku
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        <span>Semua transaksi sudah di-posting</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {periodData.isBalanced ? (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        ) : (
                                            <AlertTriangle className="h-5 w-5 text-red-500" />
                                        )}
                                        <span>Neraca saldo seimbang (Debit = Kredit)</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        <span>Penyusutan aset sudah dihitung</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        <span>Jurnal penyesuaian sudah dibuat</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    {periodData.status === "open" && (
                        <div className="flex flex-wrap gap-4">
                            <Button variant="outline" onClick={() => router.push("/jurnal/buku-besar")}>
                                <FileText className="mr-2 h-4 w-4" />
                                Lihat Jurnal
                            </Button>
                            <Button variant="outline" onClick={() => router.push("/jurnal/penyesuaian")}>
                                <Calculator className="mr-2 h-4 w-4" />
                                Jurnal Penyesuaian
                            </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button disabled={!periodData.isBalanced}>
                                        <Lock className="mr-2 h-4 w-4" />
                                        Tutup Periode
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Konfirmasi Tutup Buku</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Anda akan menutup periode <strong>{monthName} {selectedYear}</strong>.
                                            Setelah ditutup, transaksi pada periode ini tidak dapat diubah lagi.
                                            Pastikan semua data sudah benar sebelum melanjutkan.
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
                    )}
                </div>
            ) : null}
        </div>
    );
}
