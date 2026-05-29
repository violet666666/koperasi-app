"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Printer, Banknote } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function PengajuanDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [data, setData] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isActionLoading, setIsActionLoading] = React.useState(false);
    const [cashBankAccounts, setCashBankAccounts] = React.useState<any[]>([]);
    const [selectedCashBankId, setSelectedCashBankId] = React.useState<string>("");

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/loans/applications/${params.id}`);
            if (res.ok) {
                const json = await res.json();
                setData(json.data);
            }
        } catch (error) {
            console.error("Fetch error", error);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchData();
    }, [params.id]);

    // Fetch kas/bank accounts for disbursement
    React.useEffect(() => {
        fetch("/api/master/cash-bank?perPage=50")
            .then((r) => r.json())
            .then((json) => {
                let accounts: any[] = json.data || [];
                // Filter: only main accounts (not unit-specific, not SHU-specific)
                accounts = accounts.filter((a: any) => !a.unitType && !a.purpose?.startsWith('shu_'));
                setCashBankAccounts(accounts);
                const firstCash = accounts.find((a: any) => a.type === "cash");
                if (firstCash) setSelectedCashBankId(String(firstCash.id));
            })
            .catch(() => toast.error("Gagal memuat akun Kas & Bank"));
    }, []);

    const handleAction = async (action: "approve" | "reject" | "disburse") => {
        setIsActionLoading(true);
        try {
            const url = `/api/loans/applications/${params.id}/${action}`;
            const method = action === "disburse" ? "POST" : "POST"; // using POST for all based on routes
            
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    notes: "Action via UI",
                    ...(action === "disburse" && selectedCashBankId ? { cashBankAccountId: Number(selectedCashBankId) } : {}),
                }),
            });
            
            if (res.ok) {
                const result = await res.json();
                toast.success(result.message || `Berhasil melakukan ${action}`);
                if (action === "disburse" && result.receiptId) {
                    toast.success("Membuka Kwitansi Pencairan...");
                    router.push(`/kwitansi/${result.receiptId}/cetak`);
                } else {
                    fetchData(); // refresh
                }
            } else {
                const err = await res.json();
                toast.error(err.message || "Gagal mengeksekusi aksi");
            }
        } catch (error) {
            toast.error("Terjadi Kesalahan Jaringan");
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    }

    if (!data) {
        return <div className="p-8 text-center text-muted-foreground">Pengajuan tidak ditemukan</div>;
    }

    const { status, amount, tenorMonths, member, product, loan } = data;
    
    // Perhitungan logika baru
    const interestPerMonth = 1; // 1% flat per bulan
    const estimationPokok = Math.round(Number(amount) / tenorMonths);
    const estimationBunga = Math.round(Number(amount) * 0.01);
    const adminFee = Math.round(Number(amount) * 0.02); // 2% Risk deduction
    const disbursed = Number(amount) - adminFee;

    return (
        <div className="space-y-6">
            <PageHeader 
                title={`Detail Pengajuan: ${data.applicationNo}`} 
                description="Verifikasi Pengajuan Pinjaman & Pencairan" 
                backHref="/pinjaman/pengajuan"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Infromasi Peminjam</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Nama Anggota</p>
                                <p className="font-medium">{member?.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">No Anggota / NRP</p>
                                <p className="font-medium">{member?.memberNo} / {member?.nrp || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Gaji Tercatat</p>
                                <p className="font-medium">{formatCurrency(Number(member?.salary || 0))}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Rincian Pinjaman</CardTitle>
                            <CardDescription>Produk: {product?.name}</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Plafon Pinjaman</p>
                                <p className="font-bold text-lg">{formatCurrency(Number(amount))}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Jangka Waktu</p>
                                <p className="font-medium">{tenorMonths} Bulan</p>
                            </div>
                            <div className="col-span-2 mt-4 p-4 border rounded-md bg-muted/50">
                                <p className="font-semibold mb-2">Simulasi Angsuran (Per Bulan)</p>
                                <div className="flex justify-between text-sm">
                                    <span>Angsuran Pokok</span>
                                    <span>{formatCurrency(estimationPokok)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Bunga Flat (1% per bulan)</span>
                                    <span>{formatCurrency(estimationBunga)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-primary mt-2 pt-2 border-t">
                                    <span>Total Tagihan per Bulan</span>
                                    <span>{formatCurrency(estimationPokok + estimationBunga)}</span>
                                </div>
                            </div>
                            
                            <div className="col-span-2 mt-2 p-4 border rounded-md bg-emerald-50 border-emerald-200">
                                <p className="font-semibold mb-2 text-emerald-800">Rincian Pencairan Bersih</p>
                                <div className="flex justify-between text-sm text-emerald-700">
                                    <span>Plafon Pinjaman</span>
                                    <span>{formatCurrency(Number(amount))}</span>
                                </div>
                                <div className="flex justify-between text-sm text-emerald-700">
                                    <span>Potongan Resiko (2%)</span>
                                    <span>- {formatCurrency(adminFee)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-emerald-900 mt-2 pt-2 border-t border-emerald-300">
                                    <span>Dana Cair Diterima</span>
                                    <span>{formatCurrency(disbursed)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Status & Aksi</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-md border">
                                <span className="text-sm font-medium">Status Saat Ini:</span>
                                <Badge variant={status === 'approved' ? 'default' : status === 'disbursed' ? 'secondary' : 'outline'} className="uppercase">
                                    {status}
                                </Badge>
                            </div>

                            {status === "draft" && (
                <div className="space-y-3 pt-2 border-t">
                    <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                        Pengajuan masih berstatus Draft. Klik "Ajukan" untuk mengirim ke Operator untuk disetujui.
                    </div>
                    <Button onClick={async () => {
                        setIsActionLoading(true);
                        try {
                            const res = await fetch(`/api/loans/applications/${params.id}/submit`, { method: "POST" });
                            const json = await res.json();
                            if (res.ok) { toast.success("Pengajuan berhasil dikirim ke Admin!"); fetchData(); }
                            else toast.error(json.message || "Gagal mengirim pengajuan");
                        } catch { toast.error("Gagal mengirim pengajuan"); }
                        finally { setIsActionLoading(false); }
                    }} disabled={isActionLoading} className="w-full">
                        {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Ajukan ke Operator
                    </Button>
                </div>
            )}

            {status === "submitted" && (
                                <div className="flex gap-2 w-full pt-4">
                                    <Button onClick={() => handleAction("approve")} disabled={isActionLoading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                                        <CheckCircle className="w-4 h-4 mr-2" /> ACC
                                    </Button>
                                    <Button onClick={() => handleAction("reject")} disabled={isActionLoading} variant="destructive" className="flex-1">
                                        <XCircle className="w-4 h-4 mr-2" /> Tolak
                                    </Button>
                                </div>
                            )}

                            {status === "approved" && (
                                <div className="space-y-4 pt-2 border-t">
                                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                                        Pinjaman telah di-Approve. Silakan panggil Anggota ybs untuk proses "Penghadapan". Jika fisik peminjam valid, tekan Cairkan.
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium">
                                            <Banknote className="inline h-3.5 w-3.5 mr-1" />
                                            Kas/Bank Sumber Dana
                                        </Label>
                                        <Select value={selectedCashBankId} onValueChange={setSelectedCashBankId}>
                                            <SelectTrigger className="mt-1.5">
                                                <SelectValue placeholder={
                                                    cashBankAccounts.length === 0
                                                        ? "Memuat akun..."
                                                        : "Pilih akun kas/bank"
                                                } />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {cashBankAccounts.map((acc: any) => (
                                                    <SelectItem key={acc.id} value={String(acc.id)}>
                                                        <span className="flex flex-col">
                                                            <span className="font-medium text-sm">{acc.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                Saldo: {formatCurrency(Number(acc.currentBalance))}
                                                            </span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Dana pencairan akan dikurangkan dari akun ini
                                        </p>
                                    </div>
                                    <Button onClick={() => handleAction("disburse")} disabled={isActionLoading || !selectedCashBankId} className="w-full" size="lg">
                                        <Banknote className="w-5 h-5 mr-2" />
                                        Cairkan & Cetak Kwitansi
                                    </Button>
                                </div>
                            )}

                            {status === "disbursed" && (
                                <div className="space-y-4 pt-2 border-t">
                                    <div className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                                        Pinjaman telah sukses dicairkan dan jadwal angsuran sudah berjalan.
                                    </div>
                                    {loan && (
                                        <Button variant="outline" className="w-full" onClick={() => router.push(`/pinjaman/${loan.id}`)}>
                                            Lihat Pinjaman Aktif
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
