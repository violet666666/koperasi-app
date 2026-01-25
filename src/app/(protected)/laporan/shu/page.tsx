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
import { formatCurrency } from "@/lib/constants";
import { reportsApi } from "@/lib/api";

interface SHUAllocation {
    category: string;
    percentage: number;
    amount: number;
    description: string;
}

interface MemberSHU {
    memberNo: string;
    name: string;
    savingsContribution: number;
    loanContribution: number;
    totalContribution: number;
    shuShare: number;
}

interface SHUData {
    totalShu: number;
    period: string;
    allocations: SHUAllocation[];
    memberShu: MemberSHU[];
    memberSharePercent: number;
}

export default function LaporanSHUPage() {
    const [period, setPeriod] = React.useState("2024");
    const [isLoading, setIsLoading] = React.useState(true);
    const [data, setData] = React.useState<SHUData | null>(null);

    // Fetch SHU data from API
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const response = await reportsApi.shu({ year: parseInt(period) });
                const reportData = response.data as unknown as SHUData;
                setData(reportData);
            } catch (error) {
                console.error("Failed to fetch SHU data:", error);
                setData(null);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [period]);

    const totalMemberContribution = data?.memberShu?.reduce((sum, m) => sum + m.totalContribution, 0) || 0;
    const totalMemberShuShare = data?.memberShu?.reduce((sum, m) => sum + m.shuShare, 0) || 0;

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
            ) : data ? (
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
                                        <p className="text-3xl font-bold tabular-nums">{formatCurrency(data.totalShu)}</p>
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-primary">{data.memberShu?.length || 0}</p>
                                        <p className="text-sm text-muted-foreground">Anggota</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-emerald-600">{data.memberSharePercent || 30}%</p>
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
                                        {data.allocations?.length > 0 ? (
                                            data.allocations.map((alloc) => (
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
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                    Tidak ada data alokasi
                                                </TableCell>
                                            </TableRow>
                                        )}
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
                                Jasa anggota sebesar {formatCurrency(totalMemberShuShare)} dibagikan berdasarkan kontribusi simpanan dan pinjaman.
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
                                        {data.memberShu?.length > 0 ? (
                                            <>
                                                {data.memberShu.map((member) => (
                                                    <TableRow key={member.memberNo}>
                                                        <TableCell className="font-mono">{member.memberNo}</TableCell>
                                                        <TableCell className="font-medium">{member.name}</TableCell>
                                                        <TableCell className="text-right tabular-nums">{formatCurrency(member.savingsContribution)}</TableCell>
                                                        <TableCell className="text-right tabular-nums">{formatCurrency(member.loanContribution)}</TableCell>
                                                        <TableCell className="text-right tabular-nums">{formatCurrency(member.totalContribution)}</TableCell>
                                                        <TableCell className="text-right tabular-nums font-bold text-emerald-600">
                                                            {formatCurrency(member.shuShare)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="bg-muted/50">
                                                    <TableCell colSpan={4} className="font-bold">TOTAL</TableCell>
                                                    <TableCell className="text-right tabular-nums font-bold">{formatCurrency(totalMemberContribution)}</TableCell>
                                                    <TableCell className="text-right tabular-nums font-bold text-emerald-600">
                                                        {formatCurrency(totalMemberShuShare)}
                                                    </TableCell>
                                                </TableRow>
                                            </>
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                    Tidak ada data SHU anggota
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    Tidak ada data SHU untuk periode ini
                </div>
            )}
        </div>
    );
}
