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
import type { DetailSummaryItem } from "../_types";

interface SHUSummaryTabProps {
  /** Items to display (from incomeDetails or expenseDetails) */
  items: DetailSummaryItem[];
  /** Total amount for percentage calculation */
  total: number;
  /** "income" = green styling, "expense" = red styling */
  variant: "income" | "expense";
  /** Called when user clicks a category row to filter transactions */
  onCategoryClick?: (code: string) => void;
}

export function SHUSummaryTab({ items, total, variant, onCategoryClick }: SHUSummaryTabProps) {
  const colorClass = variant === "income" ? "text-emerald-600" : "text-red-600";
  const bgRowHover = "hover:bg-muted/50 cursor-pointer";
  const sorted = React.useMemo(
    () => [...items].sort((a, b) => b.amount - a.amount),
    [items]
  );

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {sorted.length} kategori sumber
        </span>
        <span className={`font-bold tabular-nums ${colorClass}`}>
          Total: {formatCurrency(total)}
        </span>
      </div>

      {/* Category table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Kode</TableHead>
              <TableHead>Sumber {variant === "income" ? "Pendapatan" : "Beban"}</TableHead>
              <TableHead className="text-right w-40">Jumlah</TableHead>
              <TableHead className="text-right w-16">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => {
              const pct = total !== 0 ? Math.abs((item.amount / total) * 100) : 0;
              return (
                <TableRow
                  key={item.code}
                  className={onCategoryClick ? bgRowHover : ""}
                  onClick={() => onCategoryClick?.(item.code)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.code}
                  </TableCell>
                  <TableCell className="text-sm">{item.name}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${colorClass}`}>
                    {formatCurrency(item.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                    {pct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Total row */}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell colSpan={2} className="text-right text-sm">
                TOTAL
              </TableCell>
              <TableCell className={`text-right tabular-nums ${colorClass}`}>
                {formatCurrency(total)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs">100%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Hint */}
      {onCategoryClick && (
        <p className="text-xs text-muted-foreground text-center">
          💡 Klik baris kategori untuk melihat daftar transaksi di tab &quot;Transaksi&quot;
        </p>
      )}
    </div>
  );
}
