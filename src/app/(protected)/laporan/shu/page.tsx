"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Download, Printer, PieChart, Users, Percent } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/constants";

interface SHUAllocation {
    category: string;
    percentage: number;
    amount: number;
    description: string;
}

interface MemberSHU {
    member_no: string;
    name: string;
    savings_contribution: number;
    loan_contribution: number;
    total_contribution: number;
    shu_share: number;
}

// Mock data
const MOCK_SHU_DATA = {
    total_shu: 50000000,
    period: "2024",
    allocations: [
        { category: "Cadangan Umum", percentage: 40, amount: 20000000, description: "Untuk penguatan modal koperasi" },
        { category: "Jasa Anggota", percentage: 30, amount: 15000000, description: "Dibagikan ke anggota berdasarkan kontribusi" },
        { category: "Dana Pengurus", percentage: 10, amount: 5000000, description: "Untuk pengurus koperasi" },
        { category: "Dana Pengawas", percentage: 5, amount: 2500000, description: "Untuk pengawas koperasi" },
        { category: "Dana Pendidikan", percentage: 5, amount: 2500000, description: "Untuk pelatihan anggota" },
        { category: "Dana Sosial", percentage: 5, amount: 2500000, description: "Untuk kegiatan sosial" },
        { category: "Dana Pembangunan", percentage: 5, amount: 2500000, description: "Untuk pengembangan koperasi" },
    ] as SHUAllocation[],
    member_shu: [
        { member_no: "A-001", name: "Budi Santoso", savings_contribution: 5000000, loan_contribution: 2000000, total_contribution: 7000000, shu_share: 1050000 },
        { member_no: "A-002", name: "Siti Aminah", savings_contribution: 8000000, loan_contribution: 5000000, total_contribution: 13000000, shu_share: 1950000 },
        { member_no: "A-003", name: "Joko Widodo", savings_contribution: 3000000, loan_contribution: 1000000, total_contribution: 4000000, shu_share: 600000 },
        { member_no: "A-004", name: "Dewi Lestari", savings_contribution: 6000000, loan_contribution: 3000000, total_contribution: 9000000, shu_share: 1350000 },
        { member_no: "A-005", name: "Ahmad Ridwan", savings_contribution: 10000000, loan_contribution: 8000000, total_contribution: 18000000, shu_share: 2700000 },
    ] as MemberSHU[],
};

export default function LaporanSHUPage() {
    const [period, setPeriod] = React.useState("2024");
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, [period]);

    const totalMemberContribution = MOCK_SHU_DATA.member_shu.reduce((sum, m) => sum + m.total_contribution, 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Laporan SHU"
                description="Sisa Hasil Usaha dan pembagian ke anggota"
                backHref="/laporan"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Printer className="mr-2 h-4 w-4" />
                            Cetak
                        </Button>
                        <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                    </div>
                }
            />

            {/* Period Selector */}
            <div className="flex items-center gap-4">
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Pilih tahun" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="2024">Tahun 2024</SelectItem>
                        <SelectItem value="2023">Tahun 2023</SelectItem>
                        <SelectItem value="2022">Tahun 2022</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-64" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* SHU Summary */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-lg bg-primary/10 p-4 text-primary">
                                        <PieChart className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total SHU Tahun {period}</p>
                                        <p className="text-3xl font-bold tabular-nums">{formatCurrency(MOCK_SHU_DATA.total_shu)}</p>
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-primary">{MOCK_SHU_DATA.member_shu.length}</p>
                                        <p className="text-sm text-muted-foreground">Anggota</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-emerald-600">30%</p>
                                        <p className="text-sm text-muted-foreground">Untuk Anggota</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Allocation Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Percent className="h-5 w-5" />
                                Pembagian SHU
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead className="w-24">Persentase</TableHead>
                                            <TableHead className="text-right w-40">Jumlah</TableHead>
                                            <TableHead className="hidden sm:table-cell">Keterangan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {MOCK_SHU_DATA.allocations.map((alloc) => (
                                            <TableRow key={alloc.category}>
                                                <TableCell className="font-medium">{alloc.category}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={alloc.percentage} className="h-2 w-16" />
                                                        <span className="text-sm tabular-nums">{alloc.percentage}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">
                                                    {formatCurrency(alloc.amount)}
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                                                    {alloc.description}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Member SHU Distribution */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Pembagian SHU Anggota
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Jasa anggota sebesar {formatCurrency(15000000)} dibagikan berdasarkan kontribusi simpanan dan pinjaman.
                            </p>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No. Anggota</TableHead>
                                            <TableHead>Nama</TableHead>
                                            <TableHead className="text-right">Simpanan</TableHead>
                                            <TableHead className="text-right">Pinjaman</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">SHU</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {MOCK_SHU_DATA.member_shu.map((member) => (
                                            <TableRow key={member.member_no}>
                                                <TableCell className="font-mono">{member.member_no}</TableCell>
                                                <TableCell className="font-medium">{member.name}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatCurrency(member.savings_contribution)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatCurrency(member.loan_contribution)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatCurrency(member.total_contribution)}</TableCell>
                                                <TableCell className="text-right tabular-nums font-bold text-emerald-600">
                                                    {formatCurrency(member.shu_share)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-muted/50">
                                            <TableCell colSpan={4} className="font-bold">TOTAL</TableCell>
                                            <TableCell className="text-right tabular-nums font-bold">{formatCurrency(totalMemberContribution)}</TableCell>
                                            <TableCell className="text-right tabular-nums font-bold text-emerald-600">
                                                {formatCurrency(MOCK_SHU_DATA.member_shu.reduce((sum, m) => sum + m.shu_share, 0))}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
