"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Download,
    Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import * as XLSX from "xlsx";

type ImportType = "tunkin" | "gaji" | "tajib" | "akun_anggota" | "sejahtera" | "migrasi_pinjaman";
type ImportStatus = "idle" | "uploading" | "previewing" | "importing" | "done";

interface PreviewRow {
    row: number;
    nrp: string;
    nama: string;
    tunkin?: number;
    gaji?: number;
    tajib?: number;
    memberId?: number;
    memberName?: string;
    status: "valid" | "error";
    reason: string | null;
    currentTunkin?: number | null;
    currentGaji?: number | null;
    currentTajib?: number | null;
    isNewMember?: boolean;
    mutasiCount?: number;
}

interface ImportResult {
    mode: string;
    type: string;
    totalRows: number;
    success: number;
    failed: number;
    preview: PreviewRow[];
    error?: string;
}

const ITEMS_PER_PAGE = 50;

// ============================================================
// Smart Sheet Detector: scans all sheets for matching columns
// ============================================================
function findBestSheet(workbook: any, type: ImportType): string {
    const requiredKeywords: Record<ImportType, string[][]> = {
        tunkin: [["tunkin", "sisa_tunkin", "sisa tunkin", "tunjangan", "tunles", "bersih"]],
        gaji: [["gaji", "diterima", "bersih", "salary"]],
        tajib: [["jml", "jumlah", "tajib", "tabungan wajib"]],
        akun_anggota: [["nrp", "nip"]],
        sejahtera: [[]],
        migrasi_pinjaman: [["pinjam", "selama", "angsuran", "saldo"]],
    };

    const keywords = requiredKeywords[type] || [];
    const sheetNames = workbook.SheetNames as string[];

    // 1. Try matching sheet name first (e.g. 'TUNKIN', 'POT GAJI', 'TAJIB')
    const nameHints: Record<ImportType, string[]> = {
        tunkin: ["tunkin", "tunjangan"],
        gaji: ["pot gaji", "gaji"],
        tajib: ["tajib", "tajip", "wajib"],
        akun_anggota: ["anggota", "member"],
        sejahtera: [],
        migrasi_pinjaman: ["pinjam", "piutang", "rincian"],
    };
    for (const hint of (nameHints[type] || [])) {
        const match = sheetNames.find(s => s.toUpperCase().includes(hint.toUpperCase()));
        if (match) return match;
    }

    // 2. Scan headers of each sheet to find one with matching columns
    for (const sName of sheetNames) {
        const ws = workbook.Sheets[sName];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
        // Check first 20 rows for a header row
        for (let r = 0; r < Math.min(20, rows.length); r++) {
            const rowStr = rows[r].map(c => String(c).toLowerCase().trim()).join(" ");
            // Must have NAMA or NMPEG
            if (!(rowStr.includes("nama") || rowStr.includes("nmpeg"))) continue;
            // Check if any required keyword group matches
            for (const kGroup of keywords) {
                if (kGroup.some(k => rowStr.includes(k))) {
                    return sName;
                }
            }
        }
    }

    // 3. Fallback: last sheet (often the processed/summary sheet)
    return sheetNames[sheetNames.length - 1];
}

function convertWorkbookToCSV(workbook: any, type: ImportType, originalName: string): File {
    const sheetName = findBestSheet(workbook, type);
    const worksheet = workbook.Sheets[sheetName];
    const csvString = XLSX.utils.sheet_to_csv(worksheet);
    const newFileName = originalName.replace(/\.[^/.]+$/, "") + "_converted.csv";
    return new File([csvString], newFileName, { type: "text/csv" });
}

export default function ImportDataPage() {
    const [importType, setImportType] = useState<ImportType>("tunkin");
    const [status, setStatus] = useState<ImportStatus>("idle");
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Pagination states
    const [validPage, setValidPage] = useState(1);
    const [errorPage, setErrorPage] = useState(1);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setResult(null);
            setError(null);
            setValidPage(1);
            setErrorPage(1);
        }
    }, []);

    const handlePreview = useCallback(async () => {
        if (!file) return;
        setStatus("uploading");
        setError(null);
        setValidPage(1);
        setErrorPage(1);

        try {
            let processedFile: File;
            if (file.name.toLowerCase().endsWith('.csv') || importType === 'sejahtera' || importType === 'migrasi_pinjaman') {
                processedFile = file;
            } else {
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                processedFile = convertWorkbookToCSV(workbook, importType, file.name);
            }

            const formData = new FormData();
            formData.append("file", processedFile);
            formData.append("type", importType);
            formData.append("mode", "preview");
            
            const targetUrl = importType === "sejahtera" ? "/api/sejahtera/import" : importType === "migrasi_pinjaman" ? "/api/loans/import-migrasi" : "/api/members/import";
            const res = await fetch(targetUrl, {
                method: "POST",
                body: formData,
            });

            let json;
            try {
                const text = await res.text();
                try {
                    json = JSON.parse(text);
                } catch (e) {
                    console.error("Raw response:", text);
                    setError("Server menolak file ini (Mungkin karena ukuran file terlalu besar melebihi 4.5 MB).");
                    toast.error("File terlalu besar atau server mengirim respons invalid.");
                    setStatus("idle");
                    return;
                }
            } catch (err) {
                // fall through
            }

            if (!res.ok) {
                setError(json?.message || "Gagal memproses file");
                toast.error(json?.message || "Gagal membaca isi file tersebut.");
                setStatus("idle");
                return;
            }

            if (json?.data?.error) {
                setError(json.data.error);
                toast.error(json.data.error);
                setStatus("idle");
                return;
            }

            setResult(json.data);
            toast.success("File berhasil di-parse. Silakan review data di bawah.");
            setStatus("previewing");
        } catch (err) {
            console.error("HandlePreview Error:", err);
            setError("Terjadi kesalahan sistem internal/jaringan.");
            toast.error("Internal Server Error saat memproses file.");
            setStatus("idle");
        }
    }, [file, importType]);

    const handleImport = useCallback(async () => {
        if (!file) return;
        setStatus("importing");

        try {
            let processedFile: File;
            if (file.name.toLowerCase().endsWith('.csv') || importType === 'sejahtera' || importType === 'migrasi_pinjaman') {
                processedFile = file;
            } else {
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                processedFile = convertWorkbookToCSV(workbook, importType, file.name);
            }

            const formData = new FormData();
            formData.append("file", processedFile);
            formData.append("type", importType);
            formData.append("mode", "commit");

            const targetUrl = importType === "sejahtera" ? "/api/sejahtera/import" : importType === "migrasi_pinjaman" ? "/api/loans/import-migrasi" : "/api/members/import";
            const res = await fetch(targetUrl, {
                method: "POST",
                body: formData,
            });

            const json = await res.json();
            if (!res.ok) {
                setError(json.message || "Gagal import data");
                toast.error(json.message || "Gagal import data ke database.");
                setStatus("previewing");
                return;
            }

            setResult(json.data);
            toast.success(`Berhasil menyimpan ${json.data.success} data.`);
            setStatus("done");
        } catch (err) {
            setError("Terjadi kesalahan saat import");
            toast.error("Ada masalah koneksi/server saat upload.");
            setStatus("previewing");
        }
    }, [file, importType]);

    const handleExport = useCallback(async () => {
        window.open("/api/members/export?format=csv", "_blank");
    }, []);

    const handleReset = useCallback(() => {
        setFile(null);
        setResult(null);
        setError(null);
        setStatus("idle");
        setValidPage(1);
        setErrorPage(1);
    }, []);

    const validRows = result?.preview.filter(r => r.status === "valid") || [];
    const errorRows = result?.preview.filter(r => r.status === "error") || [];

    // Pagination calculations
    const totalValidPages = Math.ceil(result?.success ? result.success / ITEMS_PER_PAGE : 0);
    const validPageRows = validRows.slice((validPage - 1) * ITEMS_PER_PAGE, validPage * ITEMS_PER_PAGE);

    const totalErrorPages = Math.ceil(result?.failed ? result.failed / ITEMS_PER_PAGE : 0);
    const errorPageRows = errorRows.slice((errorPage - 1) * ITEMS_PER_PAGE, errorPage * ITEMS_PER_PAGE);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Import & Export Data"
                description="Upload file CSV untuk update data anggota secara massal"
                actions={
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Data Anggota
                    </Button>
                }
            />

            {/* Upload Section */}
            {(status === "idle" || status === "uploading") && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Upload File CSV
                        </CardTitle>
                        <CardDescription>
                            Pilih tipe data dan upload file CSV untuk memperbarui data anggota.
                            Sistem akan melakukan validasi terlebih dahulu sebelum data disimpan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipe Import</label>
                                <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="tunkin">
                                            Tunjangan Kinerja (Tunkin)
                                        </SelectItem>
                                        <SelectItem value="gaji">
                                            Gaji Bersih
                                        </SelectItem>
                                        <SelectItem value="tajib">
                                            Tabungan Wajib Per Bulan
                                        </SelectItem>
                                        <SelectItem value="akun_anggota">
                                            Import Akun Anggota (NRP + Nama)
                                        </SelectItem>
                                        <SelectItem value="sejahtera">
                                            Tabungan Sejahtera (Mutasi Historis)
                                        </SelectItem>
                                        <SelectItem value="migrasi_pinjaman">
                                            Migrasi Pinjaman Aktif (SP)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">File Excel/CSV</label>
                                <input
                                    type="file"
                                    accept=".csv,.txt,.xlsx,.xls"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-muted-foreground
                                        file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                                        file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground
                                        hover:file:bg-primary/90 cursor-pointer"
                                />
                            </div>
                        </div>

                        {file && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                                <Button
                                    onClick={handlePreview}
                                    disabled={status === "uploading"}
                                >
                                    {status === "uploading" ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Memproses...
                                        </>
                                    ) : (
                                        "Preview & Validasi"
                                    )}
                                </Button>
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
                            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                                📋 Format CSV yang didukung:
                            </h4>
                            {importType === "tunkin" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Support <strong>.xls, .xlsx, .csv</strong>. Sistem akan membaca kolom <strong>NRP/NIP</strong>, <strong>NAMA</strong>, dan <strong className="bg-yellow-200">SISA_TUNKIN</strong> (atau TUNKIN/TUNJANGAN).
                                </p>
                            ) : importType === "tajib" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Support <strong>.xls, .xlsx, .csv</strong>. Sistem membaca <strong>NRP/NIP</strong>, <strong>NAMA</strong>, dan <strong className="bg-yellow-200">JML</strong> / JUMLAH.
                                </p>
                            ) : importType === "gaji" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Support <strong>.xls, .xlsx, .csv</strong>. Sistem akan mencari kecocokan bedasar <strong>NAMA</strong> (gelar akan diabaikan) atau <strong>NRP/NIP</strong> (jika ada). Wajib ada kolom <strong>JUMLAH GAJI DITERIMA</strong> / GAJI BERSIH.
                                </p>
                            ) : (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Support <strong>.xls, .xlsx, .csv</strong>. Sistem akan membaca kolom <strong>NRP/NIP</strong>, <strong>NAMA</strong>, dan opsional <strong className="bg-yellow-200">JUMLAH GAJI / DITERIMA</strong>. Anggota baru otomatis dibuatkan akun (password = NRP). NRP digunakan langsung sebagai nomor anggota.
                                </p>
                            )}
                        </div>
                        <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-950/20">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                💡 <strong>Tips:</strong> Jika anggota belum terdaftar di sistem, gunakan tipe <strong>&quot;Import Akun Anggota&quot;</strong> terlebih dahulu untuk mendaftarkan anggota baru, lalu baru import data Tunkin/Gaji. Anggota juga bisa didaftarkan manual melalui menu Anggota → Tambah Anggota.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Preview Section */}
            {(status === "previewing" || status === "importing") && result && (
                <>
                    {/* Summary */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Card>
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="rounded-lg bg-muted p-2">
                                    <FileSpreadsheet className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Baris</p>
                                    <p className="text-2xl font-bold">{result.totalRows}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-emerald-200">
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="rounded-lg bg-emerald-100 p-2">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Data Valid</p>
                                    <p className="text-2xl font-bold text-emerald-600">{result.success}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-red-200">
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="rounded-lg bg-red-100 p-2">
                                    <XCircle className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Data Error</p>
                                    <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleReset}>
                            Batal
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={status === "importing" || result.success === 0}
                        >
                            {status === "importing" ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Mengimport {result.success} data...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import {result.success} Data Valid
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Error Rows */}
                    {errorRows.length > 0 && (
                        <Card className="border-red-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                                    <XCircle className="h-4 w-4" />
                                    Daftar Data Error ({result.failed} baris)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-auto max-h-60 px-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-16">Baris</TableHead>
                                                <TableHead>NRP/NIP</TableHead>
                                                <TableHead>Nama</TableHead>
                                                <TableHead>Error</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {errorPageRows.map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{r.row}</TableCell>
                                                    <TableCell className="font-mono text-xs">{r.nrp || '-'}</TableCell>
                                                    <TableCell>{r.nama}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="destructive" className="text-xs">{r.reason}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                {totalErrorPages > 1 ? (
                                    <div className="bg-muted/30 border-t px-4 py-3 flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            Menampilkan {((errorPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(errorPage * ITEMS_PER_PAGE, result.failed)} dari {result.failed} error
                                        </p>
                                        <div className="flex gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => setErrorPage(p => Math.max(1, p - 1))}
                                                disabled={errorPage === 1}
                                            >
                                                Sebelumnya
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => setErrorPage(p => Math.min(totalErrorPages, p + 1))}
                                                disabled={errorPage === totalErrorPages}
                                            >
                                                Selanjutnya
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-muted/30 border-t px-4 py-3">
                                        <p className="text-xs text-center text-muted-foreground">
                                            Menampilkan semua {result.failed} error
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Valid Rows Preview */}
                    {validRows.length > 0 && (
                        <Card className="border-emerald-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Pratinjau Data Valid ({result.success} baris)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-auto max-h-96 px-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-16">Baris</TableHead>
                                                <TableHead>NRP/NIP</TableHead>
                                                <TableHead>Nama (CSV)</TableHead>
                                                <TableHead>Nama (DB)</TableHead>
                                                <TableHead className="text-right">
                                                    {importType === "tunkin" ? "Tunkin Baru" : importType === "tajib" ? "Tajib Baru" : importType === "sejahtera" ? "Data Mutasi" : importType === "migrasi_pinjaman" ? "Pokok Pinjaman" : "Gaji Baru"}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {importType === "tunkin" ? "Tunkin Saat Ini" : importType === "tajib" ? "Tajib Saat Ini" : importType === "sejahtera" ? "Keterangan" : importType === "migrasi_pinjaman" ? "Sisa Pokok" : "Gaji Saat Ini"}
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {validPageRows.map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{r.row}</TableCell>
                                                    <TableCell className="font-mono text-xs">{r.nrp}</TableCell>
                                                    <TableCell className="text-xs">{r.nama}</TableCell>
                                                    <TableCell className="text-xs font-medium">
                                                        {r.isNewMember ? (
                                                            <span className="flex items-center gap-1">
                                                                <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-emerald-100 text-emerald-700">BARU</Badge>
                                                                {r.memberName}
                                                            </span>
                                                        ) : r.memberName}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {importType === "akun_anggota" && r.isNewMember === false ? (
                                                            <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal border-dashed">Dilewati</Badge>
                                                        ) : importType === "sejahtera" ? (
                                                            `${r.mutasiCount} bulan`
                                                        ) : importType === "migrasi_pinjaman" ? (
                                                            formatCurrency(r.gaji || 0) // we will misuse r.gaji to pass principalAmount
                                                        ) : (
                                                            formatCurrency(importType === "tunkin" ? (r.tunkin || 0) : importType === "tajib" ? (r.tajib || 0) : (r.gaji || 0))
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-muted-foreground">
                                                        {importType === "sejahtera" || importType === "migrasi_pinjaman" ? (
                                                            <span className="text-xs">{r.reason}</span>
                                                        ) : importType === "tunkin"
                                                            ? (r.currentTunkin != null ? formatCurrency(r.currentTunkin) : "-")
                                                            : importType === "tajib"
                                                            ? (r.currentTajib != null ? formatCurrency(r.currentTajib) : "-")
                                                            : (r.currentGaji != null ? formatCurrency(r.currentGaji) : "-")
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                
                                {totalValidPages > 1 ? (
                                    <div className="bg-muted/30 border-t px-4 py-3 flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            Menampilkan {((validPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(validPage * ITEMS_PER_PAGE, result.success)} dari {result.success} data
                                        </p>
                                        <div className="flex gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => setValidPage(p => Math.max(1, p - 1))}
                                                disabled={validPage === 1}
                                            >
                                                Sebelumnya
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => setValidPage(p => Math.min(totalValidPages, p + 1))}
                                                disabled={validPage === totalValidPages}
                                            >
                                                Selanjutnya
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-muted/30 border-t px-4 py-3">
                                        <p className="text-xs text-center text-muted-foreground">
                                            Menampilkan semua {result.success} data valid
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* Done Section */}
            {status === "done" && result && (
                <Card className="border-emerald-300">
                    <CardContent className="flex flex-col items-center gap-4 py-12">
                        <div className="rounded-full bg-emerald-100 p-4">
                            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold text-emerald-800">Import Berhasil!</h3>
                        <p className="text-muted-foreground text-center">
                            <strong>{result.success}</strong> data berhasil diupdate
                            {result.failed > 0 && (
                                <>, <strong className="text-red-600">{result.failed}</strong> data gagal</>
                            )}
                        </p>
                        <Button onClick={handleReset} variant="outline">
                            Import Data Lagi
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
