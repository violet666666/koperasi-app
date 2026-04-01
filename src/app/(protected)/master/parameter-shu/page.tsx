"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Calculator,
    Save,
    Loader2,
    Percent,
    Users,
    Building2,
    BookOpen,
    HeartHandshake,
} from "lucide-react";

interface SHUParameter {
    id: string;
    name: string;
    description: string;
    percentage: number;
    icon: React.ReactNode;
}

export default function ParameterSHUPage() {
    const [parameters, setParameters] = React.useState<SHUParameter[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data - Standard cooperative SHU distribution
                setParameters([
                    { id: "dana_cadangan", name: "Dana Cadangan", description: "Untuk pengembangan dan penguatan modal PRIMKOPPOL", percentage: 25, icon: <Building2 className="h-5 w-5" /> },
                    { id: "jasa_anggota", name: "Jasa Anggota", description: "Dibagikan berdasarkan partisipasi simpanan", percentage: 25, icon: <Users className="h-5 w-5" /> },
                    { id: "jasa_modal", name: "Jasa Modal", description: "Dibagikan berdasarkan kontribusi modal", percentage: 20, icon: <Percent className="h-5 w-5" /> },
                    { id: "dana_pengurus", name: "Dana Pengurus", description: "Untuk pengurus dan pengawas PRIMKOPPOL", percentage: 10, icon: <Users className="h-5 w-5" /> },
                    { id: "dana_pendidikan", name: "Dana Pendidikan", description: "Untuk pelatihan dan edukasi anggota", percentage: 5, icon: <BookOpen className="h-5 w-5" /> },
                    { id: "dana_sosial", name: "Dana Sosial", description: "Untuk kegiatan sosial dan bantuan anggota", percentage: 5, icon: <HeartHandshake className="h-5 w-5" /> },
                    { id: "dana_pembangunan", name: "Dana Pembangunan Daerah", description: "Kontribusi untuk pembangunan wilayah kerja", percentage: 5, icon: <Building2 className="h-5 w-5" /> },
                    { id: "dana_lainnya", name: "Dana Lain-lain", description: "Untuk keperluan lain sesuai keputusan RAT", percentage: 5, icon: <Calculator className="h-5 w-5" /> },
                ]);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Calculate total
    const totalPercentage = parameters.reduce((sum, p) => sum + p.percentage, 0);

    // Handle change
    const handlePercentageChange = (id: string, value: number) => {
        setParameters(prev => prev.map(p =>
            p.id === id ? { ...p, percentage: value } : p
        ));
    };

    // Handle save
    const handleSave = async () => {
        if (totalPercentage !== 100) {
            toast.error("Total persentase harus 100%");
            return;
        }

        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Parameter SHU berhasil disimpan");
        } catch (error) {
            toast.error("Gagal menyimpan parameter");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Parameter SHU"
                description="Konfigurasi pembagian Sisa Hasil Usaha"
                backHref="/master"
                actions={
                    <Button onClick={handleSave} disabled={isSaving || totalPercentage !== 100}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Simpan
                    </Button>
                }
            />

            {/* Total Card */}
            <Card className={totalPercentage === 100 ? "border-emerald-500" : "border-red-500"}>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Calculator className="h-5 w-5" />
                            <span className="font-medium">Total Pembagian</span>
                        </div>
                        <span className={`text-2xl font-bold ${totalPercentage === 100 ? "text-emerald-600" : "text-red-600"}`}>
                            {totalPercentage}%
                        </span>
                    </div>
                    {totalPercentage !== 100 && (
                        <p className="text-sm text-red-600 mt-2">
                            Total harus 100%. {totalPercentage < 100 ? `Kurang ${100 - totalPercentage}%` : `Lebih ${totalPercentage - 100}%`}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Parameters Grid */}
            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i}>
                            <CardContent className="p-6">
                                <Skeleton className="h-24 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {parameters.map((param) => (
                        <Card key={param.id}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        {param.icon}
                                    </div>
                                    {param.name}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    {param.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={param.percentage}
                                        onChange={(e) => handlePercentageChange(param.id, Number(e.target.value))}
                                        className="text-right text-lg font-bold"
                                    />
                                    <span className="text-lg font-bold text-muted-foreground">%</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Info */}
            <Card>
                <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                        <strong>Catatan:</strong> Pembagian SHU mengacu pada UU No. 25 Tahun 1992 tentang Perkoperasian
                        dan AD/ART koperasi. Perubahan parameter memerlukan persetujuan RAT.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
