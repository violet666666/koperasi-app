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
import { formatCurrency, LOAN_STATUS } from "@/lib/constants";
import { loansApi } from "@/lib/api";
import { DatePeriodFilter, matchesDateRange, type DateRange } from "@/components/patterns/date-period-filter";

// Loan type from API
interface Loan {
    id: number;
    loanNo: string;
    memberId: number;
    member?: { id: number; memberNo: string; name: string };
    principalAmount: number;
    principalOutstanding: number;
    principalPaid?: number;
    interestPaid?: number;
    interestOutstanding?: number;
    totalAmount?: number;
    tenorMonths?: number;
    monthlyInstallment?: number;
    disbursementDate?: string;
    status: string;
    _count?: { schedules: number };
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const config = LOAN_STATUS[status as keyof typeof LOAN_STATUS] || LOAN_STATUS.active;
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
    const totalPaid = Number(loan.principalPaid || 0) + Number(loan.interestPaid || 0);
    const totalAmount = Number(loan.totalAmount || loan.principalAmount || 0);
    const MathPercentage = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;
    // cap at 100 on UI just in case
    const percentage = MathPercentage > 100 ? 100 : MathPercentage;

    return (
        <div className="w-24">
            <Progress value={percentage} className="h-2" />
            <span className="text-xs text-muted-foreground">{MathPercentage}%</span>
        </div>
    );
}

// Table columns — enriched with 6 key loan parameters per operator requirement
const columns: ColumnDef<Loan>[] = [
    {
        accessorKey: "loanNo",
        header: "No. Pinjaman",
        cell: ({ row }) => (
            <Link
                href={`/pinjaman/${row.original.id}`}
                className="font-mono text-xs text-primary hover:underline"
            >
                {row.getValue("loanNo")}
            </Link>
        ),
    },
    {
        id: "member",
        accessorFn: (row) => `${row.member?.name || ''} ${row.member?.memberNo || ''}`,
        header: "Anggota",
        cell: ({ row }) => (
            <div>
                <Link
                    href={`/anggota/${row.original.memberId}`}
                    className="font-medium hover:underline text-sm"
                >
                    {row.original.member?.name || "-"}
                </Link>
                <div className="text-xs text-muted-foreground">
                    {row.original.member?.memberNo}
                </div>
            </div>
        ),
    },
    {
        accessorKey: "disbursementDate",
        header: "Tgl Pinjam",
        cell: ({ row }) => {
            const date = row.getValue("disbursementDate") as string | undefined;
            return date ? (
                <span className="text-xs tabular-nums">
                    {new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
            ) : <span className="text-muted-foreground text-xs">-</span>;
        },
    },
    {
        accessorKey: "principalAmount",
        header: "Plafond",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums text-sm">
                {formatCurrency(Number(row.getValue("principalAmount") || 0))}
            </span>
        ),
    },
    {
        accessorKey: "tenorMonths",
        header: "Tenor",
        cell: ({ row }) => {
            const tenor = row.getValue("tenorMonths") as number | undefined;
            return tenor ? <span className="text-sm tabular-nums">{tenor} bln</span> : <span className="text-muted-foreground text-xs">-</span>;
        },
    },
    {
        id: "paidInstallments",
        header: "Angsuran Ke",
        cell: ({ row }) => {
            const schedulesPaid = row.original._count?.schedules || 0;
            const tenor = row.original.tenorMonths || 0;
            // For migrated loans that have no LoanSchedule records,
            // calculate paid installments from principalPaid / monthlyInstallment
            let paidCount = schedulesPaid;
            if (paidCount === 0 && Number(row.original.principalPaid || 0) > 0 && Number(row.original.monthlyInstallment || 0) > 0) {
                paidCount = Math.round(Number(row.original.principalPaid) / Number(row.original.monthlyInstallment));
            }
            // Clamp to tenor
            if (tenor > 0 && paidCount > tenor) paidCount = tenor;
            return (
                <span className="text-sm tabular-nums">
                    <span className="font-semibold text-emerald-600">{paidCount}</span>
                    <span className="text-muted-foreground">/{tenor}</span>
                </span>
            );
        },
    },
    {
        accessorKey: "monthlyInstallment",
        header: "Angsuran/Bln",
        cell: ({ row }) => {
            const installment = Number(row.getValue("monthlyInstallment") || 0);
            return installment > 0 ? (
                <span className="font-medium tabular-nums text-sm text-primary">
                    {formatCurrency(installment)}
                </span>
            ) : <span className="text-muted-foreground text-xs">-</span>;
        },
    },
    {
        accessorKey: "principalOutstanding",
        header: "Sisa Pinjaman",
        cell: ({ row }) => (
            <span className="font-semibold tabular-nums text-sm text-red-600">
                {formatCurrency(Number(row.getValue("principalOutstanding") || 0))}
            </span>
        ),
    },
    {
        id: "progress",
        header: "Progress",
        cell: ({ row }) => <RepaymentProgress loan={row.original} />,
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
    const [dateRange, setDateRange] = React.useState<DateRange>({ start: null, end: null, mode: "all", label: "Semua Data" });
    const [globalStats, setGlobalStats] = React.useState<{ activeCount: number, totalOutstanding: number, paidOffCount: number }>({ activeCount: 0, totalOutstanding: 0, paidOffCount: 0 });

    // Calculate summary stats (now fetched from backend)
    const stats = React.useMemo(() => {
        return {
            activeCount: globalStats.activeCount,
            totalOutstanding: globalStats.totalOutstanding,
            paidOffThisMonth: globalStats.paidOffCount,
        };
    }, [globalStats]);

    // Fetch data from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                // Fetch all loans so the client-side DataTable can paginate through all 279+ data
                const response = await loansApi.list({ perPage: 5000 });
                setLoans(response.data as unknown as Loan[]);
                const meta = response.meta as any;
                if (meta?.stats) {
                    setGlobalStats({
                        activeCount: meta.stats.activeCount || 0,
                        totalOutstanding: meta.stats.totalOutstanding || 0,
                        paidOffCount: meta.stats.paidOffCount || 0,
                    });
                }
            } catch (error) {
                console.error("Failed to fetch loans:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    // Filter data
    const filteredLoans = React.useMemo(() => {
        return loans.filter((loan) => {
            const matchesStatus = statusFilter === "all" || loan.status === statusFilter;
            const matchesDate = matchesDateRange(loan.disbursementDate, dateRange);
            return matchesStatus && matchesDate;
        });
    }, [loans, statusFilter, dateRange]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pinjaman"
                description="Kelola pinjaman anggota PRIMKOPPOL"
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
                            <p className="text-sm text-muted-foreground">Total Pinjaman</p>
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
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4 items-center">
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
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <DatePeriodFilter onChange={setDateRange} showImportNote />
                        {dateRange.mode !== "all" && (
                            <p className="text-xs text-muted-foreground">Menampilkan: <strong>{dateRange.label}</strong></p>
                        )}
                    </CardContent>
                </Card>
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
