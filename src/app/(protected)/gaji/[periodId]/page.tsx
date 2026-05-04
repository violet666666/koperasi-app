"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    Search,
    Printer,
    Eye,
    Users,
    Wallet,
    DollarSign,
    TrendingDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useAuth } from "@/lib/hooks";
import { toast } from "sonner";

// -- Types --
interface SlipRow {
    id: number;
    nrp: string;
    nama: string;
    pangkat: string;
    gajiBersih: number;
    tunkin: number;
    potTajib: number;
    potSP: number;
    potBarang: number;
    potSukarela: number;
    potKoperasiLain: number;
    totalPotKoperasi: number;
    sisaGaji: number;
    sisaTunkin: number;
    otherDeductions: Record<string, number>;
    jumlahPotNonBRI: number;
    jumlahPotBRI: number;
    terimaBersih: number;
    sisaRekening: number;
    bisaDiambilATM: number;
    memberId: number | null;
    memberName: string | null;
}

interface PeriodData {
    id: number;
    periodName: string;
    periodMonth: number;
    periodYear: number;
    sourceFile: string;
    sourceType: string;
    status: string;
    totalMembers: number;
    totalGaji: number;
    totalPotongan: number;
    createdByName: string | null;
    createdAt: string;
}

interface PeriodDetailResponse {
    period: PeriodData;
    slips: SlipRow[];
}

const PAGE_SIZE = 50;

export default function GajiPeriodDetailPage() {
    const params = useParams<{ periodId: string }>();
    const router = useRouter();
    const { user } = useAuth();

    const periodId = params.periodId;

    // Data state
    const [data, setData] = React.useState<PeriodDetailResponse | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState("");

    // UI state
    const [searchQuery, setSearchQuery] = React.useState("");
    const [currentPage, setCurrentPage] = React.useState(1);

    // Fetch period detail
    const fetchDetail = React.useCallback(async () => {
        setIsLoading(true);
        setFetchError("");
        try {
            const res = await fetch(`/api/payroll/${periodId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal memuat data");
            setData(json.data);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "Gagal memuat detail periode gaji";
            setFetchError(msg);
        } finally {
            setIsLoading(false);
        }
    }, [periodId]);

    React.useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    // Derived: filtered slips
    const filteredSlips = React.useMemo(() => {
        if (!data?.slips) return [];
        if (!searchQuery.trim()) return data.slips;

        const q = searchQuery.toLowerCase().trim();
        return data.slips.filter(
            (s) =>
                s.nrp.toLowerCase().includes(q) ||
                s.nama.toLowerCase().includes(q)
        );
    }, [data?.slips, searchQuery]);

    // Derived: pagination
    const totalPages = Math.max(1, Math.ceil(filteredSlips.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedSlips = filteredSlips.slice(
        (safeCurrentPage - 1) * PAGE_SIZE,
        safeCurrentPage * PAGE_SIZE
    );

    // Derived: average sisa gaji
    const avgSisaGaji = React.useMemo(() => {
        if (!data?.slips || data.slips.length === 0) return 0;
        const total = data.slips.reduce((sum, s) => sum + s.sisaGaji, 0);
        return Math.round(total / data.slips.length);
    }, [data?.slips]);

    // Reset page when search changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // Status badge helper
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "processed":
                return (
                    <Badge variant="default" className="bg-green-600">
                        Diproses
                    </Badge>
                );
            case "pending":
                return <Badge variant="secondary">Pending</Badge>;
            case "voided":
                return <Badge variant="destructive">Dibatalkan</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Detail Periode Gaji"
                    backHref="/gaji"
                    backLabel="Kembali ke Daftar Gaji"
                />
                <Card>
                    <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Memuat data periode gaji...
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Error state
    if (fetchError || !data) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Detail Periode Gaji"
                    backHref="/gaji"
                    backLabel="Kembali ke Daftar Gaji"
                />
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="py-4 text-red-700">
                        {fetchError || "Data tidak ditemukan"}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { period } = data;

    return (
        <div className="space-y-6">
            <PageHeader
                title={period.periodName}
                description={`Periode ${period.periodMonth}/${period.periodYear} - ${period.sourceType.toUpperCase()} - ${period.sourceFile}`}
                backHref="/gaji"
                backLabel="Kembali ke Daftar Gaji"
                actions={
                    <div className="flex items-center gap-2">
                        {getStatusBadge(period.status)}
                    </div>
                }
            />

            {/* ============================
                Summary Cards
               ============================ */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Anggota
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">
                            {period.totalMembers}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            slip gaji diproses
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Gaji
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">
                            {formatCurrency(period.totalGaji)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            gaji bersih kotor
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Potongan Koperasi
                        </CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">
                            {formatCurrency(period.totalPotongan)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            potongan koperasi total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Rata-rata Sisa Gaji
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">
                            {formatCurrency(avgSisaGaji)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            sisa gaji per anggota
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* ============================
                Toolbar
               ============================ */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Cari NRP atau nama..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button variant="outline" disabled>
                    <Printer className="mr-2 h-4 w-4" />
                    Cetak Semua Slip
                </Button>
            </div>

            {/* ============================
                Slips Table
               ============================ */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Daftar Slip Gaji ({filteredSlips.length} anggota)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredSlips.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Users className="h-12 w-12 mb-3 opacity-40" />
                            <p className="text-lg font-medium">
                                {searchQuery
                                    ? "Tidak ada hasil yang cocok"
                                    : "Belum ada data slip"}
                            </p>
                            {searchQuery && (
                                <p className="text-sm">
                                    Coba ubah kata kunci pencarian Anda.
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-[50px]">
                                                No
                                            </TableHead>
                                            <TableHead>NRP</TableHead>
                                            <TableHead>Nama</TableHead>
                                            <TableHead>Pangkat</TableHead>
                                            <TableHead className="text-right">
                                                Gaji Bersih
                                            </TableHead>
                                            <TableHead className="text-right">
                                                TAJIB
                                            </TableHead>
                                            <TableHead className="text-right">
                                                SP
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Barang
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Total Pot Kop
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Sisa Gaji
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Terima Bersih
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Aksi
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedSlips.map((slip, idx) => (
                                            <TableRow key={slip.id}>
                                                <TableCell className="text-muted-foreground">
                                                    {(safeCurrentPage - 1) * PAGE_SIZE + idx + 1}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {slip.nrp}
                                                </TableCell>
                                                <TableCell className="font-medium max-w-[200px] truncate" title={slip.nama}>
                                                    {slip.nama}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate" title={slip.pangkat}>
                                                    {slip.pangkat}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatCurrency(slip.gajiBersih)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {slip.potTajib > 0
                                                        ? formatCurrency(slip.potTajib)
                                                        : "-"}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {slip.potSP > 0
                                                        ? formatCurrency(slip.potSP)
                                                        : "-"}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {slip.potBarang > 0
                                                        ? formatCurrency(slip.potBarang)
                                                        : "-"}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">
                                                    {formatCurrency(slip.totalPotKoperasi)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatCurrency(slip.sisaGaji)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">
                                                    {formatCurrency(slip.terimaBersih)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            router.push(
                                                                `/gaji/${periodId}/slip/${slip.id}`
                                                            )
                                                        }
                                                    >
                                                        <Eye className="mr-1 h-4 w-4" />
                                                        Lihat Slip
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t px-4 py-3">
                                    <p className="text-sm text-muted-foreground">
                                        Menampilkan{" "}
                                        {(safeCurrentPage - 1) * PAGE_SIZE + 1}-
                                        {Math.min(
                                            safeCurrentPage * PAGE_SIZE,
                                            filteredSlips.length
                                        )}{" "}
                                        dari {filteredSlips.length} anggota
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={safeCurrentPage <= 1}
                                            onClick={() =>
                                                setCurrentPage((p) => p - 1)
                                            }
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm font-medium tabular-nums">
                                            {safeCurrentPage} / {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                                safeCurrentPage >= totalPages
                                            }
                                            onClick={() =>
                                                setCurrentPage((p) => p + 1)
                                            }
                                        >
                                            Selanjutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
