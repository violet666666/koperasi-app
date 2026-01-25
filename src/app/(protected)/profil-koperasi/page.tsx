"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Building2,
    MapPin,
    Phone,
    Mail,
    Globe,
    Calendar,
    Users,
    Save,
    Loader2,
    Upload,
} from "lucide-react";

interface CooperativeProfile {
    name: string;
    legalName: string;
    registrationNumber: string;
    taxId: string;
    establishedDate: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    phone: string;
    email: string;
    website: string;
    logoUrl: string;
    description: string;
    totalMembers: number;
    totalAssets: number;
}

export default function ProfilKoperasiPage() {
    const [profile, setProfile] = React.useState<CooperativeProfile | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    // Fetch profile
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                setProfile({
                    name: "PRIMKOPPOL Polda Metro Jaya",
                    legalName: "Primer Koperasi Kepolisian Polda Metro Jaya",
                    registrationNumber: "518/BH/KDK.9/III/2005",
                    taxId: "01.234.567.8-012.345",
                    establishedDate: "2005-03-15",
                    address: "Jl. Jenderal Sudirman Kav. 55",
                    city: "Jakarta Selatan",
                    province: "DKI Jakarta",
                    postalCode: "12190",
                    phone: "(021) 5221234",
                    email: "primkoppol@poldametro.go.id",
                    website: "https://primkoppol-poldametro.go.id",
                    logoUrl: "",
                    description: "Koperasi simpan pinjam yang melayani anggota kepolisian Polda Metro Jaya dan jajarannya untuk meningkatkan kesejahteraan anggota melalui layanan simpanan dan pinjaman.",
                    totalMembers: 2500,
                    totalAssets: 15000000000,
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
            toast.success("Profil koperasi berhasil disimpan");
        } catch (error) {
            toast.error("Gagal menyimpan profil");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field: keyof CooperativeProfile, value: string) => {
        setProfile(prev => prev ? { ...prev, [field]: value } : null);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeader title="Profil Koperasi" description="Informasi koperasi" />
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
                title="Profil Koperasi"
                description="Kelola informasi dan identitas koperasi"
                actions={
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Simpan
                    </Button>
                }
            />

            {profile && (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Identitas */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Building2 className="h-5 w-5" />
                                    Identitas Koperasi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <Label>Nama Koperasi</Label>
                                    <Input
                                        value={profile.name}
                                        onChange={(e) => handleChange("name", e.target.value)}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <Label>Nama Badan Hukum</Label>
                                    <Input
                                        value={profile.legalName}
                                        onChange={(e) => handleChange("legalName", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>No. Badan Hukum</Label>
                                    <Input
                                        value={profile.registrationNumber}
                                        onChange={(e) => handleChange("registrationNumber", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>NPWP</Label>
                                    <Input
                                        value={profile.taxId}
                                        onChange={(e) => handleChange("taxId", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Tanggal Berdiri</Label>
                                    <Input
                                        type="date"
                                        value={profile.establishedDate}
                                        onChange={(e) => handleChange("establishedDate", e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Alamat */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <MapPin className="h-5 w-5" />
                                    Alamat
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <Label>Alamat Lengkap</Label>
                                    <Textarea
                                        value={profile.address}
                                        onChange={(e) => handleChange("address", e.target.value)}
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <Label>Kota/Kabupaten</Label>
                                    <Input
                                        value={profile.city}
                                        onChange={(e) => handleChange("city", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Provinsi</Label>
                                    <Input
                                        value={profile.province}
                                        onChange={(e) => handleChange("province", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Kode Pos</Label>
                                    <Input
                                        value={profile.postalCode}
                                        onChange={(e) => handleChange("postalCode", e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Kontak */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Phone className="h-5 w-5" />
                                    Kontak
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label>Telepon</Label>
                                    <Input
                                        value={profile.phone}
                                        onChange={(e) => handleChange("phone", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        value={profile.email}
                                        onChange={(e) => handleChange("email", e.target.value)}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <Label>Website</Label>
                                    <Input
                                        value={profile.website}
                                        onChange={(e) => handleChange("website", e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Deskripsi */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Tentang Koperasi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    value={profile.description}
                                    onChange={(e) => handleChange("description", e.target.value)}
                                    rows={4}
                                    placeholder="Deskripsi singkat tentang koperasi..."
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Logo */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Logo Koperasi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-32 h-32 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/50">
                                        {profile.logoUrl ? (
                                            <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                        ) : (
                                            <Building2 className="h-12 w-12 text-muted-foreground/50" />
                                        )}
                                    </div>
                                    <Button variant="outline" size="sm">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload Logo
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Stats */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Statistik</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <Users className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Anggota</p>
                                        <p className="text-xl font-bold">{profile.totalMembers.toLocaleString("id-ID")}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                                        <Building2 className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Aset</p>
                                        <p className="text-lg font-bold">
                                            Rp {(profile.totalAssets / 1000000000).toFixed(1)} M
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                                        <Calendar className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Usia</p>
                                        <p className="text-lg font-bold">
                                            {new Date().getFullYear() - new Date(profile.establishedDate).getFullYear()} Tahun
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
