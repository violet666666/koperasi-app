"use client";

import * as React from "react";
import { reportsApi } from "@/lib/api";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { exportToExcel, generateNeracaPDF, type ExportColumn } from "@/lib/export-utils";
import { buildNeracaRows, type NeracaSide } from "@/lib/neraca-format";
import type { BalanceSheetResult } from "@/lib/services/neraca";

const fmt = (n: number, negativeParens = true) =>
  negativeParens && n < 0 ? `(${formatCurrency(Math.abs(n))})` : formatCurrency(n);

/** Satu kolom neraca (AKTIVA / PASIVA) — gaya format resmi: grup bernomor + subtotal Jumlah. */
function NeracaSideTable({ title, side }: { title: string; side: NeracaSide }) {
  let groupNo = 0;
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th colSpan={2} className="border-b-2 border-foreground pb-1 text-center text-base font-bold tracking-[0.2em]">
            {title}
          </th>
        </tr>
        <tr className="text-[11px] uppercase text-muted-foreground">
          <th className="border-b border-foreground py-1 pl-1 text-left font-medium">Uraian</th>
          <th className="border-b border-foreground py-1 pr-1 text-right font-medium">Jumlah (Rp)</th>
        </tr>
      </thead>
      <tbody>
        {side.rows.map((r, idx) => {
          if (r.kind === "group")
            return (
              <tr key={idx} className="bg-muted/40 print:bg-muted/40">
                <td colSpan={2} className="border-t border-border py-1 pl-1 font-bold uppercase">{++groupNo}. {r.label}</td>
              </tr>
            );
          if (r.kind === "total")
            return (
              <tr key={idx} className="border-t-[3px] border-double border-foreground font-bold">
                <td className="py-1.5 pl-1">{r.label}</td>
                <td className="py-1.5 pr-1 text-right tabular-nums">{fmt(r.amount ?? 0, false)}</td>
              </tr>
            );
          if (r.kind === "subtotal")
            return (
              <tr key={idx} className="font-semibold">
                <td className="border-t border-foreground py-1 pl-6">{r.label}</td>
                <td className="border-t border-foreground py-1 pr-1 text-right tabular-nums">{fmt(r.amount ?? 0, false)}</td>
              </tr>
            );
          const neg = (r.amount ?? 0) < 0;
          return (
            <tr key={idx}>
              <td className="py-0.5 pl-6">{r.label}</td>
              <td className={`py-0.5 pr-1 text-right tabular-nums ${neg ? "text-red-600" : ""}`}>{fmt(r.amount ?? 0)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

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
    push("=== AKTIVA ===", 0);
    const f = buildNeracaRows(data);
    for (const side of [f.aktiva, f.pasiva]) {
      for (const r of side.rows) push(r.label, r.amount ?? 0);
    }
    return rows;
  };

  const exportCols: ExportColumn[] = [
    { header: "Keterangan", key: "keterangan", width: 42 },
    { header: "Jumlah (Rp)", key: "jumlah", width: 22, format: (v) => (v === 0 ? "" : formatCurrency(Number(v))) },
  ];

  const neraca = data ? buildNeracaRows(data) : null;
  const asOfLong = data
    ? new Date(data.asOf).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : "";

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
            <Button variant="outline" size="sm" disabled={!data} onClick={() => data && generateNeracaPDF(data)}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      {error && <Card><CardContent className="p-4 text-sm text-red-600">{error}</CardContent></Card>}

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      ) : data && neraca ? (
        <Card>
          <CardContent className="p-6">
            {/* Kop surat */}
            <div className="mb-1 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/LogoPrimkoppol.png" alt="Logo" width={42} height={42} className="object-contain" />
              <div>
                <div className="text-[15px] font-bold uppercase leading-tight">Koperasi Primkoppol Resor Lumajang</div>
                <div className="text-[9px] text-muted-foreground">Jl. Alun-Alun Utara No. 11, Rogotrunan, Kec. Lumajang, Kabupaten Lumajang, Jawa Timur 67316</div>
              </div>
            </div>
            <div className="mb-4 mt-2 border-y-[3px] border-double border-foreground" />

            <div className="mb-1 text-center text-[15px] font-bold tracking-[0.3em]">NERACA (BALANCE SHEET)</div>
            <div className="mb-4 text-center text-sm text-muted-foreground">Per {asOfLong}</div>

            {data && !data.isBalanced && (
              <div className="mb-3 flex justify-center">
                <Badge variant="destructive">Tidak balance — selisih {formatCurrency(Math.abs(data.equity.selisih))}</Badge>
              </div>
            )}

            <div className="grid gap-8 lg:grid-cols-2">
              <NeracaSideTable title="AKTIVA" side={neraca.aktiva} />
              <NeracaSideTable title="PASIVA" side={neraca.pasiva} />
            </div>

            {data?.meta?.note && <div className="mt-6 text-[11px] text-muted-foreground">{data.meta.note}</div>}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
