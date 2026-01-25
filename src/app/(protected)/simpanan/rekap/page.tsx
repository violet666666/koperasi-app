"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
    Wallet,
    Search,
    Download,
    Users,
    PiggyBank,
    TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { membersApi, masterApi } from "@/lib/api/services";

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
    const [branchFilter, setBranchFilter] = React.useState<string>("all");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [branches, setBranches] = React.useState<{ id: number; name: string }[]>([]);

    // Stats
    const stats = React.useMemo(() => {
        return {
            totalMembers: data.length,
            totalPokok: data.reduce((sum, d) => sum + d.simpananPokok, 0),
            totalWajib: data.reduce((sum, d) => sum + d.simpananWajib, 0),
            totalSukarela: data.reduce((sum, d) => sum + d.simpananSukarela, 0),
            grandTotal: data.reduce((sum, d) => sum + d.total, 0),
        };
    }, [data]);

    // Filtered data
    const filteredData = React.useMemo(() => {
        return data.filter(d =>
            d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.memberNo.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [data, searchQuery]);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Fetch branches
                const branchRes = await masterApi.branches.list();
                setBranches((branchRes.data as any).data || []);

                // Fetch members
                const params = branchFilter !== "all" ? { branchId: Number(branchFilter) } : {};
                const membersRes = await membersApi.list(params);
                const members = (membersRes.data as any).data || [];

                // Simulate savings data for each member
                const recap: MemberSavingsRecap[] = members.map((member: any) => ({
                    id: member.id,
                    memberNo: member.memberNo,
                    name: member.name,
                    branchName: member.branch?.name || "-",
                    simpananPokok: Math.floor(Math.random() * 500000) + 100000,
                    simpananWajib: Math.floor(Math.random() * 2000000) + 500000,
                    simpananSukarela: Math.floor(Math.random() * 5000000),
                    total: 0,
                }));

                // Calculate totals
                recap.forEach(r => {
                    r.total = r.simpananPokok + r.simpananWajib + r.simpananSukarela;
                });

                setData(recap);
            } catch (error) {
                console.error("Failed to fetch recap:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [branchFilter]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Rekap Simpanan"
                description="Rekap simpanan per anggota"
                actions={
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
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
                            <p className="text-2xl font-bold">{stats.totalMembers}</p>
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
                                {formatCurrency(stats.totalPokok)}
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
                            <p className="text-sm text-muted-foreground">Simpanan Wajib</p>
                            <p className="text-lg font-bold tabular-nums">
                                {formatCurrency(stats.totalWajib)}
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
                                {formatCurrency(stats.grandTotal)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari anggota..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <Select value={branchFilter} onValueChange={setBranchFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter cabang" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Cabang</SelectItem>
                                {branches.map((branch) => (
                                    <SelectItem key={branch.id} value={String(branch.id)}>
                                        {branch.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No. Anggota</TableHead>
                                        <TableHead>Nama</TableHead>
                                        <TableHead>Cabang</TableHead>
                                        <TableHead className="text-right">Simpanan Pokok</TableHead>
                                        <TableHead className="text-right">Simpanan Wajib</TableHead>
                                        <TableHead className="text-right">Simpanan Sukarela</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((row) => (
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
                                                {formatCurrency(row.simpananWajib)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(row.simpananSukarela)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-bold">
                                                {formatCurrency(row.total)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredData.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                Tidak ada data
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
