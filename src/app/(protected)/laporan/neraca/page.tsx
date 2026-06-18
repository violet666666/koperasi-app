"use client";

import * as React from "react";
import { reportsApi } from "@/lib/api";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
import type { BalanceSheetItem, BalanceSheetResult } from "@/lib/services/neraca";

const fmt = (n: number, negativeParens = true) =>
  negativeParens && n < 0 ? `(${formatCurrency(Math.abs(n))})` : formatCurrency(n);

export default function NeracaPage() {
  const [data, setData] = React.useState<BalanceSheetResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError("");
      try {
        const response = await reportsApi.neraca();
        setData(response.data as BalanceSheetResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat neraca");
        setData(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const buildExportRows = () => {
    if (!data) return [];
    const rows: Record<string, unknown>[] = [];
    const push = (ket: string, jumlah: number) => rows.push({ keterangan: ket, jumlah });
    push("=== AKTIVA LANCAR ===", 0);
    data.assets.current.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    push("=== AKTIVA TETAP ===", 0);
    data.assets.fixedGross.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    push("(–) Akumulasi Penyusutan", -data.assets.accumulatedDepreciation);
    push("Total Aktiva", data.assets.totalAssets);
    push("=== KEWAJIBAN ===", 0);
    data.liabilities.savings.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    data.liabilities.other.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    push("Total Kewajiban", data.liabilities.totalLiabilities);
    push("=== EKUITAS ===", 0);
    data.equity.items.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    push("Total Ekuitas", data.equity.totalEquity);
    push("Total Pasiva", data.liabilities.totalLiabilities + data.equity.totalEquity);
    return rows;
  };

  const exportCols: ExportColumn[] = [
    { header: "Keterangan", key: "keterangan", width: 42 },
    { header: "Jumlah (Rp)", key: "jumlah", width: 22, format: (v) => (v === 0 ? "" : formatCurrency(Number(v))) },
  ];
  const periodLabel = data ? `Per ${data.asOf}` : "";

  const renderItem = (i: BalanceSheetItem, negativeParens = true) => (
    <TableRow key={i.code + i.name}>
      <TableCell className="font-mono text-sm">{i.code}</TableCell>
      <TableCell>{i.name}</TableCell>
      <TableCell className={`text-right tabular-nums ${i.amount < 0 ? "text-red-600" : ""}`}>{fmt(i.amount, negativeParens)}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Neraca"
        description="Posisi keuangan per hari ini (berbasis ledger)"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!data} onClick={() => exportToExcel(buildExportRows(), exportCols, `Neraca_${data?.asOf ?? ""}`, "Neraca")}>
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" disabled={!data} onClick={() => exportToPDF(buildExportRows(), exportCols, `Laporan Neraca ${periodLabel}`, `Neraca_${data?.asOf ?? ""}`)}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">{periodLabel || "Memuat…"}</span>
          {data && !data.isBalanced && (
            <Badge variant="destructive">Tidak balance — selisih {formatCurrency(Math.abs(data.equity.selisih))}</Badge>
          )}
          {data?.meta?.note && <span className="text-xs text-muted-foreground">{data.meta.note}</span>}
        </CardContent>
      </Card>

      {error && <Card><CardContent className="p-4 text-sm text-red-600">{error}</CardContent></Card>}

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* AKTIVA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> AKTIVA</CardTitle>
              <CardDescription>{periodLabel}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama Akun</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Aktiva Lancar</TableCell></TableRow>
                  {data.assets.current.map((i) => renderItem(i))}
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Aktiva Tetap</TableCell></TableRow>
                  {data.assets.fixedGross.map((i) => renderItem(i))}
                  {data.assets.accumulatedDepreciation !== 0 && (
                    <TableRow><TableCell className="font-mono text-sm">1403</TableCell><TableCell>(–) Akumulasi Penyusutan</TableCell><TableCell className="text-right tabular-nums text-red-600">{fmt(-data.assets.accumulatedDepreciation)}</TableCell></TableRow>
                  )}
                  <TableRow className="bg-primary/10 font-bold"><TableCell colSpan={2}>TOTAL AKTIVA</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(data.assets.totalAssets)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* PASIVA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> PASIVA</CardTitle>
              <CardDescription>{periodLabel}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama Akun</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Kewajiban — Simpanan</TableCell></TableRow>
                  {data.liabilities.savings.map((i) => renderItem(i))}
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Kewajiban — Lainnya</TableCell></TableRow>
                  {data.liabilities.other.map((i) => renderItem(i))}
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Ekuitas</TableCell></TableRow>
                  {data.equity.items.map((i) => renderItem(i))}
                  <TableRow className="bg-primary/10 font-bold"><TableCell colSpan={2}>TOTAL PASIVA</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(data.liabilities.totalLiabilities + data.equity.totalEquity)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
