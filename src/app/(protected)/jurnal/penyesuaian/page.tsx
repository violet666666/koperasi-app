"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, AlertCircle, CheckCircle, FileText, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface AdjustmentEntry {
    id: number;
    journalNo: string;
    transactionDate: string;
    description: string;
    totalDebit: number;
    totalCredit: number;
    sourceType: string;
    isPosted: boolean;
    createdBy: { id: number; name: string };
}

const ADJUSTMENT_TYPES: Record<string, string> = {
    depreciation: "Penyusutan Aset", accrual: "Akrual", prepaid: "Biaya Dibayar Dimuka",
    provision: "Pencadangan", correction: "Koreksi",
};

export default function JurnalPenyesuaianPage() {
    const [data, setData] = React.useState<AdjustmentEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/journals?adjustment=true");
                if (!res.ok) throw new Error("Failed");
                const json = await res.json();
                setData(json.data || []);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    const stats = React.useMemo(() => ({
        total: data.length,
        posted: data.filter(d => d.isPosted).length,
        draft: data.filter(d => !d.isPosted).length,
        totalAmount: data.reduce((sum, d) => sum + d.totalDebit, 0),
    }), [data]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Jurnal Penyesuaian"
                description="Entri jurnal penyesuaian akhir periode"
                actions={<Button asChild><Link href="/jurnal/umum"><Plus className="mr-2 h-4 w-4" />Buat Penyesuaian</Link></Button>}
            />

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-primary/10 p-3"><FileText className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Jurnal</p><p className="text-2xl font-bold">{stats.total}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30"><CheckCircle className="h-5 w-5 text-emerald-600" /></div><div><p className="text-sm text-muted-foreground">Posted</p><p className="text-2xl font-bold">{stats.posted}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30"><AlertCircle className="h-5 w-5 text-amber-600" /></div><div><p className="text-sm text-muted-foreground">Draft</p><p className="text-2xl font-bold">{stats.draft}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30"><Calendar className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Total Nilai</p><p className="text-lg font-bold tabular-nums">{formatCurrency(stats.totalAmount)}</p></div></CardContent></Card>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
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
                                        <TableCell>{new Date(row.transactionDate).toLocaleDateString("id-ID")}</TableCell>
                                        <TableCell className="font-mono text-sm"><span className="text-primary">{row.journalNo}</span></TableCell>
                                        <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                                        <TableCell><Badge variant="outline">{row.sourceType ? (ADJUSTMENT_TYPES[row.sourceType] || row.sourceType) : "Penyesuaian"}</Badge></TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(row.totalDebit)}</TableCell>
                                        <TableCell>
                                            {row.isPosted ? (
                                                <Badge className="bg-emerald-100 text-emerald-700">Posted</Badge>
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
