"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { unitTransactionsApi, type UnitTransaction } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import { Plus, Download, FileText, Paperclip, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
import { DatePeriodFilter, matchesDateRange, type DateRange } from "@/components/patterns/date-period-filter";
import { Card, CardContent } from "@/components/ui/card";

const txExportColumns: ExportColumn[] = [
    { header: "No. Transaksi", key: "transactionNo", width: 20 },
    { header: "Tanggal", key: "transactionDate", width: 15, format: (v) => v ? new Date(v as string).toLocaleDateString("id-ID") : "-" },
    { header: "Anggota", key: "member.name", width: 25 },
    { header: "NRP", key: "member.nrp", width: 12 },
    { header: "Unit", key: "unitType", width: 15 },
    { header: "Keterangan", key: "description", width: 30 },
    { header: "Nominal", key: "amount", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Status", key: "isPaid", width: 12, format: (v) => v ? "LUNAS" : "BELUM LUNAS" },
];

export default function RiwayatTransaksiUnitPage() {
    const [page, setPage] = React.useState(1);
    const [perPage, setPerPage] = React.useState(9999);
    const [dateRange, setDateRange] = React.useState<DateRange>({ start: null, end: null, mode: "all", label: "Semua Data" });

    // Void state
    const queryClient = useQueryClient();
    const [isVoidModalOpen, setIsVoidModalOpen] = React.useState(false);
    const [selectedTx, setSelectedTx] = React.useState<UnitTransaction | null>(null);
    const [voidReason, setVoidReason] = React.useState("");
    const [isSubmittingVoid, setIsSubmittingVoid] = React.useState(false);

    const { data: response, isLoading } = useQuery({
        queryKey: ["unit-transactions", page, perPage],
        queryFn: () => unitTransactionsApi.list({ page, perPage }),
    });

    const filteredData = React.useMemo(() => {
        if (!response?.data) return [];
        return (response.data as unknown as UnitTransaction[]).filter(tx => 
            matchesDateRange(tx.transactionDate, dateRange)
        );
    }, [response, dateRange]);

    const getUnitName = (type: string) => {
        const types: Record<string, string> = {
            toko: "Toko",
            simpan_pinjam: "Simpan Pinjam",
            fotocopy: "FotoCopy",
            cuci_mobil: "Cuci Mobil",
            fitness: "Fitness",
        };
        return types[type] || type;
    };

    const columns: ColumnDef<UnitTransaction>[] = [
        {
            header: "No. Transaksi",
            accessorKey: "transactionNo",
            cell: ({ row }) => {
                const tx = row.original;
                return (
                    <div>
                        <div className="font-medium text-primary">{tx.transactionNo}</div>
                        <div className="text-xs text-muted-foreground">
                            {format(new Date(tx.transactionDate), "d MMM yyyy", { locale: id })}
                        </div>
                    </div>
                );
            },
        },
        {
            header: "Anggota",
            accessorKey: "memberId",
            cell: ({ row }) => {
                const tx = row.original;
                return (
                    <div>
                        <div className="font-medium">{tx.member?.name}</div>
                        <div className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-sm bg-muted inline-block mt-1">
                            NRP: {tx.member?.nrp || "-"}
                        </div>
                    </div>
                );
            },
        },
        {
            header: "Unit",
            accessorKey: "unitType",
            cell: ({ row }) => (
                <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200 uppercase text-[10px] whitespace-nowrap">
                    {getUnitName(row.original.unitType)}
                </Badge>
            ),
        },
        {
            header: "Keterangan",
            accessorKey: "description",
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate" title={row.original.description}>
                    {row.original.description}
                </div>
            ),
        },
        {
            header: "Nominal",
            accessorKey: "amount",
            cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.original.amount)}</div>,
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: ({ row }) => {
                const tx = row.original;
                const baseStatus = tx.status || "completed"; // fallback for old records
                
                if (baseStatus === "pending_void") {
                    return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">PENDING VOID</Badge>;
                }
                if (baseStatus === "voided") {
                    return <Badge variant="secondary" className="line-through text-muted-foreground">DIBATALKAN</Badge>;
                }
                
                return (
                    <Badge
                        variant={tx.isPaid ? "default" : "destructive"}
                        className={tx.isPaid ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                    >
                        {tx.isPaid ? "LUNAS" : "BELUM LUNAS"}
                    </Badge>
                );
            },
        },
        {
            header: "Dok.",
            accessorKey: "supportingDocPath",
            cell: ({ row }) => {
                const path = (row.original as unknown as Record<string, unknown>).supportingDocPath as string | undefined;
                return path ? (
                    <a href={path} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        <Paperclip className="h-4 w-4" />
                    </a>
                ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                );
            },
        },
        {
            header: "Aksi",
            id: "actions",
            cell: ({ row }) => {
                const tx = row.original;
                const baseStatus = tx.status || "completed";
                const isVoidable = baseStatus === "completed";

                if (!isVoidable) return <span className="text-muted-foreground text-xs text-center block">-</span>;

                return (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                            setSelectedTx(tx);
                            setVoidReason("");
                            setIsVoidModalOpen(true);
                        }}
                    >
                        <XCircle className="h-4 w-4 mr-1" />
                        Void
                    </Button>
                );
            },
        },
    ];

    const submitVoidRequest = async () => {
        if (!selectedTx) return;
        if (!voidReason.trim()) {
            toast.error("Alasan void harus diisi");
            return;
        }

        setIsSubmittingVoid(true);
        try {
            const res = await fetch("/api/unit-transactions/void-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedTx.id,
                    reason: voidReason,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Gagal mengajukan void");
            }

            toast.success("Pengajuan void berhasil dikirim. Menunggu persetujuan Admin.");
            setIsVoidModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["unit-transactions"] });
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmittingVoid(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Riwayat Transaksi Unit"
                description="Monitor semua transaksi dari unit-unit PRIMKOPPOL"
                actions={(
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportToExcel((response?.data || []) as unknown as Record<string, unknown>[], txExportColumns, "Riwayat_Transaksi_Unit", "Transaksi")}>
                            <Download className="mr-2 h-4 w-4" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportToPDF((response?.data || []) as unknown as Record<string, unknown>[], txExportColumns, "Riwayat Transaksi Unit - PRIMKOPPOL Resor Lumajang", "Riwayat_Transaksi_Unit")}>
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                        <Button asChild>
                            <Link href="/transaksi-unit">
                                <Plus className="mr-2 h-4 w-4" />
                                Input Transaksi Baru
                            </Link>
                        </Button>
                    </div>
                )}
            />

            <Card>
                <CardContent className="p-4 space-y-3">
                    <DatePeriodFilter onChange={setDateRange} showImportNote />
                    {dateRange.mode !== "all" && (
                        <p className="text-xs text-muted-foreground">Menampilkan: <strong>{dateRange.label}</strong></p>
                    )}
                </CardContent>
            </Card>

            <DataTable
                columns={columns}
                data={filteredData}
                isLoading={isLoading}
            />

            {/* Void Request Dialog */}
            <Dialog open={isVoidModalOpen} onOpenChange={setIsVoidModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ajukan Pembatalan (Void)</DialogTitle>
                        <DialogDescription>
                            Anda akan mengajukan void untuk transaksi <strong>{selectedTx?.transactionNo}</strong> senilai{" "}
                            <strong>{formatCurrency(selectedTx?.amount || 0)}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="voidReason">Alasan Void <span className="text-red-500">*</span></Label>
                            <Textarea
                                id="voidReason"
                                placeholder="Jelaskan alasan mengapa transaksi ini harus dibatalkan..."
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm border border-amber-200">
                            <strong>Perhatian:</strong> Pengajuan ini memerlukan persetujuan Admin Unit sebelum transaksi benar-benar dibatalkan (dibuatkan Jurnal Pembalik). Limit plafon piutang anggota baru akan dikembalikan setelah void disetujui.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsVoidModalOpen(false)} disabled={isSubmittingVoid}>
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={submitVoidRequest} disabled={isSubmittingVoid}>
                            {isSubmittingVoid ? "Memproses..." : "Ajukan Void"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
