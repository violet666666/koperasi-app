"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Package, AlertTriangle, Clock, History, Search, Loader2, XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface BatchRow {
    id: number;
    batchNo: string | null;
    productId: number;
    productName: string | null;
    productSku: string | null;
    productUnit: string | null;
    purchasePrice: number;
    quantity: number;
    originalQuantity: number;
    expiryDate: string | null;
    supplierName: string | null;
    location: string;
    isActive: boolean;
    notes: string | null;
    receivedAt: string;
    createdAt: string;
}

type ViewType = "active" | "expiring_soon" | "expired" | "all";

const viewTabs: { value: ViewType; label: string; icon: React.ElementType; color: string }[] = [
    { value: "active", label: "Batch Aktif", icon: Package, color: "text-green-600" },
    { value: "expiring_soon", label: "Hampir Expired", icon: Clock, color: "text-yellow-600" },
    { value: "expired", label: "Expired", icon: XCircle, color: "text-red-600" },
    { value: "all", label: "Semua", icon: History, color: "text-muted-foreground" },
];

function formatRupiah(amount: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function getExpiryBadge(expiryDate: string | null, isActive: boolean) {
    if (!expiryDate) return <Badge variant="secondary">Tanpa Expiry</Badge>;
    const now = Date.now();
    const exp = new Date(expiryDate).getTime();
    const days = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

    if (!isActive || days < 0) return <Badge variant="destructive">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-red-100 text-red-700">{days} hari lagi</Badge>;
    if (days <= 90) return <Badge className="bg-yellow-100 text-yellow-700">{days} hari lagi</Badge>;
    return <Badge className="bg-green-100 text-green-700">{days} hari lagi</Badge>;
}

export default function BatchPage() {
    const { data: session } = useSession();
    const unitType = session?.user?.unitType as string || "toko";

    const [view, setView] = React.useState<ViewType>("active");
    const [batches, setBatches] = React.useState<BatchRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [loading, setLoading] = React.useState(true);
    const [search, setSearch] = React.useState("");
    const [searchInput, setSearchInput] = React.useState("");

    const fetchBatches = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                view,
                unitType,
                page: String(page),
                limit: "50",
                ...(search ? { search } : {}),
            });
            const res = await fetch(`/api/toko/batches?${params}`);
            if (res.ok) {
                const json = await res.json();
                setBatches(json.data || []);
                setTotal(json.total || 0);
                setTotalPages(json.totalPages || 1);
            }
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    }, [view, unitType, page, search]);

    React.useEffect(() => {
        fetchBatches();
    }, [fetchBatches]);

    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1);
    };

    const totalValue = React.useMemo(
        () => batches.reduce((sum, b) => sum + b.purchasePrice * b.quantity, 0),
        [batches]
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Manajemen Batch"
                description="Lacak batch stok, nomor batch, tanggal kadaluarsa, dan nilai inventaris"
            />

            {/* View Tabs */}
            <div className="flex gap-2 flex-wrap">
                {viewTabs.map((tab) => (
                    <Button
                        key={tab.value}
                        variant={view === tab.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => { setView(tab.value); setPage(1); }}
                        className="gap-1.5"
                    >
                        <tab.icon className={`h-4 w-4 ${view !== tab.value ? tab.color : ""}`} />
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3"><Package className="h-5 w-5 text-blue-600" /></div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Batch</p>
                            <p className="text-2xl font-bold">{total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3"><Package className="h-5 w-5 text-emerald-600" /></div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Stok (unit)</p>
                            <p className="text-2xl font-bold">{batches.reduce((s, b) => s + b.quantity, 0)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-purple-100 p-3"><AlertTriangle className="h-5 w-5 text-purple-600" /></div>
                        <div>
                            <p className="text-sm text-muted-foreground">Nilai Inventaris</p>
                            <p className="text-2xl font-bold">{formatRupiah(totalValue)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="flex gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Cari produk, batch, supplier..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch}>Cari</Button>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : batches.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                    Tidak ada data batch untuk tampilan ini
                </div>
            ) : (
                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Batch No.</TableHead>
                                <TableHead>Produk</TableHead>
                                <TableHead>HPP</TableHead>
                                <TableHead className="text-center">Stok / Awal</TableHead>
                                <TableHead>Lokasi</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Diterima</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {batches.map((b) => (
                                <TableRow key={b.id} className={!b.isActive ? "opacity-60" : ""}>
                                    <TableCell className="font-mono text-xs">
                                        {b.batchNo || `#${b.id}`}
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium text-sm">{b.productName || "-"}</p>
                                            <p className="text-xs text-muted-foreground">{b.productSku}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{formatRupiah(b.purchasePrice)}</TableCell>
                                    <TableCell className="text-center text-sm">
                                        <span className="font-medium">{b.quantity}</span>
                                        <span className="text-muted-foreground"> / {b.originalQuantity}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs capitalize">{b.location}</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">{b.supplierName || "-"}</TableCell>
                                    <TableCell>
                                        {b.expiryDate
                                            ? <div className="text-xs">{formatDate(b.expiryDate)}<div className="mt-0.5">{getExpiryBadge(b.expiryDate, b.isActive)}</div></div>
                                            : <span className="text-xs text-muted-foreground">-</span>
                                        }
                                    </TableCell>
                                    <TableCell>
                                        {b.isActive
                                            ? <Badge className="bg-green-100 text-green-700">Aktif</Badge>
                                            : <Badge variant="secondary">Nonaktif</Badge>
                                        }
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{formatDate(b.receivedAt)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Halaman {page} dari {totalPages} ({total} batch)
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            Sebelumnya
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                            Selanjutnya
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
