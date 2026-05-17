"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

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

export default function TagihanPage() {
  const [period, setPeriod] = React.useState<BillingPeriod | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchCurrent = React.useCallback(async () => {
    try {
      const res = await fetch("/api/billing/current");
      const json = await res.json();
      setPeriod(json.data ?? null);
    } catch {
      setError("Gagal memuat data tagihan");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/generate", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || "Gagal generate tagihan");
        return;
      }
      setPeriod(json.data);
    } catch {
      setError("Gagal generate tagihan");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!period) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/billing/${period.id}`, { method: "DELETE" });
      if (res.ok) {
        setPeriod(null);
      } else {
        const json = await res.json();
        setError(json.message || "Gagal menghapus draft");
      }
    } catch {
      setError("Gagal menghapus draft");
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleItem = async (itemId: number) => {
    if (!period || period.status !== "draft") return;
    const res = await fetch(
      `/api/billing/${period.id}/items/${itemId}/toggle`,
      { method: "PATCH" }
    );
    if (res.ok) {
      const json = await res.json();
      setPeriod((prev) =>
        prev
          ? {
              ...prev,
              billingItems: prev.billingItems.map((item) =>
                item.id === itemId ? json.data : item
              ),
            }
          : prev
      );
    }
  };

  const handleProcess = async () => {
    if (!period) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/billing/${period.id}/process`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchCurrent();
      } else {
        const json = await res.json();
        setError(json.message || "Gagal memproses tagihan");
      }
    } catch {
      setError("Gagal memproses tagihan");
    } finally {
      setProcessing(false);
    }
  };

  // Group items by member
  const memberSummary = React.useMemo(() => {
    if (!period) return [];
    const map = new Map<
      number,
      {
        memberId: number;
        name: string;
        nrp: string | null;
        totalAmount: number;
        markedPaidAmount: number;
        itemIds: number[];
      }
    >();
    for (const item of period.billingItems) {
      const amt = Number(item.amount);
      const existing = map.get(item.memberId);
      if (existing) {
        existing.totalAmount += amt;
        if (item.isMarkedPaid) existing.markedPaidAmount += amt;
        existing.itemIds.push(item.id);
      } else {
        map.set(item.memberId, {
          memberId: item.memberId,
          name: item.memberName,
          nrp: item.memberNrp,
          totalAmount: amt,
          markedPaidAmount: item.isMarkedPaid ? amt : 0,
          itemIds: [item.id],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [period]);

  const totalMarked = period
    ? period.billingItems.filter((i) => i.isMarkedPaid).reduce((s, i) => s + Number(i.amount), 0)
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tagihan Piutang" description="Periode 16 - 15" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tagihan Piutang"
        description="Periode penagihan piutang potongan gaji (16 - 15)"
        actions={
          !period ? (
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Generate Tagihan
            </Button>
          ) : period.status === "draft" ? (
            <div className="flex items-center gap-2">
              <Link href="/tagihan/riwayat">
                <Button variant="outline" size="sm">
                  Riwayat
                </Button>
              </Link>
              <Button
                onClick={handleDeleteDraft}
                disabled={processing}
                variant="destructive"
                size="sm"
              >
                Hapus Draft
              </Button>
              <Button
                onClick={handleProcess}
                disabled={processing}
                variant="default"
              >
                {processing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                )}
                Proses & Settle
              </Button>
            </div>
          ) : (
            <Link href="/tagihan/riwayat">
              <Button variant="outline" size="sm">
                Riwayat
              </Button>
            </Link>
          )
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!period ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Belum Ada Tagihan</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Klik &quot;Generate Tagihan&quot; untuk membuat rekap piutang potongan gaji
              periode saat ini.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Period info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Periode
                </div>
                <p className="text-lg font-semibold mt-1">{period.periodLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(period.periodStart).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  -{" "}
                  {new Date(period.periodEnd).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Anggota
                </div>
                <p className="text-lg font-semibold mt-1">
                  {memberSummary.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {period.billingItems.length} transaksi
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Total Piutang
                </div>
                <p className="text-lg font-semibold mt-1">
                  {formatCurrency(period.totalAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClipboardCheck className="h-4 w-4" />
                  Status
                </div>
                <div className="mt-1">
                  <Badge
                    variant={
                      period.status === "draft" ? "outline" : "default"
                    }
                  >
                    {period.status === "draft" ? "Draft" : "Diproses"}
                  </Badge>
                </div>
                {period.status === "draft" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(totalMarked)} ditandai lunas
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Member summary table */}
          {period.status === "draft" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Rekap per Anggota
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>NRP</TableHead>
                      <TableHead className="text-right">Total Piutang</TableHead>
                      <TableHead className="text-right">Ditandai Lunas</TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                      <TableHead className="text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberSummary.map((m) => (
                      <TableRow key={m.memberId}>
                        <TableCell className="font-medium">
                          {m.name}
                        </TableCell>
                        <TableCell>{m.nrp || "-"}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(m.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(m.markedPaidAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(m.totalAmount - m.markedPaidAmount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant={
                              m.markedPaidAmount === m.totalAmount
                                ? "default"
                                : "outline"
                            }
                            onClick={() => {
                              // Toggle all items for this member
                              const allPaid =
                                m.markedPaidAmount === m.totalAmount;
                              m.itemIds.forEach((id) => {
                                if (!allPaid) {
                                  handleToggleItem(id);
                                } else {
                                  handleToggleItem(id);
                                }
                              });
                            }}
                          >
                            {m.markedPaidAmount === m.totalAmount
                              ? "Batal"
                              : "Lunas"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Rekap per Anggota — Diproses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>NRP</TableHead>
                      <TableHead className="text-right">Total Piutang</TableHead>
                      <TableHead className="text-right">Dibayar</TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberSummary.map((m) => (
                      <TableRow key={m.memberId}>
                        <TableCell className="font-medium">
                          {m.name}
                        </TableCell>
                        <TableCell>{m.nrp || "-"}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(m.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(m.markedPaidAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(m.totalAmount - m.markedPaidAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {period.processedBy && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Diproses oleh {period.processedBy.name}
                    {period.processedAt &&
                      ` pada ${new Date(period.processedAt).toLocaleString("id-ID")}`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
