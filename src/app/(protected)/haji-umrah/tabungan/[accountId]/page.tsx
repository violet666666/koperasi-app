"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/constants";
import { Plus, CheckCircle2, Target, Calendar, TrendingUp, Printer } from "lucide-react";
import { toast } from "sonner";

interface AccountDetail {
    id: number;
    accountNo: string;
    balance: number;
    target: number;
    progress: number;
    monthlyTarget: number;
    status: string;
    openedDate: string;
    maturityDate: string | null;
    member: { id: number; name: string; memberNo: string; nrp: string | null };
    product: { id: number; name: string; type: string; adminFeeType: string | null; adminFeeValue: number | null };
    transactions: Array<{
        id: number;
        transactionNo: string;
        type: string;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        notes: string | null;
        transactionDate: string;
        createdBy: { id: number; name: string } | null;
    }>;
    stats: {
        totalDeposits: number;
        monthlyDeposits: number;
        depositCount: number;
        remaining: number;
        monthsRemaining: number | null;
        isTargetReached: boolean;
    };
}

export default function TabunganDetailPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.accountId as string;
    const [detail, setDetail] = React.useState<AccountDetail | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function loadDetail() {
            try {
                const res = await fetch(`/api/haji-umrah/savings/${accountId}`);
                if (res.ok) {
                    const json = await res.json();
                    setDetail(json.data);
                } else {
                    toast.error("Rekening tidak ditemukan");
                    router.push("/haji-umrah/tabungan");
                }
            } catch (err) {
                console.error(err);
                toast.error("Gagal memuat detail rekening");
            } finally {
                setLoading(false);
            }
        }
        if (accountId) loadDetail();
    }, [accountId, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!detail) return null;

    const productLabel = detail.product.type === "tabungan_haji" ? "Haji" : "Umrah";

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Tabungan ${productLabel} — ${detail.member.name}`}
                description={`${detail.accountNo} | ${detail.member.nrp || detail.member.memberNo}`}
                backHref="/haji-umrah/tabungan"
                backLabel="Daftar Tabungan"
                actions={
                    detail.status === "active" ? (
                        <Button onClick={() => router.push(`/haji-umrah/tabungan/${accountId}/setoran`)}>
                            <Plus className="mr-2 h-4 w-4" /> Setoran
                        </Button>
                    ) : undefined
                }
            />

            {/* Progress Card */}
            <Card className={detail.stats.isTargetReached ? "border-green-500" : ""}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Saldo saat ini</p>
                            <p className="text-3xl font-bold">{formatCurrency(detail.balance)}</p>
                        </div>
                        {detail.stats.isTargetReached && (
                            <Badge className="bg-green-500 text-white px-3 py-1">
                                <CheckCircle2 className="mr-1 h-4 w-4" /> Target Tercapai!
                            </Badge>
                        )}
                    </div>
                    {detail.target > 0 && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress ke Target ({formatCurrency(detail.target)})</span>
                                <span className="font-medium">{detail.progress}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-4">
                                <div
                                    className={`h-4 rounded-full transition-all ${
                                        detail.stats.isTargetReached ? "bg-green-500" : detail.progress >= 80 ? "bg-yellow-500" : "bg-primary"
                                    }`}
                                    style={{ width: `${Math.min(100, detail.progress)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Sisa: {formatCurrency(detail.stats.remaining)}</span>
                                {detail.stats.monthsRemaining && (
                                    <span>~{detail.stats.monthsRemaining} bulan lagi</span>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-xs text-muted-foreground">Total Setoran</p>
                                <p className="font-bold">{formatCurrency(detail.stats.totalDeposits)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-xs text-muted-foreground">Setoran Bulan Ini</p>
                                <p className="font-bold">{formatCurrency(detail.stats.monthlyDeposits)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Target className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-xs text-muted-foreground">Target Bulanan</p>
                                <p className="font-bold">{formatCurrency(detail.monthlyTarget)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-xs text-muted-foreground">Jumlah Setoran</p>
                                <p className="font-bold">{detail.stats.depositCount}x</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Riwayat Transaksi */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Riwayat Transaksi</CardTitle>
                </CardHeader>
                <CardContent>
                    {detail.transactions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">Belum ada transaksi</p>
                    ) : (
                        <div className="space-y-3">
                            {detail.transactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                                    <div>
                                        <p className="font-medium">
                                            {tx.type === "deposit" ? "Setoran" : tx.type === "withdrawal" ? "Penarikan" : "Koreksi"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(tx.transactionDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                            {tx.createdBy && ` • oleh ${tx.createdBy.name}`}
                                        </p>
                                        {tx.notes && <p className="text-xs text-muted-foreground mt-1">{tx.notes}</p>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className={`font-medium ${tx.type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                                                {tx.type === "deposit" ? "+" : "-"}{formatCurrency(tx.amount)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Saldo: {formatCurrency(tx.balanceAfter)}</p>
                                        </div>
                                        {tx.type === "deposit" && (
                                            <Button variant="ghost" size="sm" onClick={() => handlePrintKwitansi(tx, detail)}>
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function handlePrintKwitansi(
    tx: { transactionNo: string; amount: number; balanceAfter: number; notes: string | null; transactionDate: string; createdBy: { name: string } | null },
    detail: { member: { name: string }; product: { type: string }; accountNo: string }
) {
    const typeLabel = detail.product.type === "tabungan_haji" ? "Haji" : "Umrah";
    const printContent = `
        <html><head><title>Kwitansi - ${tx.transactionNo}</title>
        <style>
            body { font-family: monospace; max-width: 300px; margin: 0 auto; padding: 10px; font-size: 12px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; }
            td { padding: 2px 0; }
            .right { text-align: right; }
        </style></head><body>
        <div class="center bold">PRIMKOPPOL</div>
        <div class="center">KWITANSI SETORAN</div>
        <div class="center">Tabungan ${typeLabel}</div>
        <div class="line"></div>
        <table>
            <tr><td>No. Transaksi</td><td class="right">${tx.transactionNo}</td></tr>
            <tr><td>No. Rekening</td><td class="right">${detail.accountNo}</td></tr>
            <tr><td>Nama</td><td class="right">${detail.member.name}</td></tr>
            <tr><td>Tanggal</td><td class="right">${new Date(tx.transactionDate).toLocaleDateString("id-ID")}</td></tr>
        </table>
        <div class="line"></div>
        <table>
            <tr><td>Jumlah Setoran</td><td class="right bold">Rp ${tx.amount.toLocaleString("id-ID")}</td></tr>
            <tr><td>Saldo Setelah</td><td class="right">Rp ${tx.balanceAfter.toLocaleString("id-ID")}</td></tr>
        </table>
        <div class="line"></div>
        <div class="center">Terima kasih</div>
        <div class="center" style="font-size:10px; margin-top:10px;">${tx.createdBy?.name || ""} &bull; ${new Date().toLocaleDateString("id-ID")}</div>
        </body></html>
    `;
    const win = window.open("", "_blank", "width=400,height=500");
    if (win) {
        win.document.write(printContent);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 300);
    } else {
        alert("Pop-up diblokir. Izinkan pop-up untuk mencetak kwitansi.");
    }
}
