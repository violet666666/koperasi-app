"use client";

import React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/constants";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

const exportColumns: ExportColumn[] = [
    { header: "No. Rekening", key: "accountNo", width: 18 },
    { header: "Nama Anggota", key: "memberName", width: 25 },
    { header: "NRP", key: "memberNrp", width: 12 },
    { header: "Produk", key: "productName", width: 18 },
    { header: "Saldo", key: "balance", width: 18, format: (v) => formatCurrency(v as number) },
    { header: "Target", key: "target", width: 18, format: (v) => formatCurrency(v as number) },
    { header: "Progress (%)", key: "progress", width: 12 },
    { header: "Target Bulanan", key: "monthlyTarget", width: 15, format: (v) => formatCurrency(v as number) },
    { header: "Tanggal Buka", key: "openedDate", width: 14 },
];

export default function LaporanPage() {
    const [data, setData] = React.useState<Record<string, unknown>[]>([]);
    const [summary, setSummary] = React.useState({ totalAccounts: 0, totalSaldo: 0, totalTarget: 0, globalProgress: 0 });
    const [loading, setLoading] = React.useState(true);
    const [dateFrom, setDateFrom] = React.useState("");
    const [dateTo, setDateTo] = React.useState("");
    const [productType, setProductType] = React.useState("all");

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ type: "rekap" });
            if (dateFrom) params.set("dateFrom", dateFrom);
            if (dateTo) params.set("dateTo", dateTo);
            if (productType !== "all") params.set("productType", productType);

            const res = await fetch(`/api/haji-umrah/reports?${params}`);
            if (res.ok) {
                const json = await res.json();
                setData(json.data);
                setSummary(json.summary);
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat laporan");
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, productType]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    function handleExportExcel() {
        // Sanitize data to prevent formula injection in Excel
        const sanitizedData = data.map(row => {
            const sanitized: Record<string, unknown> = {};
            for (const col of exportColumns) {
                const val = row[col.key];
                if (typeof val === "string" && /^[=+@\-]/.test(val)) {
                    sanitized[col.key] = "'" + val;
                } else {
                    sanitized[col.key] = val;
                }
            }
            return sanitized;
        });
        exportToExcel(sanitizedData, exportColumns, "Laporan_Tabungan_Haji_Umrah", "Tabungan");
    }

    function handleExportPDF() {
        exportToPDF(
            data,
            exportColumns,
            "Laporan Tabungan Haji & Umrah — PRIMKOPPOL",
            "Laporan_Tabungan_Haji_Umrah",
            { subtitle: `Total: ${summary.totalAccounts} rekening | Saldo: ${formatCurrency(summary.totalSaldo)} | Target: ${formatCurrency(summary.totalTarget)}` }
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Laporan Tabungan"
                description="Rekap dan export laporan tabungan Haji & Umrah"
                backHref="/haji-umrah"
                backLabel="Dashboard"
                actions={
                    <>
                        <Button variant="outline" size="sm" onClick={handleExportExcel}>
                            <Download className="mr-2 h-4 w-4" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPDF}>
                            <FileText className="mr-2 h-4 w-4" /> PDF
                        </Button>
                    </>
                }
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-44" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-44" />
                <Select value={productType} onValueChange={setProductType}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Produk</SelectItem>
                        <SelectItem value="tabungan_haji">Tabungan Haji</SelectItem>
                        <SelectItem value="tabungan_umrah">Tabungan Umrah</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Total Rekening</p>
                        <p className="text-xl font-bold">{summary.totalAccounts}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Total Saldo</p>
                        <p className="text-xl font-bold">{formatCurrency(summary.totalSaldo)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Total Target</p>
                        <p className="text-xl font-bold">{formatCurrency(summary.totalTarget)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Progress Global</p>
                        <p className="text-xl font-bold">{summary.globalProgress}%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table Preview */}
            <Card>
                <CardHeader><CardTitle className="text-base">Data Tabungan</CardTitle></CardHeader>
                <CardContent>
                    {loading ? (
                        <p>Memuat data...</p>
                    ) : data.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">Tidak ada data</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        {exportColumns.map((col) => (
                                            <th key={col.key} className="text-left py-2 px-2 font-medium text-muted-foreground">{col.header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row, i) => (
                                        <tr key={i} className="border-b hover:bg-muted/50">
                                            {exportColumns.map((col) => (
                                                <td key={col.key} className="py-2 px-2">
                                                    {col.format
                                                        ? col.format(row[col.key])
                                                        : String(row[col.key] ?? "—")}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
