"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    ArrowLeft,
    Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import * as XLSX from "xlsx";
import Link from "next/link";

type ImportStatus = "idle" | "uploading" | "previewing" | "importing" | "done";

interface PreviewRow {
    row: number;
    sku: string;
    name: string;
    category: string;
    stockGdg: number;
    stockToko: number;
    stock: number;
    unit: string;
    sellPrice: number;
    costPrice: number;
    status: "valid" | "error";
    reason: string | null;
    isNew: boolean;
    currentStock: number | null;
    currentSellPrice: number | null;
}

interface ImportResult {
    mode: string;
    totalRows: number;
    success: number;
    failed: number;
    preview: PreviewRow[];
    error?: string;
}

const ITEMS_PER_PAGE = 50;

export default function TokoProdukImportPage() {
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

    const processFileAndUpload = async (mode: "preview" | "commit") => {
        if (!file) return;
        
        const isPreview = mode === "preview";
        setStatus(isPreview ? "uploading" : "importing");
        if (isPreview) {
            setError(null);
            setValidPage(1);
            setErrorPage(1);
        }

        try {
            // Client-side: Convert XLS/XLSX → CSV to reduce file size (avoids Vercel 4.5MB limit)
            let processedFile: File;
            if (file.name.toLowerCase().endsWith('.csv')) {
                processedFile = file;
            } else {
                toast.info("Mengkonversi file Excel ke CSV...");
                const arrayBuffer = await file.arrayBuffer();
                // IMPORTANT: raw:true preserves barcode numbers (prevents 8992775001011 → 8.99278E+12)
                const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                
                // Custom CSV conversion that formats numbers without scientific notation
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];
                const csvLines = rows.map((row: any[]) =>
                    row.map((cell: any) => {
                        if (cell === null || cell === undefined) return '';
                        if (typeof cell === 'number') {
                            // Preserve full number (no scientific notation for barcodes)
                            return Number.isInteger(cell) ? (cell as number).toFixed(0) : String(cell);
                        }
                        // Escape commas in string values
                        const str = String(cell);
                        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
                    }).join(',')
                );
                const csvString = csvLines.join('\n');
                
                const blob = new Blob([csvString], { type: 'text/csv' });
                processedFile = new File([blob], file.name.replace(/\.(xlsx?|xls)$/i, '.csv'), { type: 'text/csv' });
                toast.info(`File dikonversi: ${(blob.size / 1024).toFixed(0)} KB (${csvLines.length - 1} baris data)`);
            }

            if (mode === "commit") {
                toast.info("Menyimpan data ke database... Mohon tunggu, proses ini bisa memakan waktu untuk 1000+ produk.");
            }

            const formData = new FormData();
            formData.append("file", processedFile);
            formData.append("mode", mode);

            console.log(`[Import] Sending ${mode} request, file size: ${processedFile.size} bytes, name: ${processedFile.name}`);

            const res = await fetch("/api/toko/products/import", {
                method: "POST",
                body: formData,
            });

            console.log(`[Import] Response status: ${res.status}, ok: ${res.ok}`);

            let json;
            try {
                const text = await res.text();
                console.log(`[Import] Response length: ${text.length} chars, first 500: ${text.substring(0, 500)}`);
                json = JSON.parse(text);
            } catch (err) {
                console.error("[Import] Failed to parse response:", err);
                setError("Server menolak file ini. Pastikan ukuran file tidak melebihi batas.");
                toast.error("Gagal memproses file di server.");
                setStatus(isPreview ? "idle" : "previewing");
                return;
            }

            console.log("[Import] Parsed result:", {
                mode: json?.data?.mode,
                totalRows: json?.data?.totalRows,
                success: json?.data?.success,
                failed: json?.data?.failed,
                previewCount: json?.data?.preview?.length,
                error: json?.data?.error,
                message: json?.message,
            });

            if (!res.ok) {
                setError(json?.message || "Gagal memproses file");
                toast.error(json?.message || "Terjadi kesalahan pada server.");
                setStatus(isPreview ? "idle" : "previewing");
                return;
            }

            if (json?.data?.error) {
                setError(json.data.error);
                toast.error(json.data.error);
                setStatus(isPreview ? "idle" : "previewing");
                return;
            }

            setResult(json.data);

            if (isPreview) {
                toast.success(`File berhasil dibaca: ${json.data.success} valid, ${json.data.failed} error.`);
                setStatus("previewing");
            } else {
                toast.success(`Berhasil menyimpan ${json.data.success} produk ke database.`);
                setStatus("done");
            }

        } catch (err) {
            console.error("Process File Error:", err);
            setError("Terjadi kesalahan sistem internal/jaringan.");
            toast.error("Internal Server Error.");
            setStatus(isPreview ? "idle" : "previewing");
        }
    };

    const handlePreview = () => processFileAndUpload("preview");
    const handleImport = () => processFileAndUpload("commit");

    const handleReset = useCallback(() => {
        setFile(null);
        setResult(null);
        setError(null);
        setStatus("idle");
        setValidPage(1);
        setErrorPage(1);
        
        // Reset file input element if possible (handled cleanly by unmounting if needed, but we just leave it for now)
    }, []);

    const validRows = result?.preview.filter(r => r.status === "valid") || [];
    const errorRows = result?.preview.filter(r => r.status === "error") || [];

    const totalValidPages = Math.ceil(result?.success ? result.success / ITEMS_PER_PAGE : 0);
    const validPageRows = validRows.slice((validPage - 1) * ITEMS_PER_PAGE, validPage * ITEMS_PER_PAGE);

    const totalErrorPages = Math.ceil(result?.failed ? result.failed / ITEMS_PER_PAGE : 0);
    const errorPageRows = errorRows.slice((errorPage - 1) * ITEMS_PER_PAGE, errorPage * ITEMS_PER_PAGE);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Import Produk Toko"
                description="Upload file Excel (.xlsx/.csv) untuk menambah stok / memperbarui / memasukkan produk baru secara massal."
                actions={
                    <div className="flex gap-2">
                        <Button variant="destructive" onClick={async () => {
                            if (!confirm('PERINGATAN: Semua produk toko akan dihapus!\n\nAnda yakin ingin menghapus semua produk untuk import ulang?')) return;
                            try {
                                toast.info('Menghapus semua produk...');
                                const res = await fetch('/api/toko/products/reset', { method: 'DELETE' });
                                const json = await res.json();
                                if (res.ok) {
                                    toast.success(json.message);
                                } else {
                                    toast.error(json.message || 'Gagal menghapus');
                                }
                            } catch (e) {
                                toast.error('Gagal menghubungi server');
                            }
                        }}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Reset Semua Produk
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/toko/produk">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Kembali ke Produk
                            </Link>
                        </Button>
                    </div>
                }
            />

            {(status === "idle" || status === "uploading") && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Upload File Excel / CSV
                        </CardTitle>
                        <CardDescription>
                            Pastikan header dokumen Anda terdapat: <strong className="text-foreground">KODE, Nama Barang, Rak, Stock Gdg, Stock Toko, Total Stock, Sat, @ Harga Sat, HrgPokok</strong>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Pilih Dokumen Excel</label>
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-muted-foreground
                                    file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                                    file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground
                                    hover:file:bg-primary/90 cursor-pointer border rounded-md"
                            />
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
                                <Button onClick={handlePreview} disabled={status === "uploading"}>
                                    {status === "uploading" ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</>
                                    ) : (
                                        "Preview Data"
                                    )}
                                </Button>
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Gagal</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}

            {(status === "previewing" || status === "importing") && result && (
                <>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Card>
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="rounded-lg bg-muted p-2"><FileSpreadsheet className="h-5 w-5" /></div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Baris</p>
                                    <p className="text-2xl font-bold">{result.totalRows}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-emerald-200">
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="rounded-lg bg-emerald-100 p-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Data Valid & Siap</p>
                                    <p className="text-2xl font-bold text-emerald-600">{result.success}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-red-200">
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="rounded-lg bg-red-100 p-2"><XCircle className="h-5 w-5 text-red-600" /></div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Data Bermasalah</p>
                                    <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleReset}>Batal</Button>
                        <Button onClick={handleImport} disabled={status === "importing" || result.success === 0}>
                            {status === "importing" ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan {result.success} Produk...</>
                            ) : (
                                <><Upload className="mr-2 h-4 w-4" /> Konfirmasi Import ({result.success} Data)</>
                            )}
                        </Button>
                    </div>

                    {errorRows.length > 0 && (
                        <Card className="border-red-200">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                                    <XCircle className="h-4 w-4" /> Daftar Gagal / Dilewati ({result.failed})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-auto max-h-60">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-16">Baris</TableHead>
                                                <TableHead>KODE</TableHead>
                                                <TableHead>Nama Barang</TableHead>
                                                <TableHead>Alasan Error</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {errorPageRows.map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{r.row}</TableCell>
                                                    <TableCell className="font-mono text-xs">{r.sku || '-'}</TableCell>
                                                    <TableCell className="text-xs">{r.name}</TableCell>
                                                    <TableCell><Badge variant="destructive" className="text-[10px]">{r.reason}</Badge></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {validRows.length > 0 && (
                        <Card className="border-emerald-200">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" /> Pratinjau Data Valid ({result.success})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-auto max-h-96">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="text-xs whitespace-nowrap">
                                                <TableHead className="w-12">Baris</TableHead>
                                                <TableHead>KODE / Status</TableHead>
                                                <TableHead>Nama Barang</TableHead>
                                                <TableHead>Rak</TableHead>
                                                <TableHead className="text-right">Stock Gdg</TableHead>
                                                <TableHead className="text-right">Stock Toko</TableHead>
                                                <TableHead className="text-right">Total Stock</TableHead>
                                                <TableHead className="text-right">@Harga Sat</TableHead>
                                                <TableHead className="text-right">HrgPokok</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs">
                                            {validPageRows.map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{r.row}</TableCell>
                                                    <TableCell className="font-mono">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <span>{r.sku}</span>
                                                            <Badge variant={r.isNew ? "default" : "secondary"} className="text-[9px] px-1 h-4">
                                                                {r.isNew ? "PRODUK BARU" : "UPDATE DATA"}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-medium max-w-[200px] truncate">{r.name}</TableCell>
                                                    <TableCell>{r.category || '-'}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{r.stockGdg}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{r.stockToko}</TableCell>
                                                    <TableCell className="text-right tabular-nums font-bold text-emerald-600">
                                                        {r.stock}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {formatCurrency(r.sellPrice)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                                        {formatCurrency(r.costPrice)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                
                                {totalValidPages > 1 && (
                                    <div className="bg-muted/30 border-t px-4 py-3 flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            Menampilkan {((validPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(validPage * ITEMS_PER_PAGE, result.success)} dari {result.success} valid
                                        </p>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setValidPage(p => Math.max(1, p - 1))} disabled={validPage === 1}>Sebelumnya</Button>
                                            <Button variant="outline" size="sm" onClick={() => setValidPage(p => Math.min(totalValidPages, p + 1))} disabled={validPage === totalValidPages}>Selanjutnya</Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {status === "done" && result && (
                <Card className="border-emerald-300">
                    <CardContent className="flex flex-col items-center gap-4 py-12">
                        <div className="rounded-full bg-emerald-100 p-4">
                            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold text-emerald-800">Selesai!</h3>
                        <p className="text-muted-foreground text-center">
                            Berhasil mengimport/memperbarui <strong>{result.success}</strong> produk.
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={handleReset} variant="outline">Upload File Lain</Button>
                            <Button asChild>
                                <Link href="/toko/produk">Lihat Daftar Produk</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
