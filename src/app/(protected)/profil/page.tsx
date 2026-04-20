"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    User,
    Phone,
    Mail,
    MapPin,
    Calendar,
    CreditCard,
    Wallet,
    TrendingUp,
    Save,
    Loader2,
    Edit,
    Lock,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface MemberProfile {
    id: number;
    memberNo: string;
    name: string;
    nrp: string;
    rank: string;
    unit: string;
    nik: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    province: string;
    joinDate: string;
    status: string;
    totalSimpanan: number;
    totalPinjaman: number;
    sisaPinjaman: number;
    estimasiSHU: number;
}

export default function ProfilAnggotaPage() {
    const router = useRouter();
    const [profile, setProfile] = React.useState<MemberProfile | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [editName, setEditName] = React.useState("");
    
    const { data: session } = useSession();
    const isOperator = session?.user?.role?.toLowerCase() === "operator";

    // Password change states
    const [isChangingPassword, setIsChangingPassword] = React.useState(false);
    const [oldPassword, setOldPassword] = React.useState("");
    const [newPassword, setNewPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [passwordError, setPasswordError] = React.useState("");

    // Fetch profile (would use current logged-in user)
    // Fetch profile
    React.useEffect(() => {
        async function fetchData() {
            if (!session?.user?.id) return;
            setIsLoading(true);
            try {
                const response = await fetch(`/api/users/${session.user.id}`);
                const { data: userData } = await response.json();

                if (!userData) throw new Error("User not found");

                setProfile({
                    id: userData.id,
                    memberNo: userData.member?.memberNo || (isOperator ? "OP-001" : "-"),
                    name: userData.member?.name || userData.name,
                    nrp: userData.member?.nrp || "-",
                    rank: userData.member?.category || (isOperator ? "Operator" : "-"),
                    unit: userData.branch?.name || "-",
                    nik: userData.member?.nik || "-",
                    phone: userData.member?.phone || userData.phone || "-",
                    email: userData.member?.email || userData.email || "-",
                    address: userData.member?.address || "-",
                    city: userData.member?.city || "-",
                    province: userData.member?.province || "-",
                    joinDate: userData.member?.joinDate || userData.createdAt,
                    status: userData.member?.status || (userData.isActive ? "active" : "inactive"),
                    totalSimpanan: userData.stats?.totalSimpanan || 0,
                    totalPinjaman: userData.stats?.totalPinjaman || 0,
                    sisaPinjaman: userData.stats?.sisaPinjaman || 0,
                    estimasiSHU: userData.stats?.estimasiSHU || 0,
                });
                setEditName(userData.member?.name || userData.name);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [session?.user?.id, isOperator]);

    // Handle save
    const handleSave = async () => {
        if (!profile || !session?.user?.id) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/users/${session.user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName }),
            });
            if (!res.ok) throw new Error("Gagal menyimpan");
            setProfile({ ...profile, name: editName });
            toast.success("Profil berhasil diperbarui");
            setIsEditing(false);
        } catch (error) {
            toast.error("Gagal menyimpan profil");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError("");

        if (newPassword !== confirmPassword) {
            setPasswordError("Sandi baru dan konfirmasi tidak cocok.");
            return;
        }

        setIsChangingPassword(true);

        try {
            const res = await fetch("/api/user/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ oldPassword, newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Gagal mengubah kata sandi.");
            }

            toast.success("Sandi berhasil diubah!");
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            setPasswordError(error.message);
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeader title="Profil Saya" description="Informasi anggota" />
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Profil Saya"
                description="Kelola informasi pribadi Anda"
                actions={
                    isEditing ? (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsEditing(false)}>
                                Batal
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                Simpan
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => setIsEditing(true)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Profil
                        </Button>
                    )
                }
            />

            {profile && (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Main Profile */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Header Card */}
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex flex-col sm:flex-row gap-6">
                                    <Avatar className="h-24 w-24">
                                        <AvatarImage src="" />
                                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                                            {profile.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <Label>Nama Tampilan</Label>
                                                <Input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    placeholder="Nama yang ditampilkan"
                                                    className="text-lg font-bold"
                                                />
                                                <p className="text-xs text-muted-foreground">Nama ini akan tampil di catatan shift dan struk transaksi</p>
                                            </div>
                                        ) : (
                                            <h2 className="text-2xl font-bold">{profile.name}</h2>
                                        )}
                                        <p className="text-muted-foreground">{profile.rank} - {profile.unit}</p>
                                        <div className="mt-2 flex flex-wrap gap-4 text-sm">
                                            <span className="flex items-center gap-1">
                                                <CreditCard className="h-4 w-4" />
                                                NRP: {profile.nrp}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <User className="h-4 w-4" />
                                                NRP: {profile.memberNo}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Contact Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Informasi Kontak</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label>No. Telepon</Label>
                                    {isEditing ? (
                                        <Input
                                            value={profile.phone}
                                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                        />
                                    ) : (
                                        <p className="flex items-center gap-2 mt-1">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            {profile.phone}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label>Email</Label>
                                    {isEditing ? (
                                        <Input
                                            type="email"
                                            value={profile.email}
                                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                        />
                                    ) : (
                                        <p className="flex items-center gap-2 mt-1">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            {profile.email}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Address */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Alamat</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <Label>Alamat Lengkap</Label>
                                    {isEditing ? (
                                        <Input
                                            value={profile.address}
                                            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                                            disabled={isOperator}
                                        />
                                    ) : (
                                        <p className="flex items-center gap-2 mt-1">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            {profile.address || "-"}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label>Kota</Label>
                                    {isEditing ? (
                                        <Input
                                            value={profile.city}
                                            onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                                        />
                                    ) : (
                                        <p className="mt-1">{profile.city}</p>
                                    )}
                                </div>
                                <div>
                                    <Label>Provinsi</Label>
                                    {isEditing ? (
                                        <Input
                                            value={profile.province}
                                            onChange={(e) => setProfile({ ...profile, province: e.target.value })}
                                        />
                                    ) : (
                                        <p className="mt-1">{profile.province}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Change Password */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Lock className="h-5 w-5" />
                                    Keamanan
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                                    {passwordError && (
                                        <div className="text-sm font-medium text-destructive">{passwordError}</div>
                                    )}
                                    <div className="space-y-2">
                                        <Label>Password Lama</Label>
                                        <Input
                                            type="password"
                                            value={oldPassword}
                                            onChange={(e) => setOldPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Password Baru</Label>
                                        <Input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Konfirmasi Password Baru</Label>
                                        <Input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" disabled={isChangingPassword || !oldPassword || !newPassword || !confirmPassword}>
                                        {isChangingPassword ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Menyimpan...
                                            </>
                                        ) : "Ubah Password"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Financial Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Ringkasan Keuangan</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                                        <Wallet className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Simpanan</p>
                                        <p className="text-lg font-bold text-emerald-600">
                                            {formatCurrency(profile.totalSimpanan)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                                        <TrendingUp className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Pinjaman Disetujui</p>
                                        <p className="text-lg font-bold">
                                            {formatCurrency(profile.totalPinjaman)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                                        <CreditCard className="h-4 w-4 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Sisa Pinjaman</p>
                                        <p className="text-lg font-bold text-amber-600">
                                            {formatCurrency(profile.sisaPinjaman)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                                        <Wallet className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Estimasi SHU</p>
                                        <p className="text-lg font-bold text-purple-600">
                                            {formatCurrency(profile.estimasiSHU)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Membership Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Keanggotaan</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">
                                        Bergabung: {new Date(profile.joinDate).toLocaleDateString("id-ID", {
                                            day: "numeric", month: "long", year: "numeric"
                                        })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">
                                        Masa Keanggotaan: {new Date().getFullYear() - new Date(profile.joinDate).getFullYear()} Tahun
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick Links */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Akses Cepat</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/anggota/kartu")}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Cetak Kartu Anggota
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/anggota/buku")}>
                                    <Wallet className="mr-2 h-4 w-4" />
                                    Buku Transaksi
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
