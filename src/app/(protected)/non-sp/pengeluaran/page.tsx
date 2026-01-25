"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    Plus,
    ArrowDownCircle,
    TrendingDown,
    Receipt,
    Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface NonSPTransaction {
    id: number;
    transactionNo: string;
    transactionDate: string;
    category: string;
    description: string;
    amount: number;
    paymentMethod: string;
    createdBy: { id: number; name: string };
}

const EXPENSE_CATEGORIES: Record<string, string> = {
    operational: "Biaya Operasional",
    salary: "Gaji Karyawan",
    utility: "Listrik/Air/Telepon",
    rent: "Sewa Gedung",
    maintenance: "Pemeliharaan",
    supplies: "Perlengkapan Kantor",
    marketing: "Promosi & Pemasaran",
    other_expense: "Biaya Lain-lain",
};

const columns: ColumnDef<NonSPTransaction>[] = [
    {
        accessorKey: "transactionDate",
        header: "Tanggal",
        cell: ({ row }) => new Date(row.getValue("transactionDate")).toLocaleDateString("id-ID"),
    },
    {
        accessorKey: "transactionNo",
        header: "No. Transaksi",
        cell: ({ row }) => (
            <span className="font-mono text-sm">{row.getValue("transactionNo")}</span>
        ),
    },
    {
        accessorKey: "category",
        header: "Kategori",
        cell: ({ row }) => (
            <Badge variant="outline">
                {EXPENSE_CATEGORIES[row.getValue("category") as string] || row.getValue("category")}
            </Badge>
        ),
    },
    {
        accessorKey: "description",
        header: "Keterangan",
        cell: ({ row }) => (
            <div className="max-w-xs truncate">{row.getValue("description")}</div>
        ),
    },
    {
        accessorKey: "amount",
        header: "Jumlah",
        cell: ({ row }) => (
            <span className="font-bold tabular-nums text-red-600">
                -{formatCurrency(row.getValue("amount"))}
            </span>
        ),
    },
    {
        accessorKey: "paymentMethod",
        header: "Metode",
        cell: ({ row }) => {
            const method = row.getValue("paymentMethod") as string;
            return method === "cash" ? "Tunai" : "Transfer";
        },
    },
];

export default function PengeluaranNonSPPage() {
    const [data, setData] = React.useState<NonSPTransaction[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Form state
    const [formData, setFormData] = React.useState({
        category: "",
        amount: "",
        description: "",
        paymentMethod: "cash",
    });

    // Stats
    const stats = React.useMemo(() => {
        const today = new Date().toDateString();
        return {
            total: data.length,
            totalAmount: data.reduce((sum, d) => sum + d.amount, 0),
            todayAmount: data
                .filter(d => new Date(d.transactionDate).toDateString() === today)
                .reduce((sum, d) => sum + d.amount, 0),
        };
    }, [data]);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                const mockData: NonSPTransaction[] = [
                    {
                        id: 1,
                        transactionNo: "PKL-2026-00001",
                        transactionDate: "2026-01-25",
                        category: "utility",
                        description: "Pembayaran listrik bulan Januari",
                        amount: 2500000,
                        paymentMethod: "transfer",
                        createdBy: { id: 1, name: "Admin" },
                    },
                    {
                        id: 2,
                        transactionNo: "PKL-2026-00002",
                        transactionDate: "2026-01-24",
                        category: "supplies",
                        description: "Pembelian ATK",
                        amount: 750000,
                        paymentMethod: "cash",
                        createdBy: { id: 1, name: "Admin" },
                    },
                    {
                        id: 3,
                        transactionNo: "PKL-2026-00003",
                        transactionDate: "2026-01-24",
                        category: "maintenance",
                        description: "Service AC kantor",
                        amount: 500000,
                        paymentMethod: "cash",
                        createdBy: { id: 1, name: "Admin" },
                    },
                ];

                setData(mockData);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Handle submit
    const handleSubmit = async () => {
        if (!formData.category || !formData.amount) {
            toast.error("Lengkapi data pengeluaran");
            return;
        }

        setIsSubmitting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Pengeluaran berhasil dicatat");
            setDialogOpen(false);
            setFormData({ category: "", amount: "", description: "", paymentMethod: "cash" });
        } catch (error) {
            toast.error("Gagal mencatat pengeluaran");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pengeluaran Non S/P"
                description="Biaya di luar simpan pinjam"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Pengeluaran
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Pengeluaran Baru</DialogTitle>
                                <DialogDescription>
                                    Catat pengeluaran non simpan pinjam
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div>
                                    <Label>Kategori</Label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih kategori" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Jumlah</Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>Metode Pembayaran</Label>
                                    <Select
                                        value={formData.paymentMethod}
                                        onValueChange={(v) => setFormData(prev => ({ ...prev, paymentMethod: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Tunai</SelectItem>
                                            <SelectItem value="transfer">Transfer Bank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Keterangan</Label>
                                    <Textarea
                                        placeholder="Deskripsi pengeluaran"
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Batal
                                </Button>
                                <Button onClick={handleSubmit} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Receipt className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Transaksi</p>
                            <p className="text-2xl font-bold">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <ArrowDownCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Hari Ini</p>
                            <p className="text-xl font-bold tabular-nums text-red-600">
                                -{formatCurrency(stats.todayAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <TrendingDown className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
                            <p className="text-xl font-bold tabular-nums">
                                {formatCurrency(stats.totalAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={data}
                    searchColumn="description"
                    searchPlaceholder="Cari transaksi..."
                />
            )}
        </div>
    );
}
