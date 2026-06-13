"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/constants";
import { Loader2, Trash2, Landmark, Percent, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/use-auth";

interface DetailItem {
    id: number;
    memberId: number;
    memberName: string;
    accountNo: string;
    balanceSnapshot: number;
    sharePercent: number;
    amount: number;
    savingsTransactionId: number | null;
}

interface Detail {
    id: number;
    distributionNo: string;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    totalBsiAmount: number;
    memberRate: number;
    memberPoolAmount: number;
    spreadAmount: number;
    totalBalanceSnapshot: number;
    memberCount: number;
    status: string;
    processedAt: string | null;
    voidedAt: string | null;
    voidReason: string | null;
    notes: string | null;
    items: DetailItem[];
}

export default function BagiHasilDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { user } = useAuth();
    const roleName = (user as Record<string, unknown> | null)?.role
        ? ((user as Record<string, unknown>).role as { name?: string }).name ||
          (user as Record<string, unknown>).role
        : (user as Record<string, unknown> | null)?.role;
    const canVoid = roleName === "operator";

    const [detail, setDetail] = React.useState<Detail | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [voiding, setVoiding] = React.useState(false);
    const [voidReason, setVoidReason] = React.useState("");

    React.useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/haji-umrah/bagi-hasil/${id}`);
                if (res.ok) {
                    const json = await res.json();
                    setDetail(json.data);
                } else {
                    toast.error("Distribusi tidak ditemukan");
                    router.push("/haji-umrah/bagi-hasil");
                }
            } catch (err) {
                console.error(err);
                toast.error("Gagal memuat detail");
            } finally {
                setLoading(false);
            }
        }
        if (id) load();
    }, [id, router]);

    async function handleVoid() {
        if (!voidReason.trim()) {
            toast.error("Alasan void wajib diisi");
            return;
        }
        if (!confirm("Konfirmasi VOID distribusi? Semua kredit anggota & spread akan dikembalikan.")) {
            return;
        }
        setVoiding(true);
        try {
            const res = await fetch(`/api/haji-umrah/bagi-hasil/${id}/void`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ voidReason: voidReason.trim() }),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal void distribusi");
                return;
            }
            toast.success("Distribusi berhasil di-void");
            router.push("/haji-umrah/bagi-hasil");
        } catch (e) {
            console.error(e);
            toast.error("Gagal void distribusi");
        } finally {
            setVoiding(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    if (!detail) return null;

    const isVoided = detail.status === "voided";

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Distribusi ${detail.periodLabel}`}
                description={`${detail.distributionNo} • ${detail.memberCount} anggota`}
                backHref="/haji-umrah/bagi-hasil"
                backLabel="Riwayat Bagi Hasil"
            />

            {isVoided && (
                <Alert variant="destructive">
                    <AlertTitle>Distribusi Telah Di-void</AlertTitle>
                    <AlertDescription>
                        Semua kredit anggota dan spread telah dikembalikan.
                        {detail.voidReason && ` Alasan: ${detail.voidReason}`}
                    </AlertDescription>
                </Alert>
            )}

            {/* Summary cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Landmark className="h-4 w-4" /><span className="text-xs">Total BSI</span>
                        </div>
                        <p className="font-bold">{formatCurrency(detail.totalBsiAmount)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Percent className="h-4 w-4" /><span className="text-xs">Rate Anggota</span>
                        </div>
                        <p className="font-bold">{detail.memberRate}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Wallet className="h-4 w-4" /><span className="text-xs">Pool Anggota</span>
                        </div>
                        <p className="font-bold text-emerald-700">{formatCurrency(detail.memberPoolAmount)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Users className="h-4 w-4" /><span className="text-xs">Spread Koperasi</span>
                        </div>
                        <p className="font-bold text-blue-700">{formatCurrency(detail.spreadAmount)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Detail items table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Rincian Distribusi per Anggota</CardTitle>
                    <CardDescription>
                        Total saldo snapshot: {formatCurrency(detail.totalBalanceSnapshot)}
                        {detail.notes && ` • ${detail.notes}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Anggota</TableHead>
                                    <TableHead>Rekening</TableHead>
                                    <TableHead className="text-right">Saldo Snapshot</TableHead>
                                    <TableHead className="text-right">Share %</TableHead>
                                    <TableHead className="text-right">Bagi Hasil</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detail.items.map((it) => (
                                    <TableRow key={it.id} className={isVoided ? "opacity-50" : ""}>
                                        <TableCell className="font-medium">{it.memberName}</TableCell>
                                        <TableCell className="font-mono text-xs">{it.accountNo}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(it.balanceSnapshot)}</TableCell>
                                        <TableCell className="text-right">{Number(it.sharePercent).toFixed(4)}%</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-700">
                                            {formatCurrency(Number(it.amount))}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Void action — operator only, only for processed */}
            {canVoid && !isVoided && (
                <Card className="border-red-200">
                    <CardHeader>
                        <CardTitle className="text-base text-red-700 flex items-center gap-2">
                            <Trash2 className="h-4 w-4" /> Void Distribusi
                        </CardTitle>
                        <CardDescription>
                            Membatalkan distribusi: semua kredit anggota dikembalikan, spread dikeluarkan dari kas.
                            Aksi finansial — hanya operator.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Textarea
                            placeholder="Alasan void (wajib)..."
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            rows={2}
                        />
                        <Button variant="destructive" onClick={handleVoid} disabled={voiding || !voidReason.trim()}>
                            {voiding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Void Distribusi
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
