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
    Wallet,
    Trash2,
    ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/constants";

type ImportType = "tunkin" | "gaji" | "gaji_uraian" | "tajib" | "akun_anggota" | "sejahtera" | "migrasi_pinjaman" | "update_pinjaman" | "vs_sp" | "potongan" | "buku_kas" | "toko_history";
type ImportStatus = "idle" | "uploading" | "previewing" | "importing" | "done";

interface PreviewRow {
    row: number;
    nrp: string;
    nama: string;
    tunkin?: number;
    gaji?: number;
    sisaGaji?: number;
    tajib?: number;
    memberId?: number;
    memberName?: string;
    status: "valid" | "error" | "new_member" | string;
    reason: string | null;
    currentTunkin?: number | null;
    currentGaji?: number | null;
    currentSisaGaji?: number | null;
    currentTajib?: number | null;
    isNewMember?: boolean;
    mutasiCount?: number;
    pangkat?: string;
    rekening?: string;
    totalBarang?: number;
    sisaSaldo?: number;
    salarySource?: string;
    // vs_sp specific fields
    memberMatch?: string;
    pinjam?: number;
    angsuran?: number;
    jasa?: number;
    potBulan?: number;
    totalBulan?: number;
    jumlahSd?: number;
    loanNo?: string;
    notes?: string;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findBestSheet(XLSX: any, workbook: any, type: ImportType): string {
    const requiredKeywords: Record<ImportType, string[][]> = {
        tunkin: [["tunkin", "sisa_tunkin", "sisa tunkin", "tunjangan", "tunles", "bersih"]],
        gaji: [["gaji", "diterima", "bersih", "salary"]],
        gaji_uraian: [["gaji", "bersih"]],
        tajib: [["jml", "jumlah", "tajib", "Simpanan Wajib"]],
        update_pinjaman: [["pinjam", "selama"]],
        akun_anggota: [["nrp", "nip"]],
        sejahtera: [[]],
        migrasi_pinjaman: [["pinjam", "selama", "angsuran", "saldo"]],
        vs_sp: [["pinjam", "sisa saldo", "klasifikasi"]],
        potongan: [["tajib", "barang"]],
        buku_kas: [[]],
        toko_history: [[]],
    };

    const keywords = requiredKeywords[type] || [];
    const sheetNames = workbook.SheetNames as string[];

    // 1. Try matching sheet name first (e.g. 'TUNKIN', 'POT GAJI', 'TAJIB')
    const nameHints: Record<ImportType, string[]> = {
        tunkin: ["tunkin", "tunjangan"],
        gaji: ["pot gaji", "gaji"],
        gaji_uraian: ["uraian gaji", "uraian"],
        tajib: ["tajib", "tajip", "wajib"],
        update_pinjaman: ["sheet2"],
        akun_anggota: ["anggota", "member"],
        sejahtera: [],
        migrasi_pinjaman: ["pinjam", "piutang", "rincian"],
        vs_sp: ["gaji"],
        potongan: ["barang", "potongan"],
        buku_kas: [],
        toko_history: [],
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertWorkbookToCSV(XLSX: any, workbook: any, type: ImportType, originalName: string): File {
    if (type === "potongan" || type === "toko_history") {
        // Multi-sheet merge: combine all sheets into one CSV with BULAN column
        return mergeMultiSheetToCSV(XLSX, workbook, originalName, type);
    }
    const sheetName = findBestSheet(XLSX, workbook, type);
    const worksheet = workbook.Sheets[sheetName];
    const csvString = XLSX.utils.sheet_to_csv(worksheet);
    const newFileName = originalName.replace(/\.[^/.]+$/, "") + "_converted.csv";
    return new File([csvString], newFileName, { type: "text/csv" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeMultiSheetToCSV(XLSX: any, workbook: any, originalName: string, type: ImportType): File {
    // Robust month mapping to catch full names and abbreviations
    const monthMap: Record<string, string> = {
        '1': '1', 'januari': '1', 'jan': '1', 'january': '1',
        '2': '2', 'pebruari': '2', 'februari': '2', 'feb': '2', 'peb': '2', 'february': '2',
        '3': '3', 'maret': '3', 'mar': '3', 'mrt': '3', 'march': '3',
        '4': '4', 'april': '4', 'apr': '4',
        '5': '5', 'mei': '5', 'may': '5',
        '6': '6', 'juni': '6', 'jun': '6', 'june': '6',
        '7': '7', 'juli': '7', 'jul': '7', 'july': '7',
        '8': '8', 'agustus': '8', 'agu': '8', 'agt': '8', 'aug': '8', 'august': '8',
        '9': '9', 'september': '9', 'sep': '9', 'sept': '9',
        '10': '10', 'oktober': '10', 'okt': '10', 'oct': '10', 'october': '10',
        '11': '11', 'november': '11', 'nov': '11',
        '12': '12', 'desember': '12', 'des': '12', 'dec': '12', 'december': '12'
    };
    
    // Support dynamic resolving of sheet name as month numerical value
    const getMonthNum = (sName: string, index: number) => {
        const cleaned = sName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        return monthMap[cleaned] || String(index + 1);
    };

    const allRows: string[][] = [];
    // Header row
    allRows.push(['NRP', 'TAJIB', 'BARANG', 'SP', 'JUMLAH', 'NAMA', 'BULAN']);
    
    for (let i = 0; i < workbook.SheetNames.length; i++) {
        const sheetName = workbook.SheetNames[i];
        const monthNum = getMonthNum(sheetName, i);
        const ws = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as string[][];
        
        for (const row of rows) {
            const col0 = String(row[0] || '').trim();
            if (!col0) continue;
            // Skip header rows (col 1 contains "TAJIB")
            if (String(row[1] || '').toUpperCase().includes('TAJIB')) continue;
            // Must have numeric NRP
            if (!/\d/.test(col0)) continue;
            
            allRows.push([
                col0,
                String(row[1] || ''),
                String(row[2] || ''),
                String(row[3] || ''),
                String(row[4] || ''),
                String(row[5] || ''),
                monthNum
            ]);
        }
    }
    
    const csv = allRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const newFileName = originalName.replace(/\.[^/.]+$/, "") + "_merged.csv";
    return new File([csv], newFileName, { type: "text/csv" });
}

export default function ImportDataPage() {
    const [importType, setImportType] = useState<ImportType>("tunkin");
    const [status, setStatus] = useState<ImportStatus>("idle");
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [tajibPeriod, setTajibPeriod] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [error, setError] = useState<string | null>(null);
    const [isResetting, setIsResetting] = useState(false);

    // vs_sp specific states
    const [availableSheets, setAvailableSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState("GAJI");
    const [detectedPeriod, setDetectedPeriod] = useState("");
    const [vsSpSummary, setVsSpSummary] = useState<{
        total: number;
        update: number;
        newLoan: number;
        newMember: number;
        skip: number;
        error: number;
    } | null>(null);

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
            if (file.name.toLowerCase().endsWith('.csv') || importType === 'sejahtera' || importType === 'migrasi_pinjaman' || importType === 'update_pinjaman' || importType === 'vs_sp' || importType === 'toko_history') {
                processedFile = file; // These APIs read .xlsx natively
            } else {
                const XLSX = await import("xlsx");
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                processedFile = convertWorkbookToCSV(XLSX, workbook, importType, file.name);
            }

            const formData = new FormData();
            formData.append("file", processedFile);
            formData.append("type", importType);
            formData.append("mode", "preview");
            if (importType === "tajib") formData.append("periodMonth", tajibPeriod);
            if (importType === "vs_sp") formData.append("sheetName", selectedSheet);

            const targetUrl = importType === "sejahtera" ? "/api/sejahtera/import"
                : importType === "migrasi_pinjaman" ? "/api/loans/import-migrasi"
                : importType === "update_pinjaman" ? "/api/loans/import-update"
                : importType === "vs_sp" ? "/api/loans/import-vs-sp"
                : importType === "toko_history" ? "/api/toko/sales/import-history"
                : importType === "potongan" ? "/api/transactions/import-potongan"
                : "/api/members/import";
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

            // vs_sp: extract sheet list, period, summary from preview response
            if (importType === "vs_sp") {
                const vsData = json.data;
                setAvailableSheets(vsData.availableSheets || []);
                setDetectedPeriod(vsData.period || "");
                setVsSpSummary(vsData.summary || null);
            }

            toast.success("File berhasil di-parse. Silakan review data di bawah.");
            setStatus("previewing");
        } catch (err) {
            console.error("HandlePreview Error:", err);
            setError("Terjadi kesalahan sistem internal/jaringan.");
            toast.error("Internal Server Error saat memproses file.");
            setStatus("idle");
        }
    }, [file, importType, selectedSheet, tajibPeriod]);

    const handleImport = useCallback(async () => {
        if (!file) return;
        setStatus("importing");

        try {
            let processedFile: File;
            if (file.name.toLowerCase().endsWith('.csv') || importType === 'sejahtera' || importType === 'migrasi_pinjaman' || importType === 'update_pinjaman' || importType === 'vs_sp' || importType === 'potongan') {
                processedFile = file;
            } else {
                const XLSX = await import("xlsx");
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                processedFile = convertWorkbookToCSV(XLSX, workbook, importType, file.name);
            }

            const formData = new FormData();
            formData.append("file", processedFile);
            formData.append("type", importType);
            formData.append("mode", "commit");
            if (importType === "tajib") formData.append("periodMonth", tajibPeriod);
            if (importType === "vs_sp") formData.append("sheetName", selectedSheet);

            const targetUrl = importType === "sejahtera" ? "/api/sejahtera/import"
                : importType === "migrasi_pinjaman" ? "/api/loans/import-migrasi"
                : importType === "update_pinjaman" ? "/api/loans/import-update"
                : importType === "vs_sp" ? "/api/loans/import-vs-sp"
                : importType === "potongan" ? "/api/transactions/import-potongan"
                : "/api/members/import";
            // Use AbortController with 5-minute timeout for large imports
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000);
            const res = await fetch(targetUrl, {
                method: "POST",
                body: formData,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const json = await res.json();
            if (!res.ok) {
                setError(json.message || "Gagal import data");
                toast.error(json.message || "Gagal import data ke database.");
                setStatus("previewing");
                return;
            }

            setResult(json.data);

            // vs_sp: update summary from commit response
            if (importType === "vs_sp") {
                const vsData = json.data;
                setVsSpSummary(vsData.summary || null);
            }

            toast.success(`Berhasil menyimpan ${json.data.success} data.`);
            setStatus("done");
        } catch (err: any) {
            const msg = err?.name === "AbortError"
                ? "Import timeout — data mungkin sudah masuk sebagian. Cek data lalu import ulang jika perlu."
                : "Ada masalah koneksi/server saat upload.";
            setError(msg);
            toast.error(msg);
            setStatus("previewing");
        }
    }, [file, importType, selectedSheet, tajibPeriod]);

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
        setAvailableSheets([]);
        setDetectedPeriod("");
        setVsSpSummary(null);
    }, []);

    const handleResetTunkin = async () => {
        if (!confirm("YAKIN? Ini akan mengenolkan (Rp 0) data seluruh Tunkin anggota aktif yang terdaftar! Tindakan ini cocok dilakukan sebelum import ulang Tunkin.")) return;
        setIsResetting(true);
        try {
            const res = await fetch("/api/members/reset-tunkin", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Gagal mereset Tunkin");
            toast.success(data.message);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsResetting(false);
        }
    };

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
                    <div className="flex gap-2">
                        {importType === "tunkin" && (
                            <Button variant="destructive" onClick={handleResetTunkin} disabled={isResetting}>
                                {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Kosongkan Tunkin
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Data Anggota
                        </Button>
                    </div>
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
                                            Gaji Bersih & Sisa Gaji (POT GAJI)
                                        </SelectItem>
                                        <SelectItem value="gaji_uraian">
                                            Gaji Bersih & Sisa Gaji (Uraian Gaji) + Daftar Anggota
                                        </SelectItem>
                                        <SelectItem value="tajib">
                                            Simpanan Wajib Per Bulan
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
                                        <SelectItem value="update_pinjaman">
                                            Update Pinjaman SP (Periode 2026)
                                        </SelectItem>
                                        <SelectItem value="vs_sp">
                                            Import VS SP (Per Bulan)
                                        </SelectItem>
                                        <SelectItem value="potongan">
                                            Potongan Gaji Bulanan (Barang Primkoppol)
                                        </SelectItem>
                                        <SelectItem value="toko_history">
                                            History Belanja Toko (Multi-bulan)
                                        </SelectItem>
                                        <SelectItem value="buku_kas">
                                            Buku Kas / Keuangan (Transaksi Bank & Tunai)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {importType === "tajib" && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Periode Bulan (TAJIP Sederhana)</label>
                                    <Select value={tajibPeriod} onValueChange={setTajibPeriod}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 24 }, (_, i) => {
                                                const d = new Date();
                                                d.setMonth(d.getMonth() - i, 1);
                                                const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                                                const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
                                                const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
                                                return <SelectItem key={val} value={val}>{label}</SelectItem>;
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">Untuk format TAJIP sederhana (NRP+TAJIB+NAMA). Format saldo lengkap otomatis tanpa periode.</p>
                                </div>
                            )}

                            {importType !== "buku_kas" && (
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
                            )}
                        </div>

                        {importType === "buku_kas" && (
                            <div className="rounded-lg border p-6 bg-blue-50 dark:bg-blue-950/20 text-center space-y-4 my-2">
                                <Wallet className="h-12 w-12 text-blue-500 mx-auto" />
                                <div>
                                    <h3 className="font-semibold text-lg text-blue-800 dark:text-blue-300">Import Terintegrasi di Modul Keuangan</h3>
                                    <p className="text-sm text-blue-700/80 dark:text-blue-400/80 mt-1 max-w-lg mx-auto leading-relaxed">
                                        Untuk menjaga presisi arus kas dan memudahkan rekonsiliasi akuntansi (seperti pemilihan brankas akun tujuan sebelum di-upload), **Sistem Import Buku Kas** diletakkan langsung di dalam pusat modul Kas & Bank.
                                    </p>
                                </div>
                                <Button asChild size="lg" className="mt-4">
                                    <Link href="/kas-bank">
                                        Menuju Halaman Kas & Bank Koperasi
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        )}

                        {/* vs_sp: Sheet selector + Period badge */}
                        {importType === "vs_sp" && availableSheets.length > 0 && (
                            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium">Sheet:</label>
                                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                                        <SelectTrigger className="w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSheets.map(s => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {detectedPeriod && (
                                    <Badge variant="outline" className="text-sm px-3 py-1">
                                        Periode: {detectedPeriod}
                                    </Badge>
                                )}
                            </div>
                        )}

                        {file && importType !== "buku_kas" && (
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

                        {importType !== "buku_kas" && (
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
                                    Support <strong>.xls, .xlsx, .csv</strong>. Sistem membaca <strong>NRP/NIP</strong>, <strong>NAMA</strong>, <strong>POKOK</strong> (Simp. Pokok), <strong>WAJIB</strong> (Saldo Awal Wajib), lalu sisa kolom bulan <strong className="bg-yellow-200">JANUARI - DESEMBER</strong> akan otomatis dicatat sebagai Setoran Historis. Total kolom diperiksa berdasar kolom <strong>JML</strong>.
                                </p>
                            ) : importType === "gaji" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Support <strong>.xls, .xlsx, .csv</strong>. Sistem akan mencari kecocokan bedasar <strong>NAMA</strong> (gelar akan diabaikan) atau <strong>NRP/NIP</strong> (jika ada). Jika ada kolom <strong>GAJI BERSIH</strong> akan disimpan sebagai Gaji, dan kolom <strong className="bg-yellow-200">DITERIMA / JUMLAH GAJI DITERIMA</strong> disimpan sebagai Sisa Gaji (untuk perhitungan plafon piutang 50%). Dari sheet <strong>POT GAJI</strong>.
                                </p>
                            ) : importType === "gaji_uraian" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Upload file <strong>Gaji POLRES/POLSEK (.xls)</strong>. Sistem membaca sheet <strong>URAIAN GAJI</strong> dengan posisi kolom tetap: <strong>PANGKAT</strong> (C), <strong>NAMA</strong> (D), <strong>NRP</strong> (E), <strong>NO REKENING</strong> (G), <strong>GAJI BERSIH</strong> (H), <strong className="bg-yellow-200">JUMLAH GAJI DITERIMA / SISA GAJI</strong> (AK). <strong className="bg-yellow-200">Sisa Gaji</strong> digunakan untuk perhitungan plafon piutang anggota (50%). Anggota baru otomatis didaftarkan dengan NRP + NAMA + GAJI + PANGKAT + NO REKENING.
                                </p>
                            ) : importType === "sejahtera" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Upload file <strong>TAB. SEJAHTERA (.xlsx)</strong>. Format: <strong>NO REG</strong>, <strong>NAMA</strong>, <strong>SALDO AWAL</strong>, lalu <strong className="bg-yellow-200">KK, KM, SALDO AKHIR</strong> per bulan. Pencocokan anggota via <strong>NAMA</strong> (bukan NRP). Jumlah bulan otomatis terdeteksi dari kolom file.
                                </p>
                            ) : importType === "migrasi_pinjaman" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Upload file <strong>RINCIAN PIUTANG SP (.xlsx)</strong>. Sistem otomatis mendeteksi kolom <strong>NRP</strong>, <strong>PINJAM</strong>, <strong>SELAMA</strong>, <strong>ANGSURAN</strong>, dan <strong className="bg-yellow-200">SISA SALDO</strong> terbaru. Data per satker (header berulang) otomatis diproses. Hanya pinjaman dengan sisa &gt; 0 yang dimigrasi. <strong>Tidak mempengaruhi Kas/Jurnal.</strong>
                                </p>
                            ) : importType === "update_pinjaman" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Upload file <strong>RINCIAN PIUTANG SP (.xlsx) — Sheet2</strong>. Update saldo pinjaman existing + catat pembayaran bulanan 2026 (<strong className="bg-yellow-200">Jan s/d Mei</strong>). Kolom: <strong>NRP</strong> (E), <strong>PINJAM</strong> (F), <strong>SELAMA</strong> (G), <strong>ANGSURAN</strong> (I), <strong>SISA SALDO</strong> (T). Pinjaman baru otomatis dibuat jika belum ada. <strong>Tidak mempengaruhi Kas/Jurnal.</strong>
                                </p>
                            ) : importType === "vs_sp" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Upload file <strong>Rincian Piutang VS-SP (.xlsx)</strong>. Sistem otomatis mendeteksi <strong className="bg-yellow-200">periode bulan</strong> dan <strong>daftar sheet</strong> dari file. Pilih sheet yang berisi data potongan (biasanya <strong>GAJI</strong>). Kolom: <strong>NRP</strong>, <strong>NAMA</strong>, <strong>PINJAM</strong>, <strong>ANGSURAN</strong>, <strong>POT BULAN INI</strong>, <strong>TERBAYAR</strong>, <strong>SISA SALDO</strong>. Status: UPDATE (pinjaman existing), NEW_LOAN (pinjaman baru), NEW_MEMBER (anggota + pinjaman baru).
                                </p>
                            ) : importType === "potongan" ? (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Upload file <strong>Barang Primkoppol (.xlsx)</strong>. File ini berisi <strong>multi-sheet</strong> (per bulan). Kolom: <strong className="bg-yellow-200">NRP, TAJIB, BARANG, SP, JUMLAH, NAMA</strong>. Saat commit, TAJIB akan <strong>diakumulasi ke Simpanan Wajib</strong> anggota. Data BARANG dan SP dicatat sebagai informasi.
                                </p>
                            ) : (
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Support <strong>.xls, .xlsx, .csv</strong>. Sistem akan membaca kolom <strong>NRP/NIP</strong>, <strong>NAMA</strong>, dan opsional <strong className="bg-yellow-200">JUMLAH GAJI / DITERIMA</strong>. Anggota baru otomatis dibuatkan akun (password = NRP). NRP digunakan langsung sebagai nomor anggota.
                                </p>
                            )}
                        </div>
                        )}
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

                    {/* vs_sp: Breakdown summary cards */}
                    {importType === "vs_sp" && vsSpSummary && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <Card className="border-green-200 bg-green-50/50">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-green-600 font-medium">UPDATE</p>
                                    <p className="text-xl font-bold text-green-700">{vsSpSummary.update}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-yellow-200 bg-yellow-50/50">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-yellow-600 font-medium">PINJAMAN BARU</p>
                                    <p className="text-xl font-bold text-yellow-700">{vsSpSummary.newLoan}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-blue-200 bg-blue-50/50">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-blue-600 font-medium">ANGGOTA BARU</p>
                                    <p className="text-xl font-bold text-blue-700">{vsSpSummary.newMember}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-gray-200 bg-gray-50/50">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-gray-500 font-medium">SKIP</p>
                                    <p className="text-xl font-bold text-gray-600">{vsSpSummary.skip}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-red-200 bg-red-50/50">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-red-600 font-medium">ERROR</p>
                                    <p className="text-xl font-bold text-red-700">{vsSpSummary.error}</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

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
                                                {importType !== "vs_sp" && (<>
                                                <TableHead className="text-right">
                                                    {importType === "tunkin" ? "Tunkin Baru" : importType === "tajib" ? "Simulasi JML Excel" : importType === "sejahtera" ? "Data Mutasi" : importType === "migrasi_pinjaman" ? "Pokok Pinjaman" : importType === "update_pinjaman" ? "Sisa Saldo" : importType === "toko_history" ? "Total Belanja (Barang)" : importType === "potongan" ? "Total TAJIB" : importType === "gaji_uraian" ? "Gaji Bersih (H)" : "Gaji Baru"}
                                                </TableHead>
                                                {(importType === "gaji" || importType === "gaji_uraian") && (
                                                    <TableHead className="text-right">Sisa Gaji (AK)</TableHead>
                                                )}
                                                <TableHead className="text-right">
                                                    {importType === "tunkin" ? "Tunkin Saat Ini" : importType === "tajib" ? "Saldo Saat Ini" : importType === "sejahtera" ? "Keterangan" : importType === "migrasi_pinjaman" ? "Sisa Pokok" : importType === "update_pinjaman" ? "Saldo Saat Ini" : importType === "potongan" || importType === "toko_history" ? "Keterangan" : "Gaji Saat Ini"}
                                                </TableHead>
                                                {(importType === "gaji" || importType === "gaji_uraian") && (
                                                    <TableHead className="text-right">Sisa Gaji Saat Ini</TableHead>
                                                )}
                                                {importType === "tajib" && (
                                                    <TableHead className="text-right">Skema Deteksi Data</TableHead>
                                                )}
                                                </>)}
                                                {importType === "vs_sp" && (
                                                    <>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>Match</TableHead>
                                                        <TableHead>Nama Anggota</TableHead>
                                                        <TableHead className="text-right">Pinjaman</TableHead>
                                                        <TableHead className="text-right">Pot Bulan Ini</TableHead>
                                                        <TableHead className="text-right">Terbayar</TableHead>
                                                        <TableHead className="text-right">Sisa Saldo</TableHead>
                                                        <TableHead>No Pinjaman</TableHead>
                                                        <TableHead>Catatan</TableHead>
                                                    </>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {validPageRows.map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{r.row}</TableCell>
                                                    <TableCell className="font-mono text-xs">{r.nrp}</TableCell>
                                                    <TableCell className="text-xs">{r.nama}</TableCell>
                                                    <TableCell className="text-xs font-medium">
                                                        {r.status === "new_member" ? (
                                                            <span className="flex items-center gap-1">
                                                                <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-yellow-100 text-yellow-800 border-yellow-300">Akan Didaftarkan</Badge>
                                                                {r.nama}
                                                            </span>
                                                        ) : r.isNewMember ? (
                                                            <span className="flex items-center gap-1">
                                                                <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-emerald-100 text-emerald-700">BARU</Badge>
                                                                {r.memberName}
                                                            </span>
                                                        ) : (r.memberName || r.nama)}
                                                    </TableCell>
                                                    {importType !== "vs_sp" && (<>
                                                    <TableCell className="text-right font-mono">
                                                        {importType === "akun_anggota" && r.isNewMember === false ? (
                                                            <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal border-dashed">Dilewati</Badge>
                                                        ) : importType === "sejahtera" ? (
                                                            `${r.mutasiCount} bulan`
                                                        ) : importType === "migrasi_pinjaman" || importType === "potongan" ? (
                                                            formatCurrency(r.gaji || 0)
                                                        ) : importType === "update_pinjaman" ? (
                                                            (() => {
                                                                const val = r.sisaSaldo || 0;
                                                                return val <= 0 ? (
                                                                    <span className="text-emerald-600 font-bold">LUNAS</span>
                                                                ) : formatCurrency(val);
                                                            })()
                                                        ) : importType === "toko_history" ? (
                                                            <span className="text-emerald-600 font-bold">{formatCurrency(r.totalBarang || 0)}</span>
                                                        ) : (
                                                            (() => {
                                                                const val = importType === "tunkin" ? (r.tunkin || 0) : importType === "tajib" ? (r.tajib || 0) : (r.gaji || 0);
                                                                return val < 0 ? (
                                                                    <span className="text-red-600 font-bold bg-red-50 px-1 py-0.5 rounded">{formatCurrency(val)}</span>
                                                                ) : formatCurrency(val);
                                                            })()
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-muted-foreground">
                                                        {importType === "sejahtera" || importType === "migrasi_pinjaman" || importType === "potongan" || importType === "toko_history" || importType === "update_pinjaman" ? (
                                                            <span className="text-xs">{r.reason}</span>
                                                        ) : (() => {
                                                            const val = importType === "tunkin" ? r.currentTunkin : importType === "tajib" ? r.currentTajib : r.currentGaji;
                                                            return val != null ? (
                                                                val < 0 ? (
                                                                    <span className="text-red-600 font-bold bg-red-50 px-1 py-0.5 rounded">{formatCurrency(val)}</span>
                                                                ) : formatCurrency(val)
                                                            ) : "-";
                                                        })()}
                                                    </TableCell>
                                                    {(importType === "gaji" || importType === "gaji_uraian") && (
                                                        <TableCell className="text-right font-mono">
                                                            {(r as any).sisaGaji > 0 ? (
                                                                <span className="text-blue-700 font-semibold">{formatCurrency((r as any).sisaGaji)}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">-</span>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                    {(importType === "gaji" || importType === "gaji_uraian") && (
                                                        <TableCell className="text-right font-mono text-muted-foreground">
                                                            {(r as any).currentSisaGaji != null ? formatCurrency((r as any).currentSisaGaji) : "-"}
                                                        </TableCell>
                                                    )}
                                                    {importType === "tajib" && (
                                                        <TableCell className="text-right font-mono text-muted-foreground">
                                                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">{r.reason}</span>
                                                        </TableCell>
                                                    )}
                                                    </>)}
                                                    {importType === "vs_sp" && (
                                                        <>
                                                            <TableCell>
                                                                <Badge variant={
                                                                    r.status === "UPDATE" ? "default" :
                                                                    r.status === "NEW_LOAN" ? "secondary" :
                                                                    r.status === "NEW_MEMBER" ? "outline" :
                                                                    r.status === "SKIP_ZERO" ? "secondary" :
                                                                    "destructive"
                                                                }>
                                                                    {r.status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{r.memberMatch || "-"}</TableCell>
                                                            <TableCell className="font-medium">{r.memberName || r.nama}</TableCell>
                                                            <TableCell className="text-right text-sm">{formatCurrency(r.pinjam || 0)}</TableCell>
                                                            <TableCell className="text-right text-sm">{formatCurrency(r.potBulan || 0)}</TableCell>
                                                            <TableCell className="text-right text-sm">{formatCurrency(r.jumlahSd || 0)}</TableCell>
                                                            <TableCell className="text-right text-sm font-medium">{formatCurrency(r.sisaSaldo || 0)}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{r.loanNo || "-"}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{r.notes || "-"}</TableCell>
                                                        </>
                                                    )}
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
