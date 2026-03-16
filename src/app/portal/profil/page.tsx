"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { User, BadgeCheck, Pencil, Save, Loader2, CalendarIcon, X } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { toast } from "sonner";
import { getProvinceNames, getCitiesByProvince } from "@/lib/constants/regions";

// Simple API helper for portal profile
const profileApi = {
    get: () => fetch("/api/member-portal/profile").then((r) => r.json()),
    update: (data: any) =>
        fetch("/api/member-portal/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }).then((r) => {
            if (!r.ok) throw new Error("Gagal memperbarui profil");
            return r.json();
        }),
};

export default function ProfilPortalPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = React.useState(false);

    const { data: response, isLoading } = useQuery({
        queryKey: ["member-profile"],
        queryFn: profileApi.get,
    });

    const member = response?.data;

    // Editable form state
    const [formData, setFormData] = React.useState<Record<string, string>>({});

    // Sync form when member data loads or editing starts
    React.useEffect(() => {
        if (member && isEditing) {
            setFormData({
                name: member.name || "",
                nik: member.nik || "",
                gender: member.gender || "",
                birthPlace: member.birthPlace || "",
                birthDate: member.birthDate ? member.birthDate.split("T")[0] : "",
                maritalStatus: member.maritalStatus || "",
                religion: member.religion || "",
                education: member.education || "",
                occupation: member.occupation || "",
                phone: member.phone || "",
                email: member.email || "",
                address: member.address || "",
                city: member.city || "",
                province: member.province || "",
                postalCode: member.postalCode || "",
            });
        }
    }, [member, isEditing]);

    const mutation = useMutation({
        mutationFn: profileApi.update,
        onSuccess: () => {
            toast.success("Profil berhasil diperbarui!");
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ["member-profile"] });
            queryClient.invalidateQueries({ queryKey: ["member-summary"] });
        },
        onError: () => {
            toast.error("Gagal memperbarui profil");
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        if (name === "province") {
            setFormData((prev) => ({ ...prev, province: value, city: "" }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            const offset = date.getTimezoneOffset();
            const adjusted = new Date(date.getTime() - offset * 60 * 1000);
            setFormData((prev) => ({ ...prev, birthDate: adjusted.toISOString().split("T")[0] }));
        }
    };

    const handleSave = () => {
        const payload: Record<string, any> = { ...formData };
        Object.keys(payload).forEach((k) => {
            if (payload[k] === "") delete payload[k];
        });
        mutation.mutate(payload);
    };

    const provinces = getProvinceNames();
    const cities = formData.province ? getCitiesByProvince(formData.province) : [];

    // ------ READ-ONLY VIEW ------
    if (!isEditing) {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Profil Anggota</h1>
                    <Button onClick={() => setIsEditing(true)} variant="outline">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Profil
                    </Button>
                </div>

                {/* Identity Highlight Card */}
                <Card className="border-0 shadow-md overflow-hidden">
                    <div className="h-24 bg-primary" />
                    <CardContent className="p-6 relative">
                        <div className="absolute -top-12 left-6 h-24 w-24 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center shadow-sm">
                            <User className="h-12 w-12 text-slate-400" />
                        </div>

                        <div className="mt-12 mb-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-48" /> : member?.name}</h2>
                                {member?.status === "active" && <BadgeCheck className="h-5 w-5 text-emerald-500" />}
                            </div>
                            <p className="text-muted-foreground">{isLoading ? <Skeleton className="h-4 w-32 mt-2" /> : `NRP: ${member?.nrp || "-"}`}</p>
                        </div>

                        {/* Key Info Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-slate-100">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">NRP / NIP</p>
                                <p className="text-sm font-bold mt-1">{isLoading ? <Skeleton className="h-5 w-24" /> : member?.nrp || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nama Lengkap</p>
                                <p className="text-sm font-bold mt-1">{isLoading ? <Skeleton className="h-5 w-32" /> : member?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Kategori</p>
                                <p className="text-sm font-bold mt-1">{isLoading ? <Skeleton className="h-5 w-20" /> : member?.category || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Gaji Pokok</p>
                                <p className="text-sm font-bold mt-1 text-emerald-600">{isLoading ? <Skeleton className="h-5 w-28" /> : member?.salary ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(member.salary)) : "-"}</p>
                            </div>
                        </div>

                        {/* Detailed Info */}
                        {isLoading ? (
                            <div className="grid sm:grid-cols-2 gap-y-6 gap-x-12 pt-6">
                                {Array(8).fill(0).map((_, i) => (
                                    <div key={i} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-3/4" /></div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid sm:grid-cols-2 gap-y-5 gap-x-12 pt-6">
                                <InfoRow label="NRP" value={member?.memberNo} />
                                <InfoRow label="Cabang" value={member?.branch?.name} />
                                <InfoRow label="Tanggal Bergabung" value={member?.joinDate ? format(new Date(member.joinDate), "d MMMM yyyy", { locale: localeId }) : "-"} />
                                <InfoRow label="Jenis Kelamin" value={member?.gender === "male" ? "Laki-laki" : member?.gender === "female" ? "Perempuan" : "-"} />
                                <InfoRow label="Tempat, Tanggal Lahir" value={member?.birthDate ? `${member?.birthPlace || ""}, ${format(new Date(member.birthDate), "d MMMM yyyy", { locale: localeId })}` : "-"} />
                                <InfoRow label="Status Pernikahan" value={getMaritalLabel(member?.maritalStatus)} />
                                <InfoRow label="No. Telepon" value={member?.phone} />
                                <InfoRow label="Email" value={member?.email} />
                                <InfoRow label="Provinsi" value={member?.province} />
                                <InfoRow label="Kota" value={member?.city} />
                                <div className="sm:col-span-2">
                                    <InfoRow label="Alamat" value={member?.address || "Belum diatur"} />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ------ EDIT MODE ------
    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Edit Profil</h1>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="mr-2 h-4 w-4" /> Batal
                </Button>
            </div>

            {/* Data Pribadi */}
            <Card>
                <CardHeader><CardTitle className="text-lg">Data Pribadi</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <Label>Nama Lengkap</Label>
                        <Input name="name" value={formData.name || ""} onChange={handleChange} />
                    </div>

                    <div>
                        <Label>NIK</Label>
                        <Input name="nik" value={formData.nik || ""} onChange={handleChange} maxLength={16} placeholder="16 digit NIK" />
                    </div>

                    <div>
                        <Label>Jenis Kelamin</Label>
                        <Select value={formData.gender || ""} onValueChange={(v) => handleSelectChange("gender", v)}>
                            <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="male">Laki-laki</SelectItem>
                                <SelectItem value="female">Perempuan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Tempat Lahir</Label>
                        <Input name="birthPlace" value={formData.birthPlace || ""} onChange={handleChange} />
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
                                <Calendar mode="single" selected={formData.birthDate ? new Date(formData.birthDate) : undefined} onSelect={handleDateChange} disabled={(d) => d > new Date() || d < new Date("1900-01-01")} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div>
                        <Label>Status Pernikahan</Label>
                        <Select value={formData.maritalStatus || ""} onValueChange={(v) => handleSelectChange("maritalStatus", v)}>
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
                        <Label>Agama</Label>
                        <Select value={formData.religion || ""} onValueChange={(v) => handleSelectChange("religion", v)}>
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
                        <Select value={formData.education || ""} onValueChange={(v) => handleSelectChange("education", v)}>
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
                        <Input name="occupation" value={formData.occupation || ""} onChange={handleChange} />
                    </div>
                </CardContent>
            </Card>

            {/* Kontak */}
            <Card>
                <CardHeader><CardTitle className="text-lg">Kontak</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <Label>No. Telepon</Label>
                        <Input name="phone" value={formData.phone || ""} onChange={handleChange} placeholder="08xxxxxxxxxx" />
                    </div>
                    <div>
                        <Label>Email</Label>
                        <Input name="email" type="email" value={formData.email || ""} onChange={handleChange} />
                    </div>
                </CardContent>
            </Card>

            {/* Alamat */}
            <Card>
                <CardHeader><CardTitle className="text-lg">Alamat</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <Label>Alamat Lengkap</Label>
                        <Textarea name="address" value={formData.address || ""} onChange={handleChange} rows={3} placeholder="Jl. xxx No. xx, RT/RW, Kelurahan" />
                    </div>
                    <div>
                        <Label>Provinsi</Label>
                        <Select value={formData.province || ""} onValueChange={(v) => handleSelectChange("province", v)}>
                            <SelectTrigger><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
                            <SelectContent className="max-h-60">
                                {provinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Kota / Kabupaten</Label>
                        <Select value={formData.city || ""} onValueChange={(v) => handleSelectChange("city", v)} disabled={!formData.province}>
                            <SelectTrigger><SelectValue placeholder={formData.province ? "Pilih kota" : "Pilih provinsi dulu"} /></SelectTrigger>
                            <SelectContent className="max-h-60">
                                {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Kode Pos</Label>
                        <Input name="postalCode" value={formData.postalCode || ""} onChange={handleChange} maxLength={5} placeholder="12345" />
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-4 pt-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>Batal</Button>
                <Button onClick={handleSave} disabled={mutation.isPending}>
                    {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : <><Save className="mr-2 h-4 w-4" /> Simpan Profil</>}
                </Button>
            </div>
        </div>
    );
}

// Helper components
function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className="font-medium text-slate-800">{value || "-"}</p>
        </div>
    );
}

function getMaritalLabel(status?: string | null): string {
    const map: Record<string, string> = { single: "Belum Menikah", married: "Menikah", divorced: "Cerai", widowed: "Janda/Duda" };
    return status ? map[status] || status : "-";
}

