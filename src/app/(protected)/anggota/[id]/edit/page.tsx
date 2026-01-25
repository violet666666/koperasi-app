"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { membersApi } from "@/lib/api/services";

export default function EditAnggotaPage() {
    const router = useRouter();
    const params = useParams();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    // Form state
    const [formData, setFormData] = React.useState({
        name: "",
        nik: "",
        gender: "",
        birth_place: "",
        birth_date: "",
        marital_status: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        province: "",
        postal_code: "",
        branch_id: "",
        join_date: "",
        status: "",
    });

    // Fetch existing data
    React.useEffect(() => {
        if (!params.id) return;

        async function fetchData() {
            try {
                const response = await membersApi.get(Number(params.id));
                const member = (response.data as any).data || response.data;

                // Format date for input field (YYYY-MM-DD)
                const formatDate = (dateString?: string) => {
                    if (!dateString) return "";
                    return new Date(dateString).toISOString().split("T")[0];
                };

                setFormData({
                    name: member.name || "",
                    nik: member.nik || "",
                    gender: member.gender || "",
                    birth_place: member.birth_place || "",
                    birth_date: formatDate(member.birth_date),
                    marital_status: member.marital_status || "",
                    phone: member.phone || "",
                    email: member.email || "",
                    address: member.address || "",
                    city: member.city || "",
                    province: member.province || "",
                    postal_code: "", // Not in mock data/interface yet, strictly speaking
                    branch_id: String(member.branch_id),
                    join_date: formatDate(member.join_date),
                    status: member.status,
                });
            } catch (error) {
                console.error("Failed to fetch member:", error);
                toast.error("Gagal mengambil data anggota");
                router.push("/anggota");
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [params.id, router]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            await membersApi.update(Number(params.id), {
                ...formData,
                branch_id: Number(formData.branch_id),
                // Ensure status is one of the valid types if needed
            } as any);

            toast.success("Data anggota berhasil diperbarui");
            router.push(`/anggota/${params.id}`);
        } catch (error) {
            toast.error("Gagal memperbarui data anggota");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Edit Anggota"
                description="Perbarui data anggota"
                backHref={`/anggota/${params.id}`}
            />

            <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
                {/* Data Pribadi */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Data Pribadi</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Label htmlFor="name">Nama Lengkap *</Label>
                            <Input
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Masukkan nama lengkap"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="nik">NIK</Label>
                            <Input
                                id="nik"
                                name="nik"
                                value={formData.nik}
                                onChange={handleChange}
                                placeholder="16 digit NIK"
                                maxLength={16}
                            />
                        </div>

                        <div>
                            <Label htmlFor="gender">Jenis Kelamin *</Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) => handleSelectChange("gender", value)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih jenis kelamin" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Laki-laki</SelectItem>
                                    <SelectItem value="female">Perempuan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="birth_place">Tempat Lahir</Label>
                            <Input
                                id="birth_place"
                                name="birth_place"
                                value={formData.birth_place}
                                onChange={handleChange}
                                placeholder="Kota tempat lahir"
                            />
                        </div>

                        <div>
                            <Label htmlFor="birth_date">Tanggal Lahir</Label>
                            <Input
                                id="birth_date"
                                name="birth_date"
                                type="date"
                                value={formData.birth_date}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <Label htmlFor="marital_status">Status Pernikahan</Label>
                            <Select
                                value={formData.marital_status}
                                onValueChange={(value) => handleSelectChange("marital_status", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="single">Belum Menikah</SelectItem>
                                    <SelectItem value="married">Menikah</SelectItem>
                                    <SelectItem value="divorced">Cerai</SelectItem>
                                    <SelectItem value="widowed">Janda/Duda</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Kontak */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Kontak</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="phone">No. Telepon *</Label>
                            <Input
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="08xxxxxxxxxx"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="email@example.com"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Alamat */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Alamat</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Label htmlFor="address">Alamat Lengkap</Label>
                            <Textarea
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="Jl. xxx No. xx, RT/RW, Kelurahan"
                                rows={3}
                            />
                        </div>

                        <div>
                            <Label htmlFor="city">Kota/Kabupaten</Label>
                            <Input
                                id="city"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="Nama kota"
                            />
                        </div>

                        <div>
                            <Label htmlFor="province">Provinsi</Label>
                            <Input
                                id="province"
                                name="province"
                                value={formData.province}
                                onChange={handleChange}
                                placeholder="Nama provinsi"
                            />
                        </div>

                        <div>
                            <Label htmlFor="postal_code">Kode Pos</Label>
                            <Input
                                id="postal_code"
                                name="postal_code"
                                value={formData.postal_code}
                                onChange={handleChange}
                                placeholder="12345"
                                maxLength={5}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Keanggotaan */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Keanggotaan</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="branch_id">Cabang *</Label>
                            <Select
                                value={formData.branch_id}
                                onValueChange={(value) => handleSelectChange("branch_id", value)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih cabang" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Kantor Pusat</SelectItem>
                                    <SelectItem value="2">Cabang Jakarta</SelectItem>
                                    <SelectItem value="3">Cabang Surabaya</SelectItem>
                                    <SelectItem value="4">Cabang Bandung</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="join_date">Tanggal Bergabung *</Label>
                            <Input
                                id="join_date"
                                name="join_date"
                                type="date"
                                value={formData.join_date}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) => handleSelectChange("status", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Aktif</SelectItem>
                                    <SelectItem value="inactive">Non-Aktif</SelectItem>
                                    <SelectItem value="resigned">Keluar</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isSaving}
                    >
                        Batal
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Menyimpan...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Simpan Perubahan
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
