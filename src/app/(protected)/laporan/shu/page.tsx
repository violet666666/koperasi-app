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
import { Download, Printer, PieChart, Users, Percent, CalendarDays } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/patterns/data-table";
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
    purchaseContribution: number;
    totalContribution: number;
    shuShare: number;
}

interface IncomeExpenseDetail {
    code: string;
    name: string;
    amount: number;
}

interface SHUData {
    totalShu: number;
    totalIncome: number;
    totalExpense: number;
    memberNetIncome: number;
    nonMemberNetIncome: number;
    period: string;
    month: number; // 0 = all months
    periodLabel: string;
    allocationsMember: SHUAllocation[];
    allocationsNonMember: SHUAllocation[];
    incomeDetails: IncomeExpenseDetail[];
    expenseDetails: IncomeExpenseDetail[];
    memberShu: MemberSHU[];
    memberSharePercent: number;
}

const MONTHS = [
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
];

const columns: ColumnDef<MemberSHU>[] = [
    {
        accessorKey: "memberNo",
        header: "NRP",
        cell: ({ row }) => <span className="font-mono">{row.getValue("memberNo")}</span>,
    },
    {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
        accessorKey: "savingsContribution",
        header: () => <div className="text-right">Simpanan</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.getValue("savingsContribution"))}</div>,
    },
    {
        accessorKey: "loanContribution",
        header: () => <div className="text-right">Pinjaman</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.getValue("loanContribution"))}</div>,
    },
    {
        accessorKey: "purchaseContribution",
        header: () => <div className="text-right">Belanja</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.getValue("purchaseContribution"))}</div>,
    },
    {
        accessorKey: "totalContribution",
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.getValue("totalContribution"))}</div>,
    },
    {
        accessorKey: "shuShare",
        header: () => <div className="text-right font-bold">SHU</div>,
        cell: ({ row }) => <div className="text-right tabular-nums font-bold text-emerald-600">{formatCurrency(row.getValue("shuShare"))}</div>,
    },
];

export default function LaporanSHUPage() {
    const now = new Date();
    const [selectedYear, setSelectedYear] = React.useState(String(now.getFullYear()));
    const [selectedMonth, setSelectedMonth] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [data, setData] = React.useState<SHUData | null>(null);

    // Dynamic year options: 5 years back to 1 year forward
    const yearOptions = React.useMemo(() => {
        const years: string[] = [];
        for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
            years.push(String(y));
        }
        return years;
    }, []);

    // Fetch SHU data from API
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const params: { year: number; month?: number } = { year: parseInt(selectedYear) };
                if (selectedMonth !== "all") {
                    params.month = parseInt(selectedMonth);
                }
                const response = await reportsApi.shu(params);
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
    }, [selectedYear, selectedMonth]);

    const totalMemberContribution = data?.memberShu?.reduce((sum, m) => sum + m.totalContribution, 0) || 0;
    const totalMemberShuShare = data?.memberShu?.reduce((sum, m) => sum + m.shuShare, 0) || 0;

    // Computed period display label
    const periodDisplay = data?.periodLabel
        || (selectedMonth !== "all"
            ? `${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
            : `Tahun ${selectedYear}`);

    const isMonthlyView = selectedMonth !== "all";

    return (
        <div className="space-y-6">
            <PageHeader
                title="Laporan SHU"
                description="Sisa Hasil Usaha dan pembagian ke anggota"
                backHref="/laporan"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.print()}>
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
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>Filter Periode:</span>
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Pilih tahun" />
                    </SelectTrigger>
                    <SelectContent>
                        {yearOptions.map(y => (
                            <SelectItem key={y} value={y}>Tahun {y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Semua Bulan" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Bulan</SelectItem>
                        {MONTHS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {isMonthlyView && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        Proyeksi Bulanan
                    </span>
                )}
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
                                        <p className="text-sm text-muted-foreground">
                                            {isMonthlyView ? "Proyeksi SHU" : "Total SHU"} {periodDisplay}
                                        </p>
                                        <p className="text-3xl font-bold tabular-nums">{formatCurrency(data.totalShu)}</p>
                                        {isMonthlyView && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                ⚠ SHU resmi dibagi setahun sekali saat RAT. Ini adalah proyeksi perbulan.
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-primary">{data.memberShu?.length || 0}</p>
                                        <p className="text-sm text-muted-foreground">Anggota</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-emerald-600">{data.memberSharePercent || 50}%</p>
                                        <p className="text-sm text-muted-foreground">Untuk Anggota</p>
                                    </div>
                                </div>
                            </div>
                            {/* Detailed Net Income split */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Pendapatan</p>
                                    <p className="text-xl font-semibold text-emerald-600">{formatCurrency(data.totalIncome || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Beban</p>
                                    <p className="text-xl font-semibold text-red-600">{formatCurrency(data.totalExpense || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">SHU dari Anggota (80%)</p>
                                    <p className="text-xl font-semibold">{formatCurrency(data.memberNetIncome)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">SHU dari Non-Anggota (20%)</p>
                                    <p className="text-xl font-semibold">{formatCurrency(data.nonMemberNetIncome)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Income & Expense Breakdown */}
                    {((data.incomeDetails && data.incomeDetails.length > 0) || (data.expenseDetails && data.expenseDetails.length > 0)) && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {data.incomeDetails && data.incomeDetails.length > 0 && (
                                <Card className="border-emerald-200">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base text-emerald-700">📈 Rincian Pendapatan — {periodDisplay}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {data.incomeDetails.map((item) => (
                                                <div key={item.code} className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">{item.code} — {item.name}</span>
                                                    <span className="font-medium tabular-nums text-emerald-600">{formatCurrency(item.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            {data.expenseDetails && data.expenseDetails.length > 0 && (
                                <Card className="border-red-200">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base text-red-700">📉 Rincian Beban — {periodDisplay}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {data.expenseDetails.map((item) => (
                                                <div key={item.code} className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">{item.code} — {item.name}</span>
                                                    <span className="font-medium tabular-nums text-red-600">{formatCurrency(item.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* Allocation Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Percent className="h-5 w-5" />
                                Pembagian SHU dari Anggota
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
                                        {data.allocationsMember?.length > 0 ? (
                                            data.allocationsMember.map((alloc) => (
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
                                                    Tidak ada data alokasi anggota
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Allocation Table Non-Member */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Percent className="h-5 w-5" />
                                Pembagian SHU dari Non-Anggota
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
                                        {data.allocationsNonMember?.length > 0 ? (
                                            data.allocationsNonMember.map((alloc) => (
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
                                                    Tidak ada data alokasi non-anggota
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
                                Pembagian SHU Anggota — {periodDisplay}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Jasa anggota sebesar <strong>{formatCurrency(totalMemberShuShare)}</strong> dibagikan berdasarkan kontribusi simpanan dan pinjaman anggota aktif (Total Nilai Poin Transaksi: <strong>{formatCurrency(totalMemberContribution)}</strong>).
                                {isMonthlyView && <span className="text-blue-600"> Proporsi dihitung berdasarkan data {periodDisplay}.</span>}
                            </p>
                            <DataTable
                                columns={columns}
                                data={data.memberShu || []}
                                searchColumn="name"
                                searchPlaceholder="Cari anggota berdasarkan nama..."
                            />
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
