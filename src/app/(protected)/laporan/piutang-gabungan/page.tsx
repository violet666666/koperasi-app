"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Download, FileSpreadsheet, FileText, Users, Banknote, ShoppingCart, Building2, Landmark, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useAuth } from "@/lib/hooks";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

// -- Types --
interface PiutangItem {
    seq: number;
    nama: string;
    nrp: string;
    pangkat: string;
    kesatuan: string;
    piutangToko: number;
    piutangUnit: number;
    piutangSPPokok: number;
    piutangSPJasa: number;
    totalPiutang: number;
    angsuranKe: string;
    loanCount: number;
}

interface PaginationMeta {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
}

interface PiutangResponse {
    piutangList: PiutangItem[];
    totalAnggota: number;
    totalPiutangToko: number;
    totalPiutangUnit: number;
    totalPiutangSPPokok: number;
    totalPiutangSPJasa: number;
    grandTotal: number;
    pagination?: PaginationMeta;
}

const exportColumns: ExportColumn[] = [
    { header: "No", key: "seq", width: 6 },
    { header: "NRP", key: "nrp", width: 14 },
    { header: "Pangkat", key: "pangkat", width: 10 },
    { header: "Kesatuan", key: "kesatuan", width: 18 },
    { header: "Nama", key: "nama", width: 28 },
    { header: "Piutang Toko", key: "piutangToko", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Piutang Unit", key: "piutangUnit", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Pokok Pinjaman", key: "piutangSPPokok", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Jasa Pinjaman", key: "piutangSPJasa", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Total Piutang", key: "totalPiutang", width: 20, format: (v) => formatCurrency(Number(v || 0)) },
];

export default function PiutangGabunganPage() {
    const { hasRole, hasPermission } = useAuth();
    const isOperator = hasRole("operator") || hasPermission("manage_all");

    const [isLoading, setIsLoading] = React.useState(false);
    const [data, setData] = React.useState<PiutangResponse | null>(null);
    const [error, setError] = React.useState("");
    const [search, setSearch] = React.useState("");
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 });
    const [isExporting, setIsExporting] = React.useState(false);

    const fetchData = React.useCallback(async (page: number, perPage: number) => {
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/reports/piutang-gabungan?page=${page}&perPage=${perPage}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal memuat data");
            setData(json.data);
        } catch (err: any) {
            setError(err.message || "Gagal memuat data");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    React.useEffect(() => {
        fetchData(1, pagination.pageSize);
    }, []);

    // Refetch when page/size changes (after initial load)
    React.useEffect(() => {
        if (!data) return;
        fetchData(pagination.pageIndex + 1, pagination.pageSize);
    }, [pagination.pageIndex, pagination.pageSize]);

    const fetchAll = async (): Promise<PiutangItem[]> => {
        const res = await fetch("/api/reports/piutang-gabungan?export=true");
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Gagal memuat data");
        return json.data.piutangList || [];
    };

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const allData = await fetchAll();
            exportToExcel(
                allData as unknown as Record<string, unknown>[],
                exportColumns,
                "Piutang_Gabungan",
                "Piutang Gabungan"
            );
        } catch (err: any) {
            setError(err.message || "Export gagal");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const allData = await fetchAll();
            exportToPDF(
                allData as unknown as Record<string, unknown>[],
                exportColumns,
                "Piutang Gabungan - PRIMKOPPOL Resor Lumajang",
                "Piutang_Gabungan"
            );
        } catch (err: any) {
            setError(err.message || "Export gagal");
        } finally {
            setIsExporting(false);
        }
    };

    // Client-side search filter
    const filteredList = React.useMemo(() => {
        if (!data?.piutangList) return [];
        if (!search.trim()) return data.piutangList;
        const q = search.toLowerCase();
        return data.piutangList.filter(
            (item) =>
                item.nama.toLowerCase().includes(q) ||
                item.nrp.toLowerCase().includes(q) ||
                item.pangkat.toLowerCase().includes(q) ||
                (item.kesatuan || "").toLowerCase().includes(q)
        );
    }, [data?.piutangList, search]);

    // Access Control
    if (!isOperator) {
        return (
            <div className="space-y-6">
                <PageHeader title="Piutang Gabungan" backHref="/laporan" />
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="flex items-center gap-4 py-8">
                        <ShieldAlert className="h-10 w-10 text-red-500" />
                        <div>
                            <h3 className="text-lg font-semibold text-red-800">Akses Ditolak</h3>
                            <p className="text-red-600">Fitur ini hanya dapat diakses oleh Operator.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const totalAnggota = data?.pagination?.totalItems ?? data?.totalAnggota ?? 0;

    return (
        <div className="space-y-6">
            <div className="print:hidden">
                <PageHeader
                    title="Piutang Gabungan"
                    description="Rekap piutang per anggota dari Toko, Unit, dan Simpan Pinjam"
                    backHref="/laporan"
                />
            </div>

            {/* Toolbar */}
            <Card className="print:hidden">
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                    <Input
                        placeholder="Cari nama, NRP, pangkat..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="max-w-xs"
                    />
                    <Button variant="outline" onClick={() => fetchData(pagination.pageIndex + 1, pagination.pageSize)} disabled={isLoading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <div className="flex-1" />
                    {data && totalAnggota > 0 && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                                Excel
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                PDF
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <Card className="border-red-200 bg-red-50 print:hidden">
                    <CardContent className="py-4 text-red-700">{error}</CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            {data && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Anggota</CardTitle>
                            <Users className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tabular-nums">{totalAnggota}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Piutang Toko</CardTitle>
                            <ShoppingCart className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold tabular-nums text-orange-600">
                                {formatCurrency(data.totalPiutangToko)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Piutang Unit</CardTitle>
                            <Building2 className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold tabular-nums text-purple-600">
                                {formatCurrency(data.totalPiutangUnit)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Piutang SP</CardTitle>
                            <Landmark className="h-4 w-4 text-cyan-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold tabular-nums text-cyan-600">
                                {formatCurrency(data.totalPiutangSPPokok + data.totalPiutangSPJasa)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Grand Total</CardTitle>
                            <Banknote className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tabular-nums text-emerald-600">
                                {formatCurrency(data.grandTotal)}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Data Table */}
            {data && filteredList.length > 0 && (
                <Card className="print:hidden">
                    <CardHeader>
                        <CardTitle className="text-base">
                            Daftar Piutang ({totalAnggota} anggota)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[50px]">No</TableHead>
                                    <TableHead>NRP</TableHead>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>Pangkat</TableHead>
                                    <TableHead>Kesatuan</TableHead>
                                    <TableHead className="text-right">Piutang Toko</TableHead>
                                    <TableHead className="text-right">Piutang Unit</TableHead>
                                    <TableHead className="text-right">Pokok SP</TableHead>
                                    <TableHead className="text-right">Jasa SP</TableHead>
                                    <TableHead className="text-right font-bold">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredList.map((item, idx) => (
                                    <TableRow key={item.seq}>
                                        <TableCell className="text-muted-foreground">
                                            {(data.pagination ? (data.pagination.page - 1) * data.pagination.perPage + idx + 1 : idx + 1)}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{item.nrp}</TableCell>
                                        <TableCell className="font-medium">{item.nama}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.pangkat}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.kesatuan || "-"}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {item.piutangToko > 0 ? formatCurrency(item.piutangToko) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {item.piutangUnit > 0 ? formatCurrency(item.piutangUnit) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {item.piutangSPPokok > 0 ? formatCurrency(item.piutangSPPokok) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {item.piutangSPJasa > 0 ? formatCurrency(item.piutangSPJasa) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-bold">
                                            {formatCurrency(item.totalPiutang)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-primary/5 font-bold">
                                    <TableCell colSpan={5} className="text-right">TOTAL</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(data.totalPiutangToko)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(data.totalPiutangUnit)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(data.totalPiutangSPPokok)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(data.totalPiutangSPJasa)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-lg">
                                        {formatCurrency(data.grandTotal)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>

                    {/* Pagination */}
                    {data.pagination && data.pagination.totalPages > 1 && (
                        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                                Menampilkan {(data.pagination.page - 1) * data.pagination.perPage + 1} - {Math.min(data.pagination.page * data.pagination.perPage, data.pagination.totalItems)} dari {data.pagination.totalItems} data
                            </div>
                            <div className="flex items-center gap-2">
                                <Select
                                    value={`${pagination.pageSize}`}
                                    onValueChange={(value) => {
                                        setPagination(prev => ({ ...prev, pageIndex: 0, pageSize: Number(value) }));
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        {[10, 25, 50, 100].map((size) => (
                                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon" className="h-8 w-8"
                                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: 0 }))}
                                        disabled={pagination.pageIndex === 0}
                                    >{"<<"}</Button>
                                    <Button variant="outline" size="icon" className="h-8 w-8"
                                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) }))}
                                        disabled={pagination.pageIndex === 0}
                                    >{"<"}</Button>
                                    <span className="px-2 text-sm">
                                        {data.pagination.page} / {data.pagination.totalPages}
                                    </span>
                                    <Button variant="outline" size="icon" className="h-8 w-8"
                                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))}
                                        disabled={pagination.pageIndex >= data.pagination.totalPages - 1}
                                    >{">"}</Button>
                                    <Button variant="outline" size="icon" className="h-8 w-8"
                                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: (data.pagination?.totalPages ?? 1) - 1 }))}
                                        disabled={pagination.pageIndex >= (data.pagination?.totalPages ?? 1) - 1}
                                    >{">>"}</Button>
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Empty State */}
            {data && data.piutangList.length === 0 && (
                <Card className="print:hidden">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mb-3 opacity-40" />
                        <p className="text-lg font-medium">Tidak ada piutang</p>
                        <p className="text-sm">Tidak ada anggota yang memiliki piutang saat ini.</p>
                    </CardContent>
                </Card>
            )}

            {/* Loading */}
            {isLoading && !data && (
                <Card className="print:hidden">
                    <CardContent className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
