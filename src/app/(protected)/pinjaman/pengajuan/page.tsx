"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    CheckCircle,
    XCircle,
    Clock,
    FileText,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { loansApi } from "@/lib/api/services";

interface LoanApplication {
    id: number;
    applicationNo: string;
    memberId: number;
    productId: number;
    amount: number;
    tenor: number;
    status: string;
    submittedAt?: string;
    member?: { id: number; memberNo: string; name: string };
    product?: { id: number; code: string; name: string };
}

const APPLICATION_STATUS: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "secondary" },
    submitted: { label: "Diajukan", color: "warning" },
    approved: { label: "Disetujui", color: "success" },
    rejected: { label: "Ditolak", color: "destructive" },
    disbursed: { label: "Dicairkan", color: "primary" },
    cancelled: { label: "Dibatalkan", color: "secondary" },
};

function StatusBadge({ status }: { status: string }) {
    const config = APPLICATION_STATUS[status] || APPLICATION_STATUS.draft;
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        success: "default",
        primary: "default",
        warning: "secondary",
        destructive: "destructive",
        secondary: "outline",
    };

    return (
        <Badge variant={variants[config.color] || "secondary"}>
            {config.label}
        </Badge>
    );
}

const columns: ColumnDef<LoanApplication>[] = [
    {
        accessorKey: "applicationNo",
        header: "No. Pengajuan",
        cell: ({ row }) => (
            <span className="font-mono text-sm">{row.getValue("applicationNo")}</span>
        ),
    },
    {
        accessorKey: "member",
        header: "Anggota",
        cell: ({ row }) => {
            const member = row.original.member;
            return member ? (
                <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.memberNo}</p>
                </div>
            ) : "-";
        },
    },
    {
        accessorKey: "product",
        header: "Produk",
        cell: ({ row }) => {
            const product = row.original.product;
            return product ? product.name : "-";
        },
    },
    {
        accessorKey: "amount",
        header: "Jumlah",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums">
                {formatCurrency(row.getValue("amount"))}
            </span>
        ),
    },
    {
        accessorKey: "tenor",
        header: "Tenor",
        cell: ({ row }) => `${row.getValue("tenor")} bulan`,
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
        accessorKey: "submittedAt",
        header: "Tanggal Ajuan",
        cell: ({ row }) => {
            const date = row.getValue("submittedAt") as string;
            return date ? new Date(date).toLocaleDateString("id-ID") : "-";
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
                        <Link href={`/pinjaman/pengajuan/${row.original.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Lihat Detail
                        </Link>
                    </DropdownMenuItem>
                    {row.original.status === "submitted" && (
                        <>
                            <DropdownMenuItem className="text-green-600">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Setujui
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                                <XCircle className="mr-2 h-4 w-4" />
                                Tolak
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        ),
    },
];

export default function PengajuanPinjamanPage() {
    const [data, setData] = React.useState<LoanApplication[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [statusFilter, setStatusFilter] = React.useState<string>("all");

    // Stats
    const stats = React.useMemo(() => {
        return {
            total: data.length,
            pending: data.filter(d => d.status === "submitted").length,
            approved: data.filter(d => d.status === "approved").length,
            rejected: data.filter(d => d.status === "rejected").length,
        };
    }, [data]);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const params = statusFilter !== "all" ? { status: statusFilter } : {};
                const response = await loansApi.applications(params);
                setData((response.data as any).data || []);
            } catch (error) {
                console.error("Failed to fetch applications:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [statusFilter]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pengajuan Pinjaman"
                description="Daftar pengajuan pinjaman anggota"
                actions={
                    <Button asChild>
                        <Link href="/pinjaman/pengajuan/tambah">
                            <Plus className="mr-2 h-4 w-4" />
                            Pengajuan Baru
                        </Link>
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Pengajuan</p>
                            <p className="text-2xl font-bold">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Menunggu</p>
                            <p className="text-2xl font-bold">{stats.pending}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Disetujui</p>
                            <p className="text-2xl font-bold">{stats.approved}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Ditolak</p>
                            <p className="text-2xl font-bold">{stats.rejected}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="submitted">Diajukan</SelectItem>
                                <SelectItem value="approved">Disetujui</SelectItem>
                                <SelectItem value="rejected">Ditolak</SelectItem>
                                <SelectItem value="disbursed">Dicairkan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={data}
                    searchColumn="applicationNo"
                    searchPlaceholder="Cari no. pengajuan..."
                />
            )}
        </div>
    );
}
