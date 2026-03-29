"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
    Calculator,
    Users,
    TrendingUp,
    PieChart,
    Download,
    Loader2,
    RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";

interface SHUCalculation {
    year: number;
    status: "draft" | "calculated" | "distributed";
    
    totalIncome: number;
    totalExpense: number;
    netSurplus: number;

    memberIncome: number;
    memberExpense: number;
    memberSurplus: number;
    nonMemberIncome: number;
    nonMemberExpense: number;
    nonMemberSurplus: number;

    reserveFund: number;
    educationFund: number;
    employeeBonus: number;
    pengurusFund: number;
    socialFund: number;
    memberDividend: number;
    jasaModalPool: number;
    jasaUsahaPool: number;
    memberCount: number;
}

interface MemberSHU {
    id: number;
    memberNo: string;
    name: string;
    savingsContribution: number;
    loanContribution: number;
    totalContribution: number;
    modalPortion: number;
    usahaPortion: number;
    shuAmount: number;
    percentage: number;
}

const columns: ColumnDef<MemberSHU>[] = [
    {
        accessorKey: "memberNo",
        header: "NRP",
        cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("memberNo")}</span>,
    },
    { accessorKey: "name", header: "Nama Anggota" },
    {
        accessorKey: "savingsContribution",
        header: () => <div className="text-right">Kontribusi Simpanan</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.getValue("savingsContribution"))}</div>,
    },
    {
        accessorKey: "loanContribution",
        header: () => <div className="text-right">Kontribusi Transaksi</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.getValue("loanContribution"))}</div>,
    },
    {
        accessorKey: "modalPortion",
        header: () => <div className="text-right">Jasa Simpanan</div>,
        cell: ({ row }) => <div className="text-right tabular-nums text-blue-600">{formatCurrency(row.getValue("modalPortion"))}</div>,
    },
    {
        accessorKey: "usahaPortion",
        header: () => <div className="text-right">Jasa Anggota</div>,
        cell: ({ row }) => <div className="text-right tabular-nums text-green-600">{formatCurrency(row.getValue("usahaPortion"))}</div>,
    },
    {
        accessorKey: "percentage",
        header: () => <div className="text-right">%</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{Number(row.getValue("percentage")).toFixed(2)}%</div>,
    },
    {
        accessorKey: "shuAmount",
        header: () => <div className="text-right font-bold">Total SHU</div>,
        cell: ({ row }) => <div className="text-right tabular-nums font-bold text-emerald-600">{formatCurrency(row.getValue("shuAmount"))}</div>,
    },
];

export default function SHUCalculationPage() {
    const currentYear = new Date().getFullYear().toString();
    const [selectedYear, setSelectedYear] = React.useState<string>(currentYear);
    const [shuData, setShuData] = React.useState<SHUCalculation | null>(null);
    const [memberSHU, setMemberSHU] = React.useState<MemberSHU[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    // Fetch data
    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/reports/shu/calculate?year=${selectedYear}`);
            if (!res.ok) throw new Error("Gagal mengambil data perhitungan SHU");
            const json = await res.json();
            
            if (json.data) {
                setShuData(json.data.shuData);
                setMemberSHU(json.data.memberSHU);
            }
        } catch (error) {
            console.error("Failed to fetch:", error);
            toast.error("Gagal memuat data SHU");
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    // AD-ART distributions — calculated dynamically from API data
    const memberDistribution = shuData ? [
        { name: "Jasa Anggota (Usaha)", amount: shuData.jasaUsahaPool, percentage: 25, color: "bg-emerald-600" },
        { name: "Jasa Simpanan (Modal)", amount: shuData.jasaModalPool, percentage: 20, color: "bg-blue-500" },
        { name: "Cadangan", amount: shuData.memberSurplus * 0.30, percentage: 30, color: "bg-indigo-500" },
        { name: "Dana Pengurus & Pengawas", amount: shuData.memberSurplus * 0.10, percentage: 10, color: "bg-violet-500" },
        { name: "Dana Pegawai/Karyawan", amount: shuData.memberSurplus * 0.05, percentage: 5, color: "bg-amber-500" },
        { name: "Dana Pendidikan Koperasi", amount: shuData.memberSurplus * 0.05, percentage: 5, color: "bg-pink-500" },
        { name: "Dana Sosial", amount: shuData.memberSurplus * 0.05, percentage: 5, color: "bg-rose-500" },
    ] : [];

    const nonMemberDistribution = shuData ? [
        { name: "Dana Cadangan", amount: shuData.nonMemberSurplus * 0.60, percentage: 60, color: "bg-indigo-500" },
        { name: "Dana Pendidikan Koperasi", amount: shuData.nonMemberSurplus * 0.20, percentage: 20, color: "bg-pink-500" },
        { name: "Kesejahteraan Karyawan", amount: shuData.nonMemberSurplus * 0.10, percentage: 10, color: "bg-amber-500" },
        { name: "Dana Sosial", amount: shuData.nonMemberSurplus * 0.10, percentage: 10, color: "bg-rose-500" },
    ] : [];

    const statusBadge = (status: string) => {
        switch (status) {
            case "distributed": return <Badge className="bg-emerald-100 text-emerald-800">Sudah Dibagikan</Badge>;
            case "calculated": return <Badge className="bg-blue-100 text-blue-800">Data Terhitung</Badge>;
            default: return <Badge variant="outline">Belum Ada Data</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Perhitungan SHU"
                description="Sisa Hasil Usaha — Perhitungan realtime berdasarkan AD-ART Pasal 42"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                    </div>
                }
            />

            {/* Year Selector */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <span className="text-sm text-muted-foreground">Tahun Buku:</span>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                        {shuData && statusBadge(shuData.status)}
                        {shuData && (
                            <span className="text-xs text-muted-foreground">
                                ({shuData.memberCount} anggota aktif)
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            ) : shuData ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Pendapatan</p>
                                        <p className="text-lg font-bold tabular-nums">
                                            {formatCurrency(shuData.totalIncome)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                                        <TrendingUp className="h-5 w-5 text-red-600 rotate-180" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Biaya (40%)</p>
                                        <p className="text-lg font-bold tabular-nums">
                                            {formatCurrency(shuData.totalExpense)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-primary">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-3">
                                        <Calculator className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">SHU Bersih (60%)</p>
                                        <p className="text-xl font-bold tabular-nums text-primary">
                                            {formatCurrency(shuData.netSurplus)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                                        <Users className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Anggota Aktif</p>
                                        <p className="text-xl font-bold">{shuData.memberCount}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Surplus Breakdown */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-indigo-100 p-3 dark:bg-indigo-900/30">
                                        <Users className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Surplus dari Anggota</p>
                                        <p className="text-xl font-bold tabular-nums text-indigo-600">
                                            {formatCurrency(shuData.memberSurplus)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-orange-100 p-3 dark:bg-orange-900/30">
                                        <Users className="h-5 w-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Surplus dari Bukan Anggota</p>
                                        <p className="text-xl font-bold tabular-nums text-orange-600">
                                            {formatCurrency(shuData.nonMemberSurplus)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Distribution Breakdown with AD-ART Percentages */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <PieChart className="h-5 w-5" />
                                Pembagian SHU — Sesuai AD-ART Pasal 42
                            </CardTitle>
                            <CardDescription>
                                Alokasi SHU dengan persentase resmi berdasarkan Anggaran Dasar/Anggaran Rumah Tangga Primkoppol
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="anggota" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="anggota">SHU Anggota (100%)</TabsTrigger>
                                    <TabsTrigger value="non-anggota">SHU Bukan Anggota (100%)</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="anggota">
                                    <div className="space-y-4">
                                        {memberDistribution.map((fund) => (
                                            <div key={fund.name} className="space-y-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="font-medium">{fund.name} <span className="text-muted-foreground font-normal">({fund.percentage}%)</span></span>
                                                    <span className="font-bold tabular-nums text-indigo-700 dark:text-indigo-400">
                                                        {formatCurrency(fund.amount)}
                                                    </span>
                                                </div>
                                                <Progress value={fund.percentage} className={fund.color} />
                                            </div>
                                        ))}
                                        <div className="border-t pt-3 flex justify-between font-bold text-sm">
                                            <span>Total SHU untuk Anggota (Jasa Anggota + Jasa Simpanan)</span>
                                            <span className="text-emerald-700 tabular-nums">{formatCurrency(shuData.memberDividend)}</span>
                                        </div>
                                    </div>
                                </TabsContent>
                                
                                <TabsContent value="non-anggota">
                                    <div className="space-y-4">
                                        {nonMemberDistribution.map((fund) => (
                                            <div key={fund.name} className="space-y-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="font-medium">{fund.name} <span className="text-muted-foreground font-normal">({fund.percentage}%)</span></span>
                                                    <span className="font-bold tabular-nums text-orange-700 dark:text-orange-400">
                                                        {formatCurrency(fund.amount)}
                                                    </span>
                                                </div>
                                                <Progress value={fund.percentage} className={fund.color} />
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* AD-ART Reference Card */}
                    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800">
                        <CardHeader>
                            <CardTitle className="text-base text-blue-800 dark:text-blue-300">📋 Referensi Parameter SHU (AD-ART Pasal 42)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6 sm:grid-cols-2">
                                <div>
                                    <h4 className="font-semibold text-sm mb-2 text-blue-800 dark:text-blue-300">SHU dari Usaha Anggota</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between"><span>Cadangan</span><span className="font-mono font-bold">30%</span></div>
                                        <div className="flex justify-between"><span>Jasa Anggota (Usaha)</span><span className="font-mono font-bold">25%</span></div>
                                        <div className="flex justify-between"><span>Jasa Simpanan (Modal)</span><span className="font-mono font-bold">20%</span></div>
                                        <div className="flex justify-between"><span>Dana Pengurus & Pengawas</span><span className="font-mono font-bold">10%</span></div>
                                        <div className="flex justify-between"><span>Dana Pegawai/Karyawan</span><span className="font-mono font-bold">5%</span></div>
                                        <div className="flex justify-between"><span>Dana Pendidikan</span><span className="font-mono font-bold">5%</span></div>
                                        <div className="flex justify-between"><span>Dana Sosial</span><span className="font-mono font-bold">5%</span></div>
                                        <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span className="font-mono">100%</span></div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm mb-2 text-orange-800 dark:text-orange-300">SHU dari Usaha Bukan Anggota</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between"><span>Dana Cadangan</span><span className="font-mono font-bold">60%</span></div>
                                        <div className="flex justify-between"><span>Dana Pendidikan Koperasi</span><span className="font-mono font-bold">20%</span></div>
                                        <div className="flex justify-between"><span>Kesejahteraan Karyawan</span><span className="font-mono font-bold">10%</span></div>
                                        <div className="flex justify-between"><span>Dana Sosial</span><span className="font-mono font-bold">10%</span></div>
                                        <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span className="font-mono">100%</span></div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Member SHU Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Pembagian SHU per Anggota</CardTitle>
                            <CardDescription>
                                Total Hak Anggota: {formatCurrency(shuData.memberDividend)} — Jasa Simpanan {formatCurrency(shuData.jasaModalPool)} + Jasa Anggota {formatCurrency(shuData.jasaUsahaPool)} untuk {shuData.memberCount} anggota
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DataTable 
                                columns={columns} 
                                data={memberSHU} 
                                searchColumn="name" 
                                searchPlaceholder="Cari anggota berdasarkan nama..." 
                            />
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
