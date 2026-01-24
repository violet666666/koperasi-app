"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import {
    Check,
    X,
    Clock,
    FileText,
    CreditCard,
    Wallet,
    Eye,
    Loader2,
} from "lucide-react";
import { formatCurrency, APPROVAL_STATUS } from "@/lib/constants";

// Local type for approval data (simplified for this page)
interface ApprovalItem {
    id: number;
    request_type: string;
    reference_id: number;
    reference_no: string;
    description: string;
    amount?: number;
    branch_id: number;
    status: "pending" | "approved" | "rejected";
    requested_by: { id: number; name: string };
    requested_at: string;
    processed_by?: { id: number; name: string };
    processed_at?: string;
    notes?: string;
}

// Mock data
const MOCK_APPROVALS: ApprovalItem[] = [
    {
        id: 1,
        request_type: "loan_application",
        reference_id: 5,
        reference_no: "PLJ-2025-00005",
        description: "Pengajuan Pinjaman Reguler - Ahmad Ridwan (A-005)",
        amount: 15000000,
        branch_id: 1,
        status: "pending",
        requested_by: { id: 3, name: "Teller 1" },
        requested_at: "2025-01-24T10:00:00Z",
    },
    {
        id: 2,
        request_type: "loan_disbursement",
        reference_id: 4,
        reference_no: "PJM-2025-00004",
        description: "Pencairan Pinjaman - Dewi Lestari (A-004)",
        amount: 8000000,
        branch_id: 2,
        status: "pending",
        requested_by: { id: 4, name: "Supervisor Cabang" },
        requested_at: "2025-01-24T09:30:00Z",
    },
    {
        id: 3,
        request_type: "savings_withdrawal",
        reference_id: 10,
        reference_no: "SIM-2025-00010",
        description: "Penarikan Simpanan Sukarela > 5jt - Budi Santoso (A-001)",
        amount: 7500000,
        branch_id: 1,
        status: "pending",
        requested_by: { id: 3, name: "Teller 1" },
        requested_at: "2025-01-24T08:45:00Z",
    },
    {
        id: 4,
        request_type: "loan_application",
        reference_id: 3,
        reference_no: "PLJ-2025-00003",
        description: "Pengajuan Pinjaman Usaha - Siti Aminah (A-002)",
        amount: 50000000,
        branch_id: 1,
        status: "approved",
        requested_by: { id: 3, name: "Teller 1" },
        requested_at: "2025-01-23T14:00:00Z",
        processed_by: { id: 1, name: "Admin Pusat" },
        processed_at: "2025-01-23T15:30:00Z",
    },
    {
        id: 5,
        request_type: "loan_application",
        reference_id: 2,
        reference_no: "PLJ-2025-00002",
        description: "Pengajuan Pinjaman Darurat - Joko Widodo (A-003)",
        amount: 3000000,
        branch_id: 2,
        status: "rejected",
        requested_by: { id: 4, name: "Supervisor Cabang" },
        requested_at: "2025-01-22T11:00:00Z",
        processed_by: { id: 1, name: "Admin Pusat" },
        processed_at: "2025-01-22T14:00:00Z",
        notes: "Masih memiliki tunggakan pinjaman aktif",
    },
];

// Request type icons and labels
const REQUEST_TYPES = {
    loan_application: { label: "Pengajuan Pinjaman", icon: FileText, color: "blue" },
    loan_disbursement: { label: "Pencairan Pinjaman", icon: CreditCard, color: "purple" },
    savings_withdrawal: { label: "Penarikan Simpanan", icon: Wallet, color: "amber" },
    period_close: { label: "Tutup Periode", icon: Clock, color: "gray" },
};

// Status badge component
function StatusBadge({ status }: { status: keyof typeof APPROVAL_STATUS }) {
    const config = APPROVAL_STATUS[status];
    const icons = {
        pending: Clock,
        approved: Check,
        rejected: X,
    };
    const Icon = icons[status];
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        warning: "secondary",
        success: "default",
        destructive: "destructive",
    };

    return (
        <Badge variant={variants[config.color]} className="gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}

// Table columns
const columns: ColumnDef<ApprovalItem>[] = [
    {
        accessorKey: "reference_no",
        header: "No. Referensi",
        cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("reference_no")}</span>,
    },
    {
        accessorKey: "request_type",
        header: "Jenis",
        cell: ({ row }) => {
            const type = row.getValue("request_type") as keyof typeof REQUEST_TYPES;
            const config = REQUEST_TYPES[type];
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
                {row.getValue("description")}
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
        accessorKey: "requested_at",
        header: "Diajukan",
        cell: ({ row }) => {
            const date = new Date(row.getValue("requested_at"));
            return (
                <div>
                    <p>{date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                    <p className="text-xs text-muted-foreground">{row.original.requested_by?.name}</p>
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
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(true);
    const [approvals, setApprovals] = React.useState<ApprovalItem[]>([]);
    const [selectedApproval, setSelectedApproval] = React.useState<ApprovalItem | null>(null);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogAction, setDialogAction] = React.useState<"approve" | "reject" | null>(null);
    const [notes, setNotes] = React.useState("");
    const [processing, setProcessing] = React.useState(false);

    // Counts
    const counts = React.useMemo(() => ({
        pending: approvals.filter((a) => a.status === "pending").length,
        approved: approvals.filter((a) => a.status === "approved").length,
        rejected: approvals.filter((a) => a.status === "rejected").length,
    }), [approvals]);

    // Simulate loading
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setApprovals(MOCK_APPROVALS);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Handle action click
    const handleAction = (approval: ApprovalItem, action: "approve" | "reject") => {
        setSelectedApproval(approval);
        setDialogAction(action);
        setNotes("");
        setDialogOpen(true);
    };

    // Process approval
    const processApproval = async () => {
        if (!selectedApproval || !dialogAction) return;

        setProcessing(true);
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Update local state
            setApprovals((prev) =>
                prev.map((a) =>
                    a.id === selectedApproval.id
                        ? { ...a, status: dialogAction === "approve" ? "approved" : "rejected", notes }
                        : a
                )
            );

            toast.success(
                dialogAction === "approve"
                    ? "Pengajuan berhasil disetujui"
                    : "Pengajuan berhasil ditolak"
            );
            setDialogOpen(false);
        } catch (error) {
            toast.error("Gagal memproses pengajuan");
        } finally {
            setProcessing(false);
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
                    <Button size="sm" variant="default" onClick={() => handleAction(row.original, "approve")}>
                        <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(row.original, "reject")}>
                        <X className="h-4 w-4" />
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

            {/* Approval Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dialogAction === "approve" ? "Setujui Pengajuan" : "Tolak Pengajuan"}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedApproval?.description}
                            {selectedApproval?.amount && (
                                <span className="block mt-2 text-lg font-bold text-foreground">
                                    {formatCurrency(selectedApproval.amount)}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="notes">
                                Catatan {dialogAction === "reject" && <span className="text-red-500">*</span>}
                            </Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder={
                                    dialogAction === "reject"
                                        ? "Berikan alasan penolakan..."
                                        : "Catatan tambahan (opsional)"
                                }
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>
                            Batal
                        </Button>
                        <Button
                            variant={dialogAction === "approve" ? "default" : "destructive"}
                            onClick={processApproval}
                            disabled={processing || (dialogAction === "reject" && !notes.trim())}
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Memproses...
                                </>
                            ) : dialogAction === "approve" ? (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Setujui
                                </>
                            ) : (
                                <>
                                    <X className="mr-2 h-4 w-4" />
                                    Tolak
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
