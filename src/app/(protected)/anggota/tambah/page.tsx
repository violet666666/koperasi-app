"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function TambahAnggotaPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);

    // Form state
    const [formData, setFormData] = React.useState({
        name: "",
        nrp: "",
        nik: "",
        gender: "",
        birth_place: "",
        birth_date: "", // Initialized as empty string
        marital_status: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        province: "",
        postal_code: "",
        branch_id: "",
        join_date: new Date().toISOString().split("T")[0],
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (name: string, date: Date | undefined) => {
        if (date) {
            // Adjust for timezone offset to avoid previous day issue
            const offset = date.getTimezoneOffset();
            const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
            setFormData((prev) => ({ ...prev, [name]: adjustedDate.toISOString().split("T")[0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Call API to create member
            await membersApi.create(formData);

            toast.success("Anggota berhasil ditambahkan");
            router.push("/anggota");
        } catch (error) {
            toast.error("Gagal menambahkan anggota");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tambah Anggota Baru"
                description="Daftarkan anggota baru ke sistem koperasi"
                backHref="/anggota"
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
                            <Label htmlFor="nrp">NRP *</Label>
                            <Input
                                id="nrp"
                                name="nrp"
                                value={formData.nrp}
                                onChange={handleChange}
                                placeholder="Masukkan NRP / Nomor Anggota"
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

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="birth_date">Tanggal Lahir</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !formData.birth_date && "text-muted-foreground"
                                        )}
                                    >
                                        {formData.birth_date ? (
                                            format(new Date(formData.birth_date), "PPP", { locale: id })
                                        ) : (
                                            <span>Pilih tanggal</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.birth_date ? new Date(formData.birth_date) : undefined}
                                        onSelect={(date) => handleDateChange("birth_date", date)}
                                        disabled={(date) =>
                                            date > new Date() || date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
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

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="join_date">Tanggal Bergabung *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !formData.join_date && "text-muted-foreground"
                                        )}
                                    >
                                        {formData.join_date ? (
                                            format(new Date(formData.join_date), "PPP", { locale: id })
                                        ) : (
                                            <span>Pilih tanggal</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.join_date ? new Date(formData.join_date) : undefined}
                                        onSelect={(date) => handleDateChange("join_date", date)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Batal
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Menyimpan...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Simpan Anggota
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
