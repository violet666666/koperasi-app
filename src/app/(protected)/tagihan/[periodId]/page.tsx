"use client";

import * as React from "react";
import { useParams } from "next/navigation";
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
  Users,
  TrendingUp,
  Loader2,
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

export default function TagihanPeriodDetailPage() {
  const params = useParams<{ periodId: string }>();
  const [period, setPeriod] = React.useState<BillingPeriod | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);
  const [expandedMember, setExpandedMember] = React.useState<number | null>(null);

  React.useEffect(() => {
    async function fetchPeriod() {
      try {
        const res = await fetch(`/api/billing/${params.periodId}`);
        const json = await res.json();
        setPeriod(json.data ?? null);
      } catch {
        console.error("Failed to fetch period");
      } finally {
        setLoading(false);
      }
    }
    if (params.periodId) fetchPeriod();
  }, [params.periodId]);

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
        const res2 = await fetch(`/api/billing/${period.id}`);
        const json = await res2.json();
        setPeriod(json.data);
      }
    } finally {
      setProcessing(false);
    }
  };

  // Group items by member
  const memberMap = React.useMemo(() => {
    if (!period) return new Map<number, {
      memberId: number; name: string; nrp: string | null;
      totalAmount: number; markedPaidAmount: number; items: BillingItem[];
    }>();
    const map = new Map<
      number,
      {
        memberId: number;
        name: string;
        nrp: string | null;
        totalAmount: number;
        markedPaidAmount: number;
        items: BillingItem[];
      }
    >();
    for (const item of period.billingItems) {
      const amt = Number(item.amount);
      const existing = map.get(item.memberId);
      if (existing) {
        existing.totalAmount += amt;
        if (item.isMarkedPaid) existing.markedPaidAmount += amt;
        existing.items.push(item);
      } else {
        map.set(item.memberId, {
          memberId: item.memberId,
          name: item.memberName,
          nrp: item.memberNrp,
          totalAmount: amt,
          markedPaidAmount: item.isMarkedPaid ? amt : 0,
          items: [item],
        });
      }
    }
    return map;
  }, [period]);

  const members = Array.from(memberMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const totalMarked = period
    ? period.billingItems
        .filter((i) => i.isMarkedPaid)
        .reduce((s, i) => s + Number(i.amount), 0)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Periode tagihan tidak ditemukan
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Tagihan ${period.periodLabel}`}
        description={`Periode ${new Date(period.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} - ${new Date(period.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}
        backHref="/tagihan"
        actions={
          period.status === "draft" ? (
            <Button onClick={handleProcess} disabled={processing}>
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="mr-2 h-4 w-4" />
              )}
              Proses & Settle
            </Button>
          ) : undefined
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Anggota
            </div>
            <p className="text-lg font-semibold mt-1">{members.length}</p>
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
              Ditandai Lunas
            </div>
            <p className="text-lg font-semibold mt-1">
              {formatCurrency(totalMarked)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Sisa</div>
            <p className="text-lg font-semibold mt-1">
              {formatCurrency(period.totalAmount - totalMarked)}
            </p>
            <Badge
              variant={period.status === "draft" ? "outline" : "default"}
              className="mt-1"
            >
              {period.status === "draft" ? "Draft" : "Diproses"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Member detail table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail per Anggota</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>NRP</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Lunas</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <React.Fragment key={m.memberId}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      setExpandedMember(
                        expandedMember === m.memberId ? null : m.memberId
                      )
                    }
                  >
                    <TableCell className="font-medium">{m.name}</TableCell>
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
                      {period.status === "draft" && (
                        <Button
                          size="sm"
                          variant={
                            m.markedPaidAmount === m.totalAmount
                              ? "default"
                              : "outline"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            m.items.forEach((item) =>
                              handleToggleItem(item.id)
                            );
                          }}
                        >
                          {m.markedPaidAmount === m.totalAmount
                            ? "Batal"
                            : "Lunas"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expanded item details */}
                  {expandedMember === m.memberId && (
                    m.items.map((item) => (
                      <TableRow key={item.id} className="bg-muted/30">
                        <TableCell colSpan={2} className="pl-8 text-xs">
                          {item.description}
                          <span className="ml-2 text-muted-foreground">
                            ({item.unitType || item.transactionSource})
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {item.isMarkedPaid ? formatCurrency(item.amount) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {item.isMarkedPaid
                            ? "Rp 0"
                            : formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {period.status === "draft" && (
                            <Button
                              size="sm"
                              variant={
                                item.isMarkedPaid ? "default" : "outline"
                              }
                              className="text-xs h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleItem(item.id);
                              }}
                            >
                              {item.isMarkedPaid ? "Batal" : "Lunas"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
          {period.processedBy && period.status === "processed" && (
            <p className="text-xs text-muted-foreground mt-4">
              Diproses oleh {period.processedBy.name}
              {period.processedAt &&
                ` pada ${new Date(period.processedAt).toLocaleString("id-ID")}`}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
