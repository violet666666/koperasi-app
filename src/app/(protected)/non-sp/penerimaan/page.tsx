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
    ArrowUpCircle,
    TrendingUp,
    Receipt,
    Calendar,
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

const INCOME_CATEGORIES: Record<string, string> = {
    admin_fee: "Biaya Administrasi",
    interest_income: "Pendapatan Bunga",
    rental_income: "Pendapatan Sewa",
    service_fee: "Pendapatan Jasa",
    other_income: "Pendapatan Lain-lain",
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
                {INCOME_CATEGORIES[row.getValue("category") as string] || row.getValue("category")}
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
            <span className="font-bold tabular-nums text-emerald-600">
                +{formatCurrency(row.getValue("amount"))}
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

export default function PenerimaanNonSPPage() {
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
                        transactionNo: "PNR-2026-00001",
                        transactionDate: "2026-01-25",
                        category: "admin_fee",
                        description: "Biaya admin pencairan pinjaman P-2026-001",
                        amount: 500000,
                        paymentMethod: "cash",
                        createdBy: { id: 1, name: "Admin" },
                    },
                    {
                        id: 2,
                        transactionNo: "PNR-2026-00002",
                        transactionDate: "2026-01-24",
                        category: "service_fee",
                        description: "Pendapatan jasa fotocopy",
                        amount: 150000,
                        paymentMethod: "cash",
                        createdBy: { id: 1, name: "Admin" },
                    },
                    {
                        id: 3,
                        transactionNo: "PNR-2026-00003",
                        transactionDate: "2026-01-24",
                        category: "other_income",
                        description: "Denda keterlambatan angsuran",
                        amount: 75000,
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
            toast.error("Lengkapi data penerimaan");
            return;
        }

        setIsSubmitting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Penerimaan berhasil dicatat");
            setDialogOpen(false);
            setFormData({ category: "", amount: "", description: "", paymentMethod: "cash" });
        } catch (error) {
            toast.error("Gagal mencatat penerimaan");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Penerimaan Non S/P"
                description="Pendapatan di luar simpan pinjam"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Penerimaan
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Penerimaan Baru</DialogTitle>
                                <DialogDescription>
                                    Catat pendapatan non simpan pinjam
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
                                            {Object.entries(INCOME_CATEGORIES).map(([key, label]) => (
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
                                        placeholder="Deskripsi penerimaan"
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
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Hari Ini</p>
                            <p className="text-xl font-bold tabular-nums text-emerald-600">
                                +{formatCurrency(stats.todayAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Penerimaan</p>
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
