"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Banknote,
    Users,
    CheckCircle,
    Clock,
    Download,
    Play,
    Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface MemberDistribution {
    id: number;
    memberNo: string;
    name: string;
    shuAmount: number;
    status: "pending" | "distributed" | "transferred";
    distributedAt?: string;
    transferReference?: string;
}

const columns: ColumnDef<MemberDistribution>[] = [
    {
        accessorKey: "memberNo",
        header: "NRP",
        cell: ({ row }) => (
            <span className="font-mono text-sm">{row.getValue("memberNo")}</span>
        ),
    },
    {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => (
            <span className="font-medium">{row.getValue("name")}</span>
        ),
    },
    {
        accessorKey: "shuAmount",
        header: "Jumlah SHU",
        cell: ({ row }) => (
            <span className="font-bold tabular-nums text-emerald-600">
                {formatCurrency(row.getValue("shuAmount"))}
            </span>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
                pending: { label: "Menunggu", variant: "outline" },
                distributed: { label: "Dibagikan", variant: "secondary" },
                transferred: { label: "Ditransfer", variant: "default" },
            };
            const { label, variant } = config[status] || config.pending;
            return <Badge variant={variant}>{label}</Badge>;
        },
    },
    {
        accessorKey: "distributedAt",
        header: "Tanggal Distribusi",
        cell: ({ row }) => {
            const date = row.getValue("distributedAt") as string;
            return date ? new Date(date).toLocaleDateString("id-ID") : "-";
        },
    },
];

export default function SHUDistributionPage() {
    const now = new Date();
    const [selectedYear, setSelectedYear] = React.useState<string>(String(now.getFullYear()));
    const [data, setData] = React.useState<MemberDistribution[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const yearOptions = React.useMemo(() => {
        const years: string[] = [];
        for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
            years.push(String(y));
        }
        return years;
    }, []);

    // Stats
    const stats = React.useMemo(() => {
        return {
            totalMembers: data.length,
            totalAmount: data.reduce((sum, d) => sum + d.shuAmount, 0),
            distributed: data.filter(d => d.status !== "pending").length,
            pending: data.filter(d => d.status === "pending").length,
        };
    }, [data]);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/reports/shu/calculate?year=${selectedYear}`);
                if (!res.ok) throw new Error("Gagal mengambil data SHU anggota");
                const json = await res.json();
                
                if (json.data && json.data.memberSHU) {
                    const distributionFormat = json.data.memberSHU.map((m: any) => ({
                        id: m.id,
                        memberNo: m.memberNo,
                        name: m.name,
                        shuAmount: m.shuAmount,
                        status: "pending"
                    }));
                    setData(distributionFormat);
                }
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedYear]);

    // Handle distribution
    const handleDistribute = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch('/api/reports/shu/distribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year: selectedYear })
            });
            const result = await res.json();
            
            if (!res.ok) {
                throw new Error(result.error || "Gagal memproses distribusi");
            }
            
            toast.success("SHU berhasil dikunci dan distribusikan");
            // Refresh data setelah berhasil
            if (typeof window !== 'undefined') window.location.reload();
        } catch (error: any) {
            toast.error(error.message || "Gagal memproses distribusi");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Distribusi SHU"
                description="Pembagian SHU kepada anggota"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                        <Button onClick={handleDistribute} disabled={isProcessing || stats.pending === 0}>
                            {isProcessing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Play className="mr-2 h-4 w-4" />
                            )}
                            Proses Distribusi
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
                                {yearOptions.map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

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
                            <Banknote className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total SHU</p>
                            <p className="text-lg font-bold tabular-nums">
                                {formatCurrency(stats.totalAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Sudah Dibagikan</p>
                            <p className="text-2xl font-bold">{stats.distributed}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Menunggu</p>
                            <p className="text-2xl font-bold">{stats.pending}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={data}
                    searchColumn="name"
                    searchPlaceholder="Cari anggota..."
                />
            )}
        </div>
    );
}
