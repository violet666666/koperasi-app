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
    Trash2
} from "lucide-react";
import { processDataReset } from "@/lib/actions/reset.action";
import { Checkbox } from "@/components/ui/checkbox";

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
    const [resetConfirmation, setResetConfirmation] = React.useState("");
    const [isResetting, setIsResetting] = React.useState(false);

    // Fetch settings
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                setSettings({
                    appName: "PRIMKOPPOL Digital",
                    fiscalYearStart: "01",
                    currency: "IDR",
                    dateFormat: "dd/MM/yyyy",
                    emailNotifications: true,
                    loanApprovalAlert: true,
                    paymentReminderDays: 7,
                    sessionTimeout: 30,
                    requireTwoFactor: false,
                    passwordExpireDays: 90,
                    autoBackup: true,
                    backupFrequency: "daily",
                    lastBackup: "2026-01-25T23:00:00",
                });
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Handle save
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Pengaturan berhasil disimpan");
        } catch (error) {
            toast.error("Gagal menyimpan pengaturan");
        } finally {
            setIsSaving(false);
        }
    };

    // Handle backup
    const handleBackup = async () => {
        toast.info("Memproses backup...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        toast.success("Backup berhasil dibuat");
    };

    const handleResetData = async () => {
        if (resetConfirmation !== "RESET-DATA") {
            toast.error("Kata kunci konfirmasi tidak cocok.");
            return;
        }
        
        if (!resetStoreData && !resetLoanData && !resetSavingsData && !resetJournalData && !resetMemberData && !resetTunkinData && !resetGajiData) {
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
                resetGajiData
            });

            if (result.success) {
                toast.success(result.message);
                // Reset inputs
                setResetStoreData(false);
                setResetLoanData(false);
                setResetSavingsData(false);
                setResetJournalData(false);
                setResetMemberData(false);
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
                            Backup
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
                                            <Label htmlFor="reset-journal" className="font-semibold text-base cursor-pointer">Reset Data Jurnal & Kas Bank</Label>
                                            <p className="text-sm text-muted-foreground">Menghapus semua Mutasi Kas/Bank, Kwitansi, Jurnal Akuntansi, dan Transaksi Unit. Saldo Kas/Bank di-reset menjadi 0.</p>
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
                                                (!resetStoreData && !resetLoanData && !resetSavingsData && !resetJournalData && !resetMemberData)
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
