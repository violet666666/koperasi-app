"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    Upload,
    Trash2,
    Eye,
    Plus,
    FileSpreadsheet,
    AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useAuth } from "@/lib/hooks";
import { toast } from "sonner";

// -- Types --
interface PeriodRow {
    id: string;
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
    slipCount: number;
}

interface PreviewRow {
    row: number;
    nrp: string;
    nama: string;
    pangkat: string;
    gajiBersih: number;
    potTajib: number;
    potSP: number;
    potBarang: number;
    totalPotKoperasi: number;
    sisaGaji: number;
    terimaBersih: number;
    memberId: number | null;
    status: string;
}

interface PreviewData {
    mode: string;
    sheetName: string;
    periodName: string;
    periodMonth: number;
    periodYear: number;
    sourceFile: string;
    sourceType: string;
    totalRows: number;
    success: number;
    failed: number;
    preview: PreviewRow[];
    columnCount: number;
    headers: string[];
}

type ImportStatus = "idle" | "uploading" | "previewing" | "importing" | "done";

const IMPORT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function GajiPeriodListPage() {
    const { user, hasRole, hasPermission } = useAuth();
    const isAdmin =
        hasRole("operator") ||
        hasRole("admin") ||
        hasPermission("manage_all");

    // Period list state
    const [periods, setPeriods] = React.useState<PeriodRow[]>([]);
    const [isLoadingPeriods, setIsLoadingPeriods] = React.useState(true);
    const [fetchError, setFetchError] = React.useState("");

    // Import modal state
    const [importModalOpen, setImportModalOpen] = React.useState(false);
    const [importStatus, setImportStatus] = React.useState<ImportStatus>("idle");
    const [importFile, setImportFile] = React.useState<File | null>(null);
    const [importSourceType, setImportSourceType] = React.useState<string>("polres");
    const [previewData, setPreviewData] = React.useState<PreviewData | null>(null);
    const [importError, setImportError] = React.useState("");

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = React.useState<PeriodRow | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Abort controller ref for cancelling fetches
    const abortRef = React.useRef<AbortController | null>(null);

    // Fetch periods on mount
    const fetchPeriods = React.useCallback(async () => {
        setIsLoadingPeriods(true);
        setFetchError("");
        try {
            const res = await fetch("/api/payroll");
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal memuat data");
            setPeriods(json.data || []);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Gagal memuat data periode gaji";
            setFetchError(msg);
        } finally {
            setIsLoadingPeriods(false);
        }
    }, []);

    React.useEffect(() => {
        fetchPeriods();
    }, [fetchPeriods]);

    // -- Import handlers --
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setImportFile(file);
        setPreviewData(null);
        setImportError("");
    };

    const handlePreview = async () => {
        if (!importFile) return;

        // Cancel any previous request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        // Auto-abort after 5 minutes
        const timeoutId = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

        setImportStatus("uploading");
        setImportError("");
        setPreviewData(null);

        try {
            const formData = new FormData();
            formData.append("file", importFile);
            formData.append("mode", "preview");
            formData.append("sourceType", importSourceType);

            const res = await fetch("/api/payroll/import", {
                method: "POST",
                body: formData,
                signal: controller.signal,
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal memproses file");

            setPreviewData(json.data);
            setImportStatus("previewing");
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === "AbortError") {
                setImportError("Request dibatalkan (timeout 5 menit)");
            } else {
                const msg = err instanceof Error ? err.message : "Gagal preview file";
                setImportError(msg);
            }
            setImportStatus("idle");
        } finally {
            clearTimeout(timeoutId);
        }
    };

    const handleCommitImport = async () => {
        if (!importFile) return;

        // Cancel any previous request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        // Auto-abort after 5 minutes
        const timeoutId = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

        setImportStatus("importing");
        setImportError("");

        try {
            const formData = new FormData();
            formData.append("file", importFile);
            formData.append("mode", "commit");
            formData.append("sourceType", importSourceType);

            const res = await fetch("/api/payroll/import", {
                method: "POST",
                body: formData,
                signal: controller.signal,
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal import data");

            toast.success(`Import berhasil: ${json.data.totalRows} anggota (${json.data.periodName})`);
            setImportStatus("done");
            setImportModalOpen(false);
            resetImportState();
            fetchPeriods();
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === "AbortError") {
                setImportError("Request dibatalkan (timeout 5 menit)");
            } else {
                const msg = err instanceof Error ? err.message : "Gagal import data";
                setImportError(msg);
            }
            setImportStatus("previewing");
        } finally {
            clearTimeout(timeoutId);
        }
    };

    const resetImportState = () => {
        setImportFile(null);
        setPreviewData(null);
        setImportError("");
        setImportStatus("idle");
        setImportSourceType("polres");
    };

    const handleImportModalClose = (open: boolean) => {
        if (!open) {
            if (importStatus === "uploading" || importStatus === "importing") {
                abortRef.current?.abort();
            }
            resetImportState();
        }
        setImportModalOpen(open);
    };

    // -- Delete handler --
    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch("/api/payroll", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodId: deleteTarget.id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal menghapus");

            toast.success(`Periode "${deleteTarget.periodName}" berhasil dihapus`);
            setDeleteTarget(null);
            fetchPeriods();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Gagal menghapus periode";
            toast.error(msg);
        } finally {
            setIsDeleting(false);
        }
    };

    // -- Status badge helper --
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "processed":
                return <Badge variant="default" className="bg-green-600">Diproses</Badge>;
            case "pending":
                return <Badge variant="secondary">Pending</Badge>;
            case "voided":
                return <Badge variant="destructive">Dibatalkan</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gaji & Slip"
                description="Kelola data periode gaji, import slip dari Excel, dan lihat rekap per periode"
                actions={
                    isAdmin ? (
                        <Button onClick={() => setImportModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Import Gaji
                        </Button>
                    ) : undefined
                }
            />

            {/* Error */}
            {fetchError && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="py-4 text-red-700">{fetchError}</CardContent>
                </Card>
            )}

            {/* Loading */}
            {isLoadingPeriods && (
                <Card>
                    <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Memuat data periode gaji...
                    </CardContent>
                </Card>
            )}

            {/* Period Table */}
            {!isLoadingPeriods && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Daftar Periode Gaji ({periods.length} periode)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {periods.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <FileSpreadsheet className="h-12 w-12 mb-3 opacity-40" />
                                <p className="text-lg font-medium">Belum ada data periode gaji</p>
                                <p className="text-sm">
                                    Klik &quot;Import Gaji&quot; untuk mengupload file Excel slip gaji.
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Periode</TableHead>
                                        <TableHead>File Sumber</TableHead>
                                        <TableHead>Tipe</TableHead>
                                        <TableHead className="text-right">Anggota</TableHead>
                                        <TableHead className="text-right">Total Gaji</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {periods.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">
                                                {p.periodName}
                                            </TableCell>
                                            <TableCell
                                                className="max-w-[200px] truncate text-sm text-muted-foreground"
                                                title={p.sourceFile}
                                            >
                                                {p.sourceFile}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        p.sourceType === "polres"
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                >
                                                    {p.sourceType === "polres"
                                                        ? "POLRES"
                                                        : "POLSEK"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {p.slipCount}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(p.totalGaji)}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(p.status)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/gaji/${p.id}`}>
                                                            <Eye className="mr-1 h-4 w-4" />
                                                            Detail
                                                        </Link>
                                                    </Button>
                                                    {isAdmin && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => setDeleteTarget(p)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ============================
                Import Modal
               ============================ */}
            <Dialog open={importModalOpen} onOpenChange={handleImportModalClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Import Data Gaji</DialogTitle>
                        <DialogDescription>
                            Upload file Excel (.xlsx/.xls/.csv) berisi sheet &quot;POT GAJI&quot; untuk mengimport data slip gaji.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* File input + source type */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">File Excel</label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileSelect}
                                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                    disabled={
                                        importStatus === "uploading" ||
                                        importStatus === "importing"
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipe Sumber</label>
                                <Select
                                    value={importSourceType}
                                    onValueChange={setImportSourceType}
                                    disabled={
                                        importStatus === "uploading" ||
                                        importStatus === "importing"
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="polres">POLRES</SelectItem>
                                        <SelectItem value="polsek">POLSEK</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Upload/Preview button */}
                        {importFile && !previewData && (
                            <Button
                                onClick={handlePreview}
                                disabled={importStatus === "uploading"}
                                className="w-full"
                            >
                                {importStatus === "uploading" ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Memproses file...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Preview Data
                                    </>
                                )}
                            </Button>
                        )}

                        {/* Error */}
                        {importError && (
                            <Card className="border-red-200 bg-red-50">
                                <CardContent className="flex items-center gap-3 py-3 text-red-700">
                                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                                    <p className="text-sm">{importError}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Preview Data */}
                        {previewData && (
                            <div className="space-y-3">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">
                                            Preview: {previewData.sheetName} &mdash;{" "}
                                            {previewData.periodName}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-2 text-sm sm:grid-cols-4">
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Total Baris:
                                                </span>{" "}
                                                <span className="font-semibold">
                                                    {previewData.totalRows}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Cocok:
                                                </span>{" "}
                                                <span className="font-semibold text-green-600">
                                                    {previewData.preview.filter(
                                                        (r) => r.status === "valid"
                                                    ).length}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Tidak Cocok:
                                                </span>{" "}
                                                <span className="font-semibold text-amber-600">
                                                    {previewData.preview.filter(
                                                        (r) => r.status === "no_match"
                                                    ).length}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Ditampilkan:
                                                </span>{" "}
                                                <span className="font-semibold">
                                                    {previewData.preview.length} /{" "}
                                                    {previewData.totalRows}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="w-[40px]">
                                                    #
                                                </TableHead>
                                                <TableHead>NRP</TableHead>
                                                <TableHead>Nama</TableHead>
                                                <TableHead className="text-right">
                                                    Gaji Bersih
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Pot. Tajib
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Pot. SP
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Total Pot. Kop.
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Sisa Gaji
                                                </TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.preview.map((row) => (
                                                <TableRow key={row.row}>
                                                    <TableCell className="text-muted-foreground">
                                                        {row.row}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        {row.nrp}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {row.nama}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {formatCurrency(row.gajiBersih)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {row.potTajib > 0
                                                            ? formatCurrency(row.potTajib)
                                                            : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {row.potSP > 0
                                                            ? formatCurrency(row.potSP)
                                                            : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-medium">
                                                        {formatCurrency(
                                                            row.totalPotKoperasi
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {formatCurrency(row.sisaGaji)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={
                                                                row.status === "valid"
                                                                    ? "default"
                                                                    : "secondary"
                                                            }
                                                            className={
                                                                row.status === "valid"
                                                                    ? "bg-green-600"
                                                                    : "bg-amber-500 text-white"
                                                            }
                                                        >
                                                            {row.status === "valid"
                                                                ? "Cocok"
                                                                : "N/A"}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    Menampilkan {previewData.preview.length} dari{" "}
                                    {previewData.totalRows} baris. Semua data akan diimport
                                    saat commit.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        {previewData && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setPreviewData(null);
                                        setImportStatus("idle");
                                        setImportError("");
                                    }}
                                    disabled={importStatus === "importing"}
                                >
                                    Kembali
                                </Button>
                                <Button
                                    onClick={handleCommitImport}
                                    disabled={importStatus === "importing"}
                                >
                                    {importStatus === "importing" ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Mengimport...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Import ({previewData.totalRows} data)
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ============================
                Delete Confirmation Dialog
               ============================ */}
            <Dialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Konfirmasi Hapus</DialogTitle>
                        <DialogDescription>
                            Apakah Anda yakin ingin menghapus data gaji periode{" "}
                            <strong>{deleteTarget?.periodName}</strong> (
                            {deleteTarget?.sourceType?.toUpperCase()})? Semua slip gaji
                            dalam periode ini akan dihapus secara permanen.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                        <p>
                            Tindakan ini tidak dapat dibatalkan.{" "}
                            {deleteTarget?.slipCount} slip gaji akan dihapus.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
                            disabled={isDeleting}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Menghapus...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Hapus Periode
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
