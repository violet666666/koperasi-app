"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    Play,
    Loader2,
    CheckCircle,
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
    { accessorKey: "name", header: "Nama" },
    {
        accessorKey: "savingsContribution",
        header: () => <div className="text-right">Kontribusi Simpanan</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.getValue("savingsContribution"))}</div>,
    },
    {
        accessorKey: "loanContribution",
        header: () => <div className="text-right">Kontribusi Pinjaman</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.getValue("loanContribution"))}</div>,
    },
    {
        accessorKey: "percentage",
        header: () => <div className="text-right">%</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{Number(row.getValue("percentage")).toFixed(2)}%</div>,
    },
    {
        accessorKey: "shuAmount",
        header: () => <div className="text-right">SHU</div>,
        cell: ({ row }) => <div className="text-right tabular-nums font-bold text-emerald-600">{formatCurrency(row.getValue("shuAmount"))}</div>,
    },
];

export default function SHUCalculationPage() {
    const [selectedYear, setSelectedYear] = React.useState<string>("2025");
    const [shuData, setShuData] = React.useState<SHUCalculation | null>(null);
    const [memberSHU, setMemberSHU] = React.useState<MemberSHU[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isCalculating, setIsCalculating] = React.useState(false);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
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
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedYear]);

    // Handle calculation
    const handleCalculate = async () => {
        setIsCalculating(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            toast.success("Perhitungan SHU selesai");
        } catch (error) {
            toast.error("Gagal menghitung SHU");
        } finally {
            setIsCalculating(false);
        }
    };

    const fundDistribution = shuData && shuData.netSurplus > 0 ? [
        { name: "Dana Cadangan", amount: shuData.reserveFund, percentage: Number(((shuData.reserveFund/shuData.netSurplus)*100).toFixed(1)), color: "bg-blue-500" },
        { name: "Jasa Modal Anggota", amount: shuData.jasaModalPool, percentage: Number(((shuData.jasaModalPool/shuData.netSurplus)*100).toFixed(1)), color: "bg-emerald-400" },
        { name: "Jasa Usaha Anggota", amount: shuData.jasaUsahaPool, percentage: Number(((shuData.jasaUsahaPool/shuData.netSurplus)*100).toFixed(1)), color: "bg-emerald-600" },
        { name: "Dana Pengurus & Pengawas", amount: shuData.pengurusFund, percentage: Number(((shuData.pengurusFund/shuData.netSurplus)*100).toFixed(1)), color: "bg-indigo-500" },
        { name: "Kesejahteraan Karyawan", amount: shuData.employeeBonus, percentage: Number(((shuData.employeeBonus/shuData.netSurplus)*100).toFixed(1)), color: "bg-amber-500" },
        { name: "Dana Pendidikan", amount: shuData.educationFund, percentage: Number(((shuData.educationFund/shuData.netSurplus)*100).toFixed(1)), color: "bg-pink-500" },
        { name: "Dana Sosial", amount: shuData.socialFund, percentage: Number(((shuData.socialFund/shuData.netSurplus)*100).toFixed(1)), color: "bg-rose-500" },
    ] : [];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Perhitungan SHU"
                description="Sisa Hasil Usaha tahun buku"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                        <Button onClick={handleCalculate} disabled={isCalculating}>
                            {isCalculating ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Calculator className="mr-2 h-4 w-4" />
                            )}
                            Hitung SHU
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
                            </SelectContent>
                        </Select>
                        {shuData && (
                            <Badge variant={shuData.status === "distributed" ? "default" : shuData.status === "calculated" ? "secondary" : "outline"}>
                                {shuData.status === "distributed" ? "Sudah Dibagikan" : shuData.status === "calculated" ? "Sudah Dihitung" : "Draft"}
                            </Badge>
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
                                        <p className="text-sm text-muted-foreground">Total Biaya</p>
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
                                        <p className="text-sm text-muted-foreground">SHU Bersih</p>
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
                                        <p className="text-sm text-muted-foreground">Anggota</p>
                                        <p className="text-xl font-bold">{shuData.memberCount}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-indigo-100 p-3 dark:bg-indigo-900/30">
                                        <Users className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Surplus Anggota</p>
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
                                        <p className="text-sm text-muted-foreground">Surplus Bukan Anggota</p>
                                        <p className="text-xl font-bold tabular-nums text-orange-600">
                                            {formatCurrency(shuData.nonMemberSurplus)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Distribution Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <PieChart className="h-5 w-5" />
                                Pembagian SHU
                            </CardTitle>
                            <CardDescription>
                                Alokasi SHU sesuai ketentuan koperasi
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {fundDistribution.map((fund) => (
                                    <div key={fund.name} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>{fund.name} ({fund.percentage}%)</span>
                                            <span className="font-bold tabular-nums">
                                                {formatCurrency(fund.amount)}
                                            </span>
                                        </div>
                                        <Progress value={fund.percentage} className={fund.color} />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Member SHU Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Pembagian Jasa Anggota</CardTitle>
                            <CardDescription>
                                Total: {formatCurrency(shuData.memberDividend)} untuk {shuData.memberCount} anggota
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
