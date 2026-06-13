"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { memberPortalApi } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Landmark,
    Target,
    TrendingUp,
    HandCoins,
    CheckCircle2,
    CalendarClock,
    PiggyBank,
    ChevronDown,
    Building2,
    Info,
    Wallet,
    ArrowDownCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
type Talangan = {
    loanNo: string;
    status: string;
    outstanding: number;
    monthlyInstallment: number;
    tenorMonths: number;
    nextDueDate: string | null;
    nextDueAmount: number | null;
    lastDueDate: string;
} | null;

type Account = {
    id: number;
    accountNo: string;
    status: string;
    createdAt: string;
    product: { name: string; code: string; type: string; linkedBankName: string | null };
    balance: number;
    target: number;
    progress: number;
    remaining: number;
    monthlyTarget: number;
    maturityDate: string | null;
    monthsRemaining: number | null;
    isTargetReached: boolean;
    stats: { totalDeposits: number; monthlyDeposits: number; depositCount: number };
    transactions: Array<{
        id: number;
        transactionNo: string;
        type: string;
        amount: number;
        notes: string | null;
        transactionDate: string;
        referenceNo: string | null;
    }>;
    talangan: Talangan;
};

type HajiUmrahResponse = {
    data: {
        summary: {
            totalBalance: number;
            totalTarget: number;
            overallProgress: number;
            accountCount: number;
            activeTalanganCount: number;
            totalTalanganOutstanding: number;
        };
        accounts: Account[];
    };
};

function progressBarClass(progress: number, reached: boolean) {
    if (reached) return "bg-green-500";
    if (progress >= 80) return "bg-yellow-500";
    return "bg-primary";
}

function txTypeLabel(type: string) {
    switch (type) {
        case "deposit":
            return "Setoran";
        case "withdrawal":
            return "Penarikan";
        case "correction":
            return "Koreksi";
        case "interest":
            return "Bagi Hasil";
        default:
            return type;
    }
}

export default function HajiUmrahPortalPage() {
    const { data: response, isLoading, isError } = useQuery<HajiUmrahResponse>({
        queryKey: ["member-haji-umrah"],
        queryFn: () => memberPortalApi.hajiUmrah() as Promise<HajiUmrahResponse>,
        retry: 1,
    });

    const data = response?.data;
    const summary = data?.summary;
    const accounts = data?.accounts ?? [];
    const hasAccounts = accounts.length > 0;

    if (isError) {
        return (
            <div className="max-w-5xl mx-auto py-12 text-center space-y-4">
                <Landmark className="mx-auto h-16 w-16 text-red-300" />
                <h2 className="text-xl font-bold text-red-600">Gagal Memuat Data Haji &amp; Umrah</h2>
                <p className="text-muted-foreground">
                    Terjadi kesalahan saat mengambil data tabungan Haji &amp; Umrah Anda. Silakan coba muat ulang
                    halaman atau hubungi operator jika masalah berlanjut.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Tabungan Haji &amp; Umrah</h1>
                <p className="text-muted-foreground">
                    Pantau progress tabungan haji &amp; umrah Anda menuju target keberangkatan.
                </p>
            </div>

            {/* Summary gradient card + quick stats */}
            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-36 rounded-xl" />
                    <div className="grid gap-4 md:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-28 rounded-xl" />
                        ))}
                    </div>
                </div>
            ) : hasAccounts ? (
                <>
                    <Card className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-0 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Landmark className="w-32 h-32" />
                        </div>
                        <CardContent className="p-8 relative z-10">
                            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                                <div>
                                    <p className="text-emerald-100 font-medium mb-1">Total Saldo Tabungan Haji &amp; Umrah</p>
                                    <div className="text-4xl md:text-5xl font-bold tracking-tight">
                                        {formatCurrency(summary?.totalBalance ?? 0)}
                                    </div>
                                    <p className="text-emerald-100 text-sm mt-2">
                                        dari target {formatCurrency(summary?.totalTarget ?? 0)}
                                    </p>
                                </div>
                                <div className="text-left md:text-right">
                                    <p className="text-emerald-100 text-sm">Progress Keseluruhan</p>
                                    <p className="text-4xl font-bold">{summary?.overallProgress ?? 0}%</p>
                                </div>
                            </div>
                            {(summary?.totalTarget ?? 0) > 0 && (
                                <div className="mt-6">
                                    <div className="w-full bg-white/20 rounded-full h-3">
                                        <div
                                            className="h-3 rounded-full bg-white transition-all"
                                            style={{ width: `${Math.min(100, summary?.overallProgress ?? 0)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick stat row */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                                        <Target className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Total Target</p>
                                        <p className="font-bold text-lg">{formatCurrency(summary?.totalTarget ?? 0)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                        <Wallet className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Sisa untuk Target</p>
                                        <p className="font-bold text-lg">
                                            {formatCurrency(
                                                Math.max(0, (summary?.totalTarget ?? 0) - (summary?.totalBalance ?? 0)),
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`p-2.5 rounded-lg ${
                                            (summary?.activeTalanganCount ?? 0) > 0
                                                ? "bg-amber-50 text-amber-600"
                                                : "bg-slate-50 text-slate-500"
                                        }`}
                                    >
                                        <HandCoins className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Talangan Aktif</p>
                                        <p className="font-bold text-lg">
                                            {summary?.activeTalanganCount ?? 0}{" "}
                                            <span className="text-sm font-normal text-muted-foreground">
                                                · {formatCurrency(summary?.totalTalanganOutstanding ?? 0)}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            ) : null}

            {/* Empty state */}
            {!isLoading && !hasAccounts && (
                <Card className="border-2 border-dashed">
                    <CardContent className="p-12 text-center">
                        <PiggyBank className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold mb-1">Belum Ada Tabungan Haji &amp; Umrah</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                            Anda belum memiliki rekening tabungan Haji atau Umrah yang aktif. Silakan hubungi
                            koperasi PRIMKOPPOL untuk membuka rekening dan mulai menabung menuju keberangkatan.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Per-account cards */}
            <div className="space-y-6">
                {isLoading
                    ? [1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)
                    : accounts.map((acc) => {
                          const isHaji = acc.product.type === "tabungan_haji";
                          const typeLabel = isHaji ? "Haji" : "Umrah";
                          return (
                              <Card
                                  key={acc.id}
                                  className={`border shadow-sm overflow-hidden ${
                                      acc.isTargetReached ? "ring-2 ring-green-400" : ""
                                  }`}
                              >
                                  {/* Account header */}
                                  <div
                                      className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                                          isHaji
                                              ? "bg-gradient-to-r from-emerald-50 to-teal-50"
                                              : "bg-gradient-to-r from-sky-50 to-blue-50"
                                      }`}
                                  >
                                      <div className="flex items-center gap-3">
                                          <div
                                              className={`p-2.5 rounded-lg ${
                                                  isHaji ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"
                                              }`}
                                          >
                                              <Landmark className="h-6 w-6" />
                                          </div>
                                          <div>
                                              <div className="flex items-center gap-2">
                                                  <h3 className="font-bold text-lg text-slate-800">
                                                      Tabungan {typeLabel}
                                                  </h3>
                                                  {acc.status !== "active" && (
                                                      <Badge variant="secondary" className="uppercase text-[10px]">
                                                          {acc.status === "closed" ? "Ditutup" : acc.status}
                                                      </Badge>
                                                  )}
                                                  {acc.isTargetReached && (
                                                      <Badge className="bg-green-500 text-white text-[10px]">
                                                          <CheckCircle2 className="mr-1 h-3 w-3" /> Target Tercapai
                                                      </Badge>
                                                  )}
                                              </div>
                                              <p className="text-xs text-muted-foreground font-mono">{acc.accountNo}</p>
                                          </div>
                                      </div>
                                      {acc.product.linkedBankName && (
                                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                              <Building2 className="h-4 w-4" />
                                              Bank {acc.product.linkedBankName}
                                          </div>
                                      )}
                                  </div>

                                  <CardContent className="p-6 space-y-5">
                                      {/* Balance + progress */}
                                      <div>
                                          <div className="flex items-end justify-between mb-2">
                                              <div>
                                                  <p className="text-sm text-muted-foreground">Saldo Terkumpul</p>
                                                  <p className="text-3xl font-bold text-slate-900">
                                                      {formatCurrency(acc.balance)}
                                                  </p>
                                              </div>
                                              {acc.target > 0 && (
                                                  <div className="text-right">
                                                      <p className="text-xs text-muted-foreground">Target</p>
                                                      <p className="font-semibold text-slate-700">
                                                          {formatCurrency(acc.target)}
                                                      </p>
                                                  </div>
                                              )}
                                          </div>
                                          {acc.target > 0 ? (
                                              <div className="space-y-1.5">
                                                  <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                                                      <div
                                                          className={`h-4 rounded-full transition-all ${progressBarClass(
                                                              acc.progress,
                                                              acc.isTargetReached,
                                                          )}`}
                                                          style={{ width: `${Math.min(100, acc.progress)}%` }}
                                                      />
                                                  </div>
                                                  <div className="flex justify-between text-xs text-muted-foreground">
                                                      <span>
                                                          Progress <strong className="text-slate-700">{acc.progress}%</strong>
                                                      </span>
                                                      <span>Sisa {formatCurrency(acc.remaining)}</span>
                                                  </div>
                                              </div>
                                          ) : (
                                              <p className="text-xs text-muted-foreground italic">
                                                  Rekening ini tidak memiliki target amount.
                                              </p>
                                          )}
                                      </div>

                                      {/* Mini stat grid */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                          <div className="bg-slate-50 rounded-lg p-3">
                                              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                                  <TrendingUp className="h-3.5 w-3.5" />
                                                  <span className="text-[11px]">Setoran Bulan Ini</span>
                                              </div>
                                              <p className="font-bold text-sm">
                                                  {formatCurrency(acc.stats.monthlyDeposits)}
                                              </p>
                                          </div>
                                          <div className="bg-slate-50 rounded-lg p-3">
                                              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                                  <Wallet className="h-3.5 w-3.5" />
                                                  <span className="text-[11px]">Total Setoran</span>
                                              </div>
                                              <p className="font-bold text-sm">
                                                  {formatCurrency(acc.stats.totalDeposits)}
                                              </p>
                                          </div>
                                          <div className="bg-slate-50 rounded-lg p-3">
                                              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                                  <Target className="h-3.5 w-3.5" />
                                                  <span className="text-[11px]">Target Bulanan</span>
                                              </div>
                                              <p className="font-bold text-sm">{formatCurrency(acc.monthlyTarget)}</p>
                                          </div>
                                          <div className="bg-slate-50 rounded-lg p-3">
                                              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                                  <CalendarClock className="h-3.5 w-3.5" />
                                                  <span className="text-[11px]">Jatuh Tempo</span>
                                              </div>
                                              <p className="font-bold text-sm">
                                                  {acc.maturityDate
                                                      ? format(new Date(acc.maturityDate), "MMM yyyy", { locale: id })
                                                      : "—"}
                                              </p>
                                          </div>
                                      </div>

                                      {/* Maturity countdown */}
                                      {acc.maturityDate && acc.monthsRemaining !== null && !acc.isTargetReached && (
                                          <div
                                              className={`flex items-center gap-2 text-xs rounded-lg p-2.5 ${
                                                  acc.monthsRemaining <= 3
                                                      ? "bg-amber-50 text-amber-800"
                                                      : "bg-blue-50 text-blue-800"
                                              }`}
                                          >
                                              <CalendarClock className="h-4 w-4 shrink-0" />
                                              {acc.monthsRemaining > 0 ? (
                                                  <span>
                                                      Sekitar <strong>{acc.monthsRemaining} bulan</strong> lagi menuju
                                                      target keberangkatan ({format(new Date(acc.maturityDate), "d MMM yyyy", { locale: id })}).
                                                      Setoran bulanan ideal:{" "}
                                                      <strong>
                                                          {formatCurrency(
                                                              Math.ceil(acc.remaining / Math.max(1, acc.monthsRemaining)),
                                                          )}
                                                      </strong>
                                                  </span>
                                              ) : (
                                                  <span>
                                                      Target jatuh tempo telah tercapai/tanggal telah lewat. Segera
                                                      lunasi sisa {formatCurrency(acc.remaining)}.
                                                  </span>
                                              )}
                                          </div>
                                      )}

                                      {/* Linked talangan */}
                                      {acc.talangan && (
                                          <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4">
                                              <div className="flex items-center gap-2 mb-3">
                                                  <HandCoins className="h-4 w-4 text-amber-600" />
                                                  <h4 className="font-semibold text-sm text-amber-900">
                                                      Talangan {typeLabel} Aktif
                                                  </h4>
                                                  <Badge
                                                      variant="outline"
                                                      className={`text-[10px] ml-auto ${
                                                          acc.talangan.status === "active"
                                                              ? "border-amber-400 text-amber-700"
                                                              : "border-green-400 text-green-700"
                                                      }`}
                                                  >
                                                      {acc.talangan.status === "active" ? "Berjalan" : "Lunas"}
                                                  </Badge>
                                              </div>
                                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                                  <div>
                                                      <p className="text-[11px] text-muted-foreground">Sisa Outstanding</p>
                                                      <p className="font-bold">
                                                          {formatCurrency(acc.talangan.outstanding)}
                                                      </p>
                                                  </div>
                                                  <div>
                                                      <p className="text-[11px] text-muted-foreground">Cicilan / Bln</p>
                                                      <p className="font-bold">
                                                          {formatCurrency(acc.talangan.monthlyInstallment)}
                                                      </p>
                                                  </div>
                                                  <div>
                                                      <p className="text-[11px] text-muted-foreground">Jatuh Tempo Berikutnya</p>
                                                      <p className="font-bold">
                                                          {acc.talangan.nextDueDate
                                                              ? format(new Date(acc.talangan.nextDueDate), "d MMM yyyy", {
                                                                    locale: id,
                                                                })
                                                              : "—"}
                                                      </p>
                                                  </div>
                                                  <div>
                                                      <p className="text-[11px] text-muted-foreground">No. Talangan</p>
                                                      <p className="font-mono text-xs font-bold pt-1">
                                                          {acc.talangan.loanNo}
                                                      </p>
                                                  </div>
                                              </div>
                                              <p className="text-[11px] text-amber-700 mt-2">
                                                  Cicilan talangan dipotong otomatis dari {typeLabel === "Haji" ? "gaji/tunkin" : "gaji/tunkin"} sesuai kesepakatan, terpisah dari tabungan {typeLabel.toLowerCase()} Anda.
                                              </p>
                                          </div>
                                      )}

                                      {/* Deposit history (collapsible) */}
                                      <RiwayatSetoran account={acc} />
                                  </CardContent>
                              </Card>
                          );
                      })}
            </div>

            {/* Info footer */}
            {!isLoading && hasAccounts && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-slate-50 border rounded-lg p-4">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p>
                            <strong>Catatan:</strong> Setoran tabungan Haji &amp; Umrah dilakukan melalui
                            operator/kantor koperasi PRIMKOPPOL. Dana Anda tercatat di koperasi dan di-pooling ke
                            Bank {accounts[0]?.product.linkedBankName ?? "BSI"} sesuai kerja sama (MOU).
                        </p>
                        <p>
                            Tabungan Haji &amp; Umrah bersifat <strong>tidak dapat ditarik sebelum target tercapai</strong>,
                            kecuali pada kondisi khusus. Hubungi koperasi untuk informasi setoran, talangan, atau
                            pembukaan rekening baru.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Collapsible deposit history ────────────────────────────────────
function RiwayatSetoran({ account }: { account: Account }) {
    const [open, setOpen] = React.useState(false);
    const txs = account.transactions;

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-slate-700 hover:text-slate-900 pt-2 border-t">
                <span>Riwayat Setoran ({txs.length})</span>
                <ChevronDown
                    className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
                {txs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6">
                        Belum ada riwayat transaksi.
                    </p>
                ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {txs.map((tx) => {
                            const isCredit = tx.type === "deposit" || tx.type === "interest";
                            return (
                                <div
                                    key={tx.id}
                                    className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div
                                            className={`mt-0.5 p-1.5 rounded-full ${
                                                isCredit ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                                            }`}
                                        >
                                            {isCredit ? (
                                                <ArrowDownCircle className="h-4 w-4" />
                                            ) : (
                                                <ArrowDownCircle className="h-4 w-4 rotate-180" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{txTypeLabel(tx.type)}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {format(new Date(tx.transactionDate), "d MMM yyyy", { locale: id })}
                                                {tx.referenceNo && ` · Ref ${tx.referenceNo}`}
                                            </p>
                                            {tx.notes && (
                                                <p className="text-[11px] text-muted-foreground italic">{tx.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                    <p
                                        className={`text-sm font-bold font-mono ${
                                            isCredit ? "text-green-600" : "text-red-600"
                                        }`}
                                    >
                                        {isCredit ? "+" : "−"}
                                        {formatCurrency(tx.amount)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}
