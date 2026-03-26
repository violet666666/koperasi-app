"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Package } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

const ASSET_CATEGORIES: Record<string, string> = {
    building: "Bangunan",
    vehicle: "Kendaraan",
    equipment: "Peralatan",
    furniture: "Furniture",
    computer: "Komputer",
    other: "Lainnya",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    active: { label: "Aktif", variant: "default" },
    disposed: { label: "Dijual", variant: "destructive" },
    under_maintenance: { label: "Maintenance", variant: "secondary" },
};

interface AssetDetail {
    id: number;
    code: string;
    name: string;
    category: string;
    acquisitionDate: string;
    acquisitionCost: string;
    usefulLifeYears: number;
    residualValue: string;
    accumulatedDepreciation: string;
    bookValue: string;
    location: string | null;
    description: string | null;
    status: string;
    disposedDate: string | null;
    disposedValue: string | null;
    createdAt: string;
    updatedAt: string;
}

export default function DetailAsetPage() {
    const router = useRouter();
    const params = useParams();
    const [asset, setAsset] = React.useState<AssetDetail | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        async function fetchAsset() {
            try {
                const res = await fetch(`/api/aset/${params.id}`);
                const json = await res.json();
                if (res.ok) {
                    setAsset(json.data);
                } else {
                    toast.error(json.message || "Aset tidak ditemukan");
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

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Card><CardContent className="p-6 space-y-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </CardContent></Card>
            </div>
        );
    }

    if (!asset) return null;

    const statusCfg = STATUS_CONFIG[asset.status] || STATUS_CONFIG.active;

    return (
        <div className="space-y-6">
            <PageHeader
                title={asset.name}
                description={`Kode: ${asset.code}`}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.push("/aset")}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Kembali
                        </Button>
                        <Button asChild>
                            <Link href={`/aset/${asset.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </Link>
                        </Button>
                    </div>
                }
            />

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Informasi Umum
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <InfoRow label="Kode" value={asset.code} />
                        <InfoRow label="Nama" value={asset.name} />
                        <InfoRow label="Kategori" value={ASSET_CATEGORIES[asset.category] || asset.category} />
                        <InfoRow label="Status" value={<Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>} />
                        <InfoRow label="Lokasi" value={asset.location || "-"} />
                        <InfoRow label="Deskripsi" value={asset.description || "-"} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Informasi Keuangan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <InfoRow label="Tanggal Perolehan" value={new Date(asset.acquisitionDate).toLocaleDateString("id-ID")} />
                        <InfoRow label="Harga Perolehan" value={formatCurrency(Number(asset.acquisitionCost))} />
                        <InfoRow label="Umur Manfaat" value={`${asset.usefulLifeYears} tahun`} />
                        <InfoRow label="Nilai Residu" value={formatCurrency(Number(asset.residualValue))} />
                        <InfoRow label="Akum. Penyusutan" value={
                            <span className="text-red-600 font-semibold">
                                ({formatCurrency(Number(asset.accumulatedDepreciation))})
                            </span>
                        } />
                        <InfoRow label="Nilai Buku" value={
                            <span className="text-emerald-600 font-bold text-lg">
                                {formatCurrency(Number(asset.bookValue))}
                            </span>
                        } />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between border-b pb-2 last:border-0 last:pb-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-right">{value}</span>
        </div>
    );
}
