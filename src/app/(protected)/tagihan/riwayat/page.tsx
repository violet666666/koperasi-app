"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
  Loader2,
  Trash2,
  Eye,
  ChevronDown,
  ChevronRight,
  AlertCircle,
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

interface BillingItem {
  id: number;
  memberId: number;
  memberName: string;
  memberNrp: string | null;
  unitType: string | null;
  amount: number;
  isMarkedPaid: boolean;
}

interface BillingPeriodSummary {
  id: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  status: "draft" | "processed";
  totalMembers: number;
  totalAmount: number;
  processedAt: string | null;
  createdAt: string;
  _count?: { billingItems: number };
}

export default function TagihanRiwayatPage() {
  const router = useRouter();
  const [periods, setPeriods] = React.useState<BillingPeriodSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [detailItems, setDetailItems] = React.useState<BillingItem[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPeriods = React.useCallback(async () => {
    try {
      const res = await fetch("/api/billing/riwayat");
      if (res.ok) {
        const json = await res.json();
        setPeriods(json.data ?? []);
      }
    } catch {
      console.error("Failed to fetch billing history");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetailItems([]);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    setDetailItems([]);
    try {
      const res = await fetch(`/api/billing/${id}`);
      if (res.ok) {
        const json = await res.json();
        setDetailItems(json.data?.billingItems ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (p: BillingPeriodSummary) => {
    const label = p.status === "draft" ? "draft" : "yang sudah diproses";
    if (
      !confirm(
        `Hapus tagihan ${label} "${p.periodLabel}"?\n\n` +
        `${p._count?.billingItems ?? p.totalMembers} item akan dihapus.` +
        (p.status === "processed"
          ? "\n\nPerhatian: Status isPaid pada transaksi sumber akan dikembalikan ke belum bayar."
          : "")
      )
    )
      return;
    setDeleting(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/billing/${p.id}`, { method: "DELETE" });
      if (res.ok) {
        setPeriods((prev) => prev.filter((pp) => pp.id !== p.id));
        if (expandedId === p.id) {
          setExpandedId(null);
          setDetailItems([]);
        }
      } else {
        const json = await res.json();
        setError(json.message || "Gagal menghapus");
      }
    } catch {
      setError("Gagal menghapus");
    } finally {
      setDeleting(null);
    }
  };

  // Group detail items by member with unit breakdown
  const memberBreakdown = React.useMemo(() => {
    const map = new Map<
      number,
      {
        name: string;
        nrp: string | null;
        total: number;
        units: { unitType: string; amount: number; count: number }[];
      }
    >();
    for (const item of detailItems) {
      const amt = Number(item.amount);
      const ut = item.unitType || "lainnya";
      const existing = map.get(item.memberId);
      if (existing) {
        existing.total += amt;
        const ub = existing.units.find((u) => u.unitType === ut);
        if (ub) {
          ub.amount += amt;
          ub.count++;
        } else {
          existing.units.push({ unitType: ut, amount: amt, count: 1 });
        }
      } else {
        map.set(item.memberId, {
          name: item.memberName,
          nrp: item.memberNrp,
          total: amt,
          units: [{ unitType: ut, amount: amt, count: 1 }],
        });
      }
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].name.localeCompare(b[1].name)
    );
  }, [detailItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Tagihan"
        description="Daftar semua periode tagihan piutang"
        backHref="/tagihan"
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {periods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Belum Ada Riwayat</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Riwayat tagihan akan muncul setelah generate tagihan pertama.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Anggota</TableHead>
                  <TableHead className="text-right">Total Piutang</TableHead>
                  <TableHead className="text-right">Dibuat</TableHead>
                  <TableHead className="text-right w-28">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => {
                  const isExpanded = expandedId === p.id;
                  const isDeleting = deleting === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleExpand(p.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{p.periodLabel}</span>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.periodStart).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                            })}{" "}
                            -{" "}
                            {new Date(p.periodEnd).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "draft" ? "outline" : "default"
                            }
                          >
                            {p.status === "draft" ? "Draft" : "Diproses"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.totalMembers}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(p.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Lihat detail di halaman tagihan"
                              onClick={() => router.push(`/tagihan?periodId=${p.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Hapus periode ini"
                              disabled={isDeleting}
                              onClick={() => handleDelete(p)}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded detail */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            {detailLoading ? (
                              <div className="flex justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : memberBreakdown.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Tidak ada data item.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground mb-3">
                                  Detail Piutang ({memberBreakdown.length} anggota, {detailItems.length} transaksi)
                                </p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Nama</TableHead>
                                      <TableHead>NRP</TableHead>
                                      <TableHead>Unit</TableHead>
                                      <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {memberBreakdown.map(([memberId, m]) => (
                                      <TableRow key={memberId}>
                                        <TableCell className="font-medium text-sm">
                                          {m.name}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                          {m.nrp || "-"}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex flex-wrap gap-1">
                                            {m.units.map((u) => (
                                              <span
                                                key={u.unitType}
                                                className="text-xs text-muted-foreground"
                                              >
                                                {UNIT_LABELS[u.unitType] || u.unitType}{" "}
                                                {formatCurrency(u.amount)}
                                                {u.count > 1 && ` (${u.count}x)`}
                                              </span>
                                            ))}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-sm">
                                          {formatCurrency(m.total)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
