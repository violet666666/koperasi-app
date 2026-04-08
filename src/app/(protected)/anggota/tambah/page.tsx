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
        phone: "",
        email: "",
        category: "",
        branch_id: "1",
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
            // Map form fields to API schema (camelCase)
            const payload = {
                name: formData.name,
                nrp: formData.nrp || undefined,
                phone: formData.phone || undefined,
                email: formData.email || undefined,
                category: formData.category || undefined,
                branchId: parseInt(formData.branch_id),
                joinDate: formData.join_date,
            };

            await membersApi.create(payload);

            toast.success("Anggota berhasil ditambahkan");
            router.push("/anggota");
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "Gagal menambahkan anggota";
            toast.error(msg);
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tambah Anggota Baru"
                description="Daftarkan anggota baru ke sistem PRIMKOPPOL"
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
                                placeholder="Masukkan NRP / NRP"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="category">Kategori Anggota *</Label>
                            <Input
                                id="category"
                                list="category-options-tambah"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                placeholder="Pilih atau ketik kategori baru"
                                required
                            />
                            <datalist id="category-options-tambah">
                                <option value="AKBP" />
                                <option value="KOMPOL" />
                                <option value="AKP" />
                                <option value="IPTU" />
                                <option value="IPDA" />
                                <option value="AIPTU" />
                                <option value="AIPDA" />
                                <option value="BRIPKA" />
                                <option value="BRIGADIR" />
                                <option value="BRIPTU" />
                                <option value="BRIPDA" />
                                <option value="PNS" />
                                <option value="PHL" />
                                <option value="Purnawirawan" />
                                <option value="Polri" />
                            </datalist>
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

                {/* Keanggotaan */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Keanggotaan</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
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
