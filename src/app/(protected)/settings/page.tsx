"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Settings,
    Bell,
    Shield,
    Database,
    Palette,
    Save,
    Loader2,
    Download,
    Upload,
    RefreshCw,
    AlertTriangle,
    Trash2,
    QrCode,
    Camera
} from "lucide-react";
import { processDataReset } from "@/lib/actions/reset.action";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/hooks";
import { useRouter } from "next/navigation";

interface AppSettings {
    // General
    appName: string;
    fiscalYearStart: string;
    currency: string;
    dateFormat: string;
    // Notifications
    emailNotifications: boolean;
    loanApprovalAlert: boolean;
    paymentReminderDays: number;
    // Security
    sessionTimeout: number;
    requireTwoFactor: boolean;
    passwordExpireDays: number;
    // Backup
    autoBackup: boolean;
    backupFrequency: string;
    lastBackup: string;
}

export default function SettingsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [settings, setSettings] = React.useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    
    // States for Data Reset
    const [resetStoreData, setResetStoreData] = React.useState(false);
    const [resetLoanData, setResetLoanData] = React.useState(false);
    const [resetSavingsData, setResetSavingsData] = React.useState(false);
    const [resetJournalData, setResetJournalData] = React.useState(false);
    const [resetMemberData, setResetMemberData] = React.useState(false);
    const [resetTunkinData, setResetTunkinData] = React.useState(false);
    const [resetGajiData, setResetGajiData] = React.useState(false);
    const [resetKasBankData, setResetKasBankData] = React.useState(false);
    const [resetConfirmation, setResetConfirmation] = React.useState("");
    const [isResetting, setIsResetting] = React.useState(false);

    React.useEffect(() => {
        if (user && user.role.name === "kasir") {
            toast.error("Akses Ditolak", { description: "Anda tidak memiliki akses ke pengaturan sistem." });
            router.push("/dashboard");
            return;
        }

        async function fetchData() {
            setIsLoading(true);
            try {
                // Ambil data profil koperasi dari API (nama, dll)
                let apiName = "PRIMKOPPOL Digital";
                try {
                    const coopRes = await fetch("/api/settings/cooperative");
                    if (coopRes.ok) {
                        const coopJson = await coopRes.json();
                        apiName = coopJson.data?.name || apiName;
                    }
                } catch (_) { /* non-fatal */ }

                // Gabungkan dengan overrides yang disimpan di localStorage
                const saved = typeof window !== "undefined"
                    ? JSON.parse(localStorage.getItem("app_settings") || "{}")
                    : {};

                setSettings({
                    appName: saved.appName ?? apiName,
                    fiscalYearStart: saved.fiscalYearStart ?? "01",
                    currency: saved.currency ?? "IDR",
                    dateFormat: saved.dateFormat ?? "dd/MM/yyyy",
                    emailNotifications: saved.emailNotifications ?? true,
                    loanApprovalAlert: saved.loanApprovalAlert ?? true,
                    paymentReminderDays: saved.paymentReminderDays ?? 7,
                    sessionTimeout: saved.sessionTimeout ?? 30,
                    requireTwoFactor: saved.requireTwoFactor ?? false,
                    passwordExpireDays: saved.passwordExpireDays ?? 90,
                    autoBackup: saved.autoBackup ?? true,
                    backupFrequency: saved.backupFrequency ?? "daily",
                    lastBackup: saved.lastBackup ?? new Date().toISOString(),
                });
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        
        if (user && user.role.name !== "kasir") {
            fetchData();
        }
    }, [user, router]);

    // Handle save — simpan ke localStorage (pengaturan belum ada tabel DB-nya)
    const handleSave = async () => {
        if (!settings) return;

        // Validasi
        if (!settings.appName.trim()) {
            toast.error("Nama Koperasi tidak boleh kosong");
            return;
        }

        setIsSaving(true);
        try {
            // Only update localstorage since backend /api/settings/cooperative is currently hardcoded dummy
            localStorage.setItem("app_settings", JSON.stringify(settings));
            toast.success("Pengaturan berhasil disimpan");
        } catch (error) {
            toast.error("Gagal menyimpan pengaturan");
        } finally {
            setIsSaving(false);
        }
    };

    // --- State and Functions for QRIS Upload ---
    const [qrisUnitType, setQrisUnitType] = React.useState("toko");
    const [isUploadingQris, setIsUploadingQris] = React.useState(false);
    const [qrisPreviewKey, setQrisPreviewKey] = React.useState(Date.now().toString()); // For forcing image reloads
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Harus berupa file gambar (JPG/PNG)");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Ukuran maksimal file adalah 2MB");
            return;
        }

        setIsUploadingQris(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("unitType", qrisUnitType);

        try {
            const res = await fetch("/api/upload-qris", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                toast.success("QRIS unit berhasil diperbarui");
                setQrisPreviewKey(Date.now().toString()); // reload image
            } else {
                toast.error("Terjadi kesalahan saat mengupload QRIS");
            }
        } catch (error) {
            toast.error("Gagal terhubung ke server");
        } finally {
            setIsUploadingQris(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    // -------------------------------------------

    // Handle backup — info bahwa fitur server-side backup belum diimplementasikan
    const handleBackup = async () => {
        toast.info("Fitur backup server-side belum tersedia.", {
            description: "Silakan backup database melalui panel hosting Anda (misalnya Railway/Vercel dashboard).",
        });
    };

    const handleResetData = async () => {
        if (resetConfirmation !== "RESET-DATA") {
            toast.error("Kata kunci konfirmasi tidak cocok.");
            return;
        }
        
        if (!resetStoreData && !resetLoanData && !resetSavingsData && !resetJournalData && !resetMemberData && !resetTunkinData && !resetGajiData && !resetKasBankData) {
            toast.error("Pilih minimal satu tipe data yang akan dihapus.");
            return;
        }

        setIsResetting(true);
        try {
            const result = await processDataReset({
                resetStoreData,
                resetLoanData,
                resetSavingsData,
                resetJournalData,
                resetMemberData,
                resetTunkinData,
                resetGajiData,
                resetKasBankData
            });

            if (result.success) {
                toast.success(result.message);
                // Reset inputs
                setResetStoreData(false);
                setResetLoanData(false);
                setResetSavingsData(false);
                setResetJournalData(false);
                setResetMemberData(false);
                setResetKasBankData(false);
                setResetConfirmation("");
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("Terjadi kesalahan saat memproses reset data.");
        } finally {
            setIsResetting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeader title="Pengaturan" description="Konfigurasi aplikasi" />
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-96 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (user?.role?.name === "kasir") {
        return null;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pengaturan"
                description="Konfigurasi aplikasi dan sistem"
                actions={
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Simpan Pengaturan
                    </Button>
                }
            />

            {settings && (
                <Tabs defaultValue="general" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
                        <TabsTrigger value="general">
                            <Settings className="mr-2 h-4 w-4 hidden sm:inline" />
                            Umum
                        </TabsTrigger>
                        <TabsTrigger value="notifications">
                            <Bell className="mr-2 h-4 w-4 hidden sm:inline" />
                            Notifikasi
                        </TabsTrigger>
                        <TabsTrigger value="security">
                            <Shield className="mr-2 h-4 w-4 hidden sm:inline" />
                            Keamanan
                        </TabsTrigger>
                        <TabsTrigger value="backup">
                            <Database className="mr-2 h-4 w-4 hidden sm:inline" />
                            Backup & Restore
                        </TabsTrigger>
                        <TabsTrigger 
                            value="qris"
                            className="data-[state=active]:bg-violet-600 data-[state=active]:text-white rounded-md transition-all"
                        >
                            <QrCode className="h-4 w-4 mr-2 hidden sm:block" />
                            QRIS Unit
                        </TabsTrigger>
                        <TabsTrigger value="reset">
                            <AlertTriangle className="mr-2 h-4 w-4 hidden sm:inline text-red-500" />
                            <span className="text-red-500 font-medium">Reset Data</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* General Settings */}
                    <TabsContent value="general">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Settings className="h-5 w-5" />
                                    Pengaturan Umum
                                </CardTitle>
                                <CardDescription>
                                    Konfigurasi dasar aplikasi
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <Label>Nama Aplikasi</Label>
                                    <Input
                                        value={settings.appName}
                                        onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Awal Tahun Buku</Label>
                                    <Select
                                        value={settings.fiscalYearStart}
                                        onValueChange={(v) => setSettings({ ...settings, fiscalYearStart: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["01", "04", "07", "10"].map((m) => (
                                                <SelectItem key={m} value={m}>
                                                    {new Date(2000, parseInt(m) - 1).toLocaleDateString("id-ID", { month: "long" })}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Mata Uang</Label>
                                    <Select
                                        value={settings.currency}
                                        onValueChange={(v) => setSettings({ ...settings, currency: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="IDR">IDR - Rupiah</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Format Tanggal</Label>
                                    <Select
                                        value={settings.dateFormat}
                                        onValueChange={(v) => setSettings({ ...settings, dateFormat: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                                            <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                                            <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Notification Settings */}
                    <TabsContent value="notifications">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Bell className="h-5 w-5" />
                                    Pengaturan Notifikasi
                                </CardTitle>
                                <CardDescription>
                                    Konfigurasi peringatan dan pemberitahuan
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Notifikasi Email</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Kirim notifikasi via email
                                        </p>
                                    </div>
                                    <Switch
                                        checked={settings.emailNotifications}
                                        onCheckedChange={(v) => setSettings({ ...settings, emailNotifications: v })}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Alert Persetujuan Pinjaman</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Notifikasi saat ada pengajuan baru
                                        </p>
                                    </div>
                                    <Switch
                                        checked={settings.loanApprovalAlert}
                                        onCheckedChange={(v) => setSettings({ ...settings, loanApprovalAlert: v })}
                                    />
                                </div>
                                <div>
                                    <Label>Pengingat Pembayaran (hari sebelum jatuh tempo)</Label>
                                    <Input
                                        type="number"
                                        className="w-32 mt-2"
                                        value={settings.paymentReminderDays}
                                        onChange={(e) => setSettings({ ...settings, paymentReminderDays: Number(e.target.value) })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Security Settings */}
                    <TabsContent value="security">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    Pengaturan Keamanan
                                </CardTitle>
                                <CardDescription>
                                    Konfigurasi keamanan dan akses
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label>Session Timeout (menit)</Label>
                                    <Input
                                        type="number"
                                        className="w-32 mt-2"
                                        value={settings.sessionTimeout}
                                        onChange={(e) => setSettings({ ...settings, sessionTimeout: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Two-Factor Authentication</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Wajibkan 2FA untuk semua user
                                        </p>
                                    </div>
                                    <Switch
                                        checked={settings.requireTwoFactor}
                                        onCheckedChange={(v) => setSettings({ ...settings, requireTwoFactor: v })}
                                    />
                                </div>
                                <div>
                                    <Label>Masa Berlaku Password (hari)</Label>
                                    <Input
                                        type="number"
                                        className="w-32 mt-2"
                                        value={settings.passwordExpireDays}
                                        onChange={(e) => setSettings({ ...settings, passwordExpireDays: Number(e.target.value) })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Backup Settings */}
                    <TabsContent value="backup">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Database className="h-5 w-5" />
                                    Backup & Restore
                                </CardTitle>
                                <CardDescription>
                                    Kelola backup data sistem
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Backup Otomatis</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Backup database secara berkala
                                        </p>
                                    </div>
                                    <Switch
                                        checked={settings.autoBackup}
                                        onCheckedChange={(v) => setSettings({ ...settings, autoBackup: v })}
                                    />
                                </div>
                                <div>
                                    <Label>Frekuensi Backup</Label>
                                    <Select
                                        value={settings.backupFrequency}
                                        onValueChange={(v) => setSettings({ ...settings, backupFrequency: v })}
                                    >
                                        <SelectTrigger className="w-48 mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hourly">Setiap Jam</SelectItem>
                                            <SelectItem value="daily">Harian</SelectItem>
                                            <SelectItem value="weekly">Mingguan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="pt-4 border-t">
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Backup terakhir: {new Date(settings.lastBackup).toLocaleString("id-ID")}
                                    </p>
                                    <div className="flex gap-4 flex-wrap">
                                        <Button onClick={handleBackup}>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Backup Sekarang
                                        </Button>
                                        <Button variant="outline">
                                            <Download className="mr-2 h-4 w-4" />
                                            Download Backup
                                        </Button>
                                        <Button variant="outline">
                                            <Upload className="mr-2 h-4 w-4" />
                                            Restore
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* QRIS Tab */}
                    <TabsContent value="qris">
                        <Card className="border-0 shadow-md">
                            <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <QrCode className="h-5 w-5 text-violet-600" />
                                    Manajemen QRIS Dinamis Per Unit
                                </CardTitle>
                                <CardDescription>
                                    Atur gambar kode QRIS untuk masing-masing unit layanan (Toko, Cuci Mobil, Resto, dll).
                                    QRIS ini akan ditampilkan saat Kasir memilih metode pembayaran QRIS.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="space-y-4 max-w-lg">
                                    <div className="space-y-2">
                                        <Label>Pilih Unit Layanan</Label>
                                        <Select value={qrisUnitType} onValueChange={setQrisUnitType}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih unit" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="toko">Toko PRIMKOPPOL</SelectItem>
                                                <SelectItem value="cuci_mobil">Cuci Mobil</SelectItem>
                                                <SelectItem value="barbershop">Barbershop</SelectItem>
                                                <SelectItem value="fitness">Fitness</SelectItem>
                                                <SelectItem value="resto_cafe">Resto & Cafe</SelectItem>
                                                <SelectItem value="playstation">Playstation</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="pt-4 border-t">
                                        <Label className="mb-4 block">Pratinjau QRIS Aktif ({qrisUnitType})</Label>
                                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl bg-zinc-50 dark:bg-zinc-900 overflow-hidden relative min-h-[300px]">
                                            <img 
                                                src={`/uploads/qris/qris-${qrisUnitType}.png?key=${qrisPreviewKey}`} 
                                                alt={`QRIS ${qrisUnitType}`}
                                                className="max-h-[250px] object-contain shwadow-lg"
                                                onError={(e) => {
                                                    // Jika gambar tidak ditemukan, tampilkan placeholder
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    target.nextElementSibling?.classList.remove('hidden');
                                                    target.nextElementSibling?.classList.add('flex');
                                                }}
                                                onLoad={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'block';
                                                    target.nextElementSibling?.classList.add('hidden');
                                                    target.nextElementSibling?.classList.remove('flex');
                                                }}
                                            />
                                            <div className="hidden flex-col items-center text-muted-foreground">
                                                <QrCode className="h-16 w-16 mb-2 opacity-50" />
                                                <p className="text-sm">Belum ada QRIS untuk unit ini</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <input 
                                            type="file" 
                                            accept="image/png, image/jpeg" 
                                            className="hidden" 
                                            ref={fileInputRef} 
                                            onChange={handleQrisUpload} 
                                        />
                                        <Button 
                                            type="button"
                                            className="w-full gap-2 bg-violet-600 hover:bg-violet-700" 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploadingQris}
                                        >
                                            {isUploadingQris ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                            {isUploadingQris ? "Mengunggah..." : "Unggah Gambar QR Code Baru"}
                                        </Button>
                                        <p className="text-xs text-center text-muted-foreground mt-2">
                                            Format yang didukung: PNG, JPG (Maks 2MB)
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Reset Data Settings */}
                    <TabsContent value="reset">
                        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/10">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                                    <AlertTriangle className="h-5 w-5" />
                                    Danger Zone: Reset & Hapus Data
                                </CardTitle>
                                <CardDescription className="text-red-600/80 dark:text-red-400/80 border-l-4 border-red-500 pl-4 py-2 mt-2 bg-red-100 dark:bg-red-900/30">
                                    Peringatan! Proses ini bersifat permanen dan tidak dapat dikembalikan. Data yang dihapus akan musnah selamanya. Gunakan fitur ini hanya saat ingin melakukan pembersihan awal atau import data ulang secara massal.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-start space-x-3 p-4 border rounded-md bg-white dark:bg-background">
                                        <Checkbox 
                                            id="reset-store" 
                                            checked={resetStoreData}
                                            onCheckedChange={(checked) => setResetStoreData(checked as boolean)}
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="reset-store" className="font-semibold text-base cursor-pointer">Reset Data Toko</Label>
                                            <p className="text-sm text-muted-foreground">Menghapus semua Produk, Transaksi Penjualan, dan Riwayat Penjualan Toko.</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start space-x-3 p-4 border rounded-md bg-white dark:bg-background">
                                        <Checkbox 
                                            id="reset-loan" 
                                            checked={resetLoanData}
                                            onCheckedChange={(checked) => setResetLoanData(checked as boolean)}
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="reset-loan" className="font-semibold text-base cursor-pointer">Reset Data Pinjaman</Label>
                                            <p className="text-sm text-muted-foreground">Menghapus semua Pengajuan, Pinjaman Aktif, Jadwal Angsuran, dan Pembayaran Pinjaman.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-3 p-4 border rounded-md bg-white dark:bg-background">
                                        <Checkbox 
                                            id="reset-savings" 
                                            checked={resetSavingsData}
                                            onCheckedChange={(checked) => setResetSavingsData(checked as boolean)}
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="reset-savings" className="font-semibold text-base cursor-pointer">Reset Data Simpanan</Label>
                                            <p className="text-sm text-muted-foreground">Menghapus semua Transaksi Setoran dan Penarikan Simpanan, serta Riwayat Tabungan Sejahtera.</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start space-x-3 p-4 border rounded-md bg-white dark:bg-background">
                                        <Checkbox 
                                            id="reset-journal" 
                                            checked={resetJournalData}
                                            onCheckedChange={(checked) => setResetJournalData(checked as boolean)}
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="reset-journal" className="font-semibold text-base cursor-pointer">Reset Data Jurnal Akuntansi</Label>
                                            <p className="text-sm text-muted-foreground">Menghapus semua Kwitansi, Jurnal Umum/Penyesuaian, dan Transaksi Unit Koperasi.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-3 p-4 border rounded-md bg-white dark:bg-background">
                                        <Checkbox 
                                            id="reset-kasbank" 
                                            checked={resetKasBankData}
                                            onCheckedChange={(checked) => setResetKasBankData(checked as boolean)}
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="reset-kasbank" className="font-semibold text-base cursor-pointer text-blue-700 dark:text-blue-400">Reset Data Kas & Bank</Label>
                                            <p className="text-sm text-muted-foreground">Menghapus seluruh rekaman Mutasi Kas & Bank (termasuk hasil dari <strong>Import Buku Kas Excel</strong>). Saldo Kas/Bank akan dikembalikan berstatus 0.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-3 p-4 border rounded-md bg-white dark:bg-background opacity-90">
                                        <Checkbox 
                                            id="reset-member" 
                                            checked={resetMemberData}
                                            onCheckedChange={(checked) => {
                                                if (checked && (!resetLoanData || !resetSavingsData)) {
                                                    toast.warning("Centang 'Data Pinjaman' dan 'Data Simpanan' terlebih dahulu", {
                                                        description: "Data Anggota memiliki ikatan dengan Pengajuan/Simpanan/Pinjaman."
                                                    });
                                                    setResetLoanData(true);
                                                    setResetSavingsData(true);
                                                }
                                                setResetMemberData(checked as boolean);
                                            }}
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="reset-member" className="font-semibold text-base cursor-pointer">Reset Data Anggota</Label>
                                            <p className="text-sm text-muted-foreground">Menghapus semua Profil Anggota beserta Akun Simpanan mereka. Membutuhkan izin penghapusan Data Pinjaman & Simpanan.</p>
                                        </div>
                                    </div>

                                    {/* Data Tunkin & Gaji Partial Resets */}
                                    <div className="flex items-start space-x-3 p-4 border rounded-md bg-white dark:bg-background">
                                        <Checkbox 
                                            id="reset-tunkin" 
                                            checked={resetTunkinData}
                                            onCheckedChange={(checked) => setResetTunkinData(checked as boolean)}
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="reset-tunkin" className="font-semibold text-base cursor-pointer">Kosongkan Saldo Tunkin</Label>
                                            <p className="text-sm text-muted-foreground">Mereset/mengosongkan nilai Tunjangan Kinerja menjadi Rp 0 untuk seluruh anggota aktif.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-3 p-4 border rounded-md bg-white dark:bg-background">
                                        <Checkbox 
                                            id="reset-gaji" 
                                            checked={resetGajiData}
                                            onCheckedChange={(checked) => setResetGajiData(checked as boolean)}
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="reset-gaji" className="font-semibold text-base cursor-pointer">Kosongkan Saldo Gaji</Label>
                                            <p className="text-sm text-muted-foreground">Mereset/mengosongkan nilai Gaji Bersih menjadi Rp 0 untuk seluruh anggota aktif.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 mt-6 border-t border-red-200">
                                    <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-md space-y-4 border border-red-100 dark:border-red-900/50">
                                        <Label className="text-red-700 dark:text-red-400 font-semibold mb-2 block">Konfirmasi Penghapusan</Label>
                                        <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-2">
                                            Untuk melanjutkan, ketik <strong>RESET-DATA</strong> di kotak di bawah ini.
                                        </p>
                                        <Input
                                            value={resetConfirmation}
                                            onChange={(e) => setResetConfirmation(e.target.value)}
                                            placeholder="Ketik RESET-DATA"
                                            className="max-w-md border-red-300 focus-visible:ring-red-500"
                                        />
                                        
                                        <Button 
                                            variant="destructive" 
                                            onClick={handleResetData}
                                            disabled={
                                                isResetting || 
                                                resetConfirmation !== "RESET-DATA" || 
                                                (!resetStoreData && !resetLoanData && !resetSavingsData && !resetJournalData && !resetMemberData && !resetTunkinData && !resetGajiData && !resetKasBankData)
                                            }
                                            className="w-full sm:w-auto mt-4"
                                        >
                                            {isResetting ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="mr-2 h-4 w-4" />
                                            )}
                                            {isResetting ? "Sedang Menghapus Data..." : "Eksekusi Hapus Data Terpilih"}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
