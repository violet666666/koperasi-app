"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { Download, Users, UserCheck, UserX, UserPlus, FileText, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { reportsApi } from "@/lib/api";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

interface MemberSummary {
    id: number;
    memberNo: string;
    name: string;
    phone: string;
    status: string;
    joinDate: string;
    totalSavings: number;
    totalLoans: number;
}

interface RecapStats {
    total: number;
    active: number;
    inactive: number;
    resigned: number;
}

interface PaginationMeta {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
}

interface RecapResponse {
    members: MemberSummary[];
    summary: RecapStats;
    pagination?: PaginationMeta;
}

// Table columns
const columns: ColumnDef<MemberSummary>[] = [
    {
        accessorKey: "memberNo",
        header: "NRP",
        cell: ({ row }) => (
            <Link href={`/anggota/${row.original.id}`} className="font-mono text-primary hover:underline">
                {row.getValue("memberNo")}
            </Link>
        ),
    },
    {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
        accessorKey: "phone",
        header: "Telepon",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            const statusLabels: Record<string, string> = { active: "Aktif", inactive: "Tidak Aktif", pending: "Pending", resigned: "Keluar" };
            return (
                <Badge variant={status === "active" ? "default" : status === "pending" ? "outline" : "secondary"}>
                    {statusLabels[status] || status}
                </Badge>
            );
        },
    },
    {
        accessorKey: "joinDate",
        header: "Tgl Bergabung",
        cell: ({ row }) => {
            const date = row.getValue("joinDate") as string;
            return date ? new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
        },
    },
    {
        accessorKey: "totalSavings",
        header: "Total Simpanan",
        cell: ({ row }) => (
            <span className="tabular-nums text-emerald-600">{formatCurrency(row.getValue("totalSavings"))}</span>
        ),
    },
    {
        accessorKey: "totalLoans",
        header: "Sisa Pinjaman",
        cell: ({ row }) => {
            const loans = row.getValue("totalLoans") as number;
            return loans > 0 ? (
                <span className="tabular-nums text-amber-600">{formatCurrency(loans)}</span>
            ) : (
                <span className="text-muted-foreground">-</span>
            );
        },
    },
];

const exportColumns: ExportColumn[] = [
    { header: "NRP", key: "memberNo", width: 15 },
    { header: "Nama", key: "name", width: 25 },
    { header: "Telepon", key: "phone", width: 15 },
    { header: "Status", key: "status", width: 12, format: (v) => { const labels: Record<string, string> = { active: "Aktif", inactive: "Tidak Aktif", resigned: "Keluar" }; return labels[v as string] || String(v); } },
    { header: "Tgl Bergabung", key: "joinDate", width: 15, format: (v) => v ? new Date(v as string).toLocaleDateString("id-ID") : "-" },
    { header: "Total Simpanan", key: "totalSavings", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Sisa Pinjaman", key: "totalLoans", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
];

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
    const colorClasses: Record<string, string> = {
        primary: "bg-primary/10 text-primary",
        emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
        amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
        blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    };

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center gap-4">
                    <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
                        <Icon className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="text-2xl font-bold tabular-nums">{value}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function RekapAnggotaPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [members, setMembers] = React.useState<MemberSummary[]>([]);
    const [stats, setStats] = React.useState<RecapStats>({ total: 0, active: 0, inactive: 0, resigned: 0 });
    const [isExporting, setIsExporting] = React.useState(false);

    // Server-side pagination state
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 });
    const [paginationMeta, setPaginationMeta] = React.useState<PaginationMeta | null>(null);

    const fetchData = React.useCallback(async (page: number, perPage: number) => {
        setIsLoading(true);
        try {
            const response = await reportsApi.membersRecap({ page, perPage });
            const data = response.data as unknown as RecapResponse;

            if (data.members) {
                setMembers(data.members);
                setStats(data.summary || { total: data.members.length, active: 0, inactive: 0, resigned: 0 });
                setPaginationMeta(data.pagination || null);
            } else {
                setMembers([]);
                setStats({ total: 0, active: 0, inactive: 0, resigned: 0 });
                setPaginationMeta(null);
            }
        } catch (error) {
            console.error("Failed to fetch members recap:", error);
            setMembers([]);
            setStats({ total: 0, active: 0, inactive: 0, resigned: 0 });
            setPaginationMeta(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch paginated data on mount and when page changes
    React.useEffect(() => {
        fetchData(pagination.pageIndex + 1, pagination.pageSize);
    }, [pagination.pageIndex, pagination.pageSize, fetchData]);

    // Fetch ALL members for export (no pagination)
    const fetchAllMembers = React.useCallback(async (): Promise<MemberSummary[]> => {
        const response = await reportsApi.membersRecap({ export: "true" });
        const data = response.data as unknown as RecapResponse;
        return data.members || [];
    }, []);

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const allMembers = await fetchAllMembers();
            exportToExcel(allMembers as unknown as Record<string, unknown>[], exportColumns, "Rekap_Anggota", "Anggota");
        } catch (error) {
            console.error("Export Excel failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const allMembers = await fetchAllMembers();
            exportToPDF(allMembers as unknown as Record<string, unknown>[], exportColumns, "Rekap Anggota - PRIMKOPPOL Resor Lumajang", "Rekap_Anggota");
        } catch (error) {
            console.error("Export PDF failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const handlePaginationChange = (updater: any) => {
        setPagination(prev => {
            const next = typeof updater === "function" ? updater(prev) : updater;
            return { ...prev, ...next };
        });
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Rekap Anggota"
                description="Rangkuman data seluruh anggota PRIMKOPPOL"
                backHref="/laporan"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isExporting}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                            PDF
                        </Button>
                    </div>
                }
            />

            {/* Stats */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <StatCard icon={Users} label="Total Anggota" value={stats.total} color="primary" />
                <StatCard icon={UserCheck} label="Aktif" value={stats.active} color="emerald" />
                <StatCard icon={UserX} label="Non-Aktif" value={stats.inactive} color="amber" />
                <StatCard icon={UserPlus} label="Keluar" value={stats.resigned} color="blue" />
            </div>

            {/* Data Table with server-side pagination */}
            <DataTable
                columns={columns}
                data={members}
                isLoading={isLoading}
                searchPlaceholder="Cari anggota..."
                searchColumn="name"
                manualPagination
                pageCount={paginationMeta?.totalPages ?? 1}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                totalRows={paginationMeta?.totalItems ?? 0}
            />
        </div>
    );
}
