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
    month: number;
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
        header: () => <div className="text-right">Total Kontribusi</div>,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.getValue("totalContribution"))}</div>,
    },
    {
        accessorKey: "shuShare",
        header: () => <div className="text-right font-bold">SHU Diterima</div>,
        cell: ({ row }) => <div className="text-right tabular-nums font-bold text-emerald-600">{formatCurrency(row.getValue("shuShare"))}</div>,
    },
];

export default function LaporanSHUPage() {
    const now = new Date();
    const [selectedYear, setSelectedYear] = React.useState(String(now.getFullYear()));
    const [selectedMonth, setSelectedMonth] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [data, setData] = React.useState<SHUData | null>(null);

    const yearOptions = React.useMemo(() => {
        const years: string[] = [];
        for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
            years.push(String(y));
        }
        return years;
    }, []);

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

    const periodDisplay = data?.periodLabel
        || (selectedMonth !== "all"
            ? `${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
            : `Tahun ${selectedYear}`);

    const isMonthlyView = selectedMonth !== "all";

    return (
        <div className="space-y-6">
            {/* ===== PRINT HEADER — only visible when printing ===== */}
            <div className="hidden print:flex items-center gap-5 mb-6">
                <div className="bg-slate-900 rounded-full flex items-center justify-center flex-shrink-0" style={{ width: "100px", height: "100px", padding: "10px" }}>
                    <img src="/LogoPrimkoppol.png" alt="Logo Primkoppol" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-black">LAPORAN SHU (SISA HASIL USAHA)</h1>
                    <h2 className="text-lg font-bold text-black">PRIMKOPPOL RESOR LUMAJANG</h2>
                    <p className="text-sm font-medium text-black mt-1">Periode: {periodDisplay}</p>
                    {isMonthlyView && (
                        <p className="text-xs text-gray-600 mt-0.5">⚠ Proyeksi Bulanan — SHU resmi dibagi setahun sekali saat RAT</p>
                    )}
                </div>
            </div>

            {/* ===== SCREEN HEADER — hidden when printing ===== */}
            <div className="print:hidden">
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
            </div>

            {/* Period Selector — hidden when printing */}
            <div className="print:hidden flex flex-wrap items-center gap-3">
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
                    <Card className="print:border print:border-gray-300 print:shadow-none">
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-lg bg-primary/10 p-4 text-primary print:hidden">
                                        <PieChart className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            {isMonthlyView ? "Proyeksi SHU" : "Total SHU"} {periodDisplay}
                                        </p>
                                        <p className="text-3xl font-bold tabular-nums">{formatCurrency(data.totalShu)}</p>
                                        {isMonthlyView && (
                                            <p className="text-xs text-muted-foreground mt-1 print:block">
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
                                <Card className="border-emerald-200 print:border-gray-300 print:shadow-none">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base text-emerald-700 print:text-black">📈 Rincian Pendapatan — {periodDisplay}</CardTitle>
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
                                <Card className="border-red-200 print:border-gray-300 print:shadow-none">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base text-red-700 print:text-black">📉 Rincian Beban — {periodDisplay}</CardTitle>
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
                    <Card className="print:border print:border-gray-300 print:shadow-none">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Percent className="h-5 w-5 print:hidden" />
                                Pembagian SHU dari Anggota
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border print:border-gray-300">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead className="w-24">Persentase</TableHead>
                                            <TableHead className="text-right w-40">Jumlah</TableHead>
                                            <TableHead>Keterangan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.allocationsMember?.length > 0 ? (
                                            data.allocationsMember.map((alloc) => (
                                                <TableRow key={alloc.category}>
                                                    <TableCell className="font-medium">{alloc.category}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={alloc.percentage} className="h-2 w-16 print:hidden" />
                                                            <span className="text-sm tabular-nums">{alloc.percentage}%</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-medium">
                                                        {formatCurrency(alloc.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
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
                    <Card className="print:border print:border-gray-300 print:shadow-none">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Percent className="h-5 w-5 print:hidden" />
                                Pembagian SHU dari Non-Anggota
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border print:border-gray-300">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead className="w-24">Persentase</TableHead>
                                            <TableHead className="text-right w-40">Jumlah</TableHead>
                                            <TableHead>Keterangan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.allocationsNonMember?.length > 0 ? (
                                            data.allocationsNonMember.map((alloc) => (
                                                <TableRow key={alloc.category}>
                                                    <TableCell className="font-medium">{alloc.category}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={alloc.percentage} className="h-2 w-16 print:hidden" />
                                                            <span className="text-sm tabular-nums">{alloc.percentage}%</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-medium">
                                                        {formatCurrency(alloc.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
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
                    <Card className="print:border print:border-gray-300 print:shadow-none">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="h-5 w-5 print:hidden" />
                                Pembagian SHU Anggota — {periodDisplay}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Jasa anggota sebesar <strong>{formatCurrency(totalMemberShuShare)}</strong> dibagikan berdasarkan kontribusi simpanan dan pinjaman anggota aktif (Total Nilai Poin Transaksi: <strong>{formatCurrency(totalMemberContribution)}</strong>).
                                {isMonthlyView && <span className="text-blue-600"> Proporsi dihitung berdasarkan data {periodDisplay}.</span>}
                            </p>

                            {/* Screen view: DataTable with pagination */}
                            <div className="print:hidden">
                                <DataTable
                                    columns={columns}
                                    data={data.memberShu || []}
                                    searchColumn="name"
                                    searchPlaceholder="Cari anggota berdasarkan nama..."
                                />
                            </div>

                            {/* Print view: plain table, ALL rows, no pagination */}
                            <div className="hidden print:block">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-gray-400 bg-gray-100">
                                            <th className="text-left py-2 px-2 font-bold">No</th>
                                            <th className="text-left py-2 px-2 font-bold">NRP</th>
                                            <th className="text-left py-2 px-2 font-bold">Nama Anggota</th>
                                            <th className="text-right py-2 px-2 font-bold">Jasa Modal</th>
                                            <th className="text-right py-2 px-2 font-bold">Jasa Pelayanan</th>
                                            <th className="text-right py-2 px-2 font-bold">Total Kontribusi</th>
                                            <th className="text-right py-2 px-2 font-bold">SHU Diterima</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(data.memberShu || []).map((member, index) => (
                                            <tr key={member.memberNo} className={index % 2 === 0 ? "" : "bg-gray-50"} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                                <td className="py-1.5 px-2 text-gray-500">{index + 1}</td>
                                                <td className="py-1.5 px-2 font-mono text-xs">{member.memberNo}</td>
                                                <td className="py-1.5 px-2 font-medium">{member.name}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(member.savingsContribution)}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(member.loanContribution)}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(member.totalContribution)}</td>
                                                <td className="py-1.5 px-2 text-right tabular-nums font-bold">{formatCurrency(member.shuShare)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                                            <td colSpan={3} className="py-2 px-2 text-right">TOTAL</td>
                                            <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(data.memberShu?.reduce((s, m) => s + m.savingsContribution, 0) || 0)}</td>
                                            <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(data.memberShu?.reduce((s, m) => s + m.loanContribution, 0) || 0)}</td>
                                            <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(totalMemberContribution)}</td>
                                            <td className="py-2 px-2 text-right tabular-nums text-emerald-700">{formatCurrency(totalMemberShuShare)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                                <p className="text-xs text-gray-500 mt-3">
                                    Total anggota: {data.memberShu?.length || 0} orang | Dicetak: {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                                </p>
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
