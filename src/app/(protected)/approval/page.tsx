"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColumnDef } from "@tanstack/react-table";
import { ApprovalDialog, ApprovalItem } from "@/components/patterns/approval-dialog";
import {
    Check,
    X,
    Clock,
    FileText,
    CreditCard,
    Wallet,
} from "lucide-react";
import { formatCurrency, APPROVAL_STATUS } from "@/lib/constants";
import { approvalsApi } from "@/lib/api";



// Request type icons and labels
const REQUEST_TYPES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    loan_application: { label: "Pengajuan Pinjaman", icon: FileText, color: "blue" },
    loan_disbursement: { label: "Pencairan Pinjaman", icon: CreditCard, color: "purple" },
    savings_withdrawal: { label: "Penarikan Simpanan", icon: Wallet, color: "amber" },
    period_close: { label: "Tutup Periode", icon: Clock, color: "gray" },
    unit_void: { label: "Pembatalan Transaksi Unit", icon: X, color: "red" },
    void_store_sale: { label: "Pembatalan Transaksi Toko", icon: X, color: "red" },
};


// Status badge component
function StatusBadge({ status }: { status: string }) {
    const config = (APPROVAL_STATUS as Record<string, any>)[status] || { label: status, color: "secondary" };
    const icons: Record<string, any> = {
        pending: Clock,
        approved: Check,
        rejected: X,
        disbursed: Check,
    };
    const Icon = icons[status] || Clock;
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        warning: "secondary",
        success: "default",
        destructive: "destructive",
        secondary: "secondary",
        primary: "default",
    };

    return (
        <Badge variant={variants[config.color] || "secondary"} className="gap-1 capitalize">
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}

// Table columns
const columns: ColumnDef<ApprovalItem>[] = [
    {
        accessorKey: "referenceNo",
        header: "No. Referensi",
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue("referenceNo")}</span>,
    },
    {
        accessorKey: "requestType",
        header: "Jenis",
        cell: ({ row }) => {
            const type = row.getValue("requestType") as string;
            const config = REQUEST_TYPES[type] || { label: type, icon: FileText };
            const Icon = config.icon;
            return (
                <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{config.label}</span>
                </div>
            );
        },
    },
    {
        accessorKey: "description",
        header: "Keterangan",
        cell: ({ row }) => (
            <div className="max-w-[220px] truncate" title={row.getValue("description")}>
                {row.getValue("description") || "-"}
            </div>
        ),
    },
    // Kolom baru: Anggota / Pelanggan
    {
        id: "member",
        header: "Anggota / Pelanggan",
        cell: ({ row }) => {
            const item = row.original;
            // Void requests: ambil dari metadata
            const meta = (item.metadata || {}) as Record<string, any>;
            const memberName = meta.memberName && meta.memberName !== "-"
                ? meta.memberName
                : item.requestedBy?.name || null;
            const memberNrp = meta.memberNrp && meta.memberNrp !== "-" ? meta.memberNrp : null;
            const unitType = meta.unitType;

            if (!memberName) return <span className="text-muted-foreground text-xs">-</span>;

            return (
                <div>
                    <p className="font-medium text-sm truncate max-w-[160px]">{memberName}</p>
                    {memberNrp && (
                        <p className="text-xs text-muted-foreground font-mono">{memberNrp}</p>
                    )}
                    {unitType && (
                        <Badge variant="outline" className="text-[9px] mt-0.5 capitalize border-slate-300">
                            {unitType.replace(/_/g, " ")}
                        </Badge>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "amount",
        header: "Nominal",
        cell: ({ row }) => {
            const amount = row.getValue("amount") as number;
            return amount ? (
                <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
            ) : "-";
        },
    },
    {
        accessorKey: "requestedAt",
        header: "Diajukan",
        cell: ({ row }) => {
            const dateValue = row.getValue("requestedAt");
            if (!dateValue) return "-";
            const date = new Date(dateValue as string);
            return (
                <div>
                    <p>{date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                    <p className="text-xs text-muted-foreground">{row.original.requestedBy?.name}</p>
                </div>
            );
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
];


export default function ApprovalPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [approvals, setApprovals] = React.useState<ApprovalItem[]>([]);
    const [selectedApproval, setSelectedApproval] = React.useState<ApprovalItem | null>(null);
    const [dialogOpen, setDialogOpen] = React.useState(false);

    // Pagination state — per tab
    const [activeTab, setActiveTab] = React.useState("pending");
    const [pendingPage, setPendingPage] = React.useState({ pageIndex: 0, pageSize: 25 });
    const [historyPage, setHistoryPage] = React.useState({ pageIndex: 0, pageSize: 25 });
    const [pageInfo, setPageInfo] = React.useState({ total: 0, totalPages: 0 });
    const [pendingCount, setPendingCount] = React.useState(0);
    const [approvedCount, setApprovedCount] = React.useState(0);
    const [rejectedCount, setRejectedCount] = React.useState(0);

    // Counts — sourced from server-side totals
    const counts = React.useMemo(() => ({
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
    }), [pendingCount, approvedCount, rejectedCount]);

    // Current pagination for active tab
    const currentPagination = activeTab === "pending" ? pendingPage : historyPage;
    const setCurrentPagination = activeTab === "pending" ? setPendingPage : setHistoryPage;

    // Fetch approvals from API — server-side paginated
    const fetchApprovals = React.useCallback(async () => {
        try {
            setIsLoading(true);
            const status = activeTab === "pending" ? "pending" : "history";
            const page = currentPagination.pageIndex + 1;
            const perPage = currentPagination.pageSize;

            const res = await approvalsApi.list(status, { page, perPage });
            const raw = res as any;
            setApprovals((raw.data || []) as ApprovalItem[]);
            setPendingCount(raw.pendingCount ?? 0);
            setApprovedCount(raw.approvedCount ?? 0);
            setRejectedCount(raw.rejectedCount ?? 0);
            if (raw.pagination) {
                setPageInfo({
                    total: raw.pagination.total as number,
                    totalPages: raw.pagination.totalPages as number,
                });
            }
        } catch (error) {
            console.error("Failed to fetch approvals:", error);
            setApprovals([]);
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, currentPagination]);

    React.useEffect(() => {
        fetchApprovals();
    }, [fetchApprovals]);

    // Handle pagination change from DataTable
    const handlePaginationChange = (updater: any) => {
        setCurrentPagination((prev: { pageIndex: number; pageSize: number }) =>
            typeof updater === "function" ? updater(prev) : updater
        );
    };

    // Handle tab change
    const handleTabChange = (value: string) => {
        setActiveTab(value);
    };


    // Data sudah terfilter dari server berdasarkan tab aktif
    const displayData = approvals;

    // Add action column for pending
    const pendingColumns: ColumnDef<ApprovalItem>[] = [
        ...columns,
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedApproval(row.original); setDialogOpen(true); }}>
                        Review
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Persetujuan"
                description="Kelola permintaan yang memerlukan persetujuan"
            />

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className={counts.pending > 0 ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20" : ""}>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Menunggu</p>
                            <p className="text-2xl font-bold">{counts.pending}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Check className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Disetujui</p>
                            <p className="text-2xl font-bold">{counts.approved}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            <X className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Ditolak</p>
                            <p className="text-2xl font-bold">{counts.rejected}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="pending" className="gap-2">
                        Menunggu Persetujuan
                        {counts.pending > 0 && (
                            <Badge variant="secondary" className="ml-1">{counts.pending}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="history">Riwayat</TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                    <DataTable
                        columns={pendingColumns}
                        data={displayData}
                        isLoading={isLoading}
                        searchPlaceholder="Cari pengajuan..."
                        manualPagination={true}
                        pageCount={pageInfo.totalPages}
                        pagination={currentPagination}
                        onPaginationChange={handlePaginationChange}
                        totalRows={pageInfo.total}
                        pageSize={currentPagination.pageSize}
                    />
                </TabsContent>

                <TabsContent value="history">
                    <DataTable
                        columns={columns}
                        data={displayData}
                        isLoading={isLoading}
                        searchPlaceholder="Cari riwayat..."
                        manualPagination={true}
                        pageCount={pageInfo.totalPages}
                        pagination={currentPagination}
                        onPaginationChange={handlePaginationChange}
                        totalRows={pageInfo.total}
                        pageSize={currentPagination.pageSize}
                    />
                </TabsContent>
            </Tabs>

            <ApprovalDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                approval={selectedApproval}
                onSuccess={fetchApprovals}
            />
        </div>
    );
}
