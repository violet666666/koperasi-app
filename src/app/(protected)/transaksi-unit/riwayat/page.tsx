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
import { Plus, Download, FileText, Paperclip } from "lucide-react";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

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
    const [perPage, setPerPage] = React.useState(10);

    const { data: response, isLoading } = useQuery({
        queryKey: ["unit-transactions", page, perPage],
        queryFn: () => unitTransactionsApi.list({ page, perPage }),
    });

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
            accessorKey: "isPaid",
            cell: ({ row }) => {
                const tx = row.original;
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
    ];

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

            <DataTable
                columns={columns}
                data={response?.data || []}
                isLoading={isLoading}
            />
        </div>
    );
}
