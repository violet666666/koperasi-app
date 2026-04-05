"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { ApprovalDialog, ApprovalItem } from "@/components/patterns/approval-dialog";
import {
    Check,
    X,
    Clock,
    FileText,
    CreditCard,
    Wallet,
    Loader2,
} from "lucide-react";
import { formatCurrency, APPROVAL_STATUS } from "@/lib/constants";
import { approvalsApi, loansApi } from "@/lib/api";



// Request type icons and labels
const REQUEST_TYPES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    loan_application: { label: "Pengajuan Pinjaman", icon: FileText, color: "blue" },
    loan_disbursement: { label: "Pencairan Pinjaman", icon: CreditCard, color: "purple" },
    savings_withdrawal: { label: "Penarikan Simpanan", icon: Wallet, color: "amber" },
    period_close: { label: "Tutup Periode", icon: Clock, color: "gray" },
    unit_void: { label: "Pembatalan Transaksi Unit", icon: X, color: "red" },
};


// Status badge component
function StatusBadge({ status }: { status: string }) {
    const config = (APPROVAL_STATUS as Record<string, any>)[status] || { label: status, color: "secondary" };
    const icons: Record<string, any> = {
        pending: Clock,
        approved: Check,
        rejected: X,
    };
    const Icon = icons[status] || Clock;
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        warning: "secondary",
        success: "default",
        destructive: "destructive",
        secondary: "secondary",
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
        cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("referenceNo")}</span>,
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
            <div className="max-w-[250px] truncate" title={row.getValue("description")}>
                {row.getValue("description") || "-"}
            </div>
        ),
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

    // Counts
    const counts = React.useMemo(() => ({
        pending: approvals.filter((a) => a.status === "pending").length,
        approved: approvals.filter((a) => a.status === "approved").length,
        rejected: approvals.filter((a) => a.status === "rejected").length,
    }), [approvals]);

    // Fetch approvals from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [pendingRes, historyRes] = await Promise.all([
                    approvalsApi.list("pending"),
                    approvalsApi.list("history")
                ]);
                const combined = [
                    ...((pendingRes as any).data || []),
                    ...((historyRes as any).data || [])
                ];
                setApprovals(combined);
            } catch (error) {
                console.error("Failed to fetch approvals:", error);
                setApprovals([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    const fetchApprovals = async () => {
        try {
            const [pendingRes, historyRes] = await Promise.all([
                approvalsApi.list("pending"),
                approvalsApi.list("history")
            ]);
            const combined = [
                ...((pendingRes as any).data || []),
                ...((historyRes as any).data || [])
            ];
            setApprovals(combined);
        } catch (error) {
            console.error("Failed to fetch approvals:", error);
        }
    };


    // Pending approvals only
    const pendingApprovals = approvals.filter((a) => a.status === "pending");
    const historyApprovals = approvals.filter((a) => a.status !== "pending");

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
            <Tabs defaultValue="pending" className="space-y-4">
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
                        data={pendingApprovals}
                        isLoading={isLoading}
                        searchPlaceholder="Cari pengajuan..."
                    />
                </TabsContent>

                <TabsContent value="history">
                    <DataTable
                        columns={columns}
                        data={historyApprovals}
                        isLoading={isLoading}
                        searchPlaceholder="Cari riwayat..."
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
