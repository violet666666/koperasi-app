"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Printer,
    Download,
    TrendingUp,
    TrendingDown,
    Banknote,
    QrCode,
    Users,
    BarChart2,
    PlusCircle,
    Loader2,
    Car,
    Scissors,
    Gamepad2,
    Dumbbell,
    Store,
    UtensilsCrossed,
    Shirt,
    AlertCircle,
    ShieldX,
    ImagePlus,
    X,
    FileImage,
    Send,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useAuth } from "@/lib/hooks";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ── Unit label map ──────────────────────────────────────────────────────────
const UNIT_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
    cuci_mobil: { label: "Cuci Mobil & Motor", icon: Car },
    barbershop: { label: "Barbershop", icon: Scissors },
    playstation: { label: "Play Station", icon: Gamepad2 },
    fitness: { label: "Fitness", icon: Dumbbell },
    laundry: { label: "Laundry", icon: Shirt },
    toko: { label: "Toko PRIMKOPPOL", icon: Store },
    coffe_latar: { label: "Coffe Latar", icon: UtensilsCrossed },
    resto: { label: "Resto & Cafe", icon: UtensilsCrossed },
};

const PERIODS = [
    { value: "today", label: "Hari Ini" },
    { value: "week", label: "Minggu Ini" },
    { value: "month", label: "Bulan Ini" },
    { value: "year", label: "Tahun Ini" },
    { value: "custom", label: "Kustom..." },
];

const METHOD_LABEL: Record<string, string> = {
    cash: "Tunai",
    qris: "QRIS",
    salary_cut: "Potong Gaji",
};

// ── Types ───────────────────────────────────────────────────────────────────
interface LaporanTransaction {
    id: string;
    date: string;
    no: string;
    description: string;
    memberName: string | null;
    memberNrp: string | null;
    paymentMethod: string;
    amount: number;
    status: string;
    type: string;
    vehiclePlate: string | null;
}

interface LaporanSummary {
    totalPendapatan: number;
    totalTransaksi: number;
    tunai: number;
    qris: number;
    potongGaji: number;
    totalPengeluaran: number;
    laba: number;
}

interface OperationalExpense {
    id: number;
    date: string;
    transactionNo: string;
    description: string;
    amount: number;
    receiptImagePath?: string | null;
}

interface LaporanData {
    unitType: string;
    unitSlug: string;
    periodLabel: string;
    dateFrom: string;
    dateTo: string;
    summary: LaporanSummary;
    transactions: LaporanTransaction[];
    operationalExpenses: OperationalExpense[];
}

// ── Page Component ──────────────────────────────────────────────────────────
export default function LaporanUnitPage({ params }: { params: Promise<{ unitSlug: string }> }) {
    const { user } = useAuth();
    const resolvedParams = React.use(params);
    const unitSlug = resolvedParams.unitSlug;
    const unitType = unitSlug.replace(/-/g, "_");

    const roleName = user?.role?.name ?? "";
    const userUnitType = (user as any)?.unitType as string | null | undefined;
    const isOperator = roleName === "operator" || user?.permissions?.includes("manage_all");
    const isAdmin = roleName === "admin" && userUnitType === unitType;
    const hasAccess = isOperator || isAdmin;
    const isWrongUnit = !isOperator && userUnitType && userUnitType !== unitType;

    const [period, setPeriod] = React.useState("month");
    const [dateFrom, setDateFrom] = React.useState("");
    const [dateTo, setDateTo] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [data, setData] = React.useState<LaporanData | null>(null);

    // Expense Dialog
    const [showExpenseDialog, setShowExpenseDialog] = React.useState(false);
    const [expenseAmount, setExpenseAmount] = React.useState("");
    const [expenseDesc, setExpenseDesc] = React.useState("");
    const [expenseDate, setExpenseDate] = React.useState(new Date().toISOString().split("T")[0]);
    const [isSavingExpense, setIsSavingExpense] = React.useState(false);
    const [expenseReceiptFile, setExpenseReceiptFile] = React.useState<File | null>(null);
    const [expenseReceiptPreview, setExpenseReceiptPreview] = React.useState<string | null>(null);
    const expenseFileInputRef = React.useRef<HTMLInputElement>(null);

    // Submit Laporan ke Operator
    const [isSubmittingLaporan, setIsSubmittingLaporan] = React.useState(false);

    const handleExpenseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Ukuran file maksimal 5MB");
            return;
        }
        setExpenseReceiptFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setExpenseReceiptPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const clearExpenseFile = () => {
        setExpenseReceiptFile(null);
        setExpenseReceiptPreview(null);
        if (expenseFileInputRef.current) expenseFileInputRef.current.value = "";
    };

    const unitInfo = UNIT_LABELS[unitType] || { label: formatUnitName(unitSlug), icon: Store };
    const UnitIcon = unitInfo.icon;

    const fetchLaporan = React.useCallback(async () => {
        if (!hasAccess || isWrongUnit) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ period });
            if (period === "custom" && dateFrom && dateTo) {
                params.set("dateFrom", dateFrom);
                params.set("dateTo", dateTo);
            }
            const res = await fetch(`/api/unit/${unitSlug}/laporan?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            setData(json.data);
        } catch (err: any) {
            toast.error(err.message || "Gagal memuat laporan");
        } finally {
            setIsLoading(false);
        }
    }, [hasAccess, isWrongUnit, unitSlug, period, dateFrom, dateTo]);

    React.useEffect(() => {
        fetchLaporan();
    }, [fetchLaporan]);

    const handlePrint = () => window.print();

    const handleExportExcel = async () => {
        if (!data) return;
        try {
            const ExcelJS = await import("xlsx");
            const exportData: any[][] = [
                ["PRIMKOPPOL RESOR LUMAJANG"],
                [`UNIT ${unitInfo.label.toUpperCase()}`],
                ["LAPORAN TRANSAKSI & PENDAPATAN"],
                [`Periode: ${data.periodLabel}`],
                [],
                ["No.", "Tanggal", "No. Transaksi", "Keterangan", "Anggota/Pelanggan", "Metode", "Nominal", "Status"],
            ];
            data.transactions.forEach((tx, i) => {
                exportData.push([
                    i + 1,
                    new Date(tx.date).toLocaleDateString("id-ID"),
                    tx.no,
                    tx.description + (tx.vehiclePlate ? ` [${tx.vehiclePlate}]` : ""),
                    tx.memberName || "-",
                    METHOD_LABEL[tx.paymentMethod] || tx.paymentMethod,
                    tx.amount,
                    tx.status === "completed" ? "Selesai" : tx.status,
                ]);
            });
            exportData.push([]);
            exportData.push(["", "", "", "TOTAL PENDAPATAN", "", "", data.summary.totalPendapatan, ""]);
            exportData.push(["", "", "", "TOTAL PENGELUARAN OPERASIONAL", "", "", data.summary.totalPengeluaran, ""]);
            exportData.push(["", "", "", "LABA BERSIH", "", "", data.summary.laba, ""]);

            const ws = ExcelJS.utils.aoa_to_sheet(exportData);
            const wb = ExcelJS.utils.book_new();
            ExcelJS.utils.book_append_sheet(wb, ws, "Laporan");
            ExcelJS.writeFile(wb, `Laporan_${unitInfo.label}_${data.periodLabel}.xlsx`);
        } catch {
            toast.error("Gagal export Excel");
        }
    };

    const handleSaveExpense = async () => {
        if (!expenseAmount || Number(expenseAmount) <= 0) {
            toast.error("Nominal harus lebih dari 0");
            return;
        }
        if (!expenseDesc.trim()) {
            toast.error("Keterangan wajib diisi");
            return;
        }
        setIsSavingExpense(true);
        try {
            // Gunakan FormData agar bisa kirim file sekaligus
            const formData = new FormData();
            formData.append("amount", String(Number(expenseAmount)));
            formData.append("description", expenseDesc.trim());
            formData.append("transactionDate", expenseDate);
            if (expenseReceiptFile) {
                formData.append("receipt", expenseReceiptFile);
            }

            const res = await fetch(`/api/unit/${unitSlug}/operational-expense`, {
                method: "POST",
                body: formData,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success(`Pengeluaran Rp${Number(expenseAmount).toLocaleString("id-ID")} berhasil dicatat`);
            setShowExpenseDialog(false);
            setExpenseAmount("");
            setExpenseDesc("");
            setExpenseDate(new Date().toISOString().split("T")[0]);
            clearExpenseFile();
            fetchLaporan(); // Refresh
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan pengeluaran");
        } finally {
            setIsSavingExpense(false);
        }
    };

    const handleSubmitLaporanReview = async () => {
        if (!data) return;
        setIsSubmittingLaporan(true);
        try {
            const res = await fetch(`/api/unit/${unitSlug}/laporan/submit-review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    period,
                    periodLabel: data.periodLabel,
                    dateFrom: data.dateFrom,
                    dateTo: data.dateTo,
                    summary: data.summary,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success(json.message || "Laporan berhasil dikirim ke Operator!");
        } catch (err: any) {
            toast.error(err.message || "Gagal mengirim laporan");
        } finally {
            setIsSubmittingLaporan(false);
        }
    };

    // Access denied
    if (isWrongUnit) {
        return (
            <div className="space-y-6">
                <PageHeader title="Laporan Unit" description="Laporan transaksi dan pendapatan unit" />
                <Alert className="border-destructive/50 bg-destructive/5 max-w-md mx-auto mt-12">
                    <ShieldX className="h-5 w-5 text-destructive" />
                    <AlertTitle className="text-destructive font-semibold">Akses Ditolak</AlertTitle>
                    <AlertDescription>
                        Anda terdaftar di unit <strong>{userUnitType}</strong>, bukan unit ini.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const transactions = data?.transactions || [];
    const expenses = data?.operationalExpenses || [];
    const summary = data?.summary;

    // ── Kalkulasi Bagi Hasil 50/50 (khusus cuci_mobil) ─────────────────────
    const isCuciMobil = unitType === "cuci_mobil";
    const bagiHasilKaryawan = isCuciMobil && summary ? Math.floor(summary.totalPendapatan * 0.5) : 0;
    const bagianKoperasiKotor = isCuciMobil && summary ? summary.totalPendapatan - bagiHasilKaryawan : 0;
    const bagianKoperasiBersih = isCuciMobil && summary
        ? bagianKoperasiKotor - summary.totalPengeluaran
        : 0;

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">

            {/* ── Screen Header (hidden on print) ─────────────────────────── */}
            <div className="print:hidden">
                <PageHeader
                    title={`Laporan — ${unitInfo.label}`}
                    description="Rekap transaksi dan pendapatan unit"
                    actions={
                        <div className="flex gap-2 flex-wrap">
                            {isAdmin && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-red-200 text-red-700 hover:bg-red-50"
                                    onClick={() => setShowExpenseDialog(true)}
                                >
                                    <TrendingDown className="mr-2 h-4 w-4" />
                                    Catat Pengeluaran
                                </Button>
                            )}
                            {(isAdmin || isOperator) && data && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                    onClick={handleSubmitLaporanReview}
                                    disabled={isSubmittingLaporan || isLoading}
                                    title="Kirim laporan ini ke Inbox Operator untuk direview"
                                >
                                    {isSubmittingLaporan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Kirim ke Operator
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!data || isLoading}>
                                <Download className="mr-2 h-4 w-4" />
                                Export Excel
                            </Button>
                            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!data || isLoading}>
                                <Printer className="mr-2 h-4 w-4" />
                                Cetak
                            </Button>
                        </div>
                    }
                />
            </div>

            {/* ── Print Header (only visible when printing) ────────────────── */}
            <div className="hidden print:flex flex-col items-center text-center mb-6 gap-2">
                <div className="bg-slate-900 p-3 rounded-full flex items-center justify-center" style={{ width: "80px", height: "80px" }}>
                    <img
                        src="/LogoPrimkoppol.png"
                        alt="Logo Primkoppol"
                        className="w-full h-full object-contain"
                    />
                </div>
                <div>
                    <p className="text-sm font-medium text-black">PRIMKOPPOL RESOR LUMAJANG</p>
                    <h1 className="text-base font-bold text-black uppercase">UNIT {unitInfo.label}</h1>
                    <h2 className="text-sm font-bold text-black">LAPORAN TRANSAKSI & PENDAPATAN</h2>
                    <p className="text-xs text-black mt-0.5">Periode: {data?.periodLabel || "-"}</p>
                </div>
            </div>

            {/* ── Period Filter (hidden on print) ──────────────────────────── */}
            <Card className="print:hidden">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div>
                            <Label className="text-xs mb-1 block">Filter Periode</Label>
                            <Select value={period} onValueChange={setPeriod}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PERIODS.map((p) => (
                                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {period === "custom" && (
                            <>
                                <div>
                                    <Label className="text-xs mb-1 block">Dari Tanggal</Label>
                                    <Input type="date" className="w-[150px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1 block">Sampai Tanggal</Label>
                                    <Input type="date" className="w-[150px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                </div>
                                <Button size="sm" onClick={fetchLaporan} disabled={!dateFrom || !dateTo || isLoading}>
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tampilkan"}
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Summary Cards (hidden on print) ──────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-900/30">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Pendapatan</p>
                            <p className="text-lg font-bold tabular-nums text-emerald-600">
                                {isLoading ? <Skeleton className="h-5 w-24" /> : summary ? formatCurrency(summary.totalPendapatan) : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-red-100 p-2.5 text-red-600 dark:bg-red-900/30">
                            <TrendingDown className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Pengeluaran Ops.</p>
                            <p className="text-lg font-bold tabular-nums text-red-600">
                                {isLoading ? <Skeleton className="h-5 w-24" /> : summary ? formatCurrency(summary.totalPengeluaran) : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600 dark:bg-blue-900/30">
                            <BarChart2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Laba Bersih Est.</p>
                            <p className={`text-lg font-bold tabular-nums ${summary && summary.laba >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {isLoading ? <Skeleton className="h-5 w-24" /> : summary ? formatCurrency(summary.laba) : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Jumlah Transaksi</p>
                            <p className="text-lg font-bold tabular-nums">
                                {isLoading ? <Skeleton className="h-5 w-16" /> : summary ? `${summary.totalTransaksi} nota` : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Print Summary (only on print) ────────────────────────────── */}
            {summary && (
                <div className="hidden print:grid grid-cols-4 gap-3 mb-4 text-sm">
                    <div className="border rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Total Pendapatan</p>
                        <p className="font-bold">{formatCurrency(summary.totalPendapatan)}</p>
                    </div>
                    <div className="border rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Tunai</p>
                        <p className="font-bold">{formatCurrency(summary.tunai)}</p>
                    </div>
                    <div className="border rounded p-2 text-center">
                        <p className="text-xs text-gray-500">QRIS</p>
                        <p className="font-bold">{formatCurrency(summary.qris)}</p>
                    </div>
                    <div className="border rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Potong Gaji</p>
                        <p className="font-bold">{formatCurrency(summary.potongGaji)}</p>
                    </div>
                </div>
            )}

            {/* ── Breakdown Metode Bayar (screen) ──────────────────────────── */}
            {summary && !isLoading && (
                <Card className="print:hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Rincian Metode Pembayaran</CardTitle>
                    </CardHeader>
                    <CardContent className="grid sm:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                            <Banknote className="h-8 w-8 text-emerald-500 shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">Tunai</p>
                                <p className="font-bold">{formatCurrency(summary.tunai)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                            <QrCode className="h-8 w-8 text-blue-500 shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">QRIS</p>
                                <p className="font-bold">{formatCurrency(summary.qris)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                            <Users className="h-8 w-8 text-indigo-500 shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">Potong Gaji (Piutang)</p>
                                <p className="font-bold">{formatCurrency(summary.potongGaji)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bagi Hasil 50/50 - khusus Cuci Mobil */}
            {isCuciMobil && summary && !isLoading && (
                <>
                    {/* Screen */}
                    <Card className="print:hidden border-amber-200 bg-amber-50/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
                                🤝 Rekap Bagi Hasil Karyawan (50% / 50%)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-3 rounded-lg bg-white border border-amber-200">
                                <p className="text-xs text-muted-foreground">Pendapatan Kotor</p>
                                <p className="font-bold text-lg text-amber-700">{formatCurrency(summary.totalPendapatan)}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Sebelum bagi hasil</p>
                            </div>
                            <div className="p-3 rounded-lg bg-white border border-orange-200">
                                <p className="text-xs text-muted-foreground">Bagi Hasil Karyawan</p>
                                <p className="font-bold text-lg text-orange-600">({formatCurrency(bagiHasilKaryawan)})</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">50% dari pendapatan kotor</p>
                            </div>
                            <div className="p-3 rounded-lg bg-white border border-blue-200">
                                <p className="text-xs text-muted-foreground">Bagian Koperasi (Kotor)</p>
                                <p className="font-bold text-lg text-blue-700">{formatCurrency(bagianKoperasiKotor)}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">50% dari pendapatan kotor</p>
                            </div>
                            <div className={`p-3 rounded-lg border-2 ${
                                bagianKoperasiBersih >= 0
                                    ? "bg-emerald-50 border-emerald-300"
                                    : "bg-red-50 border-red-300"
                            }`}>
                                <p className="text-xs text-muted-foreground">Laba Bersih Koperasi</p>
                                <p className={`font-bold text-lg ${
                                    bagianKoperasiBersih >= 0 ? "text-emerald-700" : "text-red-700"
                                }`}>{formatCurrency(bagianKoperasiBersih)}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Setelah pengeluaran ops.</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Print */}
                    <div className="hidden print:block border border-gray-400 rounded p-3 mb-4">
                        <p className="font-bold text-sm mb-2">REKAP BAGI HASIL KARYAWAN (50% / 50%)</p>
                        <table className="w-full text-sm">
                            <tbody>
                                <tr>
                                    <td className="py-0.5 text-gray-600">Pendapatan Kotor</td>
                                    <td className="text-right font-medium">{formatCurrency(summary.totalPendapatan)}</td>
                                </tr>
                                <tr>
                                    <td className="py-0.5 text-gray-600">Bagi Hasil Karyawan (50%)</td>
                                    <td className="text-right font-medium text-orange-700">({formatCurrency(bagiHasilKaryawan)})</td>
                                </tr>
                                <tr className="border-t">
                                    <td className="py-0.5 text-gray-600">Bagian Koperasi (50% kotor)</td>
                                    <td className="text-right font-medium">{formatCurrency(bagianKoperasiKotor)}</td>
                                </tr>
                                {summary.totalPengeluaran > 0 && (
                                    <tr>
                                        <td className="py-0.5 text-gray-600">Pengeluaran Operasional</td>
                                        <td className="text-right font-medium text-red-700">({formatCurrency(summary.totalPengeluaran)})</td>
                                    </tr>
                                )}
                                <tr style={{ borderTop: "2px solid black" }}>
                                    <td className="py-1 font-bold">LABA BERSIH KOPERASI</td>
                                    <td className={`text-right font-bold ${bagianKoperasiBersih >= 0 ? "" : "text-red-700"}`}>
                                        {formatCurrency(bagianKoperasiBersih)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Transaction Table */}
            <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:pb-1">
                    <CardTitle className="text-base">Daftar Transaksi</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[50px]">No.</TableHead>
                                        <TableHead className="w-[100px]">Tanggal</TableHead>
                                        <TableHead className="w-[140px]">No. Transaksi</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        <TableHead className="w-[130px]">Anggota / Pelanggan</TableHead>
                                        <TableHead className="w-[100px]">Metode</TableHead>
                                        <TableHead className="w-[130px] text-right">Nominal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                                Tidak ada transaksi pada periode ini
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((tx, idx) => (
                                            <TableRow key={tx.id} className={tx.status === "voided" ? "opacity-50 line-through" : ""}>
                                                <TableCell className="text-center text-muted-foreground text-xs">{idx + 1}</TableCell>
                                                <TableCell className="tabular-nums text-xs">
                                                    {new Date(tx.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs text-muted-foreground">{tx.no}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="text-sm font-medium truncate max-w-[220px]">{tx.description}</p>
                                                        {tx.vehiclePlate && (
                                                            <Badge variant="outline" className="mt-0.5 text-[10px] font-mono border-slate-400 bg-slate-50 text-slate-700">
                                                                🚗 {tx.vehiclePlate}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs">
                                                        <p className="font-medium">{tx.memberName || "Walk-In"}</p>
                                                        {tx.memberNrp && <p className="text-muted-foreground">{tx.memberNrp}</p>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] whitespace-nowrap ${
                                                            tx.paymentMethod === "cash" ? "border-emerald-300 text-emerald-700" :
                                                            tx.paymentMethod === "qris" ? "border-blue-300 text-blue-700" :
                                                            "border-indigo-300 text-indigo-700"
                                                        }`}
                                                    >
                                                        {METHOD_LABEL[tx.paymentMethod] || tx.paymentMethod}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold tabular-nums">
                                                    {formatCurrency(tx.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                                {/* Total Footer */}
                                {transactions.length > 0 && summary && (
                                    <TableFooter>
                                        <TableRow className="bg-muted/60 font-bold print:break-inside-avoid">
                                            <TableCell colSpan={6} className="text-right">TOTAL PENDAPATAN</TableCell>
                                            <TableCell className="text-right tabular-nums text-emerald-600">
                                                {formatCurrency(summary.totalPendapatan)}
                                            </TableCell>
                                        </TableRow>
                                        {summary.totalPengeluaran > 0 && (
                                            <>
                                                <TableRow className="bg-red-50/50 font-medium text-red-700 print:break-inside-avoid">
                                                    <TableCell colSpan={6} className="text-right">TOTAL PENGELUARAN OPERASIONAL</TableCell>
                                                    <TableCell className="text-right tabular-nums text-red-600">
                                                        ({formatCurrency(summary.totalPengeluaran)})
                                                    </TableCell>
                                                </TableRow>
                                                <TableRow className="bg-primary/5 font-bold print:break-inside-avoid">
                                                    <TableCell colSpan={6} className="text-right">LABA BERSIH ESTIMASI</TableCell>
                                                    <TableCell className={`text-right tabular-nums font-bold ${summary.laba >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                                        {formatCurrency(summary.laba)}
                                                    </TableCell>
                                                </TableRow>
                                            </>
                                        )}
                                    </TableFooter>
                                )}
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Operational Expenses Table ────────────────────────────────── */}
            {expenses.length > 0 && (
                <Card className="print:border-0 print:shadow-none">
                    <CardHeader className="print:pb-1">
                        <CardTitle className="text-base text-red-700">Rincian Pengeluaran Operasional</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-red-50/50">
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>No. Transaksi</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead className="text-center">Bukti</TableHead>
                                    <TableHead className="text-right">Nominal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.map((exp) => (
                                    <TableRow key={exp.id}>
                                        <TableCell className="text-xs tabular-nums">
                                            {new Date(exp.date).toLocaleDateString("id-ID")}
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs text-muted-foreground">{exp.transactionNo}</span>
                                        </TableCell>
                                        <TableCell className="text-sm">{exp.description}</TableCell>
                                        <TableCell className="text-center">
                                            {exp.receiptImagePath ? (
                                                <a
                                                    href={exp.receiptImagePath}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs underline"
                                                >
                                                    <FileImage className="h-3.5 w-3.5" />
                                                    Lihat
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums text-red-600">
                                            {formatCurrency(exp.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* ── Tanda Tangan Print (only visible when printing) ─────────── */}
            <div className="hidden print:flex justify-end mt-8">
                <div className="text-center text-sm text-black">
                    <p>Lumajang, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                    <p className="mt-1">Mengetahui, Admin Unit</p>
                    <div className="mt-14 border-t border-black pt-1 min-w-[200px]">
                        <p>( ______________________ )</p>
                    </div>
                </div>
            </div>

            {/* ── Dialog Catat Pengeluaran ──────────────────────────────────── */}
            <Dialog open={showExpenseDialog} onOpenChange={(open) => { setShowExpenseDialog(open); if (!open) clearExpenseFile(); }}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-red-500" />
                            Catat Pengeluaran Operasional
                        </DialogTitle>
                        <DialogDescription>
                            Catat pengeluaran unit seperti belanja sabun, peralatan, bahan baku, dll.
                            Akan langsung mendebit kas unit ini.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="exp-amount">Nominal Pengeluaran (Rp) *</Label>
                            <Input
                                id="exp-amount"
                                type="number"
                                placeholder="0"
                                className="text-right text-lg font-bold"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="exp-desc">Keterangan Pengeluaran *</Label>
                            <Textarea
                                id="exp-desc"
                                placeholder="Misal: Beli sabun cuci, kain lap, sikat ban, dll."
                                className="resize-none"
                                rows={3}
                                value={expenseDesc}
                                onChange={(e) => setExpenseDesc(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="exp-date">Tanggal Pengeluaran</Label>
                            <Input
                                id="exp-date"
                                type="date"
                                value={expenseDate}
                                onChange={(e) => setExpenseDate(e.target.value)}
                            />
                        </div>

                        {/* Upload Foto Bukti */}
                        <div className="space-y-2">
                            <Label>Foto Bukti / Struk (Opsional, maks. 5MB)</Label>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                className="hidden"
                                ref={expenseFileInputRef}
                                onChange={handleExpenseFileChange}
                            />
                            {expenseReceiptPreview ? (
                                <div className="relative rounded-lg border border-dashed border-red-200 overflow-hidden">
                                    <img
                                        src={expenseReceiptPreview}
                                        alt="Preview bukti"
                                        className="w-full h-36 object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={clearExpenseFile}
                                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                                        {expenseReceiptFile?.name}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => expenseFileInputRef.current?.click()}
                                    className="w-full h-24 border-2 border-dashed border-red-200 rounded-lg flex flex-col items-center justify-center gap-1 text-red-400 hover:border-red-400 hover:text-red-600 hover:bg-red-50/50 transition-colors"
                                >
                                    <ImagePlus className="h-6 w-6" />
                                    <span className="text-xs">Klik untuk unggah foto struk / nota</span>
                                </button>
                            )}
                        </div>

                        <Separator />
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                            ⚠️ Pengeluaran ini akan langsung mendebit akun Kas Unit <strong>{unitInfo.label}</strong> tanpa memerlukan persetujuan tambahan.
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowExpenseDialog(false); clearExpenseFile(); }}>Batal</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={handleSaveExpense}
                            disabled={isSavingExpense || !expenseAmount || !expenseDesc}
                        >
                            {isSavingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            Simpan Pengeluaran
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function formatUnitName(slug: string) {
    return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
