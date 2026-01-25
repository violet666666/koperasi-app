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
} from "lucide-react";

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
                    <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
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
                </Tabs>
            )}
        </div>
    );
}
