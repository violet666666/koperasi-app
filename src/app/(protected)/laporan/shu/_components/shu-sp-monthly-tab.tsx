"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/constants";
import type { SPMonthlyItem } from "../_types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SHUSPMonthlyTabProps {
  data: SPMonthlyItem[];
  year: number;
  onMonthClick?: (month: string) => void;
}

export function SHUSPMonthlyTab({
  data,
  year,
  onMonthClick,
}: SHUSPMonthlyTabProps) {
  // Grand totals
  const totals = React.useMemo(() => ({
    jasa: data.reduce((s, d) => s + d.jasaPinjaman, 0),
    danaResiko: data.reduce((s, d) => s + d.danaResiko, 0),
    penalti: data.reduce((s, d) => s + d.penalti, 0),
    total: data.reduce((s, d) => s + d.total, 0),
  }), [data]);

  // Chart data with short month labels
  const chartData = React.useMemo(() =>
    data.map(d => ({
      name: d.monthLabel.replace(` ${year}`, ""), // "Januari" instead of "Januari 2026"
      "Jasa Pinjaman": d.jasaPinjaman,
      "Dana Resiko": d.danaResiko,
      "Penalti": d.penalti,
    })),
  [data, year]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Belum ada data pendapatan SimpanPinjam untuk periode ini.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 bg-blue-50/50 dark:bg-blue-950/20">
          <p className="text-xs text-muted-foreground">Jasa Pinjaman</p>
          <p className="text-sm font-bold text-blue-600 tabular-nums">{formatCurrency(totals.jasa)}</p>
        </div>
        <div className="rounded-lg border p-3 bg-indigo-50/50 dark:bg-indigo-950/20">
          <p className="text-xs text-muted-foreground">Dana Resiko</p>
          <p className="text-sm font-bold text-indigo-600 tabular-nums">{formatCurrency(totals.danaResiko)}</p>
        </div>
        <div className="rounded-lg border p-3 bg-purple-50/50 dark:bg-purple-950/20">
          <p className="text-xs text-muted-foreground">Penalti</p>
          <p className="text-sm font-bold text-purple-600 tabular-nums">{formatCurrency(totals.penalti)}</p>
        </div>
        <div className="rounded-lg border p-3 bg-emerald-50/50 dark:bg-emerald-950/20">
          <p className="text-xs text-muted-foreground">Total SP</p>
          <p className="text-sm font-bold text-emerald-600 tabular-nums">{formatCurrency(totals.total)}</p>
        </div>
      </div>

      {/* Bar chart */}
      {chartData.length > 1 && (
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}rb` : String(v)}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Jasa Pinjaman" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Dana Resiko" fill="#6366f1" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Penalti" fill="#a855f7" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bulan</TableHead>
              <TableHead className="text-right">Jasa Pinjaman</TableHead>
              <TableHead className="text-right">Dana Resiko</TableHead>
              <TableHead className="text-right">Penalti</TableHead>
              <TableHead className="text-right font-semibold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow
                key={item.month}
                className={onMonthClick ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => onMonthClick?.(item.month)}
                title={onMonthClick ? "Klik untuk lihat transaksi" : undefined}
              >
                <TableCell className="text-sm font-medium">{item.monthLabel}</TableCell>
                <TableCell className="text-right text-sm tabular-nums text-blue-600">
                  {formatCurrency(item.jasaPinjaman)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-indigo-600">
                  {formatCurrency(item.danaResiko)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-purple-600">
                  {formatCurrency(item.penalti)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-semibold text-emerald-600">
                  {formatCurrency(item.total)}
                </TableCell>
              </TableRow>
            ))}
            {/* Grand total row */}
            <TableRow className="bg-muted/30 font-semibold">
              <TableCell className="text-sm">TOTAL</TableCell>
              <TableCell className="text-right text-sm tabular-nums text-blue-600">{formatCurrency(totals.jasa)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums text-indigo-600">{formatCurrency(totals.danaResiko)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums text-purple-600">{formatCurrency(totals.penalti)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums font-bold text-emerald-600">{formatCurrency(totals.total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Links to standalone reports */}
      <div className="flex flex-wrap gap-2 pt-2">
        <a
          href="/pinjaman/laporan-jasa"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          📅 Laporan Jasa Pinjaman Lengkap →
        </a>
        <a
          href="/pinjaman/laporan-dana-resiko"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          📅 Laporan Dana Resiko Lengkap →
        </a>
      </div>
    </div>
  );
}
