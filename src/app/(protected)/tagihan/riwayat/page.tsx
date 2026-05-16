"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

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
  const [periods, setPeriods] = React.useState<BillingPeriodSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchPeriods() {
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
    }
    fetchPeriods();
  }, []);

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
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Anggota</TableHead>
                  <TableHead className="text-right">Total Piutang</TableHead>
                  <TableHead className="text-right">Dibuat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/tagihan/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.periodLabel}
                      </Link>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
