"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Plus,
    AlertCircle,
    CheckCircle,
    FileText,
    Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface AdjustmentEntry {
    id: number;
    journalNo: string;
    transactionDate: string;
    description: string;
    totalDebit: number;
    totalCredit: number;
    adjustmentType: string;
    status: "draft" | "posted";
    createdBy: { id: number; name: string };
}

const ADJUSTMENT_TYPES: Record<string, string> = {
    depreciation: "Penyusutan Aset",
    accrual: "Akrual",
    prepaid: "Biaya Dibayar Dimuka",
    provision: "Pencadangan",
    correction: "Koreksi",
};

export default function JurnalPenyesuaianPage() {
    const [data, setData] = React.useState<AdjustmentEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                const mockData: AdjustmentEntry[] = [
                    {
                        id: 1,
                        journalNo: "ADJ-2026-00001",
                        transactionDate: "2026-01-31",
                        description: "Penyusutan aset tetap bulan Januari 2026",
                        totalDebit: 5000000,
                        totalCredit: 5000000,
                        adjustmentType: "depreciation",
                        status: "posted",
                        createdBy: { id: 1, name: "Admin" },
                    },
                    {
                        id: 2,
                        journalNo: "ADJ-2026-00002",
                        transactionDate: "2026-01-31",
                        description: "Akrual bunga deposito",
                        totalDebit: 1500000,
                        totalCredit: 1500000,
                        adjustmentType: "accrual",
                        status: "posted",
                        createdBy: { id: 1, name: "Admin" },
                    },
                    {
                        id: 3,
                        journalNo: "ADJ-2026-00003",
                        transactionDate: "2026-01-31",
                        description: "Koreksi pembukuan simpanan",
                        totalDebit: 250000,
                        totalCredit: 250000,
                        adjustmentType: "correction",
                        status: "draft",
                        createdBy: { id: 1, name: "Admin" },
                    },
                ];

                setData(mockData);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Stats
    const stats = React.useMemo(() => {
        return {
            total: data.length,
            posted: data.filter(d => d.status === "posted").length,
            draft: data.filter(d => d.status === "draft").length,
            totalAmount: data.reduce((sum, d) => sum + d.totalDebit, 0),
        };
    }, [data]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Jurnal Penyesuaian"
                description="Entri jurnal penyesuaian akhir periode"
                actions={
                    <Button asChild>
                        <Link href="/jurnal/umum">
                            <Plus className="mr-2 h-4 w-4" />
                            Buat Penyesuaian
                        </Link>
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Jurnal</p>
                            <p className="text-2xl font-bold">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Posted</p>
                            <p className="text-2xl font-bold">{stats.posted}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Draft</p>
                            <p className="text-2xl font-bold">{stats.draft}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                            <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Nilai</p>
                            <p className="text-lg font-bold tabular-nums">
                                {formatCurrency(stats.totalAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>No. Jurnal</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            {new Date(row.transactionDate).toLocaleDateString("id-ID")}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            <Link
                                                href={`/jurnal/${row.id}`}
                                                className="text-primary hover:underline"
                                            >
                                                {row.journalNo}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">
                                            {row.description}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {ADJUSTMENT_TYPES[row.adjustmentType] || row.adjustmentType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatCurrency(row.totalDebit)}
                                        </TableCell>
                                        <TableCell>
                                            {row.status === "posted" ? (
                                                <Badge className="bg-emerald-100 text-emerald-700">
                                                    Posted
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">Draft</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Tidak ada jurnal penyesuaian
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
