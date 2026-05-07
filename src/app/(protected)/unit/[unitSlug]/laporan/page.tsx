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
import { Checkbox } from "@/components/ui/checkbox";
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
    Award,
    CreditCard,
    Eye,
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
    totalPemasukan: number;
    potonganSHUMember: number;
    jumlahCuciAnggota: number;
    shuPerCuci: number;
    laba: number;
    totalHPP: number;
    totalWriteOff: number;
    netProfit: number;
}

interface PaginationInfo {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
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
    pagination: PaginationInfo;
    operationalExpenses: OperationalExpense[];
    operationalIncomes: OperationalExpense[]; // Same shape as expense
}

// ── Page Component ──────────────────────────────────────────────────────────
export default function LaporanUnitPage({ params }: { params: Promise<{ unitSlug: string }> }) {
    const { user } = useAuth();
    const resolvedParams = React.use(params);
    const unitSlug = resolvedParams.unitSlug;
    const unitType = unitSlug.replace(/-/g, "_");

    // Fix: In NextAuth, role is stored directly as a string, not an object.
    const roleName = typeof user?.role === "string" ? user.role : (user?.role as any)?.name ?? "";
    const userUnitType = (user as any)?.unitType as string | null | undefined;
    const isOperator = roleName === "operator" || user?.permissions?.includes("manage_all");
    const isAdmin = roleName === "admin" && userUnitType === unitType;
    const hasAccess = isOperator || isAdmin;
    const isWrongUnit = !isOperator && userUnitType && userUnitType !== unitType;

    const [period, setPeriod] = React.useState("month");
    const [dateFrom, setDateFrom] = React.useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}-01`;
    });
    const [dateTo, setDateTo] = React.useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const lastDay = new Date(y, m, 0).getDate();
        return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    });
    const [selectedMonth, setSelectedMonth] = React.useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [isLoading, setIsLoading] = React.useState(false);
    const [data, setData] = React.useState<LaporanData | null>(null);
    const [page, setPage] = React.useState(1);
    const perPage = 50;
    const [isExporting, setIsExporting] = React.useState(false);

    // Expense Dialog
    const [editExpenseId, setEditExpenseId] = React.useState<number | null>(null);
    const [showExpenseDialog, setShowExpenseDialog] = React.useState(false);
    const [expenseAmount, setExpenseAmount] = React.useState("");
    const [expenseDesc, setExpenseDesc] = React.useState("");
    const [expenseDate, setExpenseDate] = React.useState(new Date().toISOString().split("T")[0]);
    const [isSavingExpense, setIsSavingExpense] = React.useState(false);
    const [expenseReceiptFile, setExpenseReceiptFile] = React.useState<File | null>(null);
    const [expenseReceiptPreview, setExpenseReceiptPreview] = React.useState<string | null>(null);
    const [keepExistingReceipt, setKeepExistingReceipt] = React.useState(true);
    const expenseFileInputRef = React.useRef<HTMLInputElement>(null);

    // Submit Laporan ke Operator
    const [isSubmittingLaporan, setIsSubmittingLaporan] = React.useState(false);

    // Delete confirmation dialog with reason
    const [deleteTarget, setDeleteTarget] = React.useState<{ id: number; type: "expense" | "income" } | null>(null);
    const [deleteReason, setDeleteReason] = React.useState("");
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Checkbox method filters
    const [methodFilters, setMethodFilters] = React.useState<Set<string>>(new Set(["cash", "qris", "salary_cut"]));

    // Transaction detail modal
    const [selectedTx, setSelectedTx] = React.useState<LaporanTransaction | null>(null);

    const toggleMethod = (method: string, checked: boolean | "indeterminate") => {
        setMethodFilters(prev => {
            const next = new Set(prev);
            if (checked) next.add(method);
            else next.delete(method);
            return next;
        });
    };

    // Income Dialog (Catat Pemasukan)
    const [showIncomeDialog, setShowIncomeDialog] = React.useState(false);
    const [incomeAmount, setIncomeAmount] = React.useState("");
    const [incomeDesc, setIncomeDesc] = React.useState("");
    const [incomeDate, setIncomeDate] = React.useState(new Date().toISOString().split("T")[0]);
    const [isSavingIncome, setIsSavingIncome] = React.useState(false);
    const [incomeReceiptFile, setIncomeReceiptFile] = React.useState<File | null>(null);
    const [incomeReceiptPreview, setIncomeReceiptPreview] = React.useState<string | null>(null);
    const incomeFileInputRef = React.useRef<HTMLInputElement>(null);

    const handleExpenseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Ukuran file maksimal 2MB. Silakan kompres gambar terlebih dahulu.");
            return;
        }
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Format file harus JPG, PNG, atau WebP.");
            return;
        }
        setExpenseReceiptFile(file);
        setKeepExistingReceipt(false);
        const reader = new FileReader();
        reader.onload = (ev) => setExpenseReceiptPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const clearExpenseFile = () => {
        setExpenseReceiptFile(null);
        setExpenseReceiptPreview(null);
        setKeepExistingReceipt(false);
        if (expenseFileInputRef.current) expenseFileInputRef.current.value = "";
    };

    const handleOpenAddExpense = () => {
        setEditExpenseId(null);
        setExpenseAmount("");
        setExpenseDesc("");
        setExpenseDate(new Date().toISOString().split("T")[0]);
        clearExpenseFile();
        setShowExpenseDialog(true);
    };

    const handleOpenEditExpense = (exp: OperationalExpense) => {
        setEditExpenseId(exp.id);
        setExpenseAmount(exp.amount.toString());
        setExpenseDesc(exp.description);
        setExpenseDate(new Date(exp.date).toISOString().split("T")[0]);
        setExpenseReceiptFile(null);
        setExpenseReceiptPreview(exp.receiptImagePath || null);
        setKeepExistingReceipt(true);
        setShowExpenseDialog(true);
    };

    const handleDeleteExpense = (id: number) => {
        setDeleteTarget({ id, type: "expense" });
        setDeleteReason("");
    };

    const handleDeleteIncome = (id: number) => {
        setDeleteTarget({ id, type: "income" });
        setDeleteReason("");
    };

    const confirmDelete = async () => {
        if (!deleteTarget || !deleteReason.trim()) {
            toast.error("Alasan penghapusan wajib diisi");
            return;
        }
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/unit/${unitSlug}/operational-expense/${deleteTarget.id}?reason=${encodeURIComponent(deleteReason.trim())}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success(deleteTarget.type === "income" ? "Pemasukan berhasil dihapus" : "Pengeluaran berhasil dihapus");
            setDeleteTarget(null);
            fetchLaporan(page);
        } catch (err: any) {
            toast.error(err.message || "Gagal menghapus");
        } finally {
            setIsDeleting(false);
        }
    };

    // Income handlers
    const handleIncomeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast.error("Ukuran file maksimal 2MB."); return; }
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) { toast.error("Format file harus JPG, PNG, atau WebP."); return; }
        setIncomeReceiptFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setIncomeReceiptPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const clearIncomeFile = () => {
        setIncomeReceiptFile(null);
        setIncomeReceiptPreview(null);
        if (incomeFileInputRef.current) incomeFileInputRef.current.value = "";
    };

    const handleOpenAddIncome = () => {
        setIncomeAmount("");
        setIncomeDesc("");
        setIncomeDate(new Date().toISOString().split("T")[0]);
        clearIncomeFile();
        setShowIncomeDialog(true);
    };

    const handleSaveIncome = async () => {
        if (!incomeAmount || Number(incomeAmount) <= 0) { toast.error("Nominal harus lebih dari 0"); return; }
        if (!incomeDesc.trim()) { toast.error("Keterangan wajib diisi"); return; }
        setIsSavingIncome(true);
        try {
            const formData = new FormData();
            formData.append("amount", String(Number(incomeAmount)));
            formData.append("description", incomeDesc.trim());
            formData.append("transactionDate", incomeDate);
            if (incomeReceiptFile) formData.append("receipt", incomeReceiptFile);

            const res = await fetch(`/api/unit/${unitSlug}/operational-income`, {
                method: "POST",
                body: formData,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success(`Pemasukan Rp${Number(incomeAmount).toLocaleString("id-ID")} berhasil dicatat`);
            setShowIncomeDialog(false);
            clearIncomeFile();
            fetchLaporan(page);
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan pemasukan");
        } finally {
            setIsSavingIncome(false);
        }
    };

    const unitInfo = UNIT_LABELS[unitType] || { label: formatUnitName(unitSlug), icon: Store };
    const UnitIcon = unitInfo.icon;

    const fetchLaporan = React.useCallback(async (targetPage: number = page) => {
        if (!hasAccess || isWrongUnit) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                period,
                page: String(targetPage),
                perPage: String(perPage),
                _t: Date.now().toString(),
            });
            if (period === "custom" && dateFrom && dateTo) {
                params.set("dateFrom", dateFrom);
                params.set("dateTo", dateTo);
            }
            const res = await fetch(`/api/unit/${unitSlug}/laporan?${params.toString()}`, {
                cache: "no-store",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            setData(json.data);
        } catch (err: any) {
            toast.error(err.message || "Gagal memuat laporan");
        } finally {
            setIsLoading(false);
        }
    }, [hasAccess, isWrongUnit, unitSlug, period, dateFrom, dateTo, page]);

    // Helper: fetch ALL data for export/print (no pagination)
    const fetchAllData = React.useCallback(async (): Promise<LaporanData | null> => {
        try {
            const params = new URLSearchParams({
                period,
                perPage: String(perPage),
                export: "true",
                _t: Date.now().toString(),
            });
            if (period === "custom" && dateFrom && dateTo) {
                params.set("dateFrom", dateFrom);
                params.set("dateTo", dateTo);
            }
            const res = await fetch(`/api/unit/${unitSlug}/laporan?${params.toString()}`, {
                cache: "no-store",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            return json.data;
        } catch (err: any) {
            toast.error(err.message || "Gagal memuat data");
            return null;
        }
    }, [unitSlug, period, dateFrom, dateTo]);

    React.useEffect(() => {
        fetchLaporan(1);
    }, [period, dateFrom, dateTo, hasAccess]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset page to 1 when period or date range changes
    React.useEffect(() => {
        setPage(1);
    }, [period, dateFrom, dateTo]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        fetchLaporan(newPage);
    };

    const handlePeriodChange = (newPeriod: string) => {
        if (newPeriod === "month") {
            // Convert selectedMonth (YYYY-MM) to custom date range
            const [year, month] = selectedMonth.split("-").map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            const from = `${selectedMonth}-01`;
            const to = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
            setDateFrom(from);
            setDateTo(to);
            setPeriod("custom");
        } else {
            setPeriod(newPeriod);
        }
        setPage(1);
    };

    const handleMonthChange = (monthValue: string) => {
        setSelectedMonth(monthValue);
        const [year, month] = monthValue.split("-").map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        setDateFrom(`${monthValue}-01`);
        setDateTo(`${monthValue}-${String(lastDay).padStart(2, "0")}`);
        setPeriod("custom");
        setPage(1);
    };

    const handlePrint = async () => {
        setIsExporting(true);
        try {
            const allData = await fetchAllData();
            if (!allData) return;
            // Temporarily set all data for print, then restore
            const currentData = data;
            setData(allData);
            // Small delay to ensure DOM updates before printing
            await new Promise(resolve => setTimeout(resolve, 100));
            window.print();
            // Restore paginated data after print dialog closes
            setData(currentData);
        } catch {
            toast.error("Gagal memuat data untuk cetak");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportExcel = async () => {
        if (!data) return;
        setIsExporting(true);
        try {
            const allData = await fetchAllData();
            if (!allData) return;

            const ExcelJS = await import("xlsx");
            const headerRow = ["No.", "Tanggal", "No. Transaksi", "Keterangan"];
            if (isCuciMobil) headerRow.push("Plat Nomor");
            headerRow.push("Anggota/Pelanggan", "Metode", "Nominal", "Status");

            const allTxForExport = allData.transactions.filter(tx => methodFilters.has(tx.paymentMethod));

            const exportData: any[][] = [
                ["PRIMKOPPOL RESOR LUMAJANG"],
                [`UNIT ${unitInfo.label.toUpperCase()}`],
                ["LAPORAN TRANSAKSI & PENDAPATAN"],
                [`Periode: ${allData.periodLabel}`],
                [],
                headerRow,
            ];
            allTxForExport.forEach((tx, i) => {
                const row = [
                    i + 1,
                    new Date(tx.date).toLocaleDateString("id-ID"),
                    tx.no,
                    tx.description,
                ];
                if (isCuciMobil) row.push(tx.vehiclePlate || "-");
                row.push(
                    tx.memberName || "-",
                    METHOD_LABEL[tx.paymentMethod] || tx.paymentMethod,
                    tx.amount,
                    tx.status === "completed" ? "Selesai" : tx.status
                );
                exportData.push(row);
            });
            exportData.push([]);
            exportData.push(["", "", "", "TOTAL PENDAPATAN", "", "", allData.summary.totalPendapatan, ""]);
            exportData.push(["", "", "", "TOTAL PENGELUARAN OPERASIONAL", "", "", allData.summary.totalPengeluaran, ""]);
            exportData.push(["", "", "", "LABA BERSIH", "", "", allData.summary.laba, ""]);

            const ws = ExcelJS.utils.aoa_to_sheet(exportData);
            const wb = ExcelJS.utils.book_new();
            ExcelJS.utils.book_append_sheet(wb, ws, "Laporan");
            ExcelJS.writeFile(wb, `Laporan_${unitInfo.label}_${allData.periodLabel}.xlsx`);
        } catch {
            toast.error("Gagal export Excel");
        } finally {
            setIsExporting(false);
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
            formData.append("keepExistingReceipt", String(keepExistingReceipt));

            const isEdit = editExpenseId !== null;
            const url = isEdit 
                ? `/api/unit/${unitSlug}/operational-expense/${editExpenseId}` 
                : `/api/unit/${unitSlug}/operational-expense`;

            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                body: formData,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success(isEdit ? `Pengeluaran berhasil diperbarui` : `Pengeluaran Rp${Number(expenseAmount).toLocaleString("id-ID")} berhasil dicatat`);
            setShowExpenseDialog(false);
            setExpenseAmount("");
            setExpenseDesc("");
            setExpenseDate(new Date().toISOString().split("T")[0]);
            clearExpenseFile();
            fetchLaporan(page); // Refresh
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

    const rawTransactions = data?.transactions || [];
    const expenses = data?.operationalExpenses || [];
    const incomes = data?.operationalIncomes || [];
    const rawSummary = data?.summary;

    // Apply checkbox method filters client-side (for display only, not summary)
    const transactions = React.useMemo(() => {
        return rawTransactions.filter(tx => methodFilters.has(tx.paymentMethod));
    }, [rawTransactions, methodFilters]);

    // Summary always comes from server (full period data, unaffected by pagination or method filters)
    const summary = rawSummary;

    // ── Kalkulasi Bagi Hasil 50/50 (khusus cuci_mobil) ─────────────────────
    const isCuciMobil = unitType === "cuci_mobil";
    const bagiHasilKaryawan = isCuciMobil && summary ? Math.floor(summary.totalPendapatan * 0.5) : 0;
    const bagianKoperasiKotor = isCuciMobil && summary ? summary.totalPendapatan - bagiHasilKaryawan : 0;
    const potonganSHU = isCuciMobil && summary ? summary.potonganSHUMember : 0;
    const bagianKoperasiBersih = isCuciMobil && summary
        ? bagianKoperasiKotor - summary.totalPengeluaran - potonganSHU
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
                                <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleOpenAddIncome()}
                                >
                                    <TrendingUp className="mr-2 h-4 w-4" />
                                    Catat Pemasukan
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-red-200 text-red-700 hover:bg-red-50"
                                    onClick={() => handleOpenAddExpense()}
                                >
                                    <TrendingDown className="mr-2 h-4 w-4" />
                                    Catat Pengeluaran
                                </Button>
                                </>
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
                            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!data || isLoading || isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Export Excel
                            </Button>
                            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!data || isLoading || isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                                Cetak
                            </Button>
                        </div>
                    }
                />
            </div>

            {/* ── Print Header (only visible when printing) ────────────────── */}
            <div className="hidden print:flex flex-col items-center text-center">
                <div className="logo-frame-sedang mb-2">
                    <img
                        src="/LogoPrimkoppol.png"
                        alt="Logo Primkoppol"
                        className="logo-inner-sedang"
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
                <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div>
                            <Label className="text-xs mb-1 block">Pilih Bulan</Label>
                            <Input
                                type="month"
                                className="w-[160px]"
                                value={selectedMonth}
                                onChange={(e) => handleMonthChange(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Atau Periode Lain</Label>
                            <Select value={period} onValueChange={handlePeriodChange}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PERIODS.filter(p => p.value !== "month").map((p) => (
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
                                <Button size="sm" onClick={() => fetchLaporan(page)} disabled={!dateFrom || !dateTo || isLoading}>
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tampilkan"}
                                </Button>
                            </>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 items-center border-t pt-3">
                        <span className="text-sm text-muted-foreground font-medium">Metode Bayar:</span>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <Checkbox checked={methodFilters.has("cash")} onCheckedChange={(c) => toggleMethod("cash", c)} />
                            <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Tunai
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <Checkbox checked={methodFilters.has("qris")} onCheckedChange={(c) => toggleMethod("qris", c)} />
                            <QrCode className="h-3.5 w-3.5 text-blue-600" /> QRIS
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <Checkbox checked={methodFilters.has("salary_cut")} onCheckedChange={(c) => toggleMethod("salary_cut", c)} />
                            <CreditCard className="h-3.5 w-3.5 text-indigo-600" /> Potong Gaji
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* ── Summary Cards (hidden on print) ──────────────────────────── */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-900/30">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Pendapatan</p>
                            <p className="text-lg font-bold tabular-nums text-emerald-600">
                                {isLoading ? <span className="block h-5 w-24 rounded-md bg-accent animate-pulse" /> : summary ? formatCurrency(summary.totalPendapatan) : "-"}
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
                                {isLoading ? <span className="block h-5 w-24 rounded-md bg-accent animate-pulse" /> : summary ? formatCurrency(summary.totalPengeluaran) : "-"}
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
                                {isLoading ? <span className="block h-5 w-24 rounded-md bg-accent animate-pulse" /> : summary ? formatCurrency(summary.laba) : "-"}
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
                                {isLoading ? <span className="block h-5 w-16 rounded-md bg-accent animate-pulse" /> : summary ? `${summary.totalTransaksi} nota` : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>


            {/* ── Breakdown Metode Bayar (screen) ──────────────────────────── */}
            {summary && !isLoading && (
                <Card className="print:hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Rincian Metode Pembayaran</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        <CardContent className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                            {potonganSHU > 0 && (
                                <div className="p-3 rounded-lg bg-white border border-purple-200">
                                    <p className="text-xs text-muted-foreground">Potongan SHU Langsung</p>
                                    <p className="font-bold text-lg text-purple-600">({formatCurrency(potonganSHU)})</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{summary?.jumlahCuciAnggota} cuci anggota × Rp{(summary?.shuPerCuci || 0).toLocaleString("id-ID")}</p>
                                </div>
                            )}
                            <div className={`p-3 rounded-lg border-2 ${
                                bagianKoperasiBersih >= 0
                                    ? "bg-emerald-50 border-emerald-300"
                                    : "bg-red-50 border-red-300"
                            }`}>
                                <p className="text-xs text-muted-foreground">Laba Bersih Koperasi</p>
                                <p className={`font-bold text-lg ${
                                    bagianKoperasiBersih >= 0 ? "text-emerald-700" : "text-red-700"
                                }`}>{formatCurrency(bagianKoperasiBersih)}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Setelah ops. & SHU anggota</p>
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
                                {potonganSHU > 0 && (
                                    <tr>
                                        <td className="py-0.5 text-gray-600">Potongan SHU Langsung ({summary.jumlahCuciAnggota} cuci × Rp{(summary.shuPerCuci).toLocaleString("id-ID")})</td>
                                        <td className="text-right font-medium text-purple-700">({formatCurrency(potonganSHU)})</td>
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
                        <>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[50px] text-center">No.</TableHead>
                                        <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                                        <TableHead className="whitespace-nowrap">No. Transaksi</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        {isCuciMobil && <TableHead className="whitespace-nowrap">Plat Nomor</TableHead>}
                                        <TableHead className="whitespace-nowrap">Anggota / Pelanggan</TableHead>
                                        <TableHead className="whitespace-nowrap">Metode</TableHead>
                                        <TableHead className="whitespace-nowrap text-right">Nominal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={isCuciMobil ? 8 : 7} className="text-center py-10 text-muted-foreground">
                                                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                                Tidak ada transaksi pada periode ini
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((tx, idx) => (
                                            <TableRow key={tx.id} className={tx.status === "voided" ? "opacity-50 line-through" : ""}>
                                                <TableCell className="text-center text-muted-foreground text-xs">{(page - 1) * perPage + idx + 1}</TableCell>
                                                <TableCell className="tabular-nums text-xs">
                                                    {new Date(tx.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Asia/Jakarta" })}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs text-muted-foreground">{tx.no}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium truncate max-w-[250px]" title={tx.description}>{tx.description}</p>
                                                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground shrink-0 hover:text-primary" onClick={() => setSelectedTx(tx)}>
                                                            <Eye className="h-3 w-3 mr-1" />Detail
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                {isCuciMobil && (
                                                    <TableCell>
                                                        {tx.vehiclePlate ? (
                                                            <Badge variant="outline" className="mt-0.5 text-[10px] font-mono border-slate-400 bg-slate-50 text-slate-700">
                                                                🚗 {tx.vehiclePlate}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">-</span>
                                                        )}
                                                    </TableCell>
                                                )}
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
                                    <TableFooter className="print:hidden">
                                        <TableRow className="bg-muted/60 font-bold print:break-inside-avoid">
                                            <TableCell colSpan={isCuciMobil ? 7 : 6} className="text-right">TOTAL PENDAPATAN</TableCell>
                                            <TableCell className="text-right tabular-nums text-emerald-600">
                                                {formatCurrency(summary.totalPendapatan)}
                                            </TableCell>
                                        </TableRow>
                                        {(summary.totalPengeluaran > 0 || summary.potonganSHUMember > 0) && (
                                            <>
                                                {summary.totalPengeluaran > 0 && (
                                                    <TableRow className="bg-red-50/50 font-medium text-red-700 print:break-inside-avoid">
                                                        <TableCell colSpan={isCuciMobil ? 7 : 6} className="text-right">TOTAL PENGELUARAN OPERASIONAL</TableCell>
                                                        <TableCell className="text-right tabular-nums text-red-600">
                                                            ({formatCurrency(summary.totalPengeluaran)})
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                {isCuciMobil && summary.potonganSHUMember > 0 && (
                                                    <TableRow className="bg-purple-50/50 font-medium text-purple-700 print:break-inside-avoid">
                                                        <TableCell colSpan={isCuciMobil ? 7 : 6} className="text-right">
                                                            POTONGAN SHU LANGSUNG ({summary.jumlahCuciAnggota} cuci × Rp{(summary.shuPerCuci).toLocaleString("id-ID")})
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-purple-600">
                                                            ({formatCurrency(summary.potonganSHUMember)})
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                <TableRow className="bg-primary/5 font-bold print:break-inside-avoid">
                                                    <TableCell colSpan={isCuciMobil ? 7 : 6} className="text-right">LABA BERSIH ESTIMASI</TableCell>
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

                        {/* Pagination Controls */}
                        {data?.pagination && data.pagination.totalPages > 1 && (
                            <div className="print:hidden flex items-center justify-between px-4 py-3 border-t text-sm">
                                <p className="text-muted-foreground">
                                    Menampilkan {(page - 1) * perPage + 1}–{Math.min(page * perPage, data.pagination.total)} dari {data.pagination.total} transaksi
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        disabled={page <= 1 || isLoading}
                                        onClick={() => handlePageChange(1)}
                                    >
                                        Awal
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        disabled={page <= 1 || isLoading}
                                        onClick={() => handlePageChange(page - 1)}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="px-3 text-muted-foreground">
                                        Hal. {page} / {data.pagination.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        disabled={page >= data.pagination.totalPages || isLoading}
                                        onClick={() => handlePageChange(page + 1)}
                                    >
                                        Berikutnya
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        disabled={page >= data.pagination.totalPages || isLoading}
                                        onClick={() => handlePageChange(data.pagination.totalPages)}
                                    >
                                        Akhir
                                    </Button>
                                </div>
                            </div>
                        )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ── Operational Expenses Table ────────────────────────────────── */}
            {/* Print-only: Total Pendapatan - tampil sekali di akhir tabel transaksi */}
            {transactions.length > 0 && summary && (
                <div className="hidden print:block border-t-2 border-gray-700 pt-2 mt-1 mb-4">
                    <table className="w-full text-sm">
                        <tbody>
                            <tr className="font-bold">
                                <td className="py-1 text-right pr-4">TOTAL PENDAPATAN</td>
                                <td className="py-1 text-right tabular-nums">{formatCurrency(summary.totalPendapatan)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
            {expenses.length > 0 && (

                <div className="print:break-before-page print:pt-10">
                    <div className="hidden print:flex flex-col items-center justify-center text-center mb-6">
                        <div className="logo-frame-sedang mb-2">
                            <img src="/LogoPrimkoppol.png" alt="Logo Primkoppol" className="logo-inner-sedang" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-black">PRIMKOPPOL RESOR LUMAJANG</p>
                            <h1 className="text-base font-bold text-black uppercase">UNIT {unitInfo.label}</h1>
                            <h2 className="text-sm font-bold text-black">LAPORAN PENGELUARAN OPERASIONAL</h2>
                        </div>
                    </div>

                    <Card className="print:border-0 print:shadow-none">
                        <CardHeader className="print:hidden">
                            <CardTitle className="text-base text-red-700">Rincian Pengeluaran Operasional</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-red-50/50">
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>No. Transaksi</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead className="text-center print:hidden">Bukti</TableHead>
                                    <TableHead className="text-right">Nominal</TableHead>
                                    {isAdmin && <TableHead className="text-center w-[120px] print:hidden">Aksi</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.map((exp) => (
                                    <TableRow key={exp.id}>
                                        <TableCell className="text-xs tabular-nums">
                                            {new Date(exp.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs text-muted-foreground">{exp.transactionNo}</span>
                                        </TableCell>
                                        <TableCell className="text-sm">{exp.description}</TableCell>
                                        <TableCell className="text-center print:hidden">
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
                                        {isAdmin && (
                                            <TableCell className="text-center print:hidden">
                                                <div className="flex justify-center flex-nowrap gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleOpenEditExpense(exp)}>
                                                        ✏️
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDeleteExpense(exp.id)}>
                                                        🗑️
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="print:hidden">
                                <TableRow className="bg-red-50 font-bold">
                                    <TableCell colSpan={isAdmin ? 4 : 3} className="text-right">TOTAL PENGELUARAN OPERASIONAL</TableCell>
                                    <TableCell className="text-right tabular-nums text-red-700 font-bold">
                                        {formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
                                    </TableCell>
                                    {isAdmin && <TableCell className="print:hidden" />}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
                {/* Cetak: Total Pengeluaran - tampil SEKALI di akhir tabel pengeluaran */}
                <div className="hidden print:block border-t-2 border-red-700 pt-2 mt-1 mb-2 text-sm">
                    <table className="w-full">
                        <tbody>
                            <tr className="font-bold">
                                <td className="py-1 text-right pr-4">TOTAL PENGELUARAN OPERASIONAL</td>
                                <td className="py-1 text-right tabular-nums text-red-800">{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                </div>
            )}

            {/* ── Operational Incomes Table ───────────────────────────────────── */}
            {incomes.length > 0 && (
                <div className="print:break-before-page print:pt-10">
                    <Card className="print:border-0 print:shadow-none">
                        <CardHeader className="print:hidden">
                            <CardTitle className="text-base text-emerald-700">Rincian Pemasukan Operasional</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-emerald-50/50">
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>No. Transaksi</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead className="text-center print:hidden">Bukti</TableHead>
                                    <TableHead className="text-right">Nominal</TableHead>
                                    {isAdmin && <TableHead className="text-center w-[80px] print:hidden">Aksi</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {incomes.map((inc) => (
                                    <TableRow key={inc.id}>
                                        <TableCell className="text-xs tabular-nums">
                                            {new Date(inc.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs text-muted-foreground">{inc.transactionNo}</span>
                                        </TableCell>
                                        <TableCell className="text-sm">{inc.description}</TableCell>
                                        <TableCell className="text-center print:hidden">
                                            {inc.receiptImagePath ? (
                                                <a href={inc.receiptImagePath} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs underline">
                                                    <FileImage className="h-3.5 w-3.5" /> Lihat
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                                            {formatCurrency(inc.amount)}
                                        </TableCell>
                                        {isAdmin && (
                                            <TableCell className="text-center print:hidden">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDeleteIncome(inc.id)}>
                                                    🗑️
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="print:hidden">
                                <TableRow className="bg-emerald-50 font-bold">
                                    <TableCell colSpan={isAdmin ? 4 : 3} className="text-right">TOTAL PEMASUKAN OPERASIONAL</TableCell>
                                    <TableCell className="text-right tabular-nums text-emerald-700 font-bold">
                                        {formatCurrency(incomes.reduce((s, e) => s + e.amount, 0))}
                                    </TableCell>
                                    {isAdmin && <TableCell className="print:hidden" />}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
                </div>
            )}

            {/* ── Lampiran Bukti Print (only visible when printing) ─────────── */}
            {expenses.some(e => e.receiptImagePath) && (
                <div className="hidden print:block">
                    {expenses.filter(e => e.receiptImagePath).map((exp, idx) => (
                        <div key={`bukti-${exp.id}`} className="break-before-page pt-10">
                            <div className="flex flex-col items-center justify-center text-center mb-6">
                                <div className="logo-frame-sedang mb-2">
                                    <img src="/LogoPrimkoppol.png" alt="Logo Primkoppol" className="logo-inner-sedang" />
                                </div>
                                <h1 className="text-base font-bold uppercase mt-2">BUKTI RINCIAN PENGELUARAN</h1>
                            </div>
                            <div className="flex flex-col items-center text-center">
                                <h2 className="text-sm font-bold mb-1">{idx+1}. KETERANGAN : {exp.description.toUpperCase()}</h2>
                                <h3 className="text-sm font-medium mb-4">TANGGAL : {new Date(exp.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }).toUpperCase()}</h3>
                                <div className="border p-2 max-w-[80%] mx-auto mt-2 inline-block">
                                    <img 
                                        src={exp.receiptImagePath ?? undefined} 
                                        alt={`Bukti ${exp.description}`} 
                                        className="max-w-full max-h-[550px] object-contain border border-slate-100 placeholder-slate-50 text-[8px]"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
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
                            {editExpenseId ? "Ubah Pengeluaran Operasional" : "Catat Pengeluaran Operasional"}
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
                            <Label>Foto Bukti / Struk (Opsional, maks. 2MB, JPG/PNG/WebP)</Label>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
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
                            {editExpenseId ? "Simpan Perubahan" : "Simpan Pengeluaran"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Dialog Catat Pemasukan ────────────────────────────────────── */}
            <Dialog open={showIncomeDialog} onOpenChange={(open) => { setShowIncomeDialog(open); if (!open) clearIncomeFile(); }}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            Catat Pemasukan Operasional
                        </DialogTitle>
                        <DialogDescription>
                            Catat pemasukan unit di luar transaksi POS kasir, misalnya pemasukan dari transaksi lama, sewa lahan, donasi, dll.
                            Akan langsung mengkredit kas unit ini.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="inc-amount">Nominal Pemasukan (Rp) *</Label>
                            <Input
                                id="inc-amount"
                                type="number"
                                placeholder="0"
                                className="text-right text-lg font-bold"
                                value={incomeAmount}
                                onChange={(e) => setIncomeAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="inc-desc">Keterangan Pemasukan *</Label>
                            <Textarea
                                id="inc-desc"
                                placeholder="Misal: Pemasukan sewa tempat, transaksi lama belum tercatat, dll."
                                className="resize-none"
                                rows={3}
                                value={incomeDesc}
                                onChange={(e) => setIncomeDesc(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="inc-date">Tanggal Pemasukan</Label>
                            <Input
                                id="inc-date"
                                type="date"
                                value={incomeDate}
                                onChange={(e) => setIncomeDate(e.target.value)}
                            />
                        </div>

                        {/* Upload Foto Bukti */}
                        <div className="space-y-2">
                            <Label>Foto Bukti (Opsional, maks. 2MB, JPG/PNG/WebP)</Label>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                ref={incomeFileInputRef}
                                onChange={handleIncomeFileChange}
                            />
                            {incomeReceiptPreview ? (
                                <div className="relative rounded-lg border border-dashed border-emerald-200 overflow-hidden">
                                    <img
                                        src={incomeReceiptPreview}
                                        alt="Preview bukti"
                                        className="w-full h-36 object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={clearIncomeFile}
                                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                                        {incomeReceiptFile?.name}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => incomeFileInputRef.current?.click()}
                                    className="w-full h-24 border-2 border-dashed border-emerald-200 rounded-lg flex flex-col items-center justify-center gap-1 text-emerald-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors"
                                >
                                    <ImagePlus className="h-6 w-6" />
                                    <span className="text-xs">Klik untuk unggah foto bukti pemasukan</span>
                                </button>
                            )}
                        </div>

                        <Separator />
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                            💰 Pemasukan ini akan langsung mengkredit akun Kas Unit <strong>{unitInfo.label}</strong> tanpa memerlukan persetujuan tambahan.
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowIncomeDialog(false); clearIncomeFile(); }}>Batal</Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleSaveIncome}
                            disabled={isSavingIncome || !incomeAmount || !incomeDesc}
                        >
                            {isSavingIncome ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            Simpan Pemasukan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Dialog Konfirmasi Hapus ────────────────────────────────── */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-5 w-5" />
                            Konfirmasi Hapus
                        </DialogTitle>
                        <DialogDescription>
                            {deleteTarget?.type === "income"
                                ? "Pemasukan ini akan dihapus permanen beserta bukti fotonya. Saldo kas akan otomatis terkalkulasi ulang."
                                : "Pengeluaran ini akan dihapus permanen beserta bukti fotonya. Saldo kas akan otomatis terkalkulasi ulang."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                            Tindakan ini tidak dapat dibatalkan. Data yang dihapus akan dicatat di log audit.
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="delete-reason">Alasan Penghapusan *</Label>
                            <Textarea
                                id="delete-reason"
                                placeholder="Wajib isi alasan penghapusan..."
                                className="resize-none"
                                rows={2}
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={confirmDelete}
                            disabled={isDeleting || !deleteReason.trim()}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Ya, Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transaction Detail Modal */}
            <Dialog open={!!selectedTx} onOpenChange={(open) => { if (!open) setSelectedTx(null); }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-base">Detail Transaksi</DialogTitle>
                    </DialogHeader>
                    {selectedTx && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-muted-foreground text-xs">No. Transaksi</p>
                                    <p className="font-mono font-medium">{selectedTx.no}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Tanggal</p>
                                    <p>{new Date(selectedTx.date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Tipe</p>
                                    <Badge variant="outline">{selectedTx.type === "store_sale" ? "Penjualan Toko" : "Transaksi Unit"}</Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Metode Bayar</p>
                                    <Badge variant="outline" className={
                                        selectedTx.paymentMethod === "cash" ? "border-emerald-300 text-emerald-700" :
                                        selectedTx.paymentMethod === "qris" ? "border-blue-300 text-blue-700" :
                                        "border-indigo-300 text-indigo-700"
                                    }>
                                        {METHOD_LABEL[selectedTx.paymentMethod] || selectedTx.paymentMethod}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Pelanggan</p>
                                    <p className="font-medium">{selectedTx.memberName || "Walk-In"}</p>
                                    {selectedTx.memberNrp && <p className="text-xs text-muted-foreground">NRP: {selectedTx.memberNrp}</p>}
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Status</p>
                                    <Badge variant={selectedTx.status === "completed" ? "default" : "destructive"}>
                                        {selectedTx.status === "completed" ? "Selesai" : selectedTx.status === "voided" ? "Dibatalkan" : selectedTx.status}
                                    </Badge>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Deskripsi</p>
                                <p className="whitespace-pre-wrap break-words">{selectedTx.description}</p>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-medium">Total</span>
                                <span className="text-xl font-bold">{formatCurrency(selectedTx.amount)}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function formatUnitName(slug: string) {
    return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
