"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    reserveFund: number;        // 20%
    educationFund: number;      // 5%
    employeeBonus: number;      // 10%
    memberDividend: number;     // 40%
    developmentFund: number;    // 25%
    memberCount: number;
    distributedAt?: string;
}

interface MemberSHU {
    id: number;
    memberNo: string;
    name: string;
    savingsContribution: number;
    loanContribution: number;
    totalContribution: number;
    shuAmount: number;
    percentage: number;
}

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
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                setShuData({
                    year: Number(selectedYear),
                    status: "calculated",
                    totalIncome: 850000000,
                    totalExpense: 450000000,
                    netSurplus: 400000000,
                    reserveFund: 80000000,      // 20%
                    educationFund: 20000000,    // 5%
                    employeeBonus: 40000000,    // 10%
                    memberDividend: 160000000,  // 40%
                    developmentFund: 100000000, // 25%
                    memberCount: 250,
                    distributedAt: undefined,
                });

                // Mock member SHU
                setMemberSHU([
                    { id: 1, memberNo: "A-001", name: "Ahmad Sudrajat", savingsContribution: 5000000, loanContribution: 10000000, totalContribution: 15000000, shuAmount: 2500000, percentage: 1.56 },
                    { id: 2, memberNo: "A-002", name: "Budi Santoso", savingsContribution: 3500000, loanContribution: 8000000, totalContribution: 11500000, shuAmount: 1850000, percentage: 1.16 },
                    { id: 3, memberNo: "A-003", name: "Citra Dewi", savingsContribution: 4200000, loanContribution: 5000000, totalContribution: 9200000, shuAmount: 1480000, percentage: 0.93 },
                    { id: 4, memberNo: "A-004", name: "Dian Pratama", savingsContribution: 2800000, loanContribution: 12000000, totalContribution: 14800000, shuAmount: 2380000, percentage: 1.49 },
                    { id: 5, memberNo: "A-005", name: "Eko Wijaya", savingsContribution: 6000000, loanContribution: 7500000, totalContribution: 13500000, shuAmount: 2170000, percentage: 1.36 },
                ]);
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

    const fundDistribution = shuData ? [
        { name: "Dana Cadangan", amount: shuData.reserveFund, percentage: 20, color: "bg-blue-500" },
        { name: "Jasa Anggota", amount: shuData.memberDividend, percentage: 40, color: "bg-emerald-500" },
        { name: "Dana Pengembangan", amount: shuData.developmentFund, percentage: 25, color: "bg-purple-500" },
        { name: "Bonus Karyawan", amount: shuData.employeeBonus, percentage: 10, color: "bg-amber-500" },
        { name: "Dana Pendidikan", amount: shuData.educationFund, percentage: 5, color: "bg-pink-500" },
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
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No. Anggota</TableHead>
                                        <TableHead>Nama</TableHead>
                                        <TableHead className="text-right">Kontribusi Simpanan</TableHead>
                                        <TableHead className="text-right">Kontribusi Pinjaman</TableHead>
                                        <TableHead className="text-right">%</TableHead>
                                        <TableHead className="text-right">SHU</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {memberSHU.map((member) => (
                                        <TableRow key={member.id}>
                                            <TableCell className="font-mono text-sm">{member.memberNo}</TableCell>
                                            <TableCell className="font-medium">{member.name}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(member.savingsContribution)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(member.loanContribution)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {member.percentage.toFixed(2)}%
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-bold text-emerald-600">
                                                {formatCurrency(member.shuAmount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
