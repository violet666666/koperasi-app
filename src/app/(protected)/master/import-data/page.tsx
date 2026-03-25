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

type ImportType = "tunkin" | "gaji";
type ImportStatus = "idle" | "uploading" | "previewing" | "importing" | "done";

interface PreviewRow {
    row: number;
    nrp: string;
    nama: string;
    tunkin?: number;
    gaji?: number;
    memberId?: number;
    memberName?: string;
    status: "valid" | "error";
    reason: string | null;
    currentTunkin?: number | null;
    currentGaji?: number | null;
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

export default function ImportDataPage() {
    const [importType, setImportType] = useState<ImportType>("tunkin");
    const [status, setStatus] = useState<ImportStatus>("idle");
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setResult(null);
            setError(null);
        }
    }, []);

    const handlePreview = useCallback(async () => {
        if (!file) return;
        setStatus("uploading");
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", importType);
            formData.append("mode", "preview");

            const res = await fetch("/api/members/import", {
                method: "POST",
                body: formData,
            });

            const json = await res.json();
            if (!res.ok) {
                setError(json.message || "Gagal memproses file");
                setStatus("idle");
                return;
            }

            if (json.data.error) {
                setError(json.data.error);
                setStatus("idle");
                return;
            }

            setResult(json.data);
            setStatus("previewing");
        } catch (err) {
            setError("Terjadi kesalahan saat memproses file");
            setStatus("idle");
        }
    }, [file, importType]);

    const handleImport = useCallback(async () => {
        if (!file) return;
        setStatus("importing");

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", importType);
            formData.append("mode", "commit");

            const res = await fetch("/api/members/import", {
                method: "POST",
                body: formData,
            });

            const json = await res.json();
            if (!res.ok) {
                setError(json.message || "Gagal import data");
                setStatus("previewing");
                return;
            }

            setResult(json.data);
            setStatus("done");
        } catch (err) {
            setError("Terjadi kesalahan saat import");
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
    }, []);

    const validRows = result?.preview.filter(r => r.status === "valid") || [];
    const errorRows = result?.preview.filter(r => r.status === "error") || [];

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
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">File CSV</label>
                                <input
                                    type="file"
                                    accept=".csv,.txt"
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
                                    Header harus mengandung kolom <strong>NRP/NIP</strong> dan <strong>TUNKIN</strong> (atau TUNJANGAN).
                                    Contoh: NO, NAMA, NRP/NIP, NO_REKENING, TUNKIN_MARET
                                </p>
                            ) : (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Header harus mengandung kolom <strong>NRP/NIP</strong> dan <strong>GAJI</strong> (atau BERSIH).
                                    Contoh: nip, nmpeg, bersih
                                </p>
                            )}
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
                            disabled={status === "importing" || validRows.length === 0}
                        >
                            {status === "importing" ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Mengimport {validRows.length} data...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import {validRows.length} Data Valid
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
                                    Data Error ({errorRows.length} baris)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-auto max-h-60">
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
                                            {errorRows.map((r, i) => (
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
                            </CardContent>
                        </Card>
                    )}

                    {/* Valid Rows Preview */}
                    {validRows.length > 0 && (
                        <Card className="border-emerald-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Data Valid ({validRows.length} baris)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-auto max-h-96">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-16">Baris</TableHead>
                                                <TableHead>NRP/NIP</TableHead>
                                                <TableHead>Nama (CSV)</TableHead>
                                                <TableHead>Nama (DB)</TableHead>
                                                <TableHead className="text-right">
                                                    {importType === "tunkin" ? "Tunkin Baru" : "Gaji Baru"}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {importType === "tunkin" ? "Tunkin Saat Ini" : "Gaji Saat Ini"}
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {validRows.slice(0, 50).map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{r.row}</TableCell>
                                                    <TableCell className="font-mono text-xs">{r.nrp}</TableCell>
                                                    <TableCell className="text-xs">{r.nama}</TableCell>
                                                    <TableCell className="text-xs font-medium">{r.memberName}</TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatCurrency(importType === "tunkin" ? (r.tunkin || 0) : (r.gaji || 0))}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-muted-foreground">
                                                        {importType === "tunkin"
                                                            ? (r.currentTunkin != null ? formatCurrency(r.currentTunkin) : "-")
                                                            : (r.currentGaji != null ? formatCurrency(r.currentGaji) : "-")
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {validRows.length > 50 && (
                                        <p className="text-xs text-center text-muted-foreground py-2">
                                            Menampilkan 50 dari {validRows.length} baris valid
                                        </p>
                                    )}
                                </div>
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
