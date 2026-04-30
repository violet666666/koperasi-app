"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Printer, TrendingUp, CreditCard, FileText, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface MonthlyData {
  month: string;
  monthLabel: string;
  totalJasa: number;
  totalPokok: number;
  totalTransactions: number;
}

interface ReportSummary {
  grandTotalJasa: number;
  grandTotalPokok: number;
  grandTotalTransactions: number;
}

function generateMonthOptions(): { value: string; label: string }[] {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value: val, label });
  }
  return options;
}

export default function LaporanJasaPage() {
  const monthOptions = React.useMemo(generateMonthOptions, []);
  const currentMonth = monthOptions[0]?.value || "";

  const [monthFrom, setMonthFrom] = React.useState(currentMonth);
  const [monthTo, setMonthTo] = React.useState(currentMonth);
  const [data, setData] = React.useState<MonthlyData[]>([]);
  const [summary, setSummary] = React.useState<ReportSummary>({
    grandTotalJasa: 0,
    grandTotalPokok: 0,
    grandTotalTransactions: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);

  async function fetchData() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ monthFrom, monthTo });
      const res = await fetch(`/api/loans/reports/interest?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      const json = await res.json();
      setData(json.data || []);
      setSummary(
        json.summary || { grandTotalJasa: 0, grandTotalPokok: 0, grandTotalTransactions: 0 }
      );
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    fetchData();
  }, [monthFrom, monthTo]);

  function handleExportExcel() {
    const params = new URLSearchParams({ monthFrom, monthTo });
    window.open(`/api/loans/reports/interest/export?${params}`, "_blank");
  }

  function handlePrint() {
    window.print();
  }

  const fromLabel = monthOptions.find((m) => m.value === monthFrom)?.label || monthFrom;
  const toLabel = monthOptions.find((m) => m.value === monthTo)?.label || monthTo;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Jasa Pinjaman Per Bulan"
        description="Laporan pendapatan jasa (bunga) dari pembayaran angsuran pinjaman anggota"
      />

      {/* Filters */}
      <div className="print:hidden flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Dari Bulan</label>
          <Select value={monthFrom} onValueChange={setMonthFrom}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Sampai Bulan</label>
          <Select value={monthTo} onValueChange={setMonthTo}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="icon" onClick={fetchData} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Cetak
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-bold text-center">REKAP JASA PINJAMAN PER BULAN</h1>
        <p className="text-center text-sm">PRIMKOPPOL POLRES LUMAJANG</p>
        <p className="text-center text-sm">
          Periode: {fromLabel} s/d {toLabel}
        </p>
        <p className="text-center text-sm">
          Dicetak: {new Date().toLocaleDateString("id-ID")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jasa</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(summary.grandTotalJasa)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pokok</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(summary.grandTotalPokok)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jumlah Transaksi</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">{summary.grandTotalTransactions}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Belum ada pembayaran angsuran di periode ini.
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Bulan</TableHead>
              <TableHead className="text-right">Jasa Terbayar</TableHead>
              <TableHead className="text-right">Pokok Terbayar</TableHead>
              <TableHead className="text-right">Jumlah Trx</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={row.month}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell className="font-medium">{row.monthLabel}</TableCell>
                <TableCell className="text-right text-emerald-600 font-medium">
                  {formatCurrency(row.totalJasa)}
                </TableCell>
                <TableCell className="text-right text-blue-600 font-medium">
                  {formatCurrency(row.totalPokok)}
                </TableCell>
                <TableCell className="text-right">{row.totalTransactions}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-bold">
              <TableCell colSpan={2}>TOTAL</TableCell>
              <TableCell className="text-right text-emerald-600">
                {formatCurrency(summary.grandTotalJasa)}
              </TableCell>
              <TableCell className="text-right text-blue-600">
                {formatCurrency(summary.grandTotalPokok)}
              </TableCell>
              <TableCell className="text-right">{summary.grandTotalTransactions}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
