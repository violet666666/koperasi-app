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
import { Plus } from "lucide-react";

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
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Riwayat Transaksi Unit"
                description="Monitor semua transaksi dari unit-unit koperasi"
                actions={(
                    <Button asChild>
                        <Link href="/transaksi-unit">
                            <Plus className="mr-2 h-4 w-4" />
                            Input Transaksi Baru
                        </Link>
                    </Button>
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
