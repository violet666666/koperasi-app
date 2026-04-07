"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    ShoppingCart, Banknote, QrCode, CreditCard, Clock,
    TrendingUp, ArrowRight, CheckCircle2, AlertCircle, Store,
    Upload, Trash2, ImagePlus
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface UnitStats {
    unit: string;
    unitType: string;
    qrisUrl: string | null;
    today: {
        total: number; count: number;
        cash: number; qris: number; salaryCut: number; pending: number;
    };
    weeklyChart: { date: string; total: number; count: number }[];
    recentTransactions: {
        id: number; no: string; amount: number; method: string;
        desc: string; date: string; isPaid: boolean; memberName: string | null;
    }[];
}

const METHOD_LABEL: Record<string, string> = {
    cash: "Tunai", qris: "QRIS", salary_cut: "Potong Gaji", credit: "Kredit",
};
const METHOD_COLOR: Record<string, string> = {
    cash: "bg-emerald-100 text-emerald-700",
    qris: "bg-blue-100 text-blue-700",
    salary_cut: "bg-orange-100 text-orange-700",
    credit: "bg-orange-100 text-orange-700",
};

interface KasirDashboardProps {
    unitType: string;
    roleName: string; // "kasir" | "admin"
}

export function KasirDashboard({ unitType, roleName }: KasirDashboardProps) {
    const [stats, setStats] = React.useState<UnitStats | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!unitType) return;
        fetch(`/api/unit-layanan/stats?unitType=${unitType}`)
            .then(r => r.json())
            .then(json => { if (json.data) setStats(json.data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [unitType]);

    const roleBadge = roleName === "admin" ? "Admin Unit" : "Kasir";
    const posLink = unitType === "toko" || unitType === "coffe_latar" || unitType === "resto"
        ? "/toko/kasir"
        : `/unit/${unitType ? unitType.replace(/_/g, '-') : 'layanan'}/kasir`;
    const isAdmin = roleName === "admin";

    // QRIS management state
    const [showQrisModal, setShowQrisModal] = React.useState(false);
    const [qrisPreview, setQrisPreview] = React.useState<string | null>(null);
    const [qrisFile, setQrisFile] = React.useState<File | null>(null);
    const [isUploadingQris, setIsUploadingQris] = React.useState(false);
    const [imageKey, setImageKey] = React.useState(Date.now());
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleQrisFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast.error("Ukuran file maksimal 2MB"); return; }
        setQrisFile(file);
        setQrisPreview(URL.createObjectURL(file));
    };

    const uploadQris = async () => {
        if (!qrisFile || !unitType) return;
        setIsUploadingQris(true);
        try {
            const formData = new FormData();
            formData.append("file", qrisFile as Blob);
            formData.append("unitType", unitType);
            const res = await fetch("/api/unit-layanan/qris", { method: "POST", body: formData });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal upload");
            toast.success(json.message);
            setShowQrisModal(false);
            setQrisFile(null);
            setQrisPreview(null);
            setImageKey(Date.now());
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsUploadingQris(false);
        }
    };

    const deleteQris = () => {
        if (!unitType) return;
        // Fix INP by releasing the main thread before native confirm()
        setTimeout(async () => {
            if (!window.confirm("Yakin ingin menghapus gambar QRIS unit ini?")) return;
            setIsUploadingQris(true);
            try {
                const res = await fetch(`/api/unit-layanan/qris?unitType=${unitType}`, { method: "DELETE" });
                const json = await res.json();
                if (!res.ok) throw new Error(json.message);
                toast.success(json.message);
                setShowQrisModal(false);
                setImageKey(Date.now());
            } catch (err: any) {
                toast.error(err.message);
            } finally {
                setIsUploadingQris(false);
            }
        }, 50);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Store className="h-5 w-5 text-primary" />
                        <h1 className="text-2xl font-bold">
                            {loading ? "Memuat..." : stats?.unit ?? "Dashboard Unit"}
                        </h1>
                        <Badge variant="outline" className="text-xs">{roleBadge}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Ringkasan transaksi hari ini, {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                </div>
                <Button asChild size="lg" className="gap-2 shadow-md">
                    <Link href={posLink}>
                        <ShoppingCart className="h-5 w-5" />
                        Buka Kasir POS
                    </Link>
                </Button>
            </div>

            {/* Today's KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                    label="Total Hari Ini"
                    value={loading ? null : formatCurrency(stats?.today.total ?? 0)}
                    sub={`${stats?.today.count ?? 0} transaksi`}
                    bg="bg-emerald-50 border-emerald-200"
                />
                <StatCard
                    icon={<Banknote className="h-5 w-5 text-blue-600" />}
                    label="Tunai"
                    value={loading ? null : formatCurrency(stats?.today.cash ?? 0)}
                    bg="bg-blue-50 border-blue-200"
                />
                <StatCard
                    icon={<QrCode className="h-5 w-5 text-violet-600" />}
                    label="QRIS"
                    value={loading ? null : formatCurrency(stats?.today.qris ?? 0)}
                    bg="bg-violet-50 border-violet-200"
                />
                <StatCard
                    icon={<CreditCard className="h-5 w-5 text-orange-600" />}
                    label="Potong Gaji"
                    value={loading ? null : formatCurrency(stats?.today.salaryCut ?? 0)}
                    sub={stats?.today.pending ? `${stats.today.pending} belum lunas` : undefined}
                    bg="bg-orange-50 border-orange-200"
                />
            </div>

            {/* Charts + Recent */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Weekly Bar Chart */}
                <Card className="md:col-span-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Transaksi 7 Hari Terakhir</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-[200px] w-full" />
                        ) : (
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats?.weeklyChart ?? []} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b7280" }}
                                            tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={45} />
                                        <Tooltip
                                            formatter={(v: any) => [formatCurrency(Number(v)), "Total"]}
                                            contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                        />
                                        <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card className="md:col-span-2">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Riwayat Terbaru</CardTitle>
                        <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                            <Link href={unitType === "toko" ? "/transaksi-unit/riwayat?unitType=toko" : "/transaksi-unit/riwayat"}>Semua <ArrowRight className="h-3 w-3" /></Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                            </div>
                        ) : !stats?.recentTransactions?.length ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Clock className="h-10 w-10 text-muted-foreground/40 mb-2" />
                                <p className="text-sm text-muted-foreground">Belum ada transaksi</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Mulai kasir untuk mencatat transaksi</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {stats.recentTransactions.slice(0, 6).map(t => (
                                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                                        <div className="flex-shrink-0">
                                            {t.isPaid
                                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                : <AlertCircle className="h-4 w-4 text-orange-500" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{t.desc || t.no}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {t.memberName || "Walk-in"} · {new Date(t.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} {new Date(t.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs font-bold">{formatCurrency(t.amount)}</p>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${METHOD_COLOR[t.method] ?? "bg-gray-100 text-gray-600"}`}>
                                                {METHOD_LABEL[t.method] ?? t.method}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* QRIS Management Card - only for Admin Unit */}
            {isAdmin && (
                <Card className="border-dashed border-blue-200 bg-blue-50/30">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <QrCode className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-sm">Kelola QRIS Unit</p>
                            <p className="text-xs text-muted-foreground">Upload atau hapus gambar QRIS untuk pembayaran di unit ini</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowQrisModal(true)}
                        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <ImagePlus className="h-4 w-4" />
                        Kelola QRIS
                    </button>
                </CardContent>
            </Card>
            )}

            {/* QRIS Upload/Delete Modal */}
            <Dialog open={showQrisModal} onOpenChange={setShowQrisModal}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-blue-600" />
                        Kelola QRIS — {unitType}
                    </DialogTitle>
                    <DialogDescription>
                        Unggah gambar barcode QRIS unit Anda. Kasir akan menampilkan gambar ini saat melakukan pembayaran QRIS.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Preview existing / new */}
                    <div className="border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/50 p-4 flex flex-col items-center justify-center min-h-[200px]">
                        <div className="border-2 border-dashed rounded-lg p-2 h-40 flex items-center justify-center bg-gray-50 relative group">
                            {(qrisPreview || stats?.qrisUrl) && (
                                <img
                                    src={qrisPreview || stats?.qrisUrl || ""}
                                    alt="QRIS"
                                    className="object-contain w-full h-full p-2"
                                />
                            )}
                        </div>
                        {!(qrisPreview || stats?.qrisUrl) && (
                            <p className="text-sm text-muted-foreground mt-2">Belum ada QRIS</p>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={handleQrisFileSelect}
                    />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 text-sm text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors text-center"
                    >
                        <Upload className="h-5 w-5 mx-auto mb-1" />
                        {qrisFile?.name ? qrisFile.name : "Klik untuk memilih file gambar QRIS (PNG/JPG, maks. 2MB)"}
                    </button>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <button
                        onClick={deleteQris}
                        className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 px-3 py-2 rounded border border-red-200 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                        Hapus QRIS
                    </button>
                    <div className="flex gap-2 ml-auto">
                        <button onClick={() => setShowQrisModal(false)} className="px-4 py-2 text-sm border rounded hover:bg-muted transition-colors">Batal</button>
                        <button
                            onClick={uploadQris}
                            disabled={!qrisFile || isUploadingQris}
                            className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {isUploadingQris ? "Mengunggah..." : (<><Upload className="h-4 w-4" />Simpan QRIS</>)}
                        </button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
    );
}

function StatCard({ icon, label, value, sub, bg }: {
    icon: React.ReactNode; label: string; value: string | null; sub?: string; bg?: string;
}) {
    return (
        <Card className={`border ${bg ?? ""}`}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    {icon}
                </div>
                {value === null
                    ? <Skeleton className="h-7 w-24" />
                    : <p className="text-xl font-bold tabular-nums">{value}</p>
                }
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </CardContent>
        </Card>
    );
}
