"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Printer, Download, FileText } from "lucide-react";
import { receiptsApi } from "@/lib/api/services";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

interface Receipt {
    id: number;
    receiptNo: string;
    type: string;
    description: string;
    amount: number;
    receivedFrom: string;
    paymentMethod: string;
    status: string;
    receiptDate: string;
    printedAt?: string;
    member?: { id: number; memberNo: string; nrp?: string; name: string };
    createdBy?: { id: number; name: string };
}

const typeLabels: Record<string, string> = {
    simpanan: "Setoran Simpanan",
    pinjaman: "Pencairan Pinjaman",
    angsuran: "Pembayaran Angsuran",
    unit_transaction: "Transaksi Unit",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Draft", variant: "outline" },
    printed: { label: "Dicetak", variant: "default" },
    void: { label: "Batal", variant: "destructive" },
};

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

const columns: ColumnDef<Receipt>[] = [
    {
        accessorKey: "receiptNo",
        header: "No. Kwitansi",
        cell: ({ row }) => (
            <Link href={`/kwitansi/${row.original.id}/cetak`} className="font-mono text-primary hover:underline text-sm">
                {row.getValue("receiptNo")}
            </Link>
        ),
    },
    {
        accessorKey: "receiptDate",
        header: "Tanggal",
        cell: ({ row }) => {
            const date = row.getValue("receiptDate") as string;
            return date ? new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
        },
    },
    {
        accessorKey: "receivedFrom",
        header: "Diterima Dari",
        cell: ({ row }) => (
            <div>
                <div className="font-medium">{row.original.receivedFrom}</div>
                <div className="text-xs text-muted-foreground">{row.original.member?.memberNo}</div>
            </div>
        ),
    },
    {
        accessorKey: "type",
        header: "Jenis",
        cell: ({ row }) => (
            <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                {typeLabels[row.getValue("type") as string] || row.getValue("type")}
            </Badge>
        ),
    },
    {
        accessorKey: "description",
        header: "Keterangan",
        cell: ({ row }) => (
            <div className="max-w-[200px] truncate" title={row.original.description}>
                {row.original.description}
            </div>
        ),
    },
    {
        accessorKey: "amount",
        header: "Jumlah",
        cell: ({ row }) => (
            <span className="font-medium tabular-nums">{formatCurrency(row.getValue("amount") as number)}</span>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            const config = statusConfig[status] || { label: status, variant: "outline" as const };
            return <Badge variant={config.variant}>{config.label}</Badge>;
        },
    },
    {
        id: "actions",
        header: "",
        cell: ({ row }) => (
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/kwitansi/${row.original.id}/cetak`}>
                        <Printer className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
        ),
    },
];

const exportColumns: ExportColumn[] = [
    { header: "No. Kwitansi", key: "receiptNo", width: 20 },
    { header: "Tanggal", key: "receiptDate", width: 15, format: (v) => v ? new Date(v as string).toLocaleDateString("id-ID") : "-" },
    { header: "Diterima Dari", key: "receivedFrom", width: 25 },
    { header: "No. Anggota", key: "member.memberNo", width: 15 },
    { header: "Jenis", key: "type", width: 20, format: (v) => typeLabels[v as string] || String(v) },
    { header: "Keterangan", key: "description", width: 30 },
    { header: "Jumlah", key: "amount", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Status", key: "status", width: 12, format: (v) => statusConfig[v as string]?.label || String(v) },
];

export default function KwitansiPage() {
    const [statusFilter, setStatusFilter] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [receipts, setReceipts] = React.useState<Receipt[]>([]);

    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const params: Record<string, string | number> = { perPage: 50 };
                if (statusFilter !== "all") params.status = statusFilter;
                const response = await receiptsApi.list(params);
                setReceipts((response.data || []) as unknown as Receipt[]);
            } catch (error) {
                console.error("Failed to fetch receipts:", error);
                setReceipts([]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [statusFilter]);

    const handleExportExcel = () => {
        exportToExcel(receipts as unknown as Record<string, unknown>[], exportColumns, "Daftar_Kwitansi", "Kwitansi");
    };

    const handleExportPDF = () => {
        exportToPDF(
            receipts as unknown as Record<string, unknown>[],
            exportColumns,
            "Daftar Kwitansi - Koperasi Primkoppol",
            "Daftar_Kwitansi",
            { subtitle: `Per ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` }
        );
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kwitansi"
                description="Kelola draft kwitansi dan cetak bukti pembayaran"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}>
                            <Download className="mr-2 h-4 w-4" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPDF}>
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                        <Button asChild>
                            <Link href="/kwitansi/tambah">
                                <Plus className="mr-2 h-4 w-4" />
                                Buat Kwitansi
                            </Link>
                        </Button>
                    </div>
                }
            />

            <div className="flex items-center gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="printed">Dicetak</SelectItem>
                        <SelectItem value="void">Batal</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                columns={columns}
                data={receipts}
                isLoading={isLoading}
                searchPlaceholder="Cari kwitansi..."
            />
        </div>
    );
}
