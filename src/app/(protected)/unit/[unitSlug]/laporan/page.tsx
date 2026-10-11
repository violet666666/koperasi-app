"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
    Printer,
    Download,
    TrendingUp,
    TrendingDown,
    Banknote,
    QrCode,
    Users,
    BarChart2,
    Loader2,
    Store,
    ShieldX,
    Send,
    CreditCard,
    Eye
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useAuth } from "@/lib/hooks";
import { isSameUnit } from "@/lib/unit-aliases";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SortableHeader } from "@/components/ui/sortable-header";
import { UNIT_LABELS, PERIODS, METHOD_LABEL, EXPENSE_CATEGORY_BADGE, OPS_PAYMENT_METHODS, formatUnitName } from "./_constants";
import { buildLaporanExcel } from "./_lib/export-excel";
import { ExpenseDialog, IncomeDialog, DeleteConfirmDialog, TransactionDetailDialog } from "./_components/laporan-dialogs";
import { ProfitAnalysisSection, TransactionsSection, ExpensesSection, IncomesSection } from "./_components/laporan-sections";
import type { LaporanData, LaporanTransaction, OperationalExpense } from "./_types";

// Konstanta, tipe, dan dialog dipindah ke _constants.tsx / _types.ts /
// _components/laporan-dialogs.tsx; export Excel ke _lib/export-excel.ts (ter-unit-test).
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
    const isAdmin = roleName === "admin" && isSameUnit(userUnitType, unitType);
    const hasAccess = isOperator || isAdmin;
    const isWrongUnit = !isOperator && userUnitType && !isSameUnit(userUnitType, unitType);

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

    // Sort state
    const [sortField, setSortField] = React.useState("transactionDate");
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

    const toggleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
    };

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
    const [expensePaymentMethod, setExpensePaymentMethod] = React.useState("cash");
    const [expenseCategory, setExpenseCategory] = React.useState("operational");
    const expenseFileInputRef = React.useRef<HTMLInputElement>(null);

    // Submit Laporan ke Operator
    const [isSubmittingLaporan, setIsSubmittingLaporan] = React.useState(false);

    // Delete confirmation dialog with reason
    const [deleteTarget, setDeleteTarget] = React.useState<{ id: number; type: "expense" | "income" } | null>(null);
    const [deleteReason, setDeleteReason] = React.useState("");
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Checkbox method filters
    const [methodFilters, setMethodFilters] = React.useState<Set<string>>(new Set(["cash", "qris", "salary_cut"]));
    const [opsMethodFilter, setOpsMethodFilter] = React.useState<Set<string>>(new Set(["cash", "qris", "lainnya"]));

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

    const toggleOpsMethod = (method: string, checked: boolean | "indeterminate") => {
        setOpsMethodFilter(prev => {
            const next = new Set(prev);
            if (checked) next.add(method);
            else next.delete(method);
            return next;
        });
    };

    // Income Dialog (Catat Pemasukan)
    const [editIncomeId, setEditIncomeId] = React.useState<number | null>(null);
    const [showIncomeDialog, setShowIncomeDialog] = React.useState(false);
    const [incomeAmount, setIncomeAmount] = React.useState("");
    const [incomeDesc, setIncomeDesc] = React.useState("");
    const [incomeDate, setIncomeDate] = React.useState(new Date().toISOString().split("T")[0]);
    const [isSavingIncome, setIsSavingIncome] = React.useState(false);
    const [incomeReceiptFile, setIncomeReceiptFile] = React.useState<File | null>(null);
    const [incomeReceiptPreview, setIncomeReceiptPreview] = React.useState<string | null>(null);
    const [keepExistingIncomeReceipt, setKeepExistingIncomeReceipt] = React.useState(true);
    const [incomePaymentMethod, setIncomePaymentMethod] = React.useState("cash");
    const incomeFileInputRef = React.useRef<HTMLInputElement>(null);

    // Jenis Pemasukan (operasional vs customer) + optional member picker for customer mode.
    // Pattern reused from kasir/page.tsx (memberSearch + selectedMember + /api/members?search).
    const [incomeJenis, setIncomeJenis] = React.useState<"operasional" | "customer">("operasional");
    const [incomeMemberId, setIncomeMemberId] = React.useState<number | null>(null);
    const [incomeMemberQuery, setIncomeMemberQuery] = React.useState("");
    const [incomeMemberResults, setIncomeMemberResults] = React.useState<any[]>([]);
    const [incomeMemberPicked, setIncomeMemberPicked] = React.useState<any | null>(null);
    const [isSearchingIncomeMember, setIsSearchingIncomeMember] = React.useState(false);

    const searchIncomeMember = async () => {
        if (incomeMemberQuery.trim().length < 2) return;
        setIsSearchingIncomeMember(true);
        try {
            const res = await fetch(`/api/members?search=${encodeURIComponent(incomeMemberQuery.trim())}`);
            const json = await res.json();
            setIncomeMemberResults(json.data || []);
            if ((json.data || []).length === 0) toast.error("Anggota tidak ditemukan");
        } catch {
            toast.error("Gagal mencari anggota");
        } finally { setIsSearchingIncomeMember(false); }
    };

    // Bulk select for batch payment method change
    const [selectedExpenseIds, setSelectedExpenseIds] = React.useState<Set<number>>(new Set());
    const [selectedIncomeIds, setSelectedIncomeIds] = React.useState<Set<number>>(new Set());
    const [bulkPaymentMethod, setBulkPaymentMethod] = React.useState<string>("cash");
    const [isBulkUpdating, setIsBulkUpdating] = React.useState(false);

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
        setExpensePaymentMethod("cash");
        setExpenseCategory("operational");
        clearExpenseFile();
        setShowExpenseDialog(true);
    };

    const handleOpenEditExpense = (exp: OperationalExpense) => {
        setEditExpenseId(exp.id);
        setExpenseAmount(exp.amount.toString());
        setExpenseDesc(exp.description);
        setExpenseDate(new Date(exp.date).toISOString().split("T")[0]);
        setExpensePaymentMethod(exp.paymentMethod || "cash");
        setExpenseCategory(
            exp.category === "hpp_toko" || exp.category === "belanja_aset" ? exp.category : "operational",
        );
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
            const basePath = deleteTarget.type === "income" ? "operational-income" : "operational-expense";
            const res = await fetch(`/api/unit/${unitSlug}/${basePath}/${deleteTarget.id}?reason=${encodeURIComponent(deleteReason.trim())}`, { method: "DELETE" });
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
        setEditIncomeId(null);
        setIncomeAmount("");
        setIncomeDesc("");
        setIncomeDate(new Date().toISOString().split("T")[0]);
        setIncomePaymentMethod("cash");
        clearIncomeFile();
        // Reset Jenis + member picker (always opens in operasional mode for a fresh record).
        setIncomeJenis("operasional");
        setIncomeMemberId(null);
        setIncomeMemberQuery("");
        setIncomeMemberResults([]);
        setIncomeMemberPicked(null);
        setShowIncomeDialog(true);
    };

    const handleOpenEditIncome = (inc: OperationalExpense) => {
        setEditIncomeId(inc.id);
        setIncomeAmount(inc.amount.toString());
        setIncomeDesc(inc.description);
        setIncomeDate(new Date(inc.date).toISOString().split("T")[0]);
        setIncomePaymentMethod(inc.paymentMethod || "cash");
        setIncomeReceiptFile(null);
        setIncomeReceiptPreview(inc.receiptImagePath || null);
        setKeepExistingIncomeReceipt(true);
        // Edit only applies to existing operasional (CashBankTransaction) records.
        // Force operasional mode and clear member picker — do not allow editing into/out-of customer type.
        setIncomeJenis("operasional");
        setIncomeMemberId(null);
        setIncomeMemberQuery("");
        setIncomeMemberResults([]);
        setIncomeMemberPicked(null);
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
            formData.append("paymentMethod", incomePaymentMethod);
            if (incomeReceiptFile) formData.append("receipt", incomeReceiptFile);
            formData.append("keepExistingReceipt", String(keepExistingIncomeReceipt));

            // Jenis Pemasukan: operasional (default, CB) vs customer (UnitTransaction).
            // Only send jenis for new records — edit is operasional-only (enforced in handleOpenEditIncome).
            const isEdit = editIncomeId !== null;
            if (!isEdit) {
                formData.set("jenis", incomeJenis);
                if (incomeJenis === "customer" && incomeMemberId) {
                    formData.set("memberId", String(incomeMemberId));
                }
            }
            const url = isEdit
                ? `/api/unit/${unitSlug}/operational-income/${editIncomeId}`
                : `/api/unit/${unitSlug}/operational-income`;

            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                body: formData,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success(isEdit ? "Pemasukan berhasil diperbarui" : `Pemasukan Rp${Number(incomeAmount).toLocaleString("id-ID")} berhasil dicatat`);
            setShowIncomeDialog(false);
            clearIncomeFile();
            fetchLaporan(page);
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan pemasukan");
        } finally {
            setIsSavingIncome(false);
        }
    };

    // Bulk select helpers
    const toggleExpenseSelect = (id: number, checked: boolean | "indeterminate") => {
        setSelectedExpenseIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const toggleIncomeSelect = (id: number, checked: boolean | "indeterminate") => {
        setSelectedIncomeIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const toggleAllExpenses = (checked: boolean | "indeterminate") => {
        if (checked) setSelectedExpenseIds(new Set(expenses.map(e => e.id)));
        else setSelectedExpenseIds(new Set());
    };

    const toggleAllIncomes = (checked: boolean | "indeterminate") => {
        if (checked) setSelectedIncomeIds(new Set(incomes.map(i => i.id)));
        else setSelectedIncomeIds(new Set());
    };

    const handleBulkUpdateMethod = async (type: "expense" | "income") => {
        const ids = type === "expense" ? [...selectedExpenseIds] : [...selectedIncomeIds];
        if (ids.length === 0) {
            toast.error("Pilih minimal 1 transaksi");
            return;
        }
        setIsBulkUpdating(true);
        try {
            const res = await fetch(`/api/unit/${unitSlug}/operational-batch/update-method`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids, paymentMethod: bulkPaymentMethod, type }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success(json.message);
            if (type === "expense") setSelectedExpenseIds(new Set());
            else setSelectedIncomeIds(new Set());
            fetchLaporan(page);
        } catch (err: any) {
            toast.error(err.message || "Gagal mengubah metode");
        } finally {
            setIsBulkUpdating(false);
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
                sortBy: sortField,
                sortOrder,
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
    }, [hasAccess, isWrongUnit, unitSlug, period, dateFrom, dateTo, sortField, sortOrder, page]);

    // Helper: fetch ALL data for export/print (no pagination)
    const fetchAllData = React.useCallback(async (): Promise<LaporanData | null> => {
        try {
            const params = new URLSearchParams({
                period,
                perPage: String(perPage),
                export: "true",
                sortBy: sortField,
                sortOrder,
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
    }, [unitSlug, period, dateFrom, dateTo, sortField, sortOrder]);

    React.useEffect(() => {
        fetchLaporan(1);
    }, [period, dateFrom, dateTo, hasAccess, sortField, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

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
            // Temporarily set all data for print, then restore after dialog closes
            const currentData = data;
            setData(allData);
            // Use requestAnimationFrame to ensure React has flushed DOM updates
            await new Promise<void>(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve();
                    });
                });
            });
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
            const XLSX = await import("xlsx");
            const { wb, filename, txCount, expCount, incCount } = buildLaporanExcel({
                XLSX, allData, unitLabel: unitInfo.label, isCuciMobil, usesStoreSales, methodFilters,
            });
            XLSX.writeFile(wb, filename);
            toast.success(`Excel berhasil diexport (${txCount} transaksi, ${expCount} pengeluaran, ${incCount} pemasukan)`);
        } catch (err) {
            console.error("Excel export error:", err);
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
            formData.append("paymentMethod", expensePaymentMethod);
            formData.append("expenseCategory", expenseCategory);
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
            setExpenseCategory("operational");
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
    const rawExpenses = data?.operationalExpenses || [];
    const rawIncomes = data?.operationalIncomes || [];
    const rawSummary = data?.summary;

    // Apply checkbox method filters client-side (for display only, not summary)
    const transactions = React.useMemo(() => {
        return rawTransactions.filter(tx => methodFilters.has(tx.paymentMethod));
    }, [rawTransactions, methodFilters]);

    const expenses = React.useMemo(() => {
        return rawExpenses.filter(e => opsMethodFilter.has(e.paymentMethod || "cash"));
    }, [rawExpenses, opsMethodFilter]);

    const incomes = React.useMemo(() => {
        return rawIncomes.filter(i => opsMethodFilter.has(i.paymentMethod || "cash"));
    }, [rawIncomes, opsMethodFilter]);

    // Summary always comes from server (full period data, unaffected by pagination or method filters)
    const summary = rawSummary;

    // ── Kalkulasi Bagi Hasil 50/50 (khusus cuci_mobil) ─────────────────────
    const isCuciMobil = unitType === "cuci_mobil";
    // Sinkron dengan backend: unit-laporan.ts line ~264
    const usesStoreSales = !["cuci_mobil", "simpan_pinjam", "investasi_modal_jp"].includes(unitType);
    const productProfit = data?.productProfit ?? [];
    const isRestoUnit = ["resto", "resto_cafe", "coffe_latar", "cafe_lsp"].includes(unitType);
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
                            <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
                            {/* Gabungan Operasional + Barang Dagangan + Aset jadi SATU angka utama
                                (permintaan ajudan 2026-09-30); rincian per kategori tetap
                                sebagai keterangan kecil di bawahnya.
                                Akuntansi TIDAK berubah — totalPengeluaran/laba/SHU tetap
                                operational-only, hpp_toko diakui via COGS. */}
                            <p className="text-lg font-bold tabular-nums text-red-600">
                                {isLoading ? <span className="block h-5 w-24 rounded-md bg-accent animate-pulse" /> : summary ? formatCurrency(summary.totalPengeluaran + summary.totalPembelianStok + summary.totalBelanjaAset) : "-"}
                            </p>
                            {!isLoading && summary && (summary.totalPembelianStok > 0 || summary.totalBelanjaAset > 0) && (
                                <p className="text-[10px] text-muted-foreground">
                                    Operasional {formatCurrency(summary.totalPengeluaran)}
                                    {summary.totalPembelianStok > 0 && ` · Barang Dagangan ${formatCurrency(summary.totalPembelianStok)}`}
                                    {summary.totalBelanjaAset > 0 && ` · Aset ${formatCurrency(summary.totalBelanjaAset)}`}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600 dark:bg-blue-900/30">
                            <BarChart2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">{usesStoreSales ? "Laba Bersih" : "Laba Bersih Est."}</p>
                            <p className={`text-lg font-bold tabular-nums ${summary && (usesStoreSales ? summary.netProfit : summary.laba) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {isLoading ? <span className="block h-5 w-24 rounded-md bg-accent animate-pulse" /> : summary ? formatCurrency(usesStoreSales ? summary.netProfit : summary.laba) : "-"}
                            </p>
                            {usesStoreSales && summary && !isLoading && summary.totalHPP > 0 && (
                                <p className="text-[10px] text-muted-foreground">setelah HPP {formatCurrency(summary.totalHPP)}</p>
                            )}
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

            <ProfitAnalysisSection
                isLoading={isLoading}
                productProfit={productProfit}
                summary={summary}
                usesStoreSales={usesStoreSales}
            />
            <TransactionsSection
                data={data}
                summary={summary}
                transactions={transactions}
                isLoading={isLoading}
                isCuciMobil={isCuciMobil}
                isRestoUnit={isRestoUnit}
                usesStoreSales={usesStoreSales}
                sortField={sortField}
                sortOrder={sortOrder}
                toggleSort={toggleSort}
                page={page}
                perPage={perPage}
                handlePageChange={handlePageChange}
                setSelectedTx={setSelectedTx}
                bagiHasilKaryawan={bagiHasilKaryawan}
                bagianKoperasiKotor={bagianKoperasiKotor}
                bagianKoperasiBersih={bagianKoperasiBersih}
                potonganSHU={potonganSHU}
            />
            <ExpensesSection
                expenses={expenses}
                incomes={incomes}
                transactions={transactions}
                rawExpenses={rawExpenses}
                rawIncomes={rawIncomes}
                summary={summary}
                isAdmin={isAdmin}
                isCuciMobil={isCuciMobil}
                usesStoreSales={usesStoreSales}
                page={page}
                opsMethodFilter={opsMethodFilter}
                toggleOpsMethod={toggleOpsMethod}
                bulkPaymentMethod={bulkPaymentMethod}
                isBulkUpdating={isBulkUpdating}
                handleBulkUpdateMethod={handleBulkUpdateMethod}
                selectedExpenseIds={selectedExpenseIds}
                setBulkPaymentMethod={setBulkPaymentMethod}
                setSelectedExpenseIds={setSelectedExpenseIds}
                toggleExpenseSelect={toggleExpenseSelect}
                toggleAllExpenses={toggleAllExpenses}
                handleDeleteExpense={handleDeleteExpense}
                handleOpenEditExpense={handleOpenEditExpense}
                bagiHasilKaryawan={bagiHasilKaryawan}
                bagianKoperasiKotor={bagianKoperasiKotor}
                bagianKoperasiBersih={bagianKoperasiBersih}
                potonganSHU={potonganSHU}
                unitInfo={unitInfo}
            />
            <IncomesSection
                data={data}
                expenses={expenses}
                incomes={incomes}
                page={page}
                isAdmin={isAdmin}
                bulkPaymentMethod={bulkPaymentMethod}
                isBulkUpdating={isBulkUpdating}
                handleBulkUpdateMethod={handleBulkUpdateMethod}
                selectedIncomeIds={selectedIncomeIds}
                setBulkPaymentMethod={setBulkPaymentMethod}
                setSelectedIncomeIds={setSelectedIncomeIds}
                toggleIncomeSelect={toggleIncomeSelect}
                toggleAllIncomes={toggleAllIncomes}
                handleDeleteIncome={handleDeleteIncome}
                handleOpenEditIncome={handleOpenEditIncome}
                unitInfo={unitInfo}
            />
            {/* ── Dialogs (dipindah ke _components/laporan-dialogs.tsx) ── */}
            <ExpenseDialog
                showExpenseDialog={showExpenseDialog} setShowExpenseDialog={setShowExpenseDialog}
                clearExpenseFile={clearExpenseFile} editExpenseId={editExpenseId}
                expenseAmount={expenseAmount} setExpenseAmount={setExpenseAmount}
                expenseDesc={expenseDesc} setExpenseDesc={setExpenseDesc}
                expenseDate={expenseDate} setExpenseDate={setExpenseDate}
                expensePaymentMethod={expensePaymentMethod} setExpensePaymentMethod={setExpensePaymentMethod}
                expenseCategory={expenseCategory} setExpenseCategory={setExpenseCategory}
                expenseFileInputRef={expenseFileInputRef} handleExpenseFileChange={handleExpenseFileChange}
                expenseReceiptPreview={expenseReceiptPreview} expenseReceiptFile={expenseReceiptFile}
                unitInfo={unitInfo} handleSaveExpense={handleSaveExpense} isSavingExpense={isSavingExpense}
            />
            <IncomeDialog
                showIncomeDialog={showIncomeDialog} setShowIncomeDialog={setShowIncomeDialog}
                clearIncomeFile={clearIncomeFile} editIncomeId={editIncomeId}
                incomeJenis={incomeJenis} setIncomeJenis={setIncomeJenis}
                incomeMemberQuery={incomeMemberQuery} setIncomeMemberQuery={setIncomeMemberQuery}
                searchIncomeMember={searchIncomeMember} isSearchingIncomeMember={isSearchingIncomeMember}
                incomeMemberResults={incomeMemberResults} incomeMemberPicked={incomeMemberPicked}
                setIncomeMemberPicked={setIncomeMemberPicked} setIncomeMemberId={setIncomeMemberId}
                setIncomeMemberResults={setIncomeMemberResults}
                incomeAmount={incomeAmount} setIncomeAmount={setIncomeAmount}
                incomeDesc={incomeDesc} setIncomeDesc={setIncomeDesc}
                incomeDate={incomeDate} setIncomeDate={setIncomeDate}
                incomePaymentMethod={incomePaymentMethod} setIncomePaymentMethod={setIncomePaymentMethod}
                incomeFileInputRef={incomeFileInputRef} handleIncomeFileChange={handleIncomeFileChange}
                incomeReceiptPreview={incomeReceiptPreview} incomeReceiptFile={incomeReceiptFile}
                unitInfo={unitInfo} handleSaveIncome={handleSaveIncome} isSavingIncome={isSavingIncome}
            />
            <DeleteConfirmDialog
                deleteTarget={deleteTarget} setDeleteTarget={setDeleteTarget}
                deleteReason={deleteReason} setDeleteReason={setDeleteReason}
                isDeleting={isDeleting} confirmDelete={confirmDelete}
            />
            <TransactionDetailDialog selectedTx={selectedTx} setSelectedTx={setSelectedTx} />
        </div>
    );
}

