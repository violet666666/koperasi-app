"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
    Clock, DollarSign, PlayCircle, StopCircle, Loader2,
    ArrowRight, Banknote, CreditCard, QrCode, AlertTriangle,
    CheckCircle, User, Calendar, TrendingUp, TrendingDown,
    Package, Eye, Settings, Save, Trash2, Printer,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { generateShiftRecapPDF, type ShiftRecapData } from "@/lib/export-utils";

const DEFAULT_SHIFT_OPTIONS = [
    { value: "Pagi", label: "Pagi (07:00 - 14:59)" },
    { value: "Sore", label: "Sore (15:00 - 20:59)" },
    { value: "Malam", label: "Malam (21:00 - 06:59)" },
];

const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

interface ShiftData {
    id: number;
    userId: number;
    userName: string;
    cashierDisplayName: string | null;
    unitType: string;
    shiftName: string;
    startedAt: string;
    endedAt: string | null;
    openingCash: number;
    closingCash: number | null;
    expectedCash: number | null;
    totalSalesCash: number;
    totalSalesQris: number;
    totalSalesCredit: number;
    totalTransactions: number;
    cashDifference: number | null;
    notes: string | null;
    closedByUserId: number | null;
    status: string;
    salesCount: number;
}

export default function ShiftKasirPage() {
    const { data: session } = useSession();
    const unitType = session?.user?.unitType || "toko";
    const isResto = ["resto_cafe", "resto", "coffe_latar"].includes(unitType as string);
    const isAdmin = ["admin", "operator"].includes(session?.user?.role as string);

    const [loading, setLoading] = React.useState(true);
    const [activeShift, setActiveShift] = React.useState<ShiftData | null>(null);
    const [history, setHistory] = React.useState<ShiftData[]>([]);

    // Dynamic shift schedule
    const [shiftOptions, setShiftOptions] = React.useState(DEFAULT_SHIFT_OPTIONS);
    const [shiftSchedule, setShiftSchedule] = React.useState<{ name: string; startHour: number; endHour: number }[]>([]);

    // Buka shift form
    const [shiftName, setShiftName] = React.useState("");
    const [openingCash, setOpeningCash] = React.useState("");
    const [opening, setOpening] = React.useState(false);

    // Tutup shift dialog
    const [closeDialog, setCloseDialog] = React.useState(false);
    const [closingCash, setClosingCash] = React.useState("");
    const [closeNotes, setCloseNotes] = React.useState("");
    const [closing, setClosing] = React.useState(false);
    const [closeResult, setCloseResult] = React.useState<any>(null);

    // Shift detail dialog
    const [detailOpen, setDetailOpen] = React.useState(false);
    const [detailData, setDetailData] = React.useState<any>(null);
    const [detailLoading, setDetailLoading] = React.useState(false);

    // Admin shift config dialog
    const [configOpen, setConfigOpen] = React.useState(false);
    const [configShifts, setConfigShifts] = React.useState<{ name: string; startHour: number; endHour: number }[]>([]);
    const [configSaving, setConfigSaving] = React.useState(false);

    // Admin edit closingCash dialog
    const [editCashOpen, setEditCashOpen] = React.useState(false);
    const [editCashShiftId, setEditCashShiftId] = React.useState<number | null>(null);
    const [editCashValue, setEditCashValue] = React.useState("");
    const [editCashSaving, setEditCashSaving] = React.useState(false);

    // Cashier identity for shift creation
    const [cashierIdentityId, setCashierIdentityId] = React.useState<number | null>(null);

    const fetchShiftDetail = async (shiftId: number) => {
        setDetailLoading(true);
        setDetailOpen(true);
        try {
            const res = await fetch(`/api/toko/shifts/${shiftId}/sales`);
            if (!res.ok) throw new Error();
            const json = await res.json();
            setDetailData(json.data);
        } catch {
            toast.error("Gagal memuat detail shift");
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const handlePrintShiftRecap = () => {
        if (!detailData) return;
        const s = detailData.shift;
        const recapData: ShiftRecapData = {
            shiftName: s.shiftName,
            cashierName: s.cashierDisplayName || s.userName,
            unitType: s.unitType || (unitType as string),
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            status: s.status,
            openingCash: Number(s.openingCash || 0),
            totalCash: Number(detailData.summary.totalCash || 0),
            totalQris: Number(detailData.summary.totalQris || 0),
            totalCredit: Number(detailData.summary.totalCredit || 0),
            totalRevenue: Number(detailData.summary.totalRevenue || 0),
            activeSales: detailData.summary.activeSales || 0,
            voidedSales: detailData.summary.voidedSales || 0,
            expectedCash: s.expectedCash != null ? Number(s.expectedCash) : null,
            closingCash: s.closingCash != null ? Number(s.closingCash) : null,
            cashDifference: s.cashDifference != null ? Number(s.cashDifference) : null,
            notes: s.notes || null,
            sales: (detailData.sales || []).map((sale: any) => ({
                saleNo: sale.saleNo,
                createdAt: sale.createdAt,
                customer: sale.member?.name || sale.customerName || "Umum",
                cashier: sale.cashierDisplayName || sale.createdBy?.name || "-",
                items: (sale.items || []).reduce((sum: number, i: any) => sum + i.quantity, 0),
                method: sale.paymentMethod,
                total: Number(sale.totalAmount || 0),
                isVoided: !!sale.isVoided,
            })),
            topProducts: (detailData.topProducts || []).map((p: any) => ({
                name: p.name,
                qty: p.qty,
                revenue: Number(p.revenue || 0),
            })),
        };
        generateShiftRecapPDF(recapData);
    };

    // Auto-detect shift name berdasarkan jam
    React.useEffect(() => {
        const hour = new Date().getHours();
        if (shiftSchedule.length > 0) {
            for (const shift of shiftSchedule) {
                if (shift.startHour < shift.endHour) {
                    if (hour >= shift.startHour && hour < shift.endHour) { setShiftName(shift.name); return; }
                } else {
                    if (hour >= shift.startHour || hour < shift.endHour) { setShiftName(shift.name); return; }
                }
            }
            setShiftName(shiftSchedule[0].name);
        } else {
            if (hour >= 7 && hour < 15) setShiftName("Pagi");
            else if (hour >= 15 && hour < 21) setShiftName("Sore");
            else setShiftName("Malam");
        }
    }, [shiftSchedule]);

    const fetchShifts = React.useCallback(async () => {
        try {
            setLoading(true);
            const [shiftsRes, scheduleRes] = await Promise.all([
                fetch(`/api/toko/shifts?unitType=${unitType}&limit=20`),
                fetch(`/api/toko/shift-schedule?unitType=${unitType}`),
            ]);
            const json = await shiftsRes.json();
            const shifts: ShiftData[] = json.data || [];

            // Load dynamic schedule
            try {
                const schedJson = await scheduleRes.json();
                const sched = schedJson.data as { name: string; startHour: number; endHour: number }[];
                if (Array.isArray(sched) && sched.length > 0) {
                    setShiftSchedule(sched);
                    setShiftOptions(sched.map(s => {
                        const fmtH = (h: number) => String(h).padStart(2, "0");
                        const lastHour = s.endHour === 0 ? 23 : s.endHour - 1;
                        return { value: s.name, label: `${s.name} (${fmtH(s.startHour)}:00 - ${fmtH(lastHour)}:59)` };
                    }));
                }
            } catch { /* use defaults */ }

            const open = shifts.find((s) => s.status === "open");
            setActiveShift(open || null);
            setHistory(shifts.filter((s) => s.status === "closed"));
        } catch (err) {
            console.error("Fetch shifts error:", err);
        } finally {
            setLoading(false);
        }
    }, [unitType]);

    React.useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    // Fetch cashier identity for shift creation
    React.useEffect(() => {
        async function fetchCashierIdentity() {
            try {
                const res = await fetch("/api/toko/cashier-session");
                if (!res.ok) return;
                const json = await res.json();
                if (json.data) {
                    setCashierIdentityId(json.data.id);
                }
            } catch {
                // Non-critical
            }
        }
        fetchCashierIdentity();
    }, []);

    const handleOpenShift = async () => {
        if (!shiftName) return toast.error("Pilih shift terlebih dahulu");

        setOpening(true);
        try {
            const res = await fetch("/api/toko/shifts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shiftName,
                    openingCash: parseInt(openingCash.replace(/\D/g, "") || "0"),
                    unitType,
                    cashierIdentityId,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            toast.success(json.message);
            setOpeningCash("");
            fetchShifts();
        } catch (err: any) {
            toast.error(err.message || "Gagal membuka shift");
        } finally {
            setOpening(false);
        }
    };

    const handleCloseShift = async () => {
        if (!activeShift) return;

        setClosing(true);
        try {
            const res = await fetch(`/api/toko/shifts/${activeShift.id}/close`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    closingCash: closingCash ? parseInt(closingCash.replace(/\D/g, "")) : null,
                    notes: closeNotes || null,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            setCloseResult(json.data);
            toast.success(json.message);

            // Clear cashier identity session when shift closes
            await fetch("/api/toko/cashier-session", { method: "DELETE" });
        } catch (err: any) {
            toast.error(err.message || "Gagal menutup shift");
        } finally {
            setClosing(false);
        }
    };

    const handleCloseDialogDismiss = () => {
        setCloseDialog(false);
        setClosingCash("");
        setCloseNotes("");
        setCloseResult(null);
        fetchShifts();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const handleOpenConfig = () => {
        setConfigShifts(shiftSchedule.length > 0
            ? shiftSchedule.map(s => ({ ...s }))
            : [{ name: "Pagi", startHour: 7, endHour: 15 }, { name: "Sore", startHour: 15, endHour: 21 }, { name: "Malam", startHour: 21, endHour: 7 }]
        );
        setConfigOpen(true);
    };

    const handleSaveConfig = async () => {
        setConfigSaving(true);
        try {
            const res = await fetch("/api/toko/shift-schedule", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ unitType, schedule: configShifts }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success(json.message);
            setConfigOpen(false);
            fetchShifts();
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan konfigurasi shift");
        } finally {
            setConfigSaving(false);
        }
    };

    const updateConfigShift = (index: number, field: string, value: string | number) => {
        setConfigShifts(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    };

    const addConfigShift = () => {
        setConfigShifts(prev => [...prev, { name: "", startHour: 0, endHour: 0 }]);
    };

    const removeConfigShift = (index: number) => {
        setConfigShifts(prev => prev.filter((_, i) => i !== index));
    };

    const handleEditCash = async () => {
        if (!editCashShiftId) return;
        const raw = editCashValue.replace(/\D/g, "");
        if (!raw) return toast.error("Masukkan jumlah uang fisik");
        setEditCashSaving(true);
        try {
            const res = await fetch(`/api/toko/shifts/${editCashShiftId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ closingCash: parseInt(raw) }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            toast.success(json.message);
            setEditCashOpen(false);
            setEditCashValue("");
            // Refresh detail if open
            if (detailOpen && detailData?.shift?.id === editCashShiftId) {
                fetchShiftDetail(editCashShiftId);
            }
            fetchShifts();
        } catch (err: any) {
            toast.error(err.message || "Gagal mengedit closingCash");
        } finally {
            setEditCashSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Shift Kasir"
                    description="Buka dan tutup shift untuk pencatatan kas harian"
                    backHref={isResto ? "/resto/kasir" : unitType === "cafe_lsp" ? "/cafe-lsp/kasir" : unitType === "playstation" ? "/play-station/kasir" : "/toko/kasir"}
                />
                {isAdmin && (
                    <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={handleOpenConfig}>
                        <Settings className="h-4 w-4" />
                        Atur Jadwal Shift
                    </Button>
                )}
            </div>

            {/* ── ACTIVE SHIFT ───────────────────────────────────── */}
            {activeShift ? (
                <div className="rounded-xl border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                <PlayCircle className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-green-800 dark:text-green-200">
                                    Shift {activeShift.shiftName} — AKTIF
                                </h3>
                                <p className="text-sm text-green-600 dark:text-green-400">
                                    <User className="inline h-3.5 w-3.5 mr-1" />
                                    {activeShift.cashierDisplayName || activeShift.userName} • Dibuka {formatDateTime(activeShift.startedAt)}
                                </p>
                            </div>
                        </div>
                        <Badge variant="default" className="bg-green-600 text-lg px-4 py-1">
                            OPEN
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard
                            icon={<Banknote className="h-4 w-4" />}
                            label="Modal Awal"
                            value={formatRp(activeShift.openingCash)}
                            color="blue"
                        />
                        <StatCard
                            icon={<DollarSign className="h-4 w-4" />}
                            label="Transaksi Tunai"
                            value={formatRp(activeShift.totalSalesCash)}
                            color="green"
                        />
                        <StatCard
                            icon={<QrCode className="h-4 w-4" />}
                            label="Transaksi QRIS"
                            value={formatRp(activeShift.totalSalesQris)}
                            color="purple"
                        />
                        <StatCard
                            icon={<CreditCard className="h-4 w-4" />}
                            label="Kredit (Pot.Gaji)"
                            value={formatRp(activeShift.totalSalesCredit)}
                            color="orange"
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            variant="destructive"
                            size="lg"
                            onClick={() => setCloseDialog(true)}
                            className="gap-2"
                        >
                            <StopCircle className="h-5 w-5" />
                            Tutup Shift & Serah Terima Kas
                        </Button>
                    </div>
                </div>
            ) : (
                /* ── BUKA SHIFT BARU ──────────────────────────────── */
                <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Belum Ada Shift Aktif</h3>
                            <p className="text-sm text-muted-foreground">
                                Silakan buka shift baru untuk mulai transaksi
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
                        <div>
                            <Label>Shift *</Label>
                            <Select value={shiftName} onValueChange={setShiftName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih shift" />
                                </SelectTrigger>
                                <SelectContent>
                                    {shiftOptions.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Modal Awal (Rp)</Label>
                            <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Contoh: 500000"
                                value={openingCash}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, "");
                                    setOpeningCash(raw ? parseInt(raw).toLocaleString("id-ID") : "");
                                }}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Jumlah uang tunai di laci kas saat mulai shift
                            </p>
                        </div>
                    </div>

                    <Button
                        size="lg"
                        className="gap-2"
                        onClick={handleOpenShift}
                        disabled={opening || !shiftName}
                    >
                        {opening ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <PlayCircle className="h-5 w-5" />
                        )}
                        Mulai Shift {shiftName}
                    </Button>
                </div>
            )}

            {/* ── RIWAYAT SHIFT ────────────────────────────────── */}
            {history.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Riwayat Shift Terakhir
                    </h3>
                    <div className="space-y-2">
                        {history.map((s) => (
                            <div
                                key={s.id}
                                className="rounded-lg border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => fetchShiftDetail(s.id)}
                            >
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">{s.shiftName}</Badge>
                                        <span className="text-sm font-medium">
                                            {s.cashierDisplayName || s.userName}
                                        </span>
                                        {s.closedByUserId && (
                                            <Badge variant="outline" className="text-xs">
                                                Ditutup oleh Admin
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDateTime(s.startedAt)}
                                        {s.endedAt && (
                                            <>
                                                {" "}
                                                <ArrowRight className="inline h-3 w-3" />{" "}
                                                {formatDateTime(s.endedAt)}
                                            </>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="text-center">
                                        <p className="text-muted-foreground text-xs">Transaksi</p>
                                        <p className="font-bold">{s.totalTransactions}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-muted-foreground text-xs">Total Penjualan</p>
                                        <p className="font-bold text-green-600">
                                            {formatRp(s.totalSalesCash + s.totalSalesQris + s.totalSalesCredit)}
                                        </p>
                                    </div>
                                    {s.cashDifference != null && (
                                        <div className="text-center">
                                            <p className="text-muted-foreground text-xs">Selisih Kas</p>
                                            <p
                                                className={`font-bold ${
                                                    s.cashDifference === 0
                                                        ? "text-green-600"
                                                        : s.cashDifference > 0
                                                        ? "text-blue-600"
                                                        : "text-red-600"
                                                }`}
                                            >
                                                {s.cashDifference === 0
                                                    ? "Seimbang"
                                                    : s.cashDifference > 0
                                                    ? `+${formatRp(s.cashDifference)}`
                                                    : formatRp(s.cashDifference)}
                                            </p>
                                        </div>
                                    )}
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── TUTUP SHIFT DIALOG ──────────────────────────── */}
            <Dialog open={closeDialog} onOpenChange={(open) => !open && handleCloseDialogDismiss()}>
                <DialogContent className="max-w-full sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <StopCircle className="h-5 w-5 text-destructive" />
                            Tutup Shift {activeShift?.shiftName}
                        </DialogTitle>
                        <DialogDescription>
                            Hitung uang fisik di laci kas, lalu masukkan jumlahnya di bawah.
                        </DialogDescription>
                    </DialogHeader>

                    {closeResult ? (
                        /* ── Rekap Setelah Tutup ── */
                        <div className="space-y-4">
                            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Modal Awal</span>
                                    <span className="font-medium">{formatRp(closeResult.openingCash)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Penjualan Tunai ({closeResult.totalTransactions} trx)</span>
                                    <span className="font-medium text-green-600">+{formatRp(closeResult.totalSalesCash)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Penjualan QRIS</span>
                                    <span className="font-medium text-purple-600">{formatRp(closeResult.totalSalesQris)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Kredit (Pot. Gaji)</span>
                                    <span className="font-medium text-orange-600">{formatRp(closeResult.totalSalesCredit)}</span>
                                </div>
                                <hr />
                                <div className="flex justify-between font-bold">
                                    <span>Kas Seharusnya (Tunai)</span>
                                    <span>{formatRp(closeResult.expectedCash)}</span>
                                </div>
                                {closeResult.closingCash != null && (
                                    <>
                                        <div className="flex justify-between font-bold">
                                            <span>Kas Fisik (Dihitung)</span>
                                            <span>{formatRp(closeResult.closingCash)}</span>
                                        </div>
                                        <div
                                            className={`flex justify-between font-bold text-lg pt-2 ${
                                                closeResult.cashDifference === 0
                                                    ? "text-green-600"
                                                    : closeResult.cashDifference > 0
                                                    ? "text-blue-600"
                                                    : "text-red-600"
                                            }`}
                                        >
                                            <span className="flex items-center gap-1">
                                                {closeResult.cashDifference === 0 ? (
                                                    <CheckCircle className="h-5 w-5" />
                                                ) : closeResult.cashDifference > 0 ? (
                                                    <TrendingUp className="h-5 w-5" />
                                                ) : (
                                                    <TrendingDown className="h-5 w-5" />
                                                )}
                                                SELISIH
                                            </span>
                                            <span>
                                                {closeResult.cashDifference === 0
                                                    ? "Rp 0 (Seimbang ✅)"
                                                    : formatRp(closeResult.cashDifference)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCloseDialogDismiss} className="w-full">
                                    Selesai
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        /* ── Form Input Closing ── */
                        <div className="space-y-4">
                            {activeShift && (
                                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm space-y-1">
                                    <p>
                                        <span className="text-muted-foreground">Modal Awal:</span>{" "}
                                        <span className="font-bold">{formatRp(activeShift.openingCash)}</span>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">Dibuka:</span>{" "}
                                        {formatDateTime(activeShift.startedAt)}
                                    </p>
                                </div>
                            )}

                            <div>
                                <Label htmlFor="closingCash">Jumlah Uang Fisik di Laci Kas (Rp) *</Label>
                                <Input
                                    id="closingCash"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Hitung uang, lalu masukkan total"
                                    value={closingCash}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/\D/g, "");
                                        setClosingCash(raw ? parseInt(raw).toLocaleString("id-ID") : "");
                                    }}
                                    className="text-lg font-bold"
                                />
                            </div>

                            <div>
                                <Label htmlFor="closeNotes">Catatan (Opsional)</Label>
                                <Textarea
                                    id="closeNotes"
                                    placeholder="Contoh: Kembalian Rp 5.000 lebih"
                                    value={closeNotes}
                                    onChange={(e) => setCloseNotes(e.target.value)}
                                    rows={2}
                                />
                            </div>

                            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <p className="text-xs">
                                    Setelah shift ditutup, transaksi baru tidak akan masuk ke shift ini.
                                    Pastikan uang sudah dihitung dengan benar.
                                </p>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={handleCloseDialogDismiss} disabled={closing}>
                                    Batal
                                </Button>
                                <Button variant="destructive" onClick={handleCloseShift} disabled={closing} className="gap-2">
                                    {closing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <StopCircle className="h-4 w-4" />
                                    )}
                                    Tutup Shift
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── SHIFT DETAIL DIALOG ─────────────────────────── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                {detailData ? `Detail Shift ${detailData.shift.shiftName}` : "Detail Shift"}
                            </DialogTitle>
                            {detailData && (
                                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handlePrintShiftRecap}>
                                    <Printer className="h-3.5 w-3.5" />
                                    Cetak Rekap
                                </Button>
                            )}
                        </div>
                    </DialogHeader>

                    {detailLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : detailData ? (
                        <div className="space-y-4">
                            {/* Shift Info */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Kasir</p>
                                    <p className="font-medium">{detailData.shift.userName}</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Waktu</p>
                                    <p className="font-medium text-sm">
                                        {formatDateTime(detailData.shift.startedAt)}
                                        {detailData.shift.endedAt && (
                                            <> <ArrowRight className="inline h-3 w-3" /> {formatDateTime(detailData.shift.endedAt)}</>
                                        )}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-blue-50 p-3">
                                    <p className="text-xs text-muted-foreground">Modal Awal</p>
                                    <p className="font-bold text-blue-600">{formatRp(detailData.shift.openingCash)}</p>
                                </div>
                                <div className="rounded-lg bg-green-50 p-3">
                                    <p className="text-xs text-muted-foreground">Total Pendapatan</p>
                                    <p className="font-bold text-green-600">{formatRp(detailData.summary.totalRevenue)}</p>
                                </div>
                            </div>

                            {/* Payment breakdown */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-lg border p-3 flex items-center gap-3">
                                    <Banknote className="h-5 w-5 text-emerald-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">Tunai</p>
                                        <p className="font-bold text-sm truncate">{formatRp(detailData.summary.totalCash)}</p>
                                    </div>
                                </div>
                                <div className="rounded-lg border p-3 flex items-center gap-3">
                                    <QrCode className="h-5 w-5 text-blue-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">QRIS</p>
                                        <p className="font-bold text-sm truncate">{formatRp(detailData.summary.totalQris)}</p>
                                    </div>
                                </div>
                                <div className="rounded-lg border p-3 flex items-center gap-3">
                                    <CreditCard className="h-5 w-5 text-orange-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">Potong Gaji</p>
                                        <p className="font-bold text-sm truncate">{formatRp(detailData.summary.totalCredit)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Cash reconciliation (if closed) */}
                            {detailData.shift.status === "closed" && detailData.shift.cashDifference != null && (
                                <div className={`rounded-lg p-3 border-2 ${
                                    detailData.shift.cashDifference === 0
                                        ? "border-green-200 bg-green-50"
                                        : "border-red-200 bg-red-50"
                                }`}>
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-sm">Selisih Kas</span>
                                        <span className={`font-bold text-lg ${
                                            detailData.shift.cashDifference === 0 ? "text-green-600" : "text-red-600"
                                        }`}>
                                            {detailData.shift.cashDifference === 0
                                                ? "Seimbang"
                                                : formatRp(detailData.shift.cashDifference)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                                        <span>Modal + Tunai: {formatRp(detailData.shift.expectedCash || 0)}</span>
                                        <div className="flex items-center gap-2">
                                            <span>Fisik: {detailData.shift.closingCash != null ? formatRp(detailData.shift.closingCash) : "-"}</span>
                                            {isAdmin && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-6 px-2 text-[11px] gap-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditCashShiftId(detailData.shift.id);
                                                        setEditCashValue(
                                                            detailData.shift.closingCash != null
                                                                ? Number(detailData.shift.closingCash).toLocaleString("id-ID")
                                                                : ""
                                                        );
                                                        setEditCashOpen(true);
                                                    }}
                                                >
                                                    <Save className="h-3 w-3" />
                                                    Edit Fisik
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Transaction Table — compact 5 columns */}
                            <div>
                                <h4 className="text-sm font-semibold mb-2">
                                    Transaksi ({detailData.sales.length} — {detailData.summary.voidedSales} void)
                                </h4>
                                <div className="rounded-lg border overflow-hidden">
                                    <div className="max-h-[300px] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-xs w-[140px]">No. Transaksi</TableHead>
                                                    <TableHead className="text-xs w-[60px]">Waktu</TableHead>
                                                    <TableHead className="text-xs">Info</TableHead>
                                                    <TableHead className="text-xs w-[90px]">Metode</TableHead>
                                                    <TableHead className="text-xs text-right w-[110px]">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {detailData.sales.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                                                            Tidak ada transaksi
                                                        </TableCell>
                                                    </TableRow>
                                                ) : detailData.sales.map((sale: any) => (
                                                    <TableRow key={sale.id} className={sale.isVoided ? "opacity-50" : ""}>
                                                        <TableCell>
                                                            <span className={`font-mono text-xs ${sale.isVoided ? "line-through" : ""}`}>
                                                                {sale.saleNo}
                                                            </span>
                                                            {sale.isVoided && (
                                                                <Badge variant="destructive" className="ml-1 text-[9px]">VOID</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            {new Date(sale.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            <p className="truncate max-w-[200px]">{sale.member?.name || sale.customerName || "Umum"}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {sale.cashierDisplayName || sale.createdBy?.name || "-"} · {sale.items.reduce((s: number, i: any) => s + i.quantity, 0)} item
                                                            </p>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={`text-[10px] ${
                                                                sale.paymentMethod === "cash" ? "border-emerald-300 text-emerald-700" :
                                                                sale.paymentMethod === "qris" ? "border-blue-300 text-blue-700" :
                                                                "border-orange-300 text-orange-700"
                                                            }`}>
                                                                {sale.paymentMethod === "cash" ? "Tunai" : sale.paymentMethod === "qris" ? "QRIS" : "Potong Gaji"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium text-xs">
                                                            {formatRp(sale.totalAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>

                            {/* Top Products */}
                            {detailData.topProducts.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                        <Package className="h-4 w-4" /> Produk Terlaris
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {detailData.topProducts.map((p: any) => (
                                            <div key={p.name} className="rounded-lg border px-3 py-2 text-sm">
                                                <p className="font-medium">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">{p.qty} pcs — {formatRp(p.revenue)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* ── ADMIN SHIFT CONFIG DIALOG ──────────────────────── */}
            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Konfigurasi Jadwal Shift
                        </DialogTitle>
                        <DialogDescription>
                            Atur jam shift untuk unit {unitType}. Perubahan berlaku untuk shift baru.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {configShifts.map((shift, idx) => (
                            <div key={idx} className="flex items-end gap-2">
                                <div className="flex-1">
                                    <Label className="text-xs">Nama Shift</Label>
                                    <Input
                                        value={shift.name}
                                        onChange={(e) => updateConfigShift(idx, "name", e.target.value)}
                                        placeholder="Nama"
                                        className="h-9"
                                    />
                                </div>
                                <div className="w-20">
                                    <Label className="text-xs">Jam Mulai</Label>
                                    <Select
                                        value={String(shift.startHour)}
                                        onValueChange={(v) => updateConfigShift(idx, "startHour", parseInt(v))}
                                    >
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-20">
                                    <Label className="text-xs">Jam Selesai (exclusive)</Label>
                                    <Select
                                        value={String(shift.endHour)}
                                        onValueChange={(v) => updateConfigShift(idx, "endHour", parseInt(v))}
                                    >
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {configShifts.length > 1 && (
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeConfigShift(idx)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addConfigShift} className="w-full">
                            + Tambah Shift
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfigOpen(false)} disabled={configSaving}>
                            Batal
                        </Button>
                        <Button onClick={handleSaveConfig} disabled={configSaving} className="gap-2">
                            {configSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── ADMIN EDIT CLOSING CASH DIALOG ──────────────────── */}
            <Dialog open={editCashOpen} onOpenChange={setEditCashOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5" />
                            Edit Uang Fisik
                        </DialogTitle>
                        <DialogDescription>
                            Perbaiki jumlah uang fisik yang dihitung kasir saat tutup shift. Selisih kas akan otomatis dihitung ulang.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="editCash">Jumlah Uang Fisik (Rp)</Label>
                            <Input
                                id="editCash"
                                type="text"
                                inputMode="numeric"
                                placeholder="Masukkan jumlah yang benar"
                                value={editCashValue}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, "");
                                    setEditCashValue(raw ? parseInt(raw).toLocaleString("id-ID") : "");
                                }}
                                className="text-lg font-bold"
                            />
                        </div>
                        {editCashValue && (
                            <p className="text-xs text-muted-foreground">
                                Nilai baru: {formatRp(parseInt(editCashValue.replace(/\D/g, "") || "0"))}
                            </p>
                        )}
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 text-amber-800 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            Perubahan ini akan tercatat di log audit.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditCashOpen(false)} disabled={editCashSaving}>
                            Batal
                        </Button>
                        <Button onClick={handleEditCash} disabled={editCashSaving} className="gap-2">
                            {editCashSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: "blue" | "green" | "purple" | "orange";
}) {
    const colors = {
        blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-600",
        green: "bg-green-50 dark:bg-green-950/30 text-green-600",
        purple: "bg-purple-50 dark:bg-purple-950/30 text-purple-600",
        orange: "bg-orange-50 dark:bg-orange-950/30 text-orange-600",
    };
    return (
        <div className={`rounded-lg p-3 ${colors[color]}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium opacity-70 mb-1">
                {icon} {label}
            </div>
            <p className="text-sm font-bold">{value}</p>
        </div>
    );
}
