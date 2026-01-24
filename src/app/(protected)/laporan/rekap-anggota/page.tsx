"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Users, UserCheck, UserX, UserPlus } from "lucide-react";
import { formatCurrency, formatNumber, MEMBER_STATUS } from "@/lib/constants";

interface MemberSummary {
    id: number;
    member_no: string;
    name: string;
    phone: string;
    branch: string;
    status: "active" | "inactive" | "pending";
    join_date: string;
    total_savings: number;
    total_loans: number;
}

// Mock data
const MOCK_MEMBERS: MemberSummary[] = [
    { id: 1, member_no: "A-001", name: "Budi Santoso", phone: "081234567890", branch: "Pusat", status: "active", join_date: "2020-01-15", total_savings: 15000000, total_loans: 0 },
    { id: 2, member_no: "A-002", name: "Siti Aminah", phone: "081234567891", branch: "Jakarta", status: "active", join_date: "2020-03-20", total_savings: 25000000, total_loans: 10000000 },
    { id: 3, member_no: "A-003", name: "Joko Widodo", phone: "081234567892", branch: "Surabaya", status: "active", join_date: "2021-06-10", total_savings: 8000000, total_loans: 5000000 },
    { id: 4, member_no: "A-004", name: "Dewi Lestari", phone: "081234567893", branch: "Pusat", status: "inactive", join_date: "2019-08-05", total_savings: 5000000, total_loans: 0 },
    { id: 5, member_no: "A-005", name: "Ahmad Ridwan", phone: "081234567894", branch: "Jakarta", status: "active", join_date: "2022-01-01", total_savings: 30000000, total_loans: 20000000 },
    { id: 6, member_no: "A-006", name: "Rina Wati", phone: "081234567895", branch: "Surabaya", status: "pending", join_date: "2024-11-15", total_savings: 150000, total_loans: 0 },
];

// Table columns
const columns: ColumnDef<MemberSummary>[] = [
    {
        accessorKey: "member_no",
        header: "No. Anggota",
        cell: ({ row }) => (
            <Link href={`/anggota/${row.original.id}`} className="font-mono text-primary hover:underline">
                {row.getValue("member_no")}
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
        accessorKey: "branch",
        header: "Cabang",
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
        accessorKey: "join_date",
        header: "Tgl Bergabung",
        cell: ({ row }) => new Date(row.getValue("join_date")).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
    },
    {
        accessorKey: "total_savings",
        header: "Total Simpanan",
        cell: ({ row }) => (
            <span className="tabular-nums text-emerald-600">{formatCurrency(row.getValue("total_savings"))}</span>
        ),
    },
    {
        accessorKey: "total_loans",
        header: "Sisa Pinjaman",
        cell: ({ row }) => {
            const loans = row.getValue("total_loans") as number;
            return loans > 0 ? (
                <span className="tabular-nums text-amber-600">{formatCurrency(loans)}</span>
            ) : (
                <span className="text-muted-foreground">-</span>
            );
        },
    },
];

export default function RekapAnggotaPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [branch, setBranch] = React.useState("all");
    const [status, setStatus] = React.useState("all");

    React.useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, [branch, status]);

    const filteredMembers = MOCK_MEMBERS.filter((m) => {
        if (branch !== "all" && m.branch !== branch) return false;
        if (status !== "all" && m.status !== status) return false;
        return true;
    });

    const activeCount = MOCK_MEMBERS.filter((m) => m.status === "active").length;
    const inactiveCount = MOCK_MEMBERS.filter((m) => m.status === "inactive").length;
    const pendingCount = MOCK_MEMBERS.filter((m) => m.status === "pending").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Rekap Anggota"
                description="Rekapitulasi data anggota koperasi"
                backHref="/laporan"
                actions={
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
                }
            />

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Anggota</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(MOCK_MEMBERS.length)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Anggota Aktif</CardTitle>
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatNumber(activeCount)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Anggota Keluar</CardTitle>
                        <UserX className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(inactiveCount)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Calon Anggota</CardTitle>
                        <UserPlus className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{formatNumber(pendingCount)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <Select value={branch} onValueChange={setBranch}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Semua Cabang" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Cabang</SelectItem>
                        <SelectItem value="Pusat">Kantor Pusat</SelectItem>
                        <SelectItem value="Jakarta">Cabang Jakarta</SelectItem>
                        <SelectItem value="Surabaya">Cabang Surabaya</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Tidak Aktif</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <Skeleton className="h-64" />
            ) : (
                <DataTable
                    columns={columns}
                    data={filteredMembers}
                    searchPlaceholder="Cari anggota..."
                    searchColumn="name"
                />
            )}
        </div>
    );
}
