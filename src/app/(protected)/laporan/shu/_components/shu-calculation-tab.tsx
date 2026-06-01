"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/constants";
import { ArrowDown, CheckCircle2, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { CalculationData } from "../_types";

interface SHUCalculationTabProps {
  data: CalculationData;
  variant: "member" | "non_member";
  /** Called when user wants to drill-down into income/expense */
  onDrillDown?: (source: "income" | "expense") => void;
}

export function SHUCalculationTab({ data, variant, onDrillDown }: SHUCalculationTabProps) {
  const isMember = variant === "member";

  const steps = isMember
    ? [
        {
          label: "Total Pendapatan",
          amount: data.totalIncome,
          drillDown: "income" as const,
          icon: "📊",
        },
        {
          label: "Total Beban",
          amount: data.totalExpense,
          isSubtraction: true,
          drillDown: "expense" as const,
          icon: "💸",
        },
        {
          label: "SHU Bersih (Pendapatan − Beban)",
          amount: data.netSurplus,
          isResult: true,
          icon: "⚖️",
        },
        {
          label: `Beban SHU Cuci Mobil (${data.carwashCount} transaksi × Rp 2.000)`,
          amount: data.totalCarwashBonus,
          isSubtraction: true,
          icon: "🚗",
        },
        {
          label: "SHU Adjusted (setelah Cuci Mobil)",
          amount: data.adjustedNetSurplus,
          isResult: true,
          icon: "📐",
        },
        {
          label: `Rasio Anggota vs Non-Anggota`,
          amount: 0,
          isRatio: true,
          icon: "👥",
        },
        {
          label: `SHU Anggota (${(data.memberRatio * 100).toFixed(1)}% × ${formatCurrency(data.adjustedNetSurplus)})`,
          amount: data.memberSurplus,
          isFinal: true,
          icon: "✅",
        },
      ]
    : [
        {
          label: "Total Pendapatan",
          amount: data.totalIncome,
          drillDown: "income" as const,
          icon: "📊",
        },
        {
          label: "Total Beban",
          amount: data.totalExpense,
          isSubtraction: true,
          drillDown: "expense" as const,
          icon: "💸",
        },
        {
          label: "SHU Bersih (Pendapatan − Beban)",
          amount: data.netSurplus,
          isResult: true,
          icon: "⚖️",
        },
        {
          label: `Beban SHU Cuci Mobil (${data.carwashCount} transaksi × Rp 2.000)`,
          amount: data.totalCarwashBonus,
          isSubtraction: true,
          icon: "🚗",
        },
        {
          label: "SHU Adjusted (setelah Cuci Mobil)",
          amount: data.adjustedNetSurplus,
          isResult: true,
          icon: "📐",
        },
        {
          label: `Rasio Non-Anggota`,
          amount: 0,
          isRatio: true,
          icon: "👥",
        },
        {
          label: `SHU Non-Anggota (${(data.nonMemberRatio * 100).toFixed(1)}% × ${formatCurrency(data.adjustedNetSurplus)})`,
          amount: data.nonMemberSurplus,
          isFinal: true,
          icon: "✅",
        },
      ];

  const ratio = isMember ? data.memberRatio : data.nonMemberRatio;
  const ratioAmount = isMember ? data.memberGrossIncome : data.nonMemberGrossIncome;
  const otherAmount = isMember ? data.nonMemberGrossIncome : data.memberGrossIncome;

  return (
    <div className="space-y-2 py-2">
      {/* Calculation steps */}
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <div
            className={`rounded-lg border p-3 ${
              step.isFinal
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                : step.isResult
                ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                : step.isSubtraction
                ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{step.icon}</span>
                <span className="text-sm font-medium truncate">
                  {step.label}
                </span>
                {step.drillDown && onDrillDown && (
                  <button
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => onDrillDown(step.drillDown!)}
                    title={`Lihat detail ${step.drillDown === "income" ? "pendapatan" : "beban"}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {!step.isRatio && (
                <span
                  className={`text-sm font-bold tabular-nums shrink-0 ${
                    step.isSubtraction
                      ? "text-red-600"
                      : step.isFinal
                      ? "text-emerald-700"
                      : step.isResult
                      ? "text-blue-700"
                      : ""
                  }`}
                >
                  {step.isSubtraction ? "− " : ""}
                  {formatCurrency(step.amount)}
                </span>
              )}
            </div>

            {/* Ratio detail */}
            {step.isRatio && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">
                    {isMember ? "Anggota:" : "Non-Anggota:"}
                  </span>
                  <Progress value={ratio * 100} className="h-2 flex-1" />
                  <span className="text-xs font-medium tabular-nums w-14 text-right">
                    {(ratio * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground w-32 text-right">
                    {formatCurrency(ratioAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">
                    {isMember ? "Non-Anggota:" : "Anggota:"}
                  </span>
                  <Progress value={(1 - ratio) * 100} className="h-2 flex-1" />
                  <span className="text-xs font-medium tabular-nums w-14 text-right">
                    {((1 - ratio) * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground w-32 text-right">
                    {formatCurrency(otherAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Arrow between steps */}
          {i < steps.length - 1 && (
            <div className="flex justify-center">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </React.Fragment>
      ))}

      {/* Allocation table */}
      {data.allocations.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Alokasi SHU {isMember ? "Anggota" : "Non-Anggota"}
          </h4>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium">Kategori</th>
                  <th className="text-center py-2 px-3 font-medium w-20">%</th>
                  <th className="text-right py-2 px-3 font-medium w-36">Jumlah</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {data.allocations.map((alloc) => (
                  <tr key={alloc.key} className="border-b last:border-0">
                    <td className="py-2 px-3 font-medium">{alloc.label}</td>
                    <td className="py-2 px-3 text-center tabular-nums">{alloc.percentage}%</td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-emerald-700">
                      {formatCurrency(alloc.amount)}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">{alloc.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
