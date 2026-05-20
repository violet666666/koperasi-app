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
  const [memberInfo, setMemberInfo] = React.useState<{ name: string; nrp: string | null } | null>(null);

  React.useEffect(() => {
    async function fetchFaktur() {
      try {
        const res = await fetch("/api/member-portal/faktur", {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          setPeriods(json.data ?? []);
          if (json.data?.length > 0) {
            setExpandedId(json.data[0].id);
          }
        }
        // Fetch member profile for print header
        const profileRes = await fetch("/api/member-portal/profile", { credentials: "include" });
        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          setMemberInfo({
            name: profileJson.data?.name ?? profileJson.data?.member?.name ?? null,
            nrp: profileJson.data?.memberNo ?? profileJson.data?.member?.memberNo ?? null,
          });
        }
      } catch {
        console.error("Failed to fetch faktur");
      } finally {
        setLoading(false);
      }
    }
    fetchFaktur();
  }, []);

  const handlePrint = (period: FakturPeriod) => {
    const startDate = new Date(period.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const endDate = new Date(period.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const printDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const statusLabel = period.status === "processed" ? "DIKONFIRMASI" : "MENUNGGU KONFIRMASI";

    // Unit summary
    const unitSummary = period.items.reduce((acc, item) => {
      const ut = item.unitType || "lainnya";
      const existing = acc.find((a) => a.unitType === ut);
      if (existing) existing.amount += item.amount;
      else acc.push({ unitType: ut, amount: item.amount });
      return acc;
    }, [] as { unitType: string; amount: number }[]);

    const unitPills = unitSummary.map((u) =>
      `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border:1px solid #e5e7eb;border-radius:4px;margin:2px 4px 2px 0;font-size:10px;">
        <span style="font-weight:600;">${UNIT_LABELS[u.unitType] || u.unitType}</span>
        <span>Rp ${u.amount.toLocaleString("id-ID")}</span>
      </div>`
    ).join("");

    const itemRows = period.items.map((item) =>
      `<tr>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;">${UNIT_LABELS[item.unitType || ""] || item.unitType || "-"}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;color:#4b5563;">${item.description || "-"}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;font-size:11px;font-weight:600;white-space:nowrap;">Rp ${item.amount.toLocaleString("id-ID")}</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Faktur Piutang - ${period.periodLabel}</title>
<style>
  @page { size: A4; margin: 15mm 18mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; color: #111; font-size: 12px; }
  .header { display: flex; align-items: center; gap: 14px; margin-bottom: 4px; }
  .logo-box { background: #1a1a2e; border-radius: 10px; padding: 6px; line-height: 0; }
  .org-name { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .org-sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .divider { border-top: 3px double #1a1a2e; border-bottom: 1px solid #1a1a2e; padding: 1px 0; margin: 10px 0 20px; }
  .doc-title { font-size: 18px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #1a1a2e; margin-bottom: 16px; }
  .info-grid { display: grid; grid-template-columns: 130px 8px 1fr; row-gap: 4px; margin-bottom: 16px; font-size: 11px; }
  .info-label { color: #6b7280; }
  .info-value { font-weight: 500; }
  table { width: 100%; border-collapse: collapse; }
  thead th { padding: 8px 10px; background: #1a1a2e; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  thead th:last-child { text-align: right; }
  tfoot td { padding: 10px; border: 1px solid #d1d5db; font-weight: 700; background: #f3f4f6; }
  .footer { margin-top: 32px; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  <div class="logo-box"><img src="/LogoPrimkoppol.png" width="48" height="48" style="object-fit:contain;display:block;" /></div>
  <div>
    <div class="org-name">PRIMKOPPOL Resor Lumajang</div>
    <div class="org-sub">Jl. Alun-Alun Utara No. 11, Rogotrunan, Kec. Lumajang, Kabupaten Lumajang, Jawa Timur 67316 &middot; Telp. (0334) 881110</div>
  </div>
</div>
<div class="divider"></div>
<div class="doc-title">Faktur Piutang Anggota</div>
<div class="info-grid">
  <span class="info-label">Nama Anggota</span><span>:</span><span class="info-value">${memberInfo?.name || "........................................"}</span>
  <span class="info-label">NRP</span><span>:</span><span class="info-value">${memberInfo?.nrp || "-"}</span>
  <span class="info-label">Periode</span><span>:</span><span class="info-value">${period.periodLabel}</span>
  <span class="info-label">Rentang Tanggal</span><span>:</span><span class="info-value">${startDate} s/d ${endDate}</span>
  <span class="info-label">Status</span><span>:</span><span class="info-value" style="font-weight:700;${period.status === "processed" ? "color:#065f46;" : "color:#92400e;"}">${statusLabel}</span>
  ${period.processedByName ? `<span class="info-label">Dikonfirmasi Oleh</span><span>:</span><span class="info-value">${period.processedByName}${period.processedAt ? " — " + new Date(period.processedAt).toLocaleString("id-ID") : ""}</span>` : ""}
  <span class="info-label">Dicetak</span><span>:</span><span class="info-value">${printDate}</span>
</div>
<div style="font-size:10px;font-weight:600;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Rincian Piutang (${period.itemCount} transaksi)</div>
${unitPills}
<table style="margin-top:12px;">
  <thead><tr><th>Unit</th><th>Keterangan</th><th style="text-align:right;">Jumlah</th></tr></thead>
  <tbody>${itemRows}</tbody>
  <tfoot><tr><td colspan="2" style="font-size:12px;text-transform:uppercase;letter-spacing:1px;">Total Piutang</td><td style="text-align:right;font-size:14px;white-space:nowrap;">Rp ${period.totalAmount.toLocaleString("id-ID")}</td></tr></tfoot>
</table>
<div class="footer">Dokumen ini dicetak secara otomatis oleh Sistem Informasi PRIMKOPPOL Resor Lumajang &middot; Sah sebagai bukti tagihan piutang resmi.</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)};</script>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Faktur Tagihan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Riwayat tagihan piutang potongan gaji Anda
          </p>
        </div>
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

            // Unit summary for this period
            const unitSummary = period.items.reduce((acc, item) => {
              const ut = item.unitType || "lainnya";
              const existing = acc.find((a) => a.unitType === ut);
              if (existing) existing.amount += item.amount;
              else acc.push({ unitType: ut, amount: item.amount });
              return acc;
            }, [] as { unitType: string; amount: number }[]);

            return (
              <Card key={period.id} className={!isPaid ? "border-amber-200 dark:border-amber-800" : ""}>
                <CardContent className="p-3 sm:p-4">
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
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-4">
                      {/* Action buttons */}
                      <div className="flex gap-2 mb-3">
                        <Button variant="outline" size="sm" onClick={() => handlePrint(period)}>
                          <Printer className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Cetak Faktur</span>
                        </Button>
                      </div>

                      {/* Unit summary pills */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {unitSummary.map((u) => (
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
                              <TableHead>Status</TableHead>
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
                                <TableCell>
                                  {item.isMarkedPaid ? (
                                    <Badge variant="secondary" className="text-xs">Lunas</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">Belum</Badge>
                                  )}
                                  {item.paidAt && (
                                    <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                                      {new Date(item.paidAt).toLocaleDateString("id-ID")}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                                  {formatCurrency(item.amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell className="hidden sm:table-cell" />
                              <TableCell />
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
