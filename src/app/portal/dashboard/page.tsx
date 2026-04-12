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
                carwashBonus: number;
                carwashCount: number;
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
    const totalLoanOutstanding = data?.loans?.totalOutstanding || 0;
    const netAfterLoan = salary - totalLoanOutstanding;
    const hasApprovedLoan = data?.loans?.list?.some((l: any) => l.status === "approved") || false;
    
    // Savings breakdown by product type
    const savingsAccounts = data?.savings?.accounts || [];
    const simpananPokok = savingsAccounts.filter((a: any) => a.product?.type === 'pokok').reduce((s: number, a: any) => s + a.balance, 0);
    const simpananSukarela = savingsAccounts.filter((a: any) => a.product?.type === 'sukarela' || a.product?.type === 'harian').reduce((s: number, a: any) => s + a.balance, 0);
    
    // Fallback: Jika sudah punya akun Simpanan Wajib dari Import TAJIB, gunakan akun tersebut.
    // Jika belum di-import, gunakan saldo gelondongan dari legacy profil
    const wajibAccount = savingsAccounts.find((a: any) => a.product?.type === 'wajib');
    const importedWajib = wajibAccount ? Number(wajibAccount.balance) : 0;
    const legacyWajib = data?.member?.tabunganWajib ? Number(data.member.tabunganWajib) : 0;
    
    const tabunganWajib = importedWajib > 0 ? importedWajib : legacyWajib;
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* 1. Gaji Bersih */}
                <InfoCardWrapper
                    tooltip="Gaji bersih Anda yang tercatat di sistem PRIMKOPPOL."
                    detailTitle="Gaji Bersih"
                    detailDescription={"Menampilkan gaji pokok bersih Anda per bulan yang sudah didata oleh admin/operator PRIMKOPPOL.\n\nGaji ini digunakan sebagai salah satu dasar perhitungan kelayakan pinjaman. Sesuai AD-ART 2026, sisa gaji setelah dikurangi angsuran harus minimal Rp 2.000.000.\n\nJika angka ini belum terisi atau salah, silakan hubungi operator PRIMKOPPOL untuk diperbarui."}
                >
                    <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-0 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium opacity-90">Sisa Gaji</CardTitle>
                            <DollarSign className="h-4 w-4 opacity-75" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : salary > 0 ? formatCurrency(salary) : "Belum diisi"}
                            </div>
                            <p className="text-xs opacity-80 mt-1">Sisa Gaji</p>
                        </CardContent>
                    </Card>
                </InfoCardWrapper>

                {/* 1b. Tunjangan Kinerja (Tunkin) */}
                <InfoCardWrapper
                    tooltip="Tunjangan Kinerja (Tunkin) Anda bulan ini."
                    detailTitle="Tunjangan Kinerja (Tunkin)"
                    detailDescription={"Menampilkan Tunjangan Kinerja (Tunkin/Tukin) Anda bulan berjalan.\n\nTunkin dapat digunakan sebagai sumber pemotongan angsuran pinjaman, selain gaji pokok. Saat mengajukan pinjaman, Anda bisa memilih apakah angsuran dipotong dari Gaji atau Tunkin.\n\nJika angka ini belum terisi, hubungi operator PRIMKOPPOL untuk pembaruan data."}
                >
                    <Card className="bg-gradient-to-br from-violet-500 to-purple-700 text-white border-0 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium opacity-90">Sisa Tunkin</CardTitle>
                            <Award className="h-4 w-4 opacity-75" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {isLoading ? <Skeleton className="h-8 w-32 bg-white/20" /> : tunkin > 0 ? formatCurrency(tunkin) : "Belum diisi"}
                            </div>
                            <p className="text-xs opacity-80 mt-1">Sisa Tunkin</p>
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
                        <p className="text-xs opacity-80 mt-1">Estimasi realtime — kontribusi belanja, pinjaman, Simpanan Wajib &amp; pokok</p>
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
                                {(data.estimatedSHU.carwashBonus || 0) > 0 && (
                                    <div className="flex justify-between text-xs opacity-80">
                                        <span>SHU Cuci Mobil ({data.estimatedSHU.carwashCount}x)</span>
                                        <span className="font-semibold">{formatCurrency(data.estimatedSHU.carwashBonus)}</span>
                                    </div>
                                )}
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

                            {/* === SIMPANAN WAJIB (dengan rincian bulan) === */}
                            {(() => {
                                const wajibAcc = savingsAccounts.find((a: any) => a.product?.type === 'wajib');
                                const wajibHistory = wajibAcc?.history || [];
                                const saldoAwalEntries = wajibHistory.filter((h: any) => h.notes?.includes('Saldo Wajib Awal') || h.notes?.includes('Saldo Awal') || h.notes?.includes('Import Saldo') || h.notes?.includes('Import/Update Saldo'));
                                // ALL deposit entries that are NOT saldo awal = monthly detail
                                const monthlyEntries = wajibHistory
                                    .filter((h: any) => h.type === 'deposit' && !saldoAwalEntries.includes(h))
                                    .sort((a: any, b: any) => new Date(a.transactionDate || a.date).getTime() - new Date(b.transactionDate || b.date).getTime());
                                const saldoAwal = saldoAwalEntries.reduce((s: number, e: any) => s + Number(e.amount), 0);
                                const hasDetail = saldoAwalEntries.length > 0 || monthlyEntries.length > 0;
                                const monthNames = ['JANUARI', 'PEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

                                return (
                                    <div className="border border-teal-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                        {/* Header: Tabungan Wajib Akumulasi */}
                                        {hasDetail && (
                                            <>
                                                <div className="px-4 py-3 bg-teal-50/70 space-y-1 block">
                                                    <div className="text-sm font-semibold text-teal-800">💰 Tabungan Wajib (Akumulasi)</div>
                                                    <div className="font-bold text-teal-800 font-mono text-right">{formatCurrency(saldoAwal)}</div>
                                                </div>
                                            </>
                                        )}

                                        {/* Dashed Separator - Only render if there are monthly entries AND it has an akumulasi header */}
                                        {hasDetail && monthlyEntries.length > 0 && (
                                            <div className="border-t border-dashed border-teal-300"></div>
                                        )}

                                        {/* Rincian setoran bulanan */}
                                        {monthlyEntries.length > 0 && (
                                            <div className="px-4 py-2 space-y-1 bg-white">
                                                {monthlyEntries.map((entry: any, index: number) => {
                                                    // Label bulan: dari notes import, atau dari tanggal transaksi
                                                    let monthLabel = '';
                                                    if (entry.notes?.startsWith('Setoran Import TAJIB:')) {
                                                        monthLabel = entry.notes.replace('Setoran Import TAJIB: ', '');
                                                    } else {
                                                        const d = new Date(entry.date || entry.transactionDate);
                                                        monthLabel = monthNames[d.getMonth()] || '';
                                                    }
                                                    return (
                                                        <div key={entry.id || index} className="flex justify-between items-center text-sm py-1">
                                                            <span className="text-muted-foreground font-medium w-32 uppercase">📅 {monthLabel}</span>
                                                            <span className="font-mono text-teal-700">+ {formatCurrency(Number(entry.amount))}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Solid Separator before footer */}
                                        <div className="border-t border-teal-200"></div>

                                        {/* Footer: Total Simpanan Wajib */}
                                        <div className="bg-teal-50 px-4 py-3 flex justify-between items-center">
                                            <span className="font-semibold text-sm text-teal-900">Tabungan Wajib (Tajib)</span>
                                            <span className="font-bold text-teal-900 text-base font-mono">{formatCurrency(tabunganWajib)}</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* === SIMPANAN POKOK === */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-blue-50 px-4 py-3 flex justify-between items-center">
                                    <span className="font-semibold text-sm text-blue-800">Simpanan Pokok</span>
                                    <span className="font-bold text-blue-800 text-lg font-mono">{formatCurrency(simpananPokok)}</span>
                                </div>
                            </div>

                            {/* === SIMPANAN SUKARELA === */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-emerald-50 px-4 py-3 flex justify-between items-center">
                                    <span className="font-semibold text-sm text-emerald-800">Simpanan Sukarela</span>
                                    <span className="font-bold text-emerald-800 text-lg font-mono">{formatCurrency(simpananSukarela)}</span>
                                </div>
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-2">
                                <p className="font-semibold text-sm flex items-center gap-1">ℹ️ Catatan Penting:</p>
                                <ul className="pl-1 space-y-1">
                                    <li>• Pokok & Wajib tidak bisa ditarik</li>
                                    <li>• Sukarela bisa ditarik kapan saja</li>
                                    <li>• Semakin besar = SHU semakin besar</li>
                                </ul>
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

                            {/* SHU Cuci Mobil Breakdown */}
                            {(data?.estimatedSHU?.carwashBonus || 0) > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="bg-cyan-50 px-4 py-2 border-b">
                                        <h3 className="font-semibold text-sm text-cyan-800">3. SHU Cuci Mobil — Rp 2.000/Transaksi</h3>
                                    </div>
                                    <div className="p-4 space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Jumlah Transaksi Cuci Mobil Anda</span><span className="font-mono font-semibold">{data?.estimatedSHU?.carwashCount || 0} kali</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Bonus Per Transaksi</span><span className="font-mono">Rp 2.000</span></div>
                                        <div className="border-t pt-2 flex justify-between font-semibold">
                                            <span className="text-cyan-700">Total SHU Cuci Mobil</span>
                                            <span className="text-cyan-700 font-mono">{formatCurrency(data?.estimatedSHU?.carwashBonus || 0)}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground italic">Setiap transaksi cuci mobil dengan ID anggota, Anda otomatis mendapat SHU fix Rp 2.000. Bonus ini dibebankan ke pendapatan kotor koperasi dan dicairkan saat distribusi SHU tahunan.</p>
                                    </div>
                                </div>
                            )}

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
                                <p>• Setiap cuci mobil dengan ID anggota → otomatis menambah <strong>SHU Cuci Mobil Rp 2.000</strong>.</p>
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
                                            {tx.status === "voided" ? (
                                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">DIBATALKAN</span>
                                            ) : !tx.isPaid ? (
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
