"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Plus,
    MoreHorizontal,
    Eye,
    Pencil,
    Trash2,
    Package,
    Building2,
    Calculator,
    TrendingDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";

interface Asset {
    id: number;
    code: string;
    name: string;
    category: string;
    acquisitionDate: string;
    acquisitionCost: number;
    usefulLifeYears: number;
    accumulatedDepreciation: number;
    bookValue: number;
    location: string;
    status: "active" | "disposed" | "under_maintenance";
}

const ASSET_CATEGORIES: Record<string, string> = {
    building: "Bangunan",
    vehicle: "Kendaraan",
    equipment: "Peralatan",
    furniture: "Furniture",
    computer: "Komputer",
    other: "Lainnya",
};

export default function DaftarAsetPage() {
    const [data, setData] = React.useState<Asset[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [deleteId, setDeleteId] = React.useState<number | null>(null);

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/aset");
            const json = await res.json();
            if (res.ok) {
                setData(json.data.map((a: any) => ({
                    ...a,
                    acquisitionCost: Number(a.acquisitionCost),
                    accumulatedDepreciation: Number(a.accumulatedDepreciation),
                    bookValue: Number(a.bookValue),
                })));
            }
        } catch (error) {
            console.error("Failed to fetch:", error);
            toast.error("Gagal mengambil data aset");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch(`/api/aset/${deleteId}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Aset berhasil dihapus");
                fetchData();
            } else {
                toast.error("Gagal menghapus aset");
            }
        } catch {
            toast.error("Gagal menghapus aset");
        }
        setDeleteId(null);
    };

    const columns: ColumnDef<Asset>[] = [
        {
            accessorKey: "code",
            header: "Kode",
            cell: ({ row }) => (
                <span className="font-mono text-sm">{row.getValue("code")}</span>
            ),
        },
        {
            accessorKey: "name",
            header: "Nama Aset",
            cell: ({ row }) => (
                <Link
                    href={`/aset/${row.original.id}`}
                    className="font-medium text-primary hover:underline"
                >
                    {row.getValue("name")}
                </Link>
            ),
        },
        {
            accessorKey: "category",
            header: "Kategori",
            cell: ({ row }) => (
                <Badge variant="outline">
                    {ASSET_CATEGORIES[row.getValue("category") as string] || row.getValue("category")}
                </Badge>
            ),
        },
        {
            accessorKey: "acquisitionDate",
            header: "Tgl Perolehan",
            cell: ({ row }) => new Date(row.getValue("acquisitionDate")).toLocaleDateString("id-ID"),
        },
        {
            accessorKey: "acquisitionCost",
            header: "Harga Perolehan",
            cell: ({ row }) => (
                <span className="font-medium tabular-nums">
                    {formatCurrency(row.getValue("acquisitionCost"))}
                </span>
            ),
        },
        {
            accessorKey: "accumulatedDepreciation",
            header: "Akum. Penyusutan",
            cell: ({ row }) => (
                <span className="text-red-600 tabular-nums">
                    ({formatCurrency(row.getValue("accumulatedDepreciation"))})
                </span>
            ),
        },
        {
            accessorKey: "bookValue",
            header: "Nilai Buku",
            cell: ({ row }) => (
                <span className="font-bold tabular-nums text-emerald-600">
                    {formatCurrency(row.getValue("bookValue"))}
                </span>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
                    active: { label: "Aktif", variant: "default" },
                    disposed: { label: "Dijual", variant: "destructive" },
                    under_maintenance: { label: "Maintenance", variant: "secondary" },
                };
                const config = statusConfig[status] || statusConfig.active;
                return <Badge variant={config.variant}>{config.label}</Badge>;
            },
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link href={`/aset/${row.original.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Lihat Detail
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href={`/aset/${row.original.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(row.original.id)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    // Stats
    const stats = React.useMemo(() => {
        return {
            totalAssets: data.length,
            totalCost: data.reduce((sum, d) => sum + d.acquisitionCost, 0),
            totalDepreciation: data.reduce((sum, d) => sum + d.accumulatedDepreciation, 0),
            totalBookValue: data.reduce((sum, d) => sum + d.bookValue, 0),
        };
    }, [data]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Daftar Aset"
                description="Kelola aset tetap PRIMKOPPOL"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/aset/penyusutan">
                                <TrendingDown className="mr-2 h-4 w-4" />
                                Penyusutan
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/aset/tambah">
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Aset
                            </Link>
                        </Button>
                    </div>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Aset</p>
                            <p className="text-2xl font-bold">{stats.totalAssets}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                            <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Harga Perolehan</p>
                            <p className="text-lg font-bold tabular-nums">
                                {formatCurrency(stats.totalCost)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <Calculator className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Akum. Penyusutan</p>
                            <p className="text-lg font-bold tabular-nums text-red-600">
                                ({formatCurrency(stats.totalDepreciation)})
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <TrendingDown className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Nilai Buku</p>
                            <p className="text-lg font-bold tabular-nums text-emerald-600">
                                {formatCurrency(stats.totalBookValue)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={data}
                    searchColumn="name"
                    searchPlaceholder="Cari aset..."
                />
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Aset?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Aset yang dihapus tidak bisa dikembalikan. Apakah Anda yakin ingin menghapus aset ini?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
