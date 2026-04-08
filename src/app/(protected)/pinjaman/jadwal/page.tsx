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
import { Skeleton } from "@/components/ui/skeleton";
import {
    Calendar,
    AlertTriangle,
    Clock,
    CheckCircle,
    CreditCard,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { loansApi } from "@/lib/api/services";

interface UpcomingInstallment {
    id: number;
    loanId: number;
    loanNo: string;
    memberName: string;
    memberNo: string;
    installmentNo: number;
    dueDate: string;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
    status: "upcoming" | "due_today" | "overdue";
    daysUntilDue: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    upcoming: { label: "Mendatang", color: "secondary", icon: Clock },
    due_today: { label: "Jatuh Tempo", color: "warning", icon: Calendar },
    overdue: { label: "Terlambat", color: "destructive", icon: AlertTriangle },
};

function StatusBadge({ status }: { status: string }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
    const Icon = config.icon;
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        secondary: "secondary",
        warning: "outline",
        destructive: "destructive",
    };

    return (
        <Badge variant={variants[config.color] || "secondary"} className="gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}

const columns: ColumnDef<UpcomingInstallment>[] = [
    {
        accessorKey: "dueDate",
        header: "Jatuh Tempo",
        cell: ({ row }) => {
            const date = new Date(row.getValue("dueDate"));
            return (
                <div>
                    <p className="font-medium">
                        {date.toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                        })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {row.original.daysUntilDue === 0
                            ? "Hari ini"
                            : row.original.daysUntilDue > 0
                                ? `${row.original.daysUntilDue} hari lagi`
                                : `Terlambat ${Math.abs(row.original.daysUntilDue)} hari`}
                    </p>
                </div>
            );
        },
    },
    {
        accessorKey: "loanNo",
        header: "No. Pinjaman",
        cell: ({ row }) => (
            <Link
                href={`/pinjaman/${row.original.loanId}`}
                className="font-mono text-sm text-primary hover:underline"
            >
                {row.getValue("loanNo")}
            </Link>
        ),
    },
    {
        accessorKey: "memberName",
        header: "Anggota",
        cell: ({ row }) => (
            <div>
                <p className="font-medium">{row.getValue("memberName")}</p>
                <p className="text-xs text-muted-foreground">{row.original.memberNo}</p>
            </div>
        ),
    },
    {
        accessorKey: "installmentNo",
        header: "Angsuran Ke",
        cell: ({ row }) => (
            <span className="font-medium">#{row.getValue("installmentNo")}</span>
        ),
    },
    {
        accessorKey: "totalAmount",
        header: "Jumlah",
        cell: ({ row }) => (
            <div>
                <p className="font-bold tabular-nums">
                    {formatCurrency(row.getValue("totalAmount"))}
                </p>
                <p className="text-xs text-muted-foreground">
                    P: {formatCurrency(row.original.principalAmount)} + B: {formatCurrency(row.original.interestAmount)}
                </p>
            </div>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
        id: "actions",
        cell: ({ row }) => (
            <Button asChild size="sm">
                <Link href={`/pinjaman/angsuran?loan=${row.original.loanId}`}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Bayar
                </Link>
            </Button>
        ),
    },
];

export default function JadwalAngsuranPage() {
    const [data, setData] = React.useState<UpcomingInstallment[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [periodFilter, setPeriodFilter] = React.useState<string>("week");

    // Stats
    const stats = React.useMemo(() => {
        return {
            total: data.length,
            dueToday: data.filter(d => d.status === "due_today").length,
            overdue: data.filter(d => d.status === "overdue").length,
            totalAmount: data.reduce((sum, d) => sum + d.totalAmount, 0),
        };
    }, [data]);

    // Fetch data from real endpoint
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Fetch schedules using server-side filtering
                let url = `/api/loans/schedules?period=${periodFilter}&limit=1000`;
                
                const response = await fetch(url);
                if (response.ok) {
                    const json = await response.json();
                    let fetchedData = json.data || [];
                    
                    setData(fetchedData);
                } else {
                    console.error("Gagal mengambil data jadwal");
                }
            } catch (error) {
                console.error("Terjadi kesalahan sistem", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [periodFilter]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Jadwal Angsuran"
                description="Daftar jadwal angsuran yang akan jatuh tempo"
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Jadwal</p>
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
                            <p className="text-sm text-muted-foreground">Jatuh Tempo Hari Ini</p>
                            <p className="text-2xl font-bold">{stats.dueToday}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Terlambat</p>
                            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <CreditCard className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Tagihan</p>
                            <p className="text-xl font-bold tabular-nums">
                                {formatCurrency(stats.totalAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <Select value={periodFilter} onValueChange={setPeriodFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Periode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Pending</SelectItem>
                                <SelectItem value="today">Hari Ini</SelectItem>
                                <SelectItem value="week">Minggu Ini</SelectItem>
                                <SelectItem value="month">Bulan Ini</SelectItem>
                                <SelectItem value="overdue">Terlambat</SelectItem>
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
            ) : data.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
                        <h3 className="mt-4 text-lg font-medium">Tidak Ada Jadwal</h3>
                        <p className="mt-2 text-muted-foreground">
                            Tidak ada angsuran yang jatuh tempo dalam periode ini
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={data}
                    searchColumn="memberName"
                    searchPlaceholder="Cari nama anggota..."
                />
            )}
        </div>
    );
}
