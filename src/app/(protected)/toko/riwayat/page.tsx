"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    Search, ShoppingBag, Eye, Banknote, CreditCard, QrCode,
    Calendar, User, Package, Receipt, Printer, ChevronLeft, ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useSession } from "next-auth/react";
import { generateKasirReceiptPDF, type KasirReceiptData } from "@/lib/export-utils";

interface SaleItem {
    id: number;
    productId: number;
    product: { id: number; sku: string; name: string };
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

interface Sale {
    id: number;
    saleNo: string;
    customerName: string | null;
    member: { id: number; name: string; memberNo: string } | null;
    totalAmount: number;
    paymentMethod: string;
    cashReceived: number | null;
    changeAmount: number | null;
    createdAt: string;
    createdBy: { id: number; name: string };
    cashierDisplayName: string | null;
    items: SaleItem[];
    metadata?: any;
    shiftId?: number | null;
    shift?: { id: number; shiftName: string; status: string } | null;
}

const paymentMethodLabel = (m: string) => {
    switch (m) {
        case "cash": return "Tunai";
        case "qris": return "QRIS";
        case "salary_cut": return "Potong Gaji";
        default: return m;
    }
};

const paymentMethodIcon = (m: string) => {
    switch (m) {
        case "cash": return <Banknote className="h-3.5 w-3.5" />;
        case "qris": return <QrCode className="h-3.5 w-3.5" />;
        case "salary_cut": return <CreditCard className="h-3.5 w-3.5" />;
        default: return <Banknote className="h-3.5 w-3.5" />;
    }
};

const paymentMethodColor = (m: string) => {
    switch (m) {
        case "cash": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30";
        case "qris": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30";
        case "salary_cut": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30";
        default: return "";
    }
};

interface PaginationInfo {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
}

interface StatsData {
    totalSalesCount: number;
    todaySalesCount: number;
    todaySales: number;
    todayItemsSold: number;
}

export default function RiwayatTransaksiPage() {
    const { data: session } = useSession();
    const unitType = session?.user?.unitType as string || "toko";
    const isResto = ["resto_cafe", "resto", "coffe_latar"].includes(unitType);

    // Pagination state
    const [page, setPage] = React.useState(1);
    const perPage = 25;

    // Data state
    const [sales, setSales] = React.useState<Sale[]>([]);
    const [pagination, setPagination] = React.useState<PaginationInfo>({ page: 1, perPage, total: 0, totalPages: 1 });
    const [isLoading, setIsLoading] = React.useState(true);

    // Stats from /api/toko/stats
    const [stats, setStats] = React.useState<StatsData>({
        totalSalesCount: 0,
        todaySalesCount: 0,
        todaySales: 0,
        todayItemsSold: 0,
    });

    // Filter state
    const [searchQuery, setSearchQuery] = React.useState("");
    const [debouncedSearch, setDebouncedSearch] = React.useState("");
    const [methodFilters, setMethodFilters] = React.useState<Set<string>>(new Set(["cash", "qris", "salary_cut"]));
    const [showVoided, setShowVoided] = React.useState(true);
    const [shiftFilter, setShiftFilter] = React.useState<string>("all");
    const [availableShifts, setAvailableShifts] = React.useState<{ id: number; shiftName: string; startedAt: string; status: string }[]>([]);

    const [selectedSale, setSelectedSale] = React.useState<Sale | null>(null);
    const [detailOpen, setDetailOpen] = React.useState(false);

    // Debounce search input
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setPage(1);
    }, [debouncedSearch, methodFilters, showVoided, shiftFilter]);

    // Fetch stats once on mount
    React.useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch(`/api/toko/stats?unitType=${unitType}`);
                if (res.ok) {
                    const json = await res.json();
                    const d = json.data;
                    setStats({
                        totalSalesCount: d.totalSalesCount || 0,
                        todaySalesCount: d.todaySalesCount || 0,
                        todaySales: d.todaySales || 0,
                        todayItemsSold: d.todayItemsSold || 0,
                    });
                }
            } catch { /* non-critical */ }
        }
        fetchStats();
    }, [unitType]);

    // Fetch shifts once on mount
    React.useEffect(() => {
        async function fetchShifts() {
            try {
                const res = await fetch(`/api/toko/shifts?unitType=${unitType}&limit=50`);
                if (res.ok) {
                    const json = await res.json();
                    setAvailableShifts((json.data || []).map((s: Record<string, unknown>) => ({
                        id: s.id as number,
                        shiftName: s.shiftName as string,
                        startedAt: s.startedAt as string,
                        status: s.status as string,
                    })));
                }
            } catch { /* non-critical */ }
        }
        fetchShifts();
    }, [unitType]);

    // Fetch paginated sales whenever page or filters change
    React.useEffect(() => {
        async function fetchSales() {
            setIsLoading(true);
            try {
                const methods = Array.from(methodFilters).join(",");
                const params = new URLSearchParams({
                    unitType,
                    page: String(page),
                    perPage: String(perPage),
                    ...(debouncedSearch && { search: debouncedSearch }),
                    ...(methods && { paymentMethods: methods }),
                    ...(!showVoided && { showVoided: "false" }),
                    ...(shiftFilter !== "all" && { shiftId: shiftFilter }),
                });
                const res = await fetch(`/api/toko/sales?${params}`);
                if (!res.ok) throw new Error();
                const json = await res.json();
                setSales(json.data || []);
                setPagination(json.pagination || { page: 1, perPage, total: 0, totalPages: 1 });
            } catch {
                toast.error("Gagal memuat riwayat transaksi");
            } finally {
                setIsLoading(false);
            }
        }
        fetchSales();
    }, [unitType, page, debouncedSearch, methodFilters, showVoided, shiftFilter]);

    const toggleMethod = (method: string, checked: boolean | "indeterminate") => {
        setMethodFilters(prev => {
            const next = new Set(prev);
            if (checked) next.add(method);
            else next.delete(method);
            return next;
        });
    };

    const openDetail = (sale: Sale) => {
        setSelectedSale(sale);
        setDetailOpen(true);
    };

    const handleReprint = (sale: Sale) => {
        const receiptData: KasirReceiptData = {
            saleNo: sale.saleNo,
            saleDate: sale.createdAt,
            customerName: sale.member
                ? `${sale.member.name} (${sale.member.memberNo})`
                : sale.customerName || undefined,
            cashierName: sale.cashierDisplayName || sale.createdBy?.name || "Kasir",
            items: sale.items.map(item => ({
                name: item.product?.name || "[Produk Dihapus]",
                quantity: item.quantity,
                price: item.unitPrice,
                subtotal: item.subtotal,
            })),
            totalAmount: sale.totalAmount,
            paymentMethod: sale.paymentMethod,
            cashReceived: sale.cashReceived ?? undefined,
            changeAmount: sale.changeAmount ?? undefined,
        };
        generateKasirReceiptPDF(receiptData);
    };

    const isVoided = (s: Sale) => s.metadata && typeof s.metadata === "object" && s.metadata.isVoided;

    return (
        <div className="space-y-6">
            <PageHeader
                title={isResto ? "Riwayat Transaksi Resto" : "Riwayat Transaksi Toko"}
                description="Klik transaksi untuk melihat detail item"
                backHref={isResto ? "/resto/kasir" : "/toko"}
            />

            {/* Stats */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-primary/10 p-3"><Receipt className="h-5 w-5 text-primary" /></div>
                    <div><p className="text-sm text-muted-foreground">Total Transaksi</p><p className="text-2xl font-bold">{stats.totalSalesCount.toLocaleString("id-ID")}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30"><ShoppingBag className="h-5 w-5 text-emerald-600" /></div>
                    <div><p className="text-sm text-muted-foreground">Hari Ini</p><p className="text-2xl font-bold text-emerald-600">{stats.todaySalesCount} trx</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30"><Banknote className="h-5 w-5 text-blue-600" /></div>
                    <div><p className="text-sm text-muted-foreground">Pendapatan Hari Ini</p><p className="text-lg font-bold text-blue-600">{formatCurrency(stats.todaySales)}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-orange-100 p-3 dark:bg-orange-900/30"><Package className="h-5 w-5 text-orange-600" /></div>
                    <div><p className="text-sm text-muted-foreground">Item Terjual Hari Ini</p><p className="text-2xl font-bold text-orange-600">{stats.todayItemsSold} <span className="text-sm font-normal">pcs</span></p></div>
                </CardContent></Card>
            </div>

            {/* Filters */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Cari no. transaksi, nama pelanggan, atau produk..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
                    <span className="text-sm text-muted-foreground font-medium">Metode:</span>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <Checkbox checked={methodFilters.has("cash")} onCheckedChange={(c) => toggleMethod("cash", c)} />
                        <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Tunai
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <Checkbox checked={methodFilters.has("qris")} onCheckedChange={(c) => toggleMethod("qris", c)} />
                        <QrCode className="h-3.5 w-3.5 text-blue-600" /> QRIS
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <Checkbox checked={methodFilters.has("salary_cut")} onCheckedChange={(c) => toggleMethod("salary_cut", c)} />
                        <CreditCard className="h-3.5 w-3.5 text-amber-600" /> Potong Gaji
                    </label>
                    <Separator orientation="vertical" className="h-5 mx-1" />
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <Checkbox checked={showVoided} onCheckedChange={(c) => setShowVoided(c === true)} />
                        <span className="text-muted-foreground">Tampilkan Void</span>
                    </label>
                    {availableShifts.length > 0 && (
                        <>
                            <Separator orientation="vertical" className="h-5 mx-1" />
                            <span className="text-sm text-muted-foreground font-medium">Shift:</span>
                            {availableShifts.map(sh => {
                                const date = new Date(sh.startedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
                                return (
                                    <label key={sh.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                        <Checkbox
                                            checked={shiftFilter === String(sh.id)}
                                            onCheckedChange={(c) => setShiftFilter(c ? String(sh.id) : "all")}
                                        />
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>{sh.shiftName} ({date})</span>
                                        {sh.status === "open" && <Badge className="text-[9px] bg-green-100 text-green-700">LIVE</Badge>}
                                    </label>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>

            {/* Transaction Table */}
            {isLoading ? (
                <Card><CardContent className="p-6 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
            ) : (
                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No. Transaksi</TableHead>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Pelanggan</TableHead>
                                    <TableHead className="text-center">Item</TableHead>
                                    <TableHead className="text-center">Pembayaran</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Kasir</TableHead>
                                    <TableHead className="text-center">Shift</TableHead>
                                    <TableHead className="text-center w-[80px]">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sales.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center text-muted-foreground py-10"
                                            >
                                            {debouncedSearch ? "Transaksi tidak ditemukan" : "Belum ada transaksi"}
                                        </TableCell>
                                    </TableRow>
                                ) : sales.map(sale => {
                                    const voided = isVoided(sale);
                                    return (
                                        <TableRow
                                            key={sale.id}
                                            className={`cursor-pointer hover:bg-muted/50 transition-colors ${voided ? "opacity-50" : ""}`}
                                            onClick={() => openDetail(sale)}
                                        >
                                            <TableCell>
                                                <span className={`font-mono text-xs ${voided ? "line-through" : ""}`}>{sale.saleNo}</span>
                                                {voided && <Badge variant="destructive" className="ml-2 text-[10px]">VOID</Badge>}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {new Date(sale.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                                <span className="text-xs text-muted-foreground ml-1">
                                                    {new Date(sale.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {sale.member ? (
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                        {sale.member.name}
                                                    </span>
                                                ) : sale.customerName || <span className="text-muted-foreground">-</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className="text-xs">
                                                    {sale.items.reduce((sum, i) => sum + i.quantity, 0)} pcs
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={`text-xs gap-1 ${paymentMethodColor(sale.paymentMethod)}`}>
                                                    {paymentMethodIcon(sale.paymentMethod)}
                                                    {paymentMethodLabel(sale.paymentMethod)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-bold tabular-nums text-sm">{formatCurrency(sale.totalAmount)}</span>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {sale.cashierDisplayName || sale.createdBy.name}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {sale.shift ? (
                                                    <Badge variant="outline" className={`text-[10px] ${
                                                        sale.shift.status === "open"
                                                            ? "border-green-300 text-green-700 bg-green-50"
                                                            : "border-slate-300 text-slate-600"
                                                    }`}>
                                                        {sale.shift.shiftName}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Lihat Detail"
                                                        onClick={(e) => { e.stopPropagation(); openDetail(sale); }}>
                                                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </Button>
                                                    {!voided && (
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Cetak Ulang Struk"
                                                            onClick={(e) => { e.stopPropagation(); handleReprint(sale); }}>
                                                            <Printer className="h-3.5 w-3.5 text-blue-600" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    {/* Pagination Footer */}
                    <div className="px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                            Menampilkan {sales.length > 0 ? ((pagination.page - 1) * pagination.perPage) + 1 : 0}–{((pagination.page - 1) * pagination.perPage) + sales.length} dari {pagination.total.toLocaleString("id-ID")} transaksi
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1"
                                disabled={page <= 1 || isLoading}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Sebelumnya
                            </Button>
                            <span className="text-sm font-medium tabular-nums min-w-[80px] text-center">
                                {pagination.page} / {pagination.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1"
                                disabled={page >= pagination.totalPages || isLoading}
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                            >
                                Selanjutnya
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* === Detail Transaksi Dialog === */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Detail Transaksi
                        </DialogTitle>
                    </DialogHeader>
                    {selectedSale && (
                        <div className="space-y-4">
                            {/* Header Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground">No. Transaksi</p>
                                    <p className="font-mono font-bold">{selectedSale.saleNo}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Tanggal</p>
                                    <p className="font-medium flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {new Date(selectedSale.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                        {" "}
                                        {new Date(selectedSale.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Kasir</p>
                                    <p className="font-medium flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedSale.cashierDisplayName || selectedSale.createdBy.name}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Pelanggan</p>
                                    <p className="font-medium">
                                        {selectedSale.member ? `${selectedSale.member.name} (${selectedSale.member.memberNo})` : selectedSale.customerName || "Umum"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Pembayaran</p>
                                    <Badge className={`gap-1 ${paymentMethodColor(selectedSale.paymentMethod)}`}>
                                        {paymentMethodIcon(selectedSale.paymentMethod)}
                                        {paymentMethodLabel(selectedSale.paymentMethod)}
                                    </Badge>
                                </div>
                                {isVoided(selectedSale) && (
                                    <div>
                                        <Badge variant="destructive" className="text-sm">VOID / DIBATALKAN</Badge>
                                    </div>
                                )}
                            </div>

                            {/* Items Table */}
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Produk</TableHead>
                                            <TableHead className="text-xs text-center">Qty</TableHead>
                                            <TableHead className="text-xs text-right">Harga</TableHead>
                                            <TableHead className="text-xs text-right">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedSale.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <span className="text-sm font-medium">{item.product?.name || "[Produk Dihapus]"}</span>
                                                    {item.product?.sku && <span className="text-xs text-muted-foreground ml-1">({item.product.sku})</span>}
                                                </TableCell>
                                                <TableCell className="text-center text-sm tabular-nums">{item.quantity}</TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">{formatCurrency(item.unitPrice)}</TableCell>
                                                <TableCell className="text-right text-sm tabular-nums font-medium">{formatCurrency(item.subtotal)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Total */}
                            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Item</span>
                                    <span>{selectedSale.items.reduce((s, i) => s + i.quantity, 0)} pcs</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span className="text-emerald-600">{formatCurrency(selectedSale.totalAmount)}</span>
                                </div>
                                {selectedSale.paymentMethod === "cash" && selectedSale.cashReceived && (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Tunai</span>
                                            <span>{formatCurrency(selectedSale.cashReceived)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-medium">
                                            <span className="text-muted-foreground">Kembalian</span>
                                            <span>{formatCurrency(selectedSale.changeAmount || 0)}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => setDetailOpen(false)}>Tutup</Button>
                                {!isVoided(selectedSale) && (
                                    <Button className="flex-1 gap-2" onClick={() => handleReprint(selectedSale)}>
                                        <Printer className="h-4 w-4" />
                                        Cetak Struk
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
