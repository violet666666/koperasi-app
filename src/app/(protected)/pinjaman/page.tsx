"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
    Plus,
    MoreHorizontal,
    Eye,
    CreditCard,
    Receipt,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
} from "lucide-react";
import type { Loan } from "@/types";
import { formatCurrency, LOAN_STATUS } from "@/lib/constants";

// Mock data
const MOCK_LOANS: Loan[] = [
    {
        id: 1,
        loan_no: "PJM-2024-00001",
        application_id: 1,
        member_id: 1,
        member: { member_no: "A-001", name: "Budi Santoso" },
        branch_id: 1,
        product_snapshot: {
            product_id: 1,
            code: "PJM-REG",
            name: "Pinjaman Reguler",
            interest_method: "flat",
            interest_rate: 1.5,
        },
        principal_amount: 10000000,
        interest_amount: 1800000,
        total_amount: 11800000,
        admin_fee: 100000,
        disbursed_amount: 9900000,
        tenor_months: 12,
        monthly_installment: 983333,
        principal_paid: 2500000,
        interest_paid: 450000,
        late_fee_paid: 0,
        principal_outstanding: 7500000,
        interest_outstanding: 1350000,
        disbursement_date: "2024-06-15",
        first_due_date: "2024-07-15",
        last_due_date: "2025-06-15",
        status: "active",
        created_at: "2024-06-15T10:00:00Z",
    },
    {
        id: 2,
        loan_no: "PJM-2024-00002",
        application_id: 2,
        member_id: 3,
        member: { member_no: "A-003", name: "Joko Widodo" },
        branch_id: 2,
        product_snapshot: {
            product_id: 2,
            code: "PJM-USAHA",
            name: "Pinjaman Usaha",
            interest_method: "annuity",
            interest_rate: 1.2,
        },
        principal_amount: 25000000,
        interest_amount: 3600000,
        total_amount: 28600000,
        admin_fee: 250000,
        disbursed_amount: 24750000,
        tenor_months: 12,
        monthly_installment: 2383333,
        principal_paid: 10000000,
        interest_paid: 1800000,
        late_fee_paid: 50000,
        principal_outstanding: 15000000,
        interest_outstanding: 1800000,
        disbursement_date: "2024-04-20",
        first_due_date: "2024-05-20",
        last_due_date: "2025-04-20",
        status: "active",
        created_at: "2024-04-20T14:00:00Z",
    },
    {
        id: 3,
        loan_no: "PJM-2024-00003",
        application_id: 3,
        member_id: 2,
        member: { member_no: "A-002", name: "Siti Aminah" },
        branch_id: 1,
        product_snapshot: {
            product_id: 1,
            code: "PJM-REG",
            name: "Pinjaman Reguler",
            interest_method: "flat",
            interest_rate: 1.5,
        },
        principal_amount: 5000000,
        interest_amount: 450000,
        total_amount: 5450000,
        admin_fee: 50000,
        disbursed_amount: 4950000,
        tenor_months: 6,
        monthly_installment: 908333,
        principal_paid: 5000000,
        interest_paid: 450000,
        late_fee_paid: 0,
        principal_outstanding: 0,
        interest_outstanding: 0,
        disbursement_date: "2024-03-10",
        first_due_date: "2024-04-10",
        last_due_date: "2024-09-10",
        paid_off_date: "2024-09-08",
        status: "paid_off",
        created_at: "2024-03-10T09:00:00Z",
    },
];

// Status badge component
function StatusBadge({ status }: { status: keyof typeof LOAN_STATUS }) {
    const config = LOAN_STATUS[status];
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        success: "default",
        primary: "default",
        warning: "secondary",
        secondary: "secondary",
        destructive: "destructive",
    };

    return (
        <Badge variant={variants[config.color] || "secondary"}>
            {config.label}
        </Badge>
    );
}

// Progress component for loan repayment
function RepaymentProgress({ loan }: { loan: Loan }) {
    const totalPaid = loan.principal_paid + loan.interest_paid;
    const percentage = Math.round((totalPaid / loan.total_amount) * 100);

    return (
        <div className="w-24">
            <Progress value={percentage} className="h-2" />
            <span className="text-xs text-muted-foreground">{percentage}%</span>
        </div>
    );
}

// Table columns
const columns: ColumnDef<Loan>[] = [
    {
        accessorKey: "loan_no",
        header: "No. Pinjaman",
        cell: ({ row }) => (
            <Link
                href={`/pinjaman/${row.original.id}`}
                className="font-mono text-sm text-primary hover:underline"
            >
                {row.getValue("loan_no")}
            </Link>
        ),
    },
    {
        accessorKey: "member",
        header: "Anggota",
        cell: ({ row }) => (
            <div>
                <Link
                    href={`/anggota/${row.original.member_id}`}
                    className="font-medium hover:underline"
                >
                    {row.original.member?.name}
                </Link>
                <div className="text-sm text-muted-foreground">
                    {row.original.member?.member_no}
                </div>
            </div>
        ),
    },
    {
        accessorKey: "product_snapshot",
        header: "Produk",
        cell: ({ row }) => row.original.product_snapshot.name,
    },
    {
        accessorKey: "principal_amount",
        header: "Pokok",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums">
                {formatCurrency(row.getValue("principal_amount"))}
            </span>
        ),
    },
    {
        accessorKey: "principal_outstanding",
        header: "Sisa Pokok",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums">
                {formatCurrency(row.getValue("principal_outstanding"))}
            </span>
        ),
    },
    {
        id: "progress",
        header: "Progress",
        cell: ({ row }) => <RepaymentProgress loan={row.original} />,
    },
    {
        accessorKey: "tenor_months",
        header: "Tenor",
        cell: ({ row }) => `${row.getValue("tenor_months")} bulan`,
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const loan = row.original;
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href={`/pinjaman/${loan.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Lihat Detail
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href={`/pinjaman/${loan.id}/jadwal`}>
                                <Receipt className="mr-2 h-4 w-4" />
                                Jadwal Angsuran
                            </Link>
                        </DropdownMenuItem>
                        {loan.status === "active" && (
                            <DropdownMenuItem asChild>
                                <Link href={`/pinjaman/angsuran/bayar?loan_id=${loan.id}`}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Bayar Angsuran
                                </Link>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

export default function PinjamanListPage() {
    const router = useRouter();
    const [statusFilter, setStatusFilter] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [loans, setLoans] = React.useState<Loan[]>([]);

    // Calculate summary stats
    const stats = React.useMemo(() => {
        const active = loans.filter((l) => l.status === "active");
        const totalOutstanding = active.reduce(
            (sum, l) => sum + l.principal_outstanding + l.interest_outstanding,
            0
        );
        const totalPrincipal = active.reduce((sum, l) => sum + l.principal_amount, 0);

        return {
            activeCount: active.length,
            totalOutstanding,
            totalPrincipal,
            paidOffThisMonth: loans.filter((l) => l.status === "paid_off").length,
        };
    }, [loans]);

    // Simulate data loading
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setLoans(MOCK_LOANS);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Filter data
    const filteredLoans = React.useMemo(() => {
        return loans.filter((loan) => {
            return statusFilter === "all" || loan.status === statusFilter;
        });
    }, [loans, statusFilter]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pinjaman"
                description="Kelola pinjaman anggota koperasi"
                actions={
                    <Button asChild>
                        <Link href="/pinjaman/pengajuan/tambah">
                            <Plus className="mr-2 h-4 w-4" />
                            Pengajuan Baru
                        </Link>
                    </Button>
                }
            />

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3 text-primary">
                            <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pinjaman Aktif</p>
                            <p className="text-2xl font-bold">{stats.activeCount}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Outstanding</p>
                            <p className="text-xl font-bold tabular-nums">
                                {formatCurrency(stats.totalOutstanding)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Lunas Bulan Ini</p>
                            <p className="text-2xl font-bold">{stats.paidOffThisMonth}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Jatuh Tempo</p>
                            <p className="text-2xl font-bold">0</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="paid_off">Lunas</SelectItem>
                        <SelectItem value="written_off">Hapus Buku</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={filteredLoans}
                isLoading={isLoading}
                searchPlaceholder="Cari no. pinjaman atau nama anggota..."
                onRowClick={(row) => router.push(`/pinjaman/${row.id}`)}
            />
        </div>
    );
}
