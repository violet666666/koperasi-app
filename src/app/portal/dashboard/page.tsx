"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { memberPortalApi } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import {
    PiggyBank,
    CreditCard,
    Wallet,
    ArrowRight,
    Store,
    BookOpen,
    Car,
    Dumbbell,
    Printer,
    History,
    DollarSign,
    AlertTriangle,
    Send,
    CheckCircle2,
    Shirt,
    UtensilsCrossed,
    Gamepad2,
    Scissors,
    Building,
    Award,
    Landmark,
    TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/use-auth";
import { InfoCardWrapper } from "@/components/patterns/info-card-wrapper";

function getUnitIcon(unitType: string) {
    switch (unitType) {
        case "toko": return <Store className="h-5 w-5" />;
        case "simpan_pinjam": return <BookOpen className="h-5 w-5" />;
        case "fotocopy": return <Printer className="h-5 w-5" />;
        case "cuci_mobil": return <Car className="h-5 w-5" />;
        case "fitness": return <Dumbbell className="h-5 w-5" />;
        case "laundry": return <Shirt className="h-5 w-5" />;
        case "resto_cafe": return <UtensilsCrossed className="h-5 w-5" />;
        case "playstation": return <Gamepad2 className="h-5 w-5" />;
        case "barbershop": return <Scissors className="h-5 w-5" />;
        case "aset": return <Building className="h-5 w-5" />;
        default: return <Wallet className="h-5 w-5" />;
    }
}

function getUnitName(unitType: string) {
    const types: Record<string, string> = {
        toko: "Toko",
        simpan_pinjam: "Simpan Pinjam",
        fotocopy: "Fotocopy",
        cuci_mobil: "Cuci Mobil & Motor",
        fitness: "Fitness",
        laundry: "Laundry",
        resto_cafe: "Resto & Cafe",
        playstation: "Playstation",
        barbershop: "Barbershop",
        aset: "Aset",
    };
    return types[unitType] || unitType;
}

export default function MemberDashboardPage() {
    // Dynamic month name
    const currentMonthName = format(new Date(), "MMMM", { locale: id });
    const { user } = useAuth();
    const [showTabunganDetail, setShowTabunganDetail] = React.useState(false);
    const [showSHUDetail, setShowSHUDetail] = React.useState(false);

    type SummaryResponse = {
        data: {
            member: any;
            savings: { totalBalance: number; accounts: any[] };
            loans: { totalOutstanding: number; activeCount: number; list: any[] };
            unitTransactions: {
                unpaidTotal: number;
                unpaidCount: number;
                byUnit: { unitType: string; totalAmount: number; count: number }[];
                recent: any[];
            };
            estimatedSHU?: {
                total: number;
                jasaModal: number;
                jasaUsaha: number;
                jasaModalPercent: number;
                jasaUsahaPercent: number;
            };
        }
    };

    const { data: response, isLoading } = useQuery<SummaryResponse>({
        queryKey: ["member-summary"],
        queryFn: () => memberPortalApi.summary() as Promise<SummaryResponse>,
    });

    const data = response?.data;
    const salary = data?.member?.salary || 0;
    const tunkin = data?.member?.tunlesKinerja ? Number(data.member.tunlesKinerja) : 0;
    const tabunganWajib = data?.member?.tabunganWajib ? Number(data.member.tabunganWajib) : 0;
    const totalLoanOutstanding = data?.loans?.totalOutstanding || 0;
    const netAfterLoan = salary - totalLoanOutstanding;
    const hasApprovedLoan = data?.loans?.list?.some((l: any) => l.status === "approved") || false;

    // Savings breakdown by product type
    const savingsAccounts = data?.savings?.accounts || [];
    const simpananPokok = savingsAccounts.filter((a: any) => a.product?.type === 'pokok').reduce((s: number, a: any) => s + a.balance, 0);
    const simpananSukarela = savingsAccounts.filter((a: any) => a.product?.type === 'sukarela' || a.product?.type === 'harian').reduce((s: number, a: any) => s + a.balance, 0);
    const totalTabungan = tabunganWajib + simpananPokok + simpananSukarela;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Selamat Datang, {user?.name?.split(' ')[0]}!</h1>
                <p className="text-muted-foreground">Dashboard anggota PRIMKOPPOL Resor Lumajang</p>
            </div>

            {/* Loan Approved Notification */}
            {hasApprovedLoan && (
                <Alert className="border-emerald-300 bg-emerald-50">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertTitle className="text-emerald-800 font-semibold">Pengajuan Pinjaman Disetujui!</AlertTitle>
                    <AlertDescription className="text-emerald-700">
                        Pengajuan pinjaman Anda telah disetujui. Silakan <strong>menghadap ke pihak yang berwenang</strong> untuk proses pencairan.
                    </AlertDescription>
                </Alert>
            )}

            {/* 4 Main Stat Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* 1. Gaji Bersih */}
                <InfoCardWrapper
                    tooltip="Gaji bersih Anda yang tercatat di sistem koperasi."
                    detailTitle="Gaji Bersih"
                    detailDescription={"Menampilkan gaji pokok bersih Anda per bulan yang sudah didata oleh admin/operator koperasi.\n\nGaji ini digunakan sebagai salah satu dasar perhitungan kelayakan pinjaman. Sesuai AD-ART 2026, sisa gaji setelah dikurangi angsuran harus minimal Rp 2.000.000.\n\nJika angka ini belum terisi atau salah, silakan hubungi operator koperasi untuk diperbarui."}
                >
                    <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-0 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium opacity-90">Gaji Bersih</CardTitle>
                            <DollarSign className="h-4 w-4 opacity-75" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : salary > 0 ? formatCurrency(salary) : "Belum diisi"}
                            </div>
                            <p className="text-xs opacity-80 mt-1">Gaji pokok per bulan</p>
                        </CardContent>
                    </Card>
                </InfoCardWrapper>

                {/* 1b. Tunjangan Kinerja (Tunkin) */}
                <InfoCardWrapper
                    tooltip="Tunjangan Kinerja (Tunkin) Anda bulan ini."
                    detailTitle="Tunjangan Kinerja (Tunkin)"
                    detailDescription={"Menampilkan Tunjangan Kinerja (Tunkin/Tukin) Anda bulan berjalan.\n\nTunkin dapat digunakan sebagai sumber pemotongan angsuran pinjaman, selain gaji pokok. Saat mengajukan pinjaman, Anda bisa memilih apakah angsuran dipotong dari Gaji atau Tunkin.\n\nJika angka ini belum terisi, hubungi operator koperasi untuk pembaruan data."}
                >
                    <Card className="bg-gradient-to-br from-violet-500 to-purple-700 text-white border-0 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium opacity-90">Tunjangan Kinerja</CardTitle>
                            <Award className="h-4 w-4 opacity-75" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : tunkin > 0 ? formatCurrency(tunkin) : "Belum diisi"}
                            </div>
                            <p className="text-xs opacity-80 mt-1">Tunkin bulan berjalan</p>
                        </CardContent>
                    </Card>
                </InfoCardWrapper>

                {/* 2. Pinjaman Berlangsung */}
                <InfoCardWrapper
                    tooltip="Total sisa pinjaman Anda yang masih berjalan."
                    detailTitle="Pinjaman Berlangsung"
                    detailDescription={"Menampilkan total sisa pokok pinjaman Anda yang statusnya masih aktif (belum lunas).\n\nAnda bisa memiliki maksimal 2 pinjaman berjalan sekaligus (1 potong gaji + 1 potong tunkin).\n\nAngka ini berkurang setiap bulan seiring pembayaran angsuran Anda.\n\nJika Anda melakukan Bayar Sendiri (BS), sisa pinjaman akan turun lebih cepat dan angsuran bulanan akan dihitung ulang."}
                >
                    <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium opacity-90">Pinjaman Berlangsung</CardTitle>
                            <CreditCard className="h-4 w-4 opacity-75" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : formatCurrency(totalLoanOutstanding)}
                            </div>
                            <p className="text-xs opacity-80 mt-1">{data?.loans?.activeCount || 0} pinjaman aktif</p>
                        </CardContent>
                    </Card>
                </InfoCardWrapper>

                {/* 3. Pengajuan Pinjaman (Warning) */}
                <Link href="/portal/pengajuan-pinjaman">
                    <Card className={`border-0 shadow-md h-full transition-transform hover:scale-[1.02] ${netAfterLoan < 0 ? "bg-gradient-to-br from-red-500 to-red-700" : "bg-gradient-to-br from-amber-500 to-amber-700"} text-white`}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium opacity-90">Pengajuan Pinjaman</CardTitle>
                            <Send className="h-4 w-4 opacity-75" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : formatCurrency(Math.max(0, netAfterLoan))}
                            </div>
                            <p className="text-xs opacity-80 mt-1">
                                {netAfterLoan < 0 ? "⚠ Pinjaman melebihi gaji" : "Sisa setelah pinjaman"}
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                {/* 4. Tagihan / Bill Payment */}
                <InfoCardWrapper
                    tooltip="Total tagihan belanja unit koperasi Anda yang belum lunas."
                    detailTitle="Tagihan Unit"
                    detailDescription={"Menampilkan total tagihan dari seluruh unit layanan koperasi (Toko, Cuci Mobil, Fitness, dll) yang statusnya masih belum dibayar.\n\nTagihan ini biasanya dilunasi melalui potongan gaji bulanan atau pembayaran langsung ke kasir.\n\nUntuk melihat rincian tagihan per unit, lihat bagian 'Ringkasan Per Unit' di bawah."}
                >
                    <Card className="bg-gradient-to-br from-red-500 to-red-700 text-white border-0 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium opacity-90">Tagihan Unit</CardTitle>
                            <Wallet className="h-4 w-4 opacity-75" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : formatCurrency(data?.unitTransactions?.unpaidTotal || 0)}
                            </div>
                            <p className="text-xs opacity-80 mt-1">{data?.unitTransactions?.unpaidCount || 0} transaksi belum lunas</p>
                        </CardContent>
                    </Card>
                </InfoCardWrapper>
            </div>

            {/* Row 2: Tabungan + SHU (Clickable for detail) */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* 6. Tabungan Akumulasi — Clickable */}
                <Card
                    className="bg-gradient-to-br from-cyan-600 to-teal-800 text-white border-0 shadow-md cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setShowTabunganDetail(true)}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium opacity-90">Total Tabungan</CardTitle>
                        <Landmark className="h-4 w-4 opacity-75" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : formatCurrency(totalTabungan)}
                        </div>
                        {!isLoading && (
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-xs opacity-80">
                                    <span>Tab. Wajib (per {currentMonthName})</span>
                                    <span className="font-semibold">{formatCurrency(tabunganWajib)}</span>
                                </div>
                                <div className="flex justify-between text-xs opacity-80">
                                    <span>Simpanan Pokok (per {currentMonthName})</span>
                                    <span className="font-semibold">{formatCurrency(simpananPokok)}</span>
                                </div>
                                <div className="flex justify-between text-xs opacity-80">
                                    <span>Simpanan Sukarela (per {currentMonthName})</span>
                                    <span className="font-semibold">{formatCurrency(simpananSukarela)}</span>
                                </div>
                                <p className="text-[10px] opacity-60 mt-1 italic">Ketuk untuk detail →</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 7. SHU Estimasi — Clickable */}
                <Card
                    className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white border-0 shadow-md cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setShowSHUDetail(true)}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium opacity-90">Estimasi SHU Anda</CardTitle>
                        <TrendingUp className="h-4 w-4 opacity-75" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : formatCurrency(data?.estimatedSHU?.total || 0)}
                        </div>
                        <p className="text-xs opacity-80 mt-1">Estimasi realtime — kontribusi belanja, pinjaman, tabungan wajib &amp; pokok</p>
                        {!isLoading && data?.estimatedSHU && (
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-xs opacity-80">
                                    <span>Jasa Usaha ({data.estimatedSHU.jasaUsahaPercent?.toFixed(1)}%)</span>
                                    <span className="font-semibold">{formatCurrency(data.estimatedSHU.jasaUsaha)}</span>
                                </div>
                                <div className="flex justify-between text-xs opacity-80">
                                    <span>Jasa Modal ({data.estimatedSHU.jasaModalPercent?.toFixed(1)}%)</span>
                                    <span className="font-semibold">{formatCurrency(data.estimatedSHU.jasaModal)}</span>
                                </div>
                                <p className="text-[10px] opacity-60 mt-1 italic">Ketuk untuk detail perhitungan →</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ===== TABUNGAN DETAIL DIALOG ===== */}
            {showTabunganDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowTabunganDetail(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-cyan-600 to-teal-800 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
                            <h2 className="text-lg font-bold">📊 Detail Tabungan Anda</h2>
                            <button onClick={() => setShowTabunganDetail(false)} className="text-white/80 hover:text-white text-xl font-bold">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-center p-4 bg-teal-50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Total Tabungan Anda</p>
                                <p className="text-3xl font-bold text-teal-700">{formatCurrency(totalTabungan)}</p>
                            </div>
                            <div className="space-y-3">
                                <h3 className="font-semibold text-sm text-gray-700 border-b pb-1">Rincian per Produk Simpanan</h3>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div><p className="font-medium text-sm">Tabungan Wajib (Tajib)</p><p className="text-xs text-muted-foreground">Potongan wajib bulanan per {currentMonthName}</p></div>
                                    <p className="font-bold text-teal-700">{formatCurrency(tabunganWajib)}</p>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div><p className="font-medium text-sm">Simpanan Pokok</p><p className="text-xs text-muted-foreground">Setoran awal saat menjadi anggota</p></div>
                                    <p className="font-bold text-teal-700">{formatCurrency(simpananPokok)}</p>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div><p className="font-medium text-sm">Simpanan Sukarela</p><p className="text-xs text-muted-foreground">Tabungan sukarela yang bisa ditarik</p></div>
                                    <p className="font-bold text-teal-700">{formatCurrency(simpananSukarela)}</p>
                                </div>
                            </div>
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                                <p className="font-semibold">ℹ️ Catatan Penting:</p>
                                <p>• Simpanan <strong>Pokok</strong> dan <strong>Wajib</strong> tidak dapat ditarik kecuali saat keluar keanggotaan.</p>
                                <p>• Simpanan <strong>Sukarela</strong> dapat ditarik kapan saja melalui kasir.</p>
                                <p>• Semakin besar tabungan Anda, semakin besar <strong>SHU Jasa Simpanan</strong> yang Anda terima.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== SHU DETAIL DIALOG ===== */}
            {showSHUDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSHUDetail(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
                            <h2 className="text-lg font-bold">📈 Detail Estimasi SHU Anda</h2>
                            <button onClick={() => setShowSHUDetail(false)} className="text-white/80 hover:text-white text-xl font-bold">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-center p-4 bg-orange-50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Total Estimasi SHU Tahun {new Date().getFullYear()}</p>
                                <p className="text-3xl font-bold text-orange-700">{formatCurrency(data?.estimatedSHU?.total || 0)}</p>
                                <p className="text-xs text-muted-foreground mt-1">Perhitungan realtime berdasarkan AD-ART Pasal 42</p>
                            </div>

                            {/* Jasa Simpanan Breakdown */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-blue-50 px-4 py-2 border-b">
                                    <h3 className="font-semibold text-sm text-blue-800">1. Jasa Simpanan (Modal) — 20%</h3>
                                </div>
                                <div className="p-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Simpanan Anda</span><span className="font-mono">{formatCurrency(totalTabungan)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Porsi Anda dari Total</span><span className="font-mono font-semibold">{data?.estimatedSHU?.jasaModalPercent?.toFixed(2) || 0}%</span></div>
                                    <div className="border-t pt-2 flex justify-between font-semibold">
                                        <span className="text-blue-700">Estimasi Jasa Simpanan</span>
                                        <span className="text-blue-700 font-mono">{formatCurrency(data?.estimatedSHU?.jasaModal || 0)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground italic">Dihitung dari: (Simpanan Anda ÷ Total Simpanan Seluruh Anggota) × Kolam Jasa Simpanan (20% dari laba koperasi)</p>
                                </div>
                            </div>

                            {/* Jasa Anggota Breakdown */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-green-50 px-4 py-2 border-b">
                                    <h3 className="font-semibold text-sm text-green-800">2. Jasa Anggota (Usaha) — 25%</h3>
                                </div>
                                <div className="p-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Kontribusi Transaksi Anda</span><span className="font-mono">{data?.estimatedSHU?.jasaUsahaPercent?.toFixed(2) || 0}%</span></div>
                                    <div className="border-t pt-2 flex justify-between font-semibold">
                                        <span className="text-green-700">Estimasi Jasa Anggota</span>
                                        <span className="text-green-700 font-mono">{formatCurrency(data?.estimatedSHU?.jasaUsaha || 0)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground italic">Dihitung dari: 25% × margin keuntungan transaksi Anda (belanja toko, cuci mobil, angsuran pinjaman)</p>
                                </div>
                            </div>

                            {/* AD-ART Reference Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-4 py-2 border-b">
                                    <h3 className="font-semibold text-sm text-gray-700">Tabel Alokasi SHU (AD-ART Pasal 42)</h3>
                                </div>
                                <div className="p-3">
                                    <table className="w-full text-xs">
                                        <thead><tr className="border-b"><th className="text-left py-1 font-semibold">Alokasi</th><th className="text-right py-1 font-semibold">%</th><th className="text-right py-1 font-semibold">Untuk</th></tr></thead>
                                        <tbody>
                                            <tr className="border-b bg-green-50"><td className="py-1">Jasa Anggota</td><td className="text-right font-mono">25%</td><td className="text-right text-green-700 font-semibold">Anggota ← Anda</td></tr>
                                            <tr className="border-b bg-blue-50"><td className="py-1">Jasa Simpanan</td><td className="text-right font-mono">20%</td><td className="text-right text-blue-700 font-semibold">Anggota ← Anda</td></tr>
                                            <tr className="border-b"><td className="py-1">Cadangan</td><td className="text-right font-mono">30%</td><td className="text-right text-muted-foreground">Koperasi</td></tr>
                                            <tr className="border-b"><td className="py-1">Dana Pengurus</td><td className="text-right font-mono">10%</td><td className="text-right text-muted-foreground">Pengurus</td></tr>
                                            <tr className="border-b"><td className="py-1">Dana Pegawai</td><td className="text-right font-mono">5%</td><td className="text-right text-muted-foreground">Karyawan</td></tr>
                                            <tr className="border-b"><td className="py-1">Dana Pendidikan</td><td className="text-right font-mono">5%</td><td className="text-right text-muted-foreground">Koperasi</td></tr>
                                            <tr><td className="py-1">Dana Sosial</td><td className="text-right font-mono">5%</td><td className="text-right text-muted-foreground">Koperasi</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                                <p className="font-semibold">ℹ️ Catatan:</p>
                                <p>• Nilai ini adalah <strong>estimasi realtime</strong> — angka resmi ditetapkan saat RAT (Rapat Anggota Tahunan).</p>
                                <p>• Semakin besar tabungan Anda → semakin besar <strong>Jasa Simpanan</strong>.</p>
                                <p>• Semakin sering belanja/bertransaksi → semakin besar <strong>Jasa Anggota</strong>.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Warning Alert for Loan vs Salary */}
            {!isLoading && salary > 0 && netAfterLoan < 0 && (
                <Alert className="border-red-300 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-800 font-semibold">Peringatan Akumulasi Pinjaman</AlertTitle>
                    <AlertDescription className="text-red-700">
                        Total pinjaman Anda ({formatCurrency(totalLoanOutstanding)}) telah melebihi gaji bersih ({formatCurrency(salary)}).
                        Selisih: <strong>{formatCurrency(Math.abs(netAfterLoan))}</strong>. Pengajuan pinjaman baru mungkin tidak disetujui.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Riwayat Transaksi Terbaru */}
                <Card className="md:col-span-2 lg:col-span-4 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>History Transaksi / Bill Payment</CardTitle>
                            <CardDescription>Riwayat transaksi Anda di seluruh unit PRIMKOPPOL</CardDescription>
                        </div>
                        <Link href="/portal/transaksi" className="text-sm text-primary hover:underline flex items-center gap-1 font-medium">
                            Lihat Semua <ArrowRight className="h-4 w-4" />
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-full max-w-[200px]" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : data?.unitTransactions.recent.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 rounded-xl border border-dashed">
                                <History className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
                                <p className="text-sm font-medium text-muted-foreground">Belum ada transaksi</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {data?.unitTransactions.recent.slice(0, 6).map((tx: any) => (
                                    <div key={tx.id} className="flex items-start justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                        <div className="flex gap-3">
                                            <div className="mt-1 h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                {getUnitIcon(tx.unitType)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm line-clamp-1">{tx.description}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[10px] h-5 bg-slate-50 uppercase tracking-wider">{getUnitName(tx.unitType)}</Badge>
                                                    <span className="text-xs text-muted-foreground">{format(new Date(tx.transactionDate), "d MMM yyyy", { locale: id })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-sm">{formatCurrency(tx.amount)}</div>
                                            {!tx.isPaid ? (
                                                <span className="text-[10px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">BELUM LUNAS</span>
                                            ) : (
                                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">LUNAS</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Ringkasan Per Unit */}
                <Card className="md:col-span-1 lg:col-span-3 shadow-sm bg-slate-50 border-0 ring-1 ring-slate-200">
                    <CardHeader>
                        <CardTitle>Ringkasan Per Unit</CardTitle>
                        <CardDescription>Total transaksi per unit layanan</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex gap-3 items-center">
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                        <div className="space-y-2 flex-1"><Skeleton className="h-4 w-full" /></div>
                                    </div>
                                ))}
                            </div>
                        ) : data?.unitTransactions.byUnit.length === 0 ? (
                            <p className="text-sm text-center text-muted-foreground py-8">Tidak ada data</p>
                        ) : (
                            <div className="space-y-4">
                                {data?.unitTransactions.byUnit.map((stats: any) => (
                                    <div key={stats.unitType} className="flex items-center p-3 bg-white rounded-lg border shadow-sm">
                                        <div className="h-10 w-10 text-slate-500 bg-slate-100 rounded-md flex items-center justify-center mr-3">
                                            {getUnitIcon(stats.unitType)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-sm font-semibold">{getUnitName(stats.unitType)}</p>
                                                <p className="text-sm font-bold text-primary">{formatCurrency(stats.totalAmount)}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{stats.count} Transaksi</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
