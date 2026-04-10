"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Calculator, Save, Loader2, Users, Building2 } from "lucide-react";

interface SHUParameter {
    key: string;
    label: string;
    percentage: number;
    description: string;
}

interface SHUConfig {
    memberAllocations: SHUParameter[];
    nonMemberAllocations: SHUParameter[];
}

export default function ParameterSHUPage() {
    const [config, setConfig] = React.useState<SHUConfig>({
        memberAllocations: [],
        nonMemberAllocations: [],
    });
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/settings/shu");
                const json = await res.json();
                
                if (json.data) {
                    setConfig(json.data);
                } else {
                    // Fallback to defaults to match calculator
                    setConfig({
                        memberAllocations: [
                            { key: "jasa_usaha", label: "Jasa Anggota", percentage: 25, description: "Berdasar kontribusi belanja & jasa (Jasa Anggota)" },
                            { key: "jasa_modal", label: "Jasa Simpanan", percentage: 20, description: "Berdasar simpanan pokok & wajib (Jasa Simpanan)" },
                            { key: "cadangan", label: "Cadangan", percentage: 30, description: "Dana Cadangan Koperasi (Cadangan)" },
                            { key: "pengurus", label: "Dana Pengurus", percentage: 10, description: "Insentif Pengurus & Pengawas (Dana Pengurus)" },
                            { key: "pegawai", label: "Dana Pegawai", percentage: 5, description: "Kesejahteraan Karyawan (Dana Pegawai)" },
                            { key: "pendidikan", label: "Dana Pendidikan", percentage: 5, description: "Pendidikan Perkoperasian (Dana Pendidikan)" },
                            { key: "sosial", label: "Dana Sosial", percentage: 5, description: "Bakti Sosial (Dana Sosial)" },
                        ],
                        nonMemberAllocations: [
                            { key: "cadangan", label: "Dana Cadangan", percentage: 60, description: "Dana cadangan koperasi" },
                            { key: "pendidikan1", label: "Dana Pendidikan Koperasi (Bagian 1)", percentage: 10, description: "Dana Pendidikan" },
                            { key: "pegawai", label: "Dana Kesejahteraan Pegawai", percentage: 10, description: "Kesejahteraan pegawai/karyawan" },
                            { key: "pendidikan2", label: "Dana Pendidikan Koperasi (Bagian 2)", percentage: 10, description: "Dana Pendidikan" },
                            { key: "sosial", label: "Dana Sosial", percentage: 10, description: "Dana Sosial Koperasi" },
                        ]
                    });
                }
            } catch (error) {
                console.error("Failed to fetch parameter SHU:", error);
                toast.error("Gagal memuat parameter SHU");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Calculate totals
    const totalMember = config.memberAllocations.reduce((sum, p) => sum + p.percentage, 0);
    const totalNonMember = config.nonMemberAllocations.reduce((sum, p) => sum + p.percentage, 0);

    // Handle change
    const handleChange = (type: "member" | "nonMember", key: string, value: number) => {
        setConfig(prev => ({
            ...prev,
            [type === "member" ? "memberAllocations" : "nonMemberAllocations"]: prev[type === "member" ? "memberAllocations" : "nonMemberAllocations"].map(p =>
                p.key === key ? { ...p, percentage: value } : p
            )
        }));
    };

    // Handle save
    const handleSave = async () => {
        if (totalMember !== 100 || totalNonMember !== 100) {
            toast.error("Total persentase kedua kategori harus genap 100%");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch("/api/settings/shu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });
            
            if (!res.ok) throw new Error("Gagal menyimpan");
            
            toast.success("Parameter SHU berhasil disimpan permanen");
        } catch (error) {
            toast.error("Gagal menyimpan parameter");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Parameter Pembagian SHU"
                description="Konfigurasi persentase alokasi Sisa Hasil Usaha berdasarkan AD/ART PRIMKOPPOL."
                backHref="/master"
                actions={
                    <Button onClick={handleSave} disabled={isSaving || totalMember !== 100 || totalNonMember !== 100}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Simpan Permanen
                    </Button>
                }
            />

            {isLoading ? (
                 <div className="space-y-4">
                     <Skeleton className="h-40 w-full" />
                     <Skeleton className="h-40 w-full" />
                 </div>
            ) : (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Member Allocations */}
                    <div className="space-y-4">
                        <Card className={totalMember === 100 ? "border-emerald-500 shadow-sm" : "border-red-500 shadow-sm"}>
                            <CardHeader className="bg-gray-50 border-b pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Users className="h-5 w-5 text-indigo-600" />
                                        <div>
                                            <CardTitle className="text-lg">SHU Anggota</CardTitle>
                                            <CardDescription>Porsi pembagian dari kontribusi anggota (Internal)</CardDescription>
                                        </div>
                                    </div>
                                    <span className={`text-2xl font-bold ${totalMember === 100 ? "text-emerald-600" : "text-red-600"}`}>
                                        {totalMember}%
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y">
                                    {config.memberAllocations.map((param) => (
                                        <div key={param.key} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                            <div>
                                                <p className="font-semibold text-sm">{param.label}</p>
                                                <p className="text-xs text-muted-foreground">{param.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={param.percentage || ''}
                                                    onChange={(e) => handleChange("member", param.key, Number(e.target.value))}
                                                    className="w-20 text-right font-medium"
                                                />
                                                <span className="text-sm font-bold text-gray-500">%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Non-Member Allocations */}
                    <div className="space-y-4">
                        <Card className={totalNonMember === 100 ? "border-blue-500 shadow-sm" : "border-red-500 shadow-sm"}>
                            <CardHeader className="bg-gray-50 border-b pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <CardTitle className="text-lg">SHU Non-Anggota</CardTitle>
                                            <CardDescription>Porsi pembagian dari laba unit usaha (Eksternal)</CardDescription>
                                        </div>
                                    </div>
                                    <span className={`text-2xl font-bold ${totalNonMember === 100 ? "text-blue-600" : "text-red-600"}`}>
                                        {totalNonMember}%
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y">
                                    {config.nonMemberAllocations.map((param) => (
                                        <div key={param.key} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                            <div>
                                                <p className="font-semibold text-sm">{param.label}</p>
                                                <p className="text-xs text-muted-foreground">{param.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={param.percentage || ''}
                                                    onChange={(e) => handleChange("nonMember", param.key, Number(e.target.value))}
                                                    className="w-20 text-right font-medium"
                                                />
                                                <span className="text-sm font-bold text-gray-500">%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Info */}
            <Card className="bg-blue-50/50 border-blue-100 mt-6">
                <CardContent className="p-4 flex gap-3 text-sm text-blue-900">
                    <Calculator className="h-5 w-5 shrink-0 text-blue-600" />
                    <p>
                        <strong>Peraturan AD/ART:</strong> Pastikan total persentase pada masing-masing kelompok (Anggota dan Non-Anggota) mencapai genap 100%. Data yang diisi di layar ini akan menjadi penentu tunggal (<em>Single Source of Truth</em>) untuk distribusi seluruh uang SHU Koperasi pada akhir tahun berjalan.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
