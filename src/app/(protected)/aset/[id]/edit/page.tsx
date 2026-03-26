"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Save } from "lucide-react";

export default function EditAsetPage() {
    const router = useRouter();
    const params = useParams();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [form, setForm] = React.useState({
        code: "",
        name: "",
        category: "equipment",
        acquisitionDate: "",
        acquisitionCost: "",
        usefulLifeYears: "5",
        residualValue: "0",
        accumulatedDepreciation: "0",
        location: "",
        description: "",
        status: "active",
    });

    React.useEffect(() => {
        async function fetchAsset() {
            try {
                const res = await fetch(`/api/aset/${params.id}`);
                const json = await res.json();
                if (res.ok) {
                    const a = json.data;
                    setForm({
                        code: a.code,
                        name: a.name,
                        category: a.category,
                        acquisitionDate: a.acquisitionDate?.slice(0, 10) || "",
                        acquisitionCost: String(Number(a.acquisitionCost)),
                        usefulLifeYears: String(a.usefulLifeYears),
                        residualValue: String(Number(a.residualValue)),
                        accumulatedDepreciation: String(Number(a.accumulatedDepreciation)),
                        location: a.location || "",
                        description: a.description || "",
                        status: a.status,
                    });
                } else {
                    toast.error("Aset tidak ditemukan");
                    router.push("/aset");
                }
            } catch {
                toast.error("Gagal mengambil data aset");
            } finally {
                setIsLoading(false);
            }
        }
        fetchAsset();
    }, [params.id, router]);

    const handleChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.code || !form.name || !form.acquisitionCost) {
            toast.error("Kode, Nama, dan Harga Perolehan wajib diisi");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/aset/${params.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const json = await res.json();

            if (!res.ok) {
                toast.error(json.message || "Gagal mengupdate aset");
                return;
            }

            toast.success("Aset berhasil diupdate");
            router.push(`/aset/${params.id}`);
        } catch {
            toast.error("Terjadi kesalahan sistem");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Card><CardContent className="p-6 space-y-4">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </CardContent></Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Edit Aset"
                description={`Ubah data aset ${form.code}`}
                actions={
                    <Button variant="outline" onClick={() => router.push(`/aset/${params.id}`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Kembali
                    </Button>
                }
            />

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Informasi Aset</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="code">Kode Aset *</Label>
                            <Input
                                id="code"
                                value={form.code}
                                onChange={(e) => handleChange("code", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Aset *</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => handleChange("name", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Kategori</Label>
                            <Select value={form.category} onValueChange={(v) => handleChange("category", v)}>
                                <SelectTrigger id="category">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="building">Bangunan</SelectItem>
                                    <SelectItem value="vehicle">Kendaraan</SelectItem>
                                    <SelectItem value="equipment">Peralatan</SelectItem>
                                    <SelectItem value="furniture">Furniture</SelectItem>
                                    <SelectItem value="computer">Komputer</SelectItem>
                                    <SelectItem value="other">Lainnya</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
                                <SelectTrigger id="status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Aktif</SelectItem>
                                    <SelectItem value="under_maintenance">Maintenance</SelectItem>
                                    <SelectItem value="disposed">Dijual / Dilepas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="acquisitionDate">Tanggal Perolehan</Label>
                            <Input
                                id="acquisitionDate"
                                type="date"
                                value={form.acquisitionDate}
                                onChange={(e) => handleChange("acquisitionDate", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="acquisitionCost">Harga Perolehan (Rp) *</Label>
                            <Input
                                id="acquisitionCost"
                                type="number"
                                value={form.acquisitionCost}
                                onChange={(e) => handleChange("acquisitionCost", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="usefulLifeYears">Umur Manfaat (Tahun)</Label>
                            <Input
                                id="usefulLifeYears"
                                type="number"
                                min="1"
                                value={form.usefulLifeYears}
                                onChange={(e) => handleChange("usefulLifeYears", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="residualValue">Nilai Residu (Rp)</Label>
                            <Input
                                id="residualValue"
                                type="number"
                                value={form.residualValue}
                                onChange={(e) => handleChange("residualValue", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="accumulatedDepreciation">Akumulasi Penyusutan (Rp)</Label>
                            <Input
                                id="accumulatedDepreciation"
                                type="number"
                                value={form.accumulatedDepreciation}
                                onChange={(e) => handleChange("accumulatedDepreciation", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location">Lokasi</Label>
                            <Input
                                id="location"
                                value={form.location}
                                onChange={(e) => handleChange("location", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="description">Deskripsi</Label>
                            <Textarea
                                id="description"
                                value={form.description}
                                onChange={(e) => handleChange("description", e.target.value)}
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-2 mt-6">
                    <Button type="button" variant="outline" onClick={() => router.push(`/aset/${params.id}`)}>
                        Batal
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
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
