"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Loader2,
  Printer,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

const UNIT_LABELS: Record<string, string> = {
  toko: "Toko",
  carwash: "Cuci Mobil",
  resto: "Resto",
  coffe_latar: "Cafe Latar",
  cafe_lsp: "Cafe LSP",
  barbershop: "Barbershop",
  fitness: "Fitness",
  play_station: "PlayStation",
  properti: "Properti",
  simpan_pinjam: "Simpan Pinjam",
};

interface FakturItem {
  id: number;
  unitType: string | null;
  description: string | null;
  amount: number;
  isMarkedPaid: boolean;
  paidAt: string | null;
}

interface FakturPeriod {
  id: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  status: "draft" | "processed";
  processedAt: string | null;
  processedByName: string | null;
  items: FakturItem[];
  totalAmount: number;
  itemCount: number;
}

export default function FakturPage() {
  const [periods, setPeriods] = React.useState<FakturPeriod[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  React.useEffect(() => {
    async function fetchFaktur() {
      try {
        const res = await fetch("/api/member-portal/faktur", {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          setPeriods(json.data ?? []);
          // Auto-expand first period
          if (json.data?.length > 0) {
            setExpandedId(json.data[0].id);
          }
        }
      } catch {
        console.error("Failed to fetch faktur");
      } finally {
        setLoading(false);
      }
    }
    fetchFaktur();
  }, []);

  const handlePrint = () => window.print();

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Faktur Tagihan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Riwayat tagihan piutang potongan gaji Anda
          </p>
        </div>
        {periods.length > 0 && (
          <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
            <Printer className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Cetak</span>
          </Button>
        )}
      </div>

      {/* Print header */}
      <div className="hidden print:block print:mb-4">
        <h1 className="text-lg font-bold">Faktur Tagihan Piutang</h1>
        <p className="text-sm">Dicetak: {new Date().toLocaleString("id-ID")}</p>
      </div>

      {periods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Belum Ada Faktur</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Faktur tagihan akan muncul setelah operator memproses tagihan piutang Anda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {periods.map((period) => {
            const isExpanded = expandedId === period.id;
            const isPaid = period.status === "processed";

            return (
              <Card key={period.id} className={!isPaid ? "border-amber-200 dark:border-amber-800" : ""}>
                <CardContent className="p-3 sm:p-4">
                  {/* Period header — clickable to expand */}
                  <button
                    className="w-full text-left flex items-start sm:items-center justify-between gap-2"
                    onClick={() => toggleExpand(period.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm sm:text-base">{period.periodLabel}</span>
                        {isPaid ? (
                          <Badge className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Lunas</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600"><Clock className="h-3 w-3 mr-1" />Menunggu</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(period.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} s/d{" "}
                        {new Date(period.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {isPaid && period.processedByName && (
                        <p className="text-xs text-muted-foreground">
                          Dikonfirmasi oleh {period.processedByName}
                          {period.processedAt && ` — ${new Date(period.processedAt).toLocaleString("id-ID")}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-sm sm:text-base whitespace-nowrap">{formatCurrency(period.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">{period.itemCount} transaksi</p>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground print:hidden" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground print:hidden" />
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4 print:mt-2">
                      {/* Print-only period title */}
                      <div className="hidden print:block mb-2">
                        <p className="text-sm font-semibold">{period.periodLabel} — {formatCurrency(period.totalAmount)}</p>
                      </div>

                      {/* Unit summary pills */}
                      <div className="flex flex-wrap gap-2 mb-3 print:hidden">
                        {period.items.reduce((acc, item) => {
                          const ut = item.unitType || "lainnya";
                          const existing = acc.find((a) => a.unitType === ut);
                          if (existing) existing.amount += item.amount;
                          else acc.push({ unitType: ut, amount: item.amount });
                          return acc;
                        }, [] as { unitType: string; amount: number }[]).map((u) => (
                          <div key={u.unitType} className="flex items-center gap-1.5 rounded-md border px-2 py-1">
                            <Badge variant="secondary" className="text-xs">
                              {UNIT_LABELS[u.unitType] || u.unitType}
                            </Badge>
                            <span className="text-xs font-semibold">{formatCurrency(u.amount)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Detail table */}
                      <div className="overflow-x-auto -mx-3 sm:mx-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Unit</TableHead>
                              <TableHead className="hidden sm:table-cell">Keterangan</TableHead>
                              <TableHead className="text-right">Jumlah</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {period.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <span className="text-sm font-medium">
                                    {UNIT_LABELS[item.unitType || ""] || item.unitType || "-"}
                                  </span>
                                  <p className="sm:hidden text-xs text-muted-foreground">{item.description || "-"}</p>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                  {item.description || "-"}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                                  {formatCurrency(item.amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Total row */}
                            <TableRow className="font-bold border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell className="hidden sm:table-cell" />
                              <TableCell className="text-right whitespace-nowrap">{formatCurrency(period.totalAmount)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
