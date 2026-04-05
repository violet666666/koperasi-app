"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Search, History, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { unitTransactionsApi, memberLookupApi, Member } from "@/lib/api/services";

interface LimitValidation {
    allowed: boolean;
    sisaLimit: number;
    plafonPiutang: number;
    totalTagihan: number;
    sisaLimitSetelah?: number;
    reason?: string;
}

export default function TransaksiUnitPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSearching, setIsSearching] = React.useState(false);
    const [isValidating, setIsValidating] = React.useState(false);
    const [member, setMember] = React.useState<Member | null>(null);
    const [limitInfo, setLimitInfo] = React.useState<LimitValidation | null>(null);

    const [formData, setFormData] = React.useState({
        nrp: "",
        unitType: "",
        description: "",
        amount: "",
        transactionDate: new Date().toISOString().split("T")[0],
        paymentMethod: "cash",
        notes: "",
        carwashCategory: "",
    });

    const formatRupiah = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (name === "amount") setLimitInfo(null);
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => {
            const updates = { ...prev, [name]: value };
            if (name === "carwashCategory") {
                const prices: Record<string, string> = {
                    "Motor": "15000", "Mobil kecil": "35000",
                    "Mobil sedang": "40000", "Mobil besar": "45000", "Mobil jumbo": "50000",
                };
                if (prices[value]) updates.amount = prices[value];
            }
            if (name === "paymentMethod") setLimitInfo(null);
            return updates;
        });
    };

    const searchMember = async () => {
        if (!formData.nrp) { toast.error("Masukkan NRP terlebih dahulu"); return; }
        setIsSearching(true);
        setLimitInfo(null);
        try {
            const response = await memberLookupApi.byNrp(formData.nrp);
            if (response.data) {
                setMember(response.data);
                toast.success("Anggota ditemukan");
            } else {
                setMember(null);
                toast.error("Anggota tidak ditemukan");
            }
        } catch {
            setMember(null);
            toast.error("Anggota tidak ditemukan atau terjadi kesalahan");
        } finally {
            setIsSearching(false);
        }
    };

    // ── Gatekeeper: Validasi 3 Lapis ──────────────────────────────────────────
    const validateLimit = React.useCallback(async () => {
        if (!member || !formData.amount || formData.paymentMethod !== "salary_cut") return;
        setIsValidating(true);
        try {
            const res = await fetch("/api/unit-transactions/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nrp: formData.nrp,
                    amount: Number(formData.amount),
                    unitType: formData.unitType || "umum",
                }),
            });
            const data = await res.json();
            setLimitInfo(data);
        } catch {
            toast.error("Gagal memvalidasi limit piutang");
        } finally {
            setIsValidating(false);
        }
    }, [member, formData.nrp, formData.amount, formData.paymentMethod, formData.unitType]);

    React.useEffect(() => {
        if (member && formData.paymentMethod === "salary_cut" && formData.amount) {
            const t = setTimeout(validateLimit, 600);
            return () => clearTimeout(t);
        } else {
            setLimitInfo(null);
        }
    }, [formData.amount, formData.paymentMethod, member, validateLimit]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") { e.preventDefault(); searchMember(); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!member) { toast.error("Silakan cari anggota berdasarkan NRP terlebih dahulu"); return; }
        if (!formData.unitType) { toast.error("Silakan pilih Unit Transaksi"); return; }
        if (formData.unitType === "cuci_mobil" && !formData.carwashCategory) {
            toast.error("Silakan pilih Kategori Kendaraan"); return;
        }
        if (formData.paymentMethod === "salary_cut" && limitInfo && !limitInfo.allowed) {
            toast.error(limitInfo.reason || "Limit piutang tidak mencukupi. Transaksi ditolak.");
            return;
        }
        if (formData.paymentMethod === "salary_cut" && !limitInfo) {
            toast.error("Harap tunggu validasi limit piutang selesai");
            return;
        }

        setIsLoading(true);
        try {
            const finalDescription = formData.unitType === "cuci_mobil"
                ? `[${formData.carwashCategory}] ${formData.description}`
                : formData.description;

            await unitTransactionsApi.create({
                nrp: formData.nrp,
                unitType: formData.unitType,
                description: finalDescription,
                amount: Number(formData.amount),
                transactionDate: formData.transactionDate,
                isPaid: formData.paymentMethod !== "salary_cut",
                paymentMethod: formData.paymentMethod,
                notes: formData.notes,
            });

            toast.success("Transaksi unit berhasil dicatat");
            setFormData(prev => ({
                nrp: "", unitType: "", description: "", amount: "",
                transactionDate: prev.transactionDate,
                paymentMethod: "cash", notes: "", carwashCategory: "",
            }));
            setMember(null);
            setLimitInfo(null);
            toast("Lihat Riwayat Transaksi?", {
                action: { label: "Lihat", onClick: () => router.push("/transaksi-unit/riwayat") }
            });
        } catch {
            toast.error("Gagal mencatat transaksi");
        } finally {
            setIsLoading(false);
        }
    };

    const isSalaryCut = formData.paymentMethod === "salary_cut";
    const isLimitBlocked = isSalaryCut && limitInfo !== null && !limitInfo.allowed;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Input Transaksi Unit"
                description="Catat mutasi transaksi dari berbagai unit PRIMKOPPOL"
                actions={(
                    <Button variant="outline" asChild>
                        <Link href="/transaksi-unit/riwayat">
                            <History className="mr-2 h-4 w-4" />
                            Riwayat Transaksi
                        </Link>
                    </Button>
                )}
            />

            <div className="grid gap-6 md:grid-cols-2">
                {/* Panel Kiri: Form Transaksi */}
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">Form Transaksi</CardTitle>
                        <CardDescription>Masukkan NRP dan detail transaksi</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* NRP */}
                            <div>
                                <Label htmlFor="nrp">NRP Anggota *</Label>
                                <div className="flex mt-1 gap-2">
                                    <Input id="nrp" name="nrp" value={formData.nrp}
                                        onChange={handleChange} onKeyDown={handleKeyDown}
                                        placeholder="Masukkan NRP..." required />
                                    <Button type="button" variant="secondary"
                                        onClick={searchMember} disabled={isSearching || !formData.nrp}>
                                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            {/* Unit */}
                            <div>
                                <Label>Pilih Unit *</Label>
                                <Select value={formData.unitType}
                                    onValueChange={(v) => handleSelectChange("unitType", v)} required>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="toko">Toko / Retail</SelectItem>
                                        <SelectItem value="barbershop">Barbershop</SelectItem>
                                        <SelectItem value="play_station">Play Station</SelectItem>
                                        <SelectItem value="fitness">Fitness Center</SelectItem>
                                        <SelectItem value="cuci_mobil">Cuci Mobil</SelectItem>
                                        <SelectItem value="coffe_latar">Coffe Latar / Resto</SelectItem>
                                        <SelectItem value="fotocopy">FotoCopy & ATK</SelectItem>
                                        <SelectItem value="simpan_pinjam">Simpan Pinjam (Admin Fee)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Carwash */}
                            {formData.unitType === "cuci_mobil" && (
                                <div>
                                    <Label>Kategori Kendaraan *</Label>
                                    <Select value={formData.carwashCategory}
                                        onValueChange={(v) => handleSelectChange("carwashCategory", v)}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Motor">Motor (Rp 15.000)</SelectItem>
                                            <SelectItem value="Mobil kecil">Mobil kecil (Rp 35.000)</SelectItem>
                                            <SelectItem value="Mobil sedang">Mobil sedang (Rp 40.000)</SelectItem>
                                            <SelectItem value="Mobil besar">Mobil besar (Rp 45.000)</SelectItem>
                                            <SelectItem value="Mobil jumbo">Mobil jumbo (Rp 50.000)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Deskripsi */}
                            <div>
                                <Label htmlFor="description">Deskripsi Transaksi *</Label>
                                <Input id="description" name="description" value={formData.description}
                                    onChange={handleChange} placeholder="Cth: Potong Rambut Reguler"
                                    required className="mt-1" />
                            </div>

                            {/* Nominal */}
                            <div>
                                <Label htmlFor="amount">Nominal (Rp) *</Label>
                                <Input id="amount" name="amount" type="number" min="0"
                                    value={formData.amount} onChange={handleChange}
                                    placeholder="0" required className="mt-1" />
                            </div>

                            {/* Metode Pembayaran */}
                            <div>
                                <Label>Metode Pembayaran *</Label>
                                <Select value={formData.paymentMethod}
                                    onValueChange={(v) => handleSelectChange("paymentMethod", v)}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">💵 Tunai</SelectItem>
                                        <SelectItem value="qris">📱 QRIS</SelectItem>
                                        <SelectItem value="salary_cut">✂️ Potong Gaji (Piutang)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* ── Kartu Info Limit (Gatekeeper Visual) ── */}
                            {isSalaryCut && member && (
                                <div className={`rounded-lg border p-3 text-sm space-y-1.5 transition-all ${
                                    isValidating ? "bg-muted/30 border-muted" :
                                    limitInfo?.allowed ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" :
                                    limitInfo ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" :
                                    "bg-muted/30 border-muted"
                                }`}>
                                    {isValidating ? (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Memvalidasi limit piutang...</span>
                                        </div>
                                    ) : limitInfo ? (
                                        <>
                                            <div className="flex items-center gap-2 font-medium">
                                                {limitInfo.allowed
                                                    ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                                    : <ShieldAlert className="h-4 w-4 text-red-600" />}
                                                <span className={limitInfo.allowed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                                                    {limitInfo.allowed ? "Limit Mencukupi — Transaksi Diizinkan" : "Limit Tidak Mencukupi — Transaksi Ditolak"}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mt-1">
                                                <span className="text-muted-foreground">Plafon Piutang</span>
                                                <span className="font-medium">{formatRupiah(limitInfo.plafonPiutang)}</span>
                                                <span className="text-muted-foreground">Total Tagihan Aktif</span>
                                                <span className="font-medium">{formatRupiah(limitInfo.totalTagihan)}</span>
                                                <span className="text-muted-foreground">Sisa Limit</span>
                                                <span className="font-semibold">{formatRupiah(limitInfo.sisaLimit)}</span>
                                                {limitInfo.allowed && limitInfo.sisaLimitSetelah !== undefined && (
                                                    <>
                                                        <span className="text-muted-foreground">Sisa Setelah Transaksi</span>
                                                        <span className="font-semibold text-amber-600">{formatRupiah(limitInfo.sisaLimitSetelah)}</span>
                                                    </>
                                                )}
                                            </div>
                                            {!limitInfo.allowed && (
                                                <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-start gap-1">
                                                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                                    {limitInfo.reason}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-muted-foreground text-xs">Masukkan nominal untuk memeriksa sisa limit piutang.</p>
                                    )}
                                </div>
                            )}

                            {/* Tanggal */}
                            <div>
                                <Label htmlFor="transactionDate">Tanggal Transaksi *</Label>
                                <Input id="transactionDate" name="transactionDate" type="date"
                                    value={formData.transactionDate} onChange={handleChange}
                                    required className="mt-1" />
                            </div>

                            {/* Catatan */}
                            <div>
                                <Label htmlFor="notes">Catatan (Opsional)</Label>
                                <Textarea id="notes" name="notes" value={formData.notes}
                                    onChange={handleChange} placeholder="Catatan tambahan..."
                                    rows={2} className="mt-1" />
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading || !member || isValidating || isLimitBlocked}
                                className="w-full mt-4"
                                variant={isLimitBlocked ? "destructive" : "default"}
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                                ) : isLimitBlocked ? (
                                    <><ShieldAlert className="mr-2 h-4 w-4" />Transaksi Ditolak — Limit Tidak Cukup</>
                                ) : (
                                    <><Save className="mr-2 h-4 w-4" />Simpan Transaksi</>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Panel Kanan: Info Anggota */}
                <div>
                    {member ? (
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader>
                                <CardTitle className="text-lg">Detail Anggota</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {[
                                    { label: "Nama", value: member.name },
                                    { label: "NRP", value: member.nrp || "-" },
                                    { label: "No. Anggota", value: member.memberNo },
                                    { label: "Kesatuan", value: (member as any).occupation || "-" },
                                ].map(({ label, value }) => (
                                    <div key={label} className="grid grid-cols-3 gap-2 py-2 border-b">
                                        <div className="text-sm text-muted-foreground">{label}</div>
                                        <div className="col-span-2 font-medium">{value}</div>
                                    </div>
                                ))}
                                <div className="grid grid-cols-3 gap-2 py-2 border-b">
                                    <div className="text-sm text-muted-foreground">Status</div>
                                    <div className="col-span-2">
                                        <Badge variant={member.status === "active" ? "default" : "destructive"}>
                                            {member.status === "active" ? "Aktif" : "Non-Aktif"}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Sisa Limit Piutang — tampil jika Potong Gaji dipilih */}
                                {isSalaryCut && limitInfo && (
                                    <div className={`rounded-md p-3 mt-1 text-center transition-all ${
                                        limitInfo.allowed
                                            ? "bg-emerald-100 dark:bg-emerald-950/30"
                                            : "bg-red-100 dark:bg-red-950/30"
                                    }`}>
                                        <p className="text-xs text-muted-foreground mb-1">Sisa Limit Piutang</p>
                                        <p className={`text-2xl font-bold ${
                                            limitInfo.allowed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                                        }`}>
                                            {formatRupiah(limitInfo.sisaLimit)}
                                        </p>
                                        <p className="text-xs mt-1 text-muted-foreground">
                                            dari plafon {formatRupiah(limitInfo.plafonPiutang)}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                            <Search className="h-10 w-10 mb-4 opacity-50" />
                            <p>Masukkan NRP untuk melihat detail anggota</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
