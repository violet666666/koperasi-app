"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardCheck,
  Plus,
  Users,
  TrendingUp,
  Calendar,
  Loader2,
  AlertCircle,
  Printer,
  ChevronDown,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Download,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { generateFakturPiutangPDF, exportFakturPiutangExcel, type FakturPiutangData } from "@/lib/export-utils";

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

interface BillingItem {
  id: number;
  memberId: number;
  memberName: string;
  memberNrp: string | null;
  unitType: string | null;
  transactionSource: string;
  description: string;
  amount: number;
  isMarkedPaid: boolean;
  paidAt: string | null;
}

interface BillingPeriod {
  id: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  status: "draft" | "processed";
  totalMembers: number;
  totalAmount: number;
  processedAt: string | null;
  processedBy: { name: string } | null;
  billingItems: BillingItem[];
}

interface PeriodOption {
  id: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: string;
}

interface MemberRow {
  memberId: number;
  name: string;
  nrp: string | null;
  totalAmount: number;
  isPaid: boolean;
  items: BillingItem[];
  unitBreakdown: { unitType: string; amount: number; count: number }[];
}

export default function TagihanPage() {
  const searchParams = useSearchParams();
  const [period, setPeriod] = React.useState<BillingPeriod | null>(null);
  const [periods, setPeriods] = React.useState<PeriodOption[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showCustomDate, setShowCustomDate] = React.useState(false);
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [selectedMembers, setSelectedMembers] = React.useState<Set<number>>(new Set());
  const [expandedMembers, setExpandedMembers] = React.useState<Set<number>>(new Set());

  const fetchPeriods = React.useCallback(async () => {
    try {
      const res = await fetch("/api/billing/riwayat");
      const json = await res.json();
      setPeriods(json.data ?? []);
    } catch { /* ignore */ }
  }, []);

  const fetchPeriod = React.useCallback(async (id?: number) => {
    try {
      setLoading(true);
      const url = id ? `/api/billing/${id}` : "/api/billing/current";
      const res = await fetch(url);
      const json = await res.json();
      setPeriod(json.data ?? null);
      if (json.data) setSelectedPeriodId(json.data.id);
    } catch {
      setError("Gagal memuat data tagihan");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const periodIdParam = searchParams.get("periodId");
    if (periodIdParam) {
      fetchPeriod(Number(periodIdParam));
    } else {
      fetchPeriod();
    }
    fetchPeriods();
  }, [fetchPeriod, fetchPeriods, searchParams]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (showCustomDate && customStart && customEnd) {
        body.periodStart = customStart;
        body.periodEnd = customEnd;
      }
      const res = await fetch("/api/billing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || "Gagal generate tagihan");
        return;
      }
      setPeriod(json.data);
      setSelectedPeriodId(json.data.id);
      fetchPeriods();
    } catch {
      setError("Gagal generate tagihan");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!period) return;
    const paidCount = period.billingItems.filter((i) => i.isMarkedPaid).length;
    const msg = period.status === "processed"
      ? `Hapus riwayat tagihan ${period.periodLabel}?\n\nPerhatian: Status isPaid pada ${paidCount} transaksi sumber akan dikembalikan ke belum bayar.`
      : `Hapus draft tagihan ${period.periodLabel}?${paidCount > 0 ? `\n\nPerhatian: ${paidCount} transaksi yang sudah dilunaskan akan dikembalikan ke belum bayar.` : ""}`;
    if (!confirm(msg)) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/billing/${period.id}`, { method: "DELETE" });
      if (res.ok) {
        setPeriod(null);
        setSelectedPeriodId(null);
        fetchPeriods();
      } else {
        const json = await res.json();
        setError(json.message || "Gagal menghapus");
      }
    } catch {
      setError("Gagal menghapus");
    } finally {
      setProcessing(false);
    }
  };

  const handleSettle = async (memberIds: number[]) => {
    if (!period || memberIds.length === 0) return;
    if (!confirm(`Lunaskan ${memberIds.length} anggota terpilih?`)) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/billing/${period.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds }),
      });
      const json = await res.json();
      if (res.ok) {
        setSelectedMembers(new Set());
        await fetchPeriod(period.id);
        fetchPeriods();
      } else {
        setError(json.message || "Gagal memproses");
      }
    } catch {
      setError("Gagal memproses");
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    if (!period) return;
    const fakturData: FakturPiutangData = {
      periodLabel: period.periodLabel,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: period.status,
      processedByName: period.processedBy?.name ?? null,
      processedAt: period.processedAt,
      members: memberRows.map((m) => ({
        name: m.name,
        nrp: m.nrp,
        unitBreakdown: m.unitBreakdown,
        totalAmount: m.totalAmount,
      })),
      totalAmount: totalPiutang,
      totalMembers: memberRows.length,
      totalTransactions: period.billingItems.length,
      unitSummary: totalUnitBreakdown,
    };
    generateFakturPiutangPDF(fakturData);
  };

  const handleExportExcel = () => {
    if (!period) return;
    const fakturData: FakturPiutangData = {
      periodLabel: period.periodLabel,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: period.status,
      processedByName: period.processedBy?.name ?? null,
      processedAt: period.processedAt,
      members: memberRows.map((m) => ({
        name: m.name,
        nrp: m.nrp,
        unitBreakdown: m.unitBreakdown,
        totalAmount: m.totalAmount,
      })),
      totalAmount: totalPiutang,
      totalMembers: memberRows.length,
      totalTransactions: period.billingItems.length,
      unitSummary: totalUnitBreakdown,
    };
    exportFakturPiutangExcel(fakturData);
  };

  const toggleMember = (memberId: number) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleExpand = (memberId: number) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  // Group items by member with unit breakdown
  const memberRows: MemberRow[] = React.useMemo(() => {
    if (!period) return [];
    const map = new Map<number, MemberRow>();
    for (const item of period.billingItems) {
      const amt = Number(item.amount);
      const existing = map.get(item.memberId);
      if (existing) {
        existing.totalAmount += amt;
        existing.items.push(item);
        if (item.isMarkedPaid) existing.isPaid = true;
        const ut = item.unitType || "lainnya";
        const ub = existing.unitBreakdown.find((u) => u.unitType === ut);
        if (ub) { ub.amount += amt; ub.count++; }
        else existing.unitBreakdown.push({ unitType: ut, amount: amt, count: 1 });
      } else {
        const ut = item.unitType || "lainnya";
        map.set(item.memberId, {
          memberId: item.memberId,
          name: item.memberName,
          nrp: item.memberNrp,
          totalAmount: amt,
          isPaid: item.isMarkedPaid,
          items: [item],
          unitBreakdown: [{ unitType: ut, amount: amt, count: 1 }],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [period]);

  const totalPiutang = period ? period.billingItems.reduce((s, i) => s + Number(i.amount), 0) : 0;
  const unsettledRows = memberRows.filter((m) => !m.isPaid);
  const settledCount = memberRows.length - unsettledRows.length;
  const totalUnitBreakdown = React.useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const row of memberRows) {
      for (const u of row.unitBreakdown) {
        const existing = map.get(u.unitType);
        if (existing) { existing.amount += u.amount; existing.count += u.count; }
        else map.set(u.unitType, { amount: u.amount, count: u.count });
      }
    }
    return Array.from(map.entries())
      .map(([unitType, data]) => ({ unitType, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }, [memberRows]);

  const isDraft = period?.status === "draft";

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tagihan Piutang" description="Memuat..." />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Tagihan Piutang"
        description="Rekap piutang potongan gaji anggota per unit"
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            {period && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cetak PDF</span>
              </Button>
            )}
            {period && (
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
            )}
            {period && (
              <Button
                onClick={handleDelete}
                disabled={processing}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Hapus</span>
              </Button>
            )}
            <Link href="/tagihan/riwayat">
              <Button variant="outline" size="sm">Riwayat</Button>
            </Link>
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive ">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Period selector */}
      {periods.length > 0 && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium">Periode:</span>
              <select
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm min-w-0"
                value={selectedPeriodId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setPeriod(null);
                    setSelectedPeriodId(null);
                  } else {
                    fetchPeriod(Number(val));
                  }
                }}
              >
                <option value="">— Pilih —</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.periodLabel} ({p.status === "draft" ? "Draft" : "Diproses"})
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomDate(!showCustomDate)}
              >
                <Calendar className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{showCustomDate ? "Sembunyikan" : "Rentang Custom"}</span>
              </Button>
            </div>
            {showCustomDate && (
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mt-3">
                <div className="space-y-1 w-full sm:w-auto">
                  <label className="text-sm font-medium">Dari</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  />
                </div>
                <div className="space-y-1 w-full sm:w-auto">
                  <label className="text-sm font-medium">Sampai</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  />
                </div>
                <Button onClick={handleGenerate} disabled={generating} size="sm" className="w-full sm:w-auto">
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Generate
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!period ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Belum Ada Tagihan Aktif</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Pilih periode dari dropdown di atas, atau generate tagihan baru.
            </p>
            {periods.length === 0 && (
              <Button className="mt-4" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Generate Tagihan
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>

          {/* Summary cards — 2x2 on mobile, 4-col on md+ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />Periode
                </div>
                <p className="text-base sm:text-lg font-semibold mt-1">{period.periodLabel}</p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {new Date(period.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} -{" "}
                  {new Date(period.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />Anggota
                </div>
                <p className="text-base sm:text-lg font-semibold mt-1">{memberRows.length}</p>
                <p className="text-xs text-muted-foreground">
                  {period.billingItems.length} transaksi
                  {settledCount > 0 && ` · ${settledCount} lunas`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />Piutang
                </div>
                <p className="text-base sm:text-lg font-semibold mt-1">{formatCurrency(totalPiutang)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <ClipboardCheck className="h-4 w-4" />Status
                </div>
                <div className="mt-1">
                  <Badge variant={isDraft ? "outline" : "default"}>
                    {isDraft ? "Draft" : "Diproses"}
                  </Badge>
                </div>
                {period.processedBy && (
                  <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                    oleh {period.processedBy.name}
                    {period.processedAt && ` ${new Date(period.processedAt).toLocaleString("id-ID")}`}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Unit breakdown summary */}
          {totalUnitBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base">Ringkasan per Unit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {totalUnitBreakdown.map((u) => (
                    <div key={u.unitType} className="flex items-center gap-1.5 sm:gap-2 rounded-md border px-2 sm:px-3 py-1.5 sm:py-2">
                      <Badge variant="secondary" className="text-xs">
                        {UNIT_LABELS[u.unitType] || u.unitType}
                      </Badge>
                      <span className="text-xs sm:text-sm font-semibold">{formatCurrency(u.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bulk actions for draft */}
          {isDraft && unsettledRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 ">
              <Button onClick={() => handleSettle(unsettledRows.map((m) => m.memberId))} disabled={processing} size="sm">
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Lunaskan Semua ({unsettledRows.length})
              </Button>
              {selectedMembers.size > 0 && (
                <Button onClick={() => handleSettle(Array.from(selectedMembers))} disabled={processing} variant="outline" size="sm">
                  {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Lunaskan Terpilih ({selectedMembers.size})
                </Button>
              )}
              {settledCount > 0 && (
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {settledCount} sudah lunas
                </span>
              )}
            </div>
          )}

          {/* Main table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base">
                Detail Piutang per Anggota
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isDraft && unsettledRows.length > 0 && (
                        <TableHead className="w-10 ">
                          <Checkbox
                            checked={selectedMembers.size === unsettledRows.length && unsettledRows.length > 0}
                            onCheckedChange={() => {
                              if (selectedMembers.size === unsettledRows.length) {
                                setSelectedMembers(new Set());
                              } else {
                                setSelectedMembers(new Set(unsettledRows.map((m) => m.memberId)));
                              }
                            }}
                          />
                        </TableHead>
                      )}
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead className="hidden sm:table-cell">NRP</TableHead>
                      <TableHead className="hidden md:table-cell">Unit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberRows.map((m) => {
                      const isExpanded = expandedMembers.has(m.memberId);
                      return (
                        <React.Fragment key={m.memberId}>
                          <TableRow
                            className={`cursor-pointer hover:bg-muted/50 ${m.isPaid ? "opacity-60" : ""}`}
                            onClick={() => toggleExpand(m.memberId)}
                          >
                            {isDraft && unsettledRows.length > 0 && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                {!m.isPaid && (
                                  <Checkbox
                                    checked={selectedMembers.has(m.memberId)}
                                    onCheckedChange={() => toggleMember(m.memberId)}
                                  />
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm sm:text-base">{m.name}</div>
                              {/* Show NRP below name on mobile */}
                              <div className="sm:hidden text-xs text-muted-foreground">{m.nrp || "-"}</div>
                              {/* Show unit badges below name on mobile */}
                              <div className="md:hidden flex flex-wrap gap-1 mt-0.5">
                                {m.unitBreakdown.map((u) => (
                                  <span key={u.unitType} className="text-xs text-muted-foreground">
                                    {UNIT_LABELS[u.unitType] || u.unitType} {formatCurrency(u.amount)}
                                  </span>
                                ))}
                              </div>
                              {m.isPaid && (
                                <Badge variant="secondary" className="text-xs ml-2">Lunas</Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">{m.nrp || "-"}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {m.unitBreakdown.map((u) => (
                                  <Badge key={u.unitType} variant="outline" className="text-xs">
                                    {UNIT_LABELS[u.unitType] || u.unitType}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm sm:text-base whitespace-nowrap">
                              {formatCurrency(m.totalAmount)}
                            </TableCell>
                          </TableRow>
                          {/* Expanded unit breakdown */}
                          {isExpanded && (
                            m.unitBreakdown.map((u) => (
                              <TableRow key={`${m.memberId}-${u.unitType}`} className="bg-muted/30">
                                {isDraft && unsettledRows.length > 0 && <TableCell />}
                                <TableCell />
                                <TableCell />
                                <TableCell className="hidden sm:table-cell" />
                                <TableCell className="pl-4 sm:pl-8">
                                  <span className="text-sm text-muted-foreground">
                                    {UNIT_LABELS[u.unitType] || u.unitType}
                                  </span>
                                  <span className="ml-2 text-xs text-muted-foreground">({u.count} tx)</span>
                                </TableCell>
                                <TableCell className="text-right text-sm whitespace-nowrap">{formatCurrency(u.amount)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </React.Fragment>
                      );
                    })}
                    {/* Totals row */}
                    <TableRow className="font-bold border-t-2">
                      {isDraft && unsettledRows.length > 0 && <TableCell />}
                      <TableCell />
                      <TableCell colSpan={2}>TOTAL</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {totalUnitBreakdown.map((u) => (
                            <span key={u.unitType} className="text-xs">
                              {(UNIT_LABELS[u.unitType] || u.unitType)}: {formatCurrency(u.amount)}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(totalPiutang)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
