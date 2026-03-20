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

export default function PengajuanDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [data, setData] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isActionLoading, setIsActionLoading] = React.useState(false);

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

    const handleAction = async (action: "approve" | "reject" | "disburse") => {
        setIsActionLoading(true);
        try {
            const url = `/api/loans/applications/${params.id}/${action}`;
            const method = action === "disburse" ? "POST" : "POST"; // using POST for all based on routes
            
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes: "Action via UI" }),
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
    const interestPerMonth = Number(product.interestRate) / 12;
    const estimationPokok = Math.round(Number(amount) / tenorMonths);
    const estimationBunga = Math.round(Number(amount) * (interestPerMonth / 100));

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
                                <p className="font-semibold mb-2">Estimasi Potong Gaji (Per Bulan)</p>
                                <div className="flex justify-between text-sm">
                                    <span>Angsuran Pokok</span>
                                    <span>{formatCurrency(estimationPokok)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Angsuran Bunga ({interestPerMonth}% per bulan)</span>
                                    <span>{formatCurrency(estimationBunga)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-primary mt-2 pt-2 border-t">
                                    <span>Total Potongan</span>
                                    <span>{formatCurrency(estimationPokok + estimationBunga)}</span>
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
                                    <Button onClick={() => handleAction("disburse")} disabled={isActionLoading} className="w-full" size="lg">
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
