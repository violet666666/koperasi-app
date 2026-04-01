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
import { Loader2, Save, CalendarIcon } from "lucide-react";
import { membersApi } from "@/lib/api/services";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getProvinceNames, getCitiesByProvince } from "@/lib/constants/regions";

export default function EditAnggotaPage() {
    const router = useRouter();
    const params = useParams();
    const memberId = Number(params.id);

    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    const [formData, setFormData] = React.useState({
        name: "",
        nrp: "",
        nik: "",
        gender: "",
        category: "",
        salary: "",
        birthPlace: "",
        birthDate: "",
        maritalStatus: "",
        religion: "",
        education: "",
        occupation: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        province: "",
        postalCode: "",
    });

    React.useEffect(() => {
        if (!memberId) return;
        async function load() {
            setIsLoading(true);
            try {
                const res = await membersApi.get(memberId);
                const m = (res.data as any).data || res.data;
                setFormData({
                    name: m.name || "",
                    nrp: m.nrp || "",
                    nik: m.nik || "",
                    gender: m.gender || "",
                    category: m.category || "",
                    salary: m.salary ? String(m.salary) : "",
                    birthPlace: m.birthPlace || "",
                    birthDate: m.birthDate ? m.birthDate.split("T")[0] : "",
                    maritalStatus: m.maritalStatus || "",
                    religion: m.religion || "",
                    education: m.education || "",
                    occupation: m.occupation || "",
                    phone: m.phone || "",
                    email: m.email || "",
                    address: m.address || "",
                    city: m.city || "",
                    province: m.province || "",
                    postalCode: m.postalCode || "",
                });
            } catch {
                toast.error("Gagal memuat data anggota");
                router.push("/anggota");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [memberId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        if (name === "province") {
            setFormData((prev) => ({ ...prev, province: value, city: "" }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleDateChange = (name: string, date: Date | undefined) => {
        if (date) {
            const offset = date.getTimezoneOffset();
            const adjusted = new Date(date.getTime() - offset * 60 * 1000);
            setFormData((prev) => ({ ...prev, [name]: adjusted.toISOString().split("T")[0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload: Record<string, any> = { ...formData };
            Object.keys(payload).forEach((key) => {
                if (payload[key] === "") delete payload[key];
            });
            await membersApi.update(memberId, payload);
            toast.success("Data anggota berhasil diperbarui");
            router.push(`/anggota/${memberId}`);
        } catch (error: any) {
            const msg = error?.response?.data?.message || "Gagal memperbarui data anggota";
            toast.error(msg);
        } finally {
            setIsSaving(false);
        }
    };

    const provinces = getProvinceNames();
    const cities = formData.province ? getCitiesByProvince(formData.province) : [];

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-3xl">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Edit Data Anggota"
                description="Perbarui informasi lengkap anggota PRIMKOPPOL"
                backHref={`/anggota/${memberId}`}
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
                            <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                        </div>

                        <div>
                            <Label htmlFor="nrp">NRP</Label>
                            <Input id="nrp" name="nrp" value={formData.nrp} onChange={handleChange} placeholder="Nomor Registrasi Pokok" />
                        </div>

                        <div>
                            <Label htmlFor="nik">NIK</Label>
                            <Input id="nik" name="nik" value={formData.nik} onChange={handleChange} maxLength={16} placeholder="16 digit NIK" />
                        </div>

                        <div>
                            <Label>Jenis Kelamin</Label>
                            <Select value={formData.gender} onValueChange={(v) => handleSelectChange("gender", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Laki-laki</SelectItem>
                                    <SelectItem value="female">Perempuan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Kategori Anggota</Label>
                            <Select value={formData.category} onValueChange={(v) => handleSelectChange("category", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Polri">Polri</SelectItem>
                                    <SelectItem value="PNS">PNS</SelectItem>
                                    <SelectItem value="Purnawirawan">Purnawirawan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="salary">Gaji Bersih (Per Bulan)</Label>
                            <Input
                                id="salary"
                                name="salary"
                                type="number"
                                min="0"
                                value={formData.salary}
                                onChange={handleChange}
                                placeholder="Masukkan nominal gaji bersih"
                            />
                        </div>

                        <div>
                            <Label>Status Pernikahan</Label>
                            <Select value={formData.maritalStatus} onValueChange={(v) => handleSelectChange("maritalStatus", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="single">Belum Menikah</SelectItem>
                                    <SelectItem value="married">Menikah</SelectItem>
                                    <SelectItem value="divorced">Cerai</SelectItem>
                                    <SelectItem value="widowed">Janda/Duda</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Tempat Lahir</Label>
                            <Input name="birthPlace" value={formData.birthPlace} onChange={handleChange} placeholder="Kota tempat lahir" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Tanggal Lahir</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !formData.birthDate && "text-muted-foreground")}>
                                        {formData.birthDate ? format(new Date(formData.birthDate), "PPP", { locale: localeId }) : <span>Pilih tanggal</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.birthDate ? new Date(formData.birthDate) : undefined}
                                        onSelect={(d) => handleDateChange("birthDate", d)}
                                        disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div>
                            <Label>Agama</Label>
                            <Select value={formData.religion} onValueChange={(v) => handleSelectChange("religion", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="islam">Islam</SelectItem>
                                    <SelectItem value="kristen">Kristen</SelectItem>
                                    <SelectItem value="katolik">Katolik</SelectItem>
                                    <SelectItem value="hindu">Hindu</SelectItem>
                                    <SelectItem value="buddha">Buddha</SelectItem>
                                    <SelectItem value="konghucu">Konghucu</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Pendidikan</Label>
                            <Select value={formData.education} onValueChange={(v) => handleSelectChange("education", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sd">SD</SelectItem>
                                    <SelectItem value="smp">SMP</SelectItem>
                                    <SelectItem value="sma">SMA/SMK</SelectItem>
                                    <SelectItem value="d3">D3</SelectItem>
                                    <SelectItem value="s1">S1</SelectItem>
                                    <SelectItem value="s2">S2</SelectItem>
                                    <SelectItem value="s3">S3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Pekerjaan</Label>
                            <Input name="occupation" value={formData.occupation} onChange={handleChange} placeholder="Pekerjaan saat ini" />
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
                            <Label htmlFor="phone">No. Telepon</Label>
                            <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="08xxxxxxxxxx" />
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" />
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
                            <Label>Alamat Lengkap</Label>
                            <Textarea name="address" value={formData.address} onChange={handleChange} placeholder="Jl. xxx No. xx, RT/RW, Kelurahan" rows={3} />
                        </div>

                        <div>
                            <Label>Provinsi</Label>
                            <Select value={formData.province} onValueChange={(v) => handleSelectChange("province", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {provinces.map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Kota / Kabupaten</Label>
                            <Select value={formData.city} onValueChange={(v) => handleSelectChange("city", v)} disabled={!formData.province}>
                                <SelectTrigger><SelectValue placeholder={formData.province ? "Pilih kota" : "Pilih provinsi dulu"} /></SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {cities.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Kode Pos</Label>
                            <Input name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="12345" maxLength={5} />
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                        Batal
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
                        ) : (
                            <><Save className="mr-2 h-4 w-4" /> Simpan Perubahan</>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
