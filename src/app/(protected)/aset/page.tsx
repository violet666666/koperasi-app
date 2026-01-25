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
import { Skeleton } from "@/components/ui/skeleton";
import {
    Plus,
    MoreHorizontal,
    Eye,
    Pencil,
    Package,
    Building2,
    Calculator,
    TrendingDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

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
                </DropdownMenuContent>
            </DropdownMenu>
        ),
    },
];

export default function DaftarAsetPage() {
    const [data, setData] = React.useState<Asset[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    // Stats
    const stats = React.useMemo(() => {
        return {
            totalAssets: data.length,
            totalCost: data.reduce((sum, d) => sum + d.acquisitionCost, 0),
            totalDepreciation: data.reduce((sum, d) => sum + d.accumulatedDepreciation, 0),
            totalBookValue: data.reduce((sum, d) => sum + d.bookValue, 0),
        };
    }, [data]);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                const mockData: Asset[] = [
                    {
                        id: 1,
                        code: "AST-001",
                        name: "Gedung Kantor Pusat",
                        category: "building",
                        acquisitionDate: "2020-01-15",
                        acquisitionCost: 500000000,
                        usefulLifeYears: 20,
                        accumulatedDepreciation: 125000000,
                        bookValue: 375000000,
                        location: "Kantor Pusat",
                        status: "active",
                    },
                    {
                        id: 2,
                        code: "AST-002",
                        name: "Mobil Operasional Toyota Avanza",
                        category: "vehicle",
                        acquisitionDate: "2022-06-20",
                        acquisitionCost: 200000000,
                        usefulLifeYears: 8,
                        accumulatedDepreciation: 50000000,
                        bookValue: 150000000,
                        location: "Kantor Pusat",
                        status: "active",
                    },
                    {
                        id: 3,
                        code: "AST-003",
                        name: "Server Komputer",
                        category: "computer",
                        acquisitionDate: "2023-03-10",
                        acquisitionCost: 75000000,
                        usefulLifeYears: 4,
                        accumulatedDepreciation: 28125000,
                        bookValue: 46875000,
                        location: "Data Center",
                        status: "active",
                    },
                    {
                        id: 4,
                        code: "AST-004",
                        name: "Meja dan Kursi Kantor (20 set)",
                        category: "furniture",
                        acquisitionDate: "2021-08-01",
                        acquisitionCost: 40000000,
                        usefulLifeYears: 10,
                        accumulatedDepreciation: 12000000,
                        bookValue: 28000000,
                        location: "Kantor Pusat",
                        status: "active",
                    },
                ];

                setData(mockData);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Daftar Aset"
                description="Kelola aset tetap koperasi"
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
        </div>
    );
}
