"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Wallet,
    Search,
    Users,
    PiggyBank,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { ExportButton, formatCurrencyExport } from "@/components/patterns/export-button";

interface MemberSavingsRecap {
    id: number;
    memberNo: string;
    name: string;
    branchName: string;
    simpananPokok: number;
    simpananWajib: number;
    simpananSukarela: number;
    total: number;
}

export default function RekapSimpananPage() {
    const [data, setData] = React.useState<MemberSavingsRecap[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [debouncedSearch, setDebouncedSearch] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [totals, setTotals] = React.useState({
        totalPokok: 0,
        totalWajib: 0,
        totalSukarela: 0,
        grandTotal: 0,
    });
    const [totalMembers, setTotalMembers] = React.useState(0);

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch data from real API
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({
                    page: String(page),
                    perPage: "50",
                });
                if (debouncedSearch) params.set("search", debouncedSearch);

                const res = await fetch(`/api/reports/savings-recap/members?${params}`);
                if (!res.ok) throw new Error("Failed to fetch");
                const json = await res.json();

                setData(json.data || []);
                setTotalPages(json.meta?.totalPages || 1);
                setTotalMembers(json.meta?.total || 0);
                if (json.totals) setTotals(json.totals);
            } catch (error) {
                console.error("Failed to fetch recap:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [page, debouncedSearch]);

    // Also fetch grand totals (all members, not just current page)
    React.useEffect(() => {
        async function fetchGrandTotals() {
            try {
                const res = await fetch(`/api/reports/savings-recap/members?perPage=9999`);
                if (!res.ok) return;
                const json = await res.json();
                if (json.totals) setTotals(json.totals);
                setTotalMembers(json.meta?.total || 0);
            } catch {
                // Silent fail for totals
            }
        }
        if (!debouncedSearch) fetchGrandTotals();
    }, [debouncedSearch]);

    const exportColumns = [
        { key: "memberNo", header: "NRP" },
        { key: "name", header: "Nama" },
        { key: "branchName", header: "Cabang" },
        { key: "simpananPokok", header: "Simpanan Pokok", format: formatCurrencyExport },
        { key: "simpananWajib", header: "Simpanan Wajib (Tabungan Wajib)", format: formatCurrencyExport },
        { key: "simpananSukarela", header: "Simpanan Sukarela", format: formatCurrencyExport },
        { key: "total", header: "Total", format: formatCurrencyExport },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Rekap Simpanan"
                description="Rekap simpanan per anggota — data real dari database"
                actions={
                    <ExportButton
                        title="Rekap Simpanan Anggota"
                        filename="rekap_simpanan"
                        columns={exportColumns}
                        data={data}
                    />
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Anggota</p>
                            <p className="text-2xl font-bold">{totalMembers}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <PiggyBank className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Simpanan Pokok</p>
                            <p className="text-lg font-bold tabular-nums">
                                {formatCurrency(totals.totalPokok)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                            <Wallet className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Tabungan Wajib</p>
                            <p className="text-lg font-bold tabular-nums">
                                {formatCurrency(totals.totalWajib)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <TrendingUp className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Simpanan</p>
                            <p className="text-lg font-bold tabular-nums text-emerald-600">
                                {formatCurrency(totals.grandTotal)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari nama atau NRP anggota..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>NRP</TableHead>
                                            <TableHead>Nama</TableHead>
                                            <TableHead>Cabang</TableHead>
                                            <TableHead className="text-right">Simpanan Pokok</TableHead>
                                            <TableHead className="text-right">Tabungan Wajib</TableHead>
                                            <TableHead className="text-right">Simpanan Sukarela</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {row.memberNo}
                                                </TableCell>
                                                <TableCell className="font-medium">{row.name}</TableCell>
                                                <TableCell>{row.branchName}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatCurrency(row.simpananPokok)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {row.simpananWajib > 0 ? (
                                                        <span className="text-blue-600 font-medium">
                                                            {formatCurrency(row.simpananWajib)}
                                                        </span>
                                                    ) : (
                                                        formatCurrency(0)
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatCurrency(row.simpananSukarela)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums font-bold">
                                                    {formatCurrency(row.total)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {data.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                    Tidak ada data
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between p-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Halaman {page} dari {totalPages} ({totalMembers} anggota)
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page <= 1}
                                            onClick={() => setPage(p => p - 1)}
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page >= totalPages}
                                            onClick={() => setPage(p => p + 1)}
                                        >
                                            Next <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
