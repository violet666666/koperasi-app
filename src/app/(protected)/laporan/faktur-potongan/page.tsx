"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, Printer, Search, Users, Banknote, FileText, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useAuth } from "@/lib/hooks";

// -- Types --
interface PotonganLine {
    jenis: string;
    ptKe: string;
    jumlah: number;
}

interface FakturItem {
    seq: number;
    noRes: string;
    notaBuku: string;
    nama: string;
    nrp: string;
    pangkat: string;
    kesatuan: string;
    potongan: PotonganLine[];
    totalPotongan: number;
}

interface PaginationMeta {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
}

interface FakturResponse {
    fakturList: FakturItem[];
    month: number;
    year: number;
    periodLabel: string;
    totalAnggota: number;
    totalNominal: number;
    pagination?: PaginationMeta;
}

const BULAN_OPTIONS = [
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
];

const TAHUN_OPTIONS = (() => {
    const yr = new Date().getFullYear();
    return [yr - 1, yr, yr + 1].map((y) => ({ value: String(y), label: String(y) }));
})();

export default function FakturPotonganPage() {
    const { user, hasRole, hasPermission } = useAuth();
    const isOperator = hasRole("operator") || hasPermission("manage_all");

    const now = new Date();
    const [month, setMonth] = React.useState(String(now.getMonth() + 1));
    const [year, setYear] = React.useState(String(now.getFullYear()));
    const [isLoading, setIsLoading] = React.useState(false);
    const [data, setData] = React.useState<FakturResponse | null>(null);
    const [error, setError] = React.useState("");

    // Server-side pagination state
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 });

    // Print state: all-member data for print view
    const [printData, setPrintData] = React.useState<FakturItem[] | null>(null);
    const [isExporting, setIsExporting] = React.useState(false);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError("");
        setData(null);
        setPrintData(null);
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
        try {
            const res = await fetch(`/api/reports/faktur-potongan?month=${month}&year=${year}&page=1&perPage=${pagination.pageSize}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal memuat data");
            setData(json.data);
        } catch (err: any) {
            setError(err.message || "Gagal memuat data faktur");
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch paginated data when page changes (after initial generate)
    React.useEffect(() => {
        if (!data) return;
        async function fetchPage() {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/reports/faktur-potongan?month=${month}&year=${year}&page=${pagination.pageIndex + 1}&perPage=${pagination.pageSize}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Gagal memuat data");
                setData(json.data);
            } catch (err: any) {
                setError(err.message || "Gagal memuat data");
            } finally {
                setIsLoading(false);
            }
        }
        fetchPage();
    }, [pagination.pageIndex, pagination.pageSize]);

    const fetchAllForPrint = async (): Promise<FakturItem[]> => {
        const res = await fetch(`/api/reports/faktur-potongan?month=${month}&year=${year}&export=true`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Gagal memuat data");
        return json.data.fakturList || [];
    };

    const handlePrint = async () => {
        setIsExporting(true);
        try {
            const allFaktur = await fetchAllForPrint();
            setPrintData(allFaktur);
            // Wait for React to render the print div, then trigger print
            setTimeout(() => {
                window.print();
            }, 100);
        } catch (err: any) {
            setError(err.message || "Gagal menyiapkan data cetak");
        } finally {
            setIsExporting(false);
        }
    };

    const handlePaginationChange = (updater: any) => {
        setPagination(prev => {
            const next = typeof updater === "function" ? updater(prev) : updater;
            return { ...prev, ...next };
        });
    };

    // Use totalItems from pagination for accurate count
    const totalAnggota = data?.pagination?.totalItems ?? data?.totalAnggota ?? 0;
    const totalNominal = data?.totalNominal ?? 0;

    // -- Access Control --
    if (!isOperator) {
        return (
            <div className="space-y-6">
                <PageHeader title="Faktur Potongan" backHref="/laporan" />
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

    return (
        <div className="space-y-6">
            {/* -- Screen Header (hidden on print) -- */}
            <div className="print:hidden">
                <PageHeader
                    title="Faktur Potongan Gaji"
                    description="Generate dan cetak slip faktur potongan gaji untuk anggota"
                    backHref="/laporan"
                />
            </div>

            {/* -- Filter Bar (hidden on print) -- */}
            <Card className="print:hidden">
                <CardContent className="flex flex-wrap items-end gap-4 py-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Bulan</label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BULAN_OPTIONS.map((b) => (
                                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Tahun</label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TAHUN_OPTIONS.map((y) => (
                                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleGenerate} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Generate
                    </Button>
                    {data && data.pagination && data.pagination.totalItems > 0 && (
                        <Button variant="outline" onClick={handlePrint} disabled={isExporting}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                            Cetak Faktur
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* -- Error -- */}
            {error && (
                <Card className="border-red-200 bg-red-50 print:hidden">
                    <CardContent className="py-4 text-red-700">{error}</CardContent>
                </Card>
            )}

            {/* -- Summary Cards (hidden on print) -- */}
            {data && (
                <div className="grid gap-4 sm:grid-cols-3 print:hidden">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Periode</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold">{data.periodLabel}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Anggota dengan Tagihan</CardTitle>
                            <Users className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tabular-nums">{totalAnggota}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Seluruh Potongan</CardTitle>
                            <Banknote className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tabular-nums text-emerald-600">
                                {formatCurrency(totalNominal)}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* -- Preview Table with pagination (hidden on print) -- */}
            {data && data.fakturList.length > 0 && (
                <Card className="print:hidden">
                    <CardHeader>
                        <CardTitle className="text-base">
                            Preview Faktur ({totalAnggota} anggota)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[50px]">No</TableHead>
                                    <TableHead>NRP</TableHead>
                                    <TableHead>Nama</TableHead>
                                    <TableHead className="text-right">Sp</TableHead>
                                    <TableHead className="text-right">Pokok (P)</TableHead>
                                    <TableHead className="text-right">Jasa (J)</TableHead>
                                    <TableHead className="text-right">Unit/BRG</TableHead>
                                    <TableHead className="text-right font-bold">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.fakturList.map((f, idx) => {
                                    const sp = f.potongan.find((p) => p.jenis === "Sp")?.jumlah || 0;
                                    const pokok = f.potongan.find((p) => p.jenis === "P")?.jumlah || 0;
                                    const jasa = f.potongan.find((p) => p.jenis === "J")?.jumlah || 0;
                                    const unitBrg = f.potongan
                                        .filter((p) => !["Sp", "P", "J"].includes(p.jenis))
                                        .reduce((s, p) => s + p.jumlah, 0);
                                    return (
                                        <TableRow key={idx}>
                                            <TableCell className="text-muted-foreground">
                                                {(data.pagination ? (data.pagination.page - 1) * data.pagination.perPage + idx + 1 : idx + 1)}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{f.nrp}</TableCell>
                                            <TableCell className="font-medium">{f.nama}</TableCell>
                                            <TableCell className="text-right tabular-nums">{sp > 0 ? formatCurrency(sp) : "-"}</TableCell>
                                            <TableCell className="text-right tabular-nums">{pokok > 0 ? formatCurrency(pokok) : "-"}</TableCell>
                                            <TableCell className="text-right tabular-nums">{jasa > 0 ? formatCurrency(jasa) : "-"}</TableCell>
                                            <TableCell className="text-right tabular-nums">{unitBrg > 0 ? formatCurrency(unitBrg) : "-"}</TableCell>
                                            <TableCell className="text-right tabular-nums font-bold">{formatCurrency(f.totalPotongan)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-primary/5 font-bold">
                                    <TableCell colSpan={7} className="text-right">GRAND TOTAL</TableCell>
                                    <TableCell className="text-right tabular-nums text-lg">
                                        {formatCurrency(totalNominal)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>

                    {/* Pagination controls */}
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
                                        {[10, 20, 50, 100].map((size) => (
                                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: 0 }))}
                                        disabled={pagination.pageIndex === 0}
                                    >
                                        {"<<"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) }))}
                                        disabled={pagination.pageIndex === 0}
                                    >
                                        {"<"}
                                    </Button>
                                    <span className="px-2 text-sm">
                                        {data.pagination.page} / {data.pagination.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))}
                                        disabled={pagination.pageIndex >= data.pagination.totalPages - 1}
                                    >
                                        {">"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: (data.pagination?.totalPages ?? 1) - 1 }))}
                                        disabled={pagination.pageIndex >= (data.pagination?.totalPages ?? 1) - 1}
                                    >
                                        {">>"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* -- Empty State -- */}
            {data && data.fakturList.length === 0 && (
                <Card className="print:hidden">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mb-3 opacity-40" />
                        <p className="text-lg font-medium">Tidak ada tagihan potongan</p>
                        <p className="text-sm">Semua anggota tidak memiliki tagihan pada periode {data.periodLabel}.</p>
                    </CardContent>
                </Card>
            )}

            {/* ==================================================
                PRINT LAYOUT -- 4 kolom x 2 baris per halaman A4 Landscape
                Hidden on screen, visible only when printing
               ================================================== */}
            {data && (printData || data.fakturList).length > 0 && (
                <div className="hidden print:block">
                    <style>{`
                        @media print {
                            @page {
                                size: A4 landscape;
                                margin: 6mm;
                            }
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                    `}</style>
                    <div className="faktur-print-grid" style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "2px",
                    }}>
                        {(printData || data.fakturList).map((faktur, idx) => (
                            <div
                                key={idx}
                                className="faktur-ticket"
                                style={{
                                    border: "1px solid #999",
                                    padding: "5px 7px",
                                    fontSize: "7.5pt",
                                    lineHeight: "1.3",
                                    pageBreakInside: "avoid",
                                    breakInside: "avoid",
                                    // Every 8 faktur = new page
                                    ...(idx > 0 && idx % 8 === 0 ? { breakBefore: "page" } : {}),
                                }}
                            >
                                {/* Header */}
                                <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: 1 }}>
                                    PRIMKOPPOL RESOR
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                    <span style={{ fontWeight: "bold" }}>LUMAJANG</span>
                                    <span style={{ fontSize: "6.5pt" }}>No.Res: {faktur.noRes}</span>
                                </div>

                                {/* Identitas */}
                                <table style={{ width: "100%", fontSize: "7pt", marginBottom: 2 }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: "60px" }}>Nama</td>
                                            <td>: <strong>{faktur.nama}</strong></td>
                                        </tr>
                                        <tr>
                                            <td>Pangkat/NRP</td>
                                            <td>: {faktur.pangkat} / <strong>{faktur.nrp}</strong></td>
                                        </tr>
                                        <tr>
                                            <td>Kesatuan</td>
                                            <td>: {faktur.kesatuan}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Title */}
                                <div style={{
                                    textAlign: "center",
                                    fontWeight: "bold",
                                    borderTop: "1px solid #000",
                                    borderBottom: "1px solid #000",
                                    padding: "1px 0",
                                    marginBottom: 2,
                                }}>
                                    FAKTUR POTONGAN
                                </div>

                                {/* Tabel Potongan */}
                                <table style={{ width: "100%", fontSize: "7pt", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid #000" }}>
                                            <th style={{ textAlign: "left", padding: "1px 2px", width: "50px" }}>NB</th>
                                            <th style={{ textAlign: "left", padding: "1px 2px" }}>Jenis Pot</th>
                                            <th style={{ textAlign: "center", padding: "1px 2px", width: "40px" }}>PT KE</th>
                                            <th style={{ textAlign: "right", padding: "1px 2px" }}>Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {faktur.potongan.map((pot, pi) => (
                                            <tr key={pi}>
                                                <td style={{ padding: "1px 2px", fontSize: "6pt" }}>{pi === 0 ? faktur.notaBuku : ""}</td>
                                                <td style={{ padding: "1px 2px" }}>{pot.jenis}</td>
                                                <td style={{ textAlign: "center", padding: "1px 2px" }}>{pot.ptKe}</td>
                                                <td style={{ textAlign: "right", padding: "1px 2px", fontFamily: "monospace" }}>
                                                    {pot.jumlah.toLocaleString("id-ID")}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Empty rows to maintain consistent height */}
                                        {Array.from({ length: Math.max(0, 4 - faktur.potongan.length) }).map((_, ei) => (
                                            <tr key={`e${ei}`}>
                                                <td style={{ padding: "1px 2px" }}>&nbsp;</td>
                                                <td></td><td></td><td></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ borderTop: "1px solid #000", fontWeight: "bold" }}>
                                            <td colSpan={3} style={{ padding: "1px 2px", textAlign: "right" }}>TOTAL</td>
                                            <td style={{ textAlign: "right", padding: "1px 2px", fontFamily: "monospace" }}>
                                                {faktur.totalPotongan.toLocaleString("id-ID")}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>

                                {/* Footer */}
                                <div style={{ textAlign: "right", fontSize: "6.5pt", marginTop: 3 }}>
                                    <div>Lumajang, {data.periodLabel}</div>
                                    <div>Bag. Simpan Pinjam</div>
                                    <div style={{ marginTop: 18 }}>( . . . . . . . . . . . . . )</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
