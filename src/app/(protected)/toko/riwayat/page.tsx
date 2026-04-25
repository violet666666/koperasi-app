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
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    Search, ShoppingBag, Eye, Banknote, CreditCard, QrCode,
    Calendar, User, Package, Receipt,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useSession } from "next-auth/react";

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
    items: SaleItem[];
    metadata?: any;
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

export default function RiwayatTransaksiPage() {
    const { data: session } = useSession();
    const unitType = session?.user?.unitType as string || "toko";
    const isResto = ["resto_cafe", "resto", "coffe_latar"].includes(unitType);

    const [sales, setSales] = React.useState<Sale[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [filterMethod, setFilterMethod] = React.useState("all");
    const [selectedSale, setSelectedSale] = React.useState<Sale | null>(null);
    const [detailOpen, setDetailOpen] = React.useState(false);

    React.useEffect(() => {
        async function fetchSales() {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/toko/sales?unitType=${unitType}&limit=500`);
                if (!res.ok) throw new Error();
                const json = await res.json();
                setSales(json.data || []);
            } catch {
                toast.error("Gagal memuat riwayat transaksi");
            } finally {
                setIsLoading(false);
            }
        }
        fetchSales();
    }, [unitType]);

    const filtered = React.useMemo(() => {
        return sales.filter(s => {
            // Filter voided
            const isVoided = s.metadata && typeof s.metadata === "object" && s.metadata.isVoided;
            const matchSearch = !searchQuery ||
                s.saleNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (s.member?.name && s.member.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                s.items.some(i => i.product.name.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchMethod = filterMethod === "all" || s.paymentMethod === filterMethod;
            return matchSearch && matchMethod;
        });
    }, [sales, searchQuery, filterMethod]);

    const stats = React.useMemo(() => {
        const activeSales = sales.filter(s => !(s.metadata && typeof s.metadata === "object" && s.metadata.isVoided));
        const today = new Date().toDateString();
        const todaySales = activeSales.filter(s => new Date(s.createdAt).toDateString() === today);
        return {
            totalTransactions: activeSales.length,
            todayTransactions: todaySales.length,
            todayRevenue: todaySales.reduce((sum, s) => sum + s.totalAmount, 0),
            todayItems: todaySales.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.quantity, 0), 0),
        };
    }, [sales]);

    const openDetail = (sale: Sale) => {
        setSelectedSale(sale);
        setDetailOpen(true);
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
            <div className="grid gap-4 sm:grid-cols-4">
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-primary/10 p-3"><Receipt className="h-5 w-5 text-primary" /></div>
                    <div><p className="text-sm text-muted-foreground">Total Transaksi</p><p className="text-2xl font-bold">{stats.totalTransactions}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30"><ShoppingBag className="h-5 w-5 text-emerald-600" /></div>
                    <div><p className="text-sm text-muted-foreground">Hari Ini</p><p className="text-2xl font-bold text-emerald-600">{stats.todayTransactions} trx</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30"><Banknote className="h-5 w-5 text-blue-600" /></div>
                    <div><p className="text-sm text-muted-foreground">Pendapatan Hari Ini</p><p className="text-lg font-bold text-blue-600">{formatCurrency(stats.todayRevenue)}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-orange-100 p-3 dark:bg-orange-900/30"><Package className="h-5 w-5 text-orange-600" /></div>
                    <div><p className="text-sm text-muted-foreground">Item Terjual Hari Ini</p><p className="text-2xl font-bold text-orange-600">{stats.todayItems} <span className="text-sm font-normal">pcs</span></p></div>
                </CardContent></Card>
            </div>

            {/* Filters */}
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
                <Select value={filterMethod} onValueChange={setFilterMethod}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Metode</SelectItem>
                        <SelectItem value="cash">Tunai</SelectItem>
                        <SelectItem value="qris">QRIS</SelectItem>
                        <SelectItem value="salary_cut">Potong Gaji</SelectItem>
                    </SelectContent>
                </Select>
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
                                    <TableHead className="text-center w-[60px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                                            {searchQuery ? "Transaksi tidak ditemukan" : "Belum ada transaksi"}
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.map(sale => {
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
                                            <TableCell className="text-sm text-muted-foreground">{sale.createdBy.name}</TableCell>
                                            <TableCell className="text-center">
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    {filtered.length > 0 && (
                        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
                            Menampilkan {filtered.length} dari {sales.length} transaksi
                        </div>
                    )}
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
                                    <p className="font-medium flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedSale.createdBy.name}</p>
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
                                                    <span className="text-sm font-medium">{item.product.name}</span>
                                                    <span className="text-xs text-muted-foreground ml-1">({item.product.sku})</span>
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

                            <Button variant="outline" className="w-full" onClick={() => setDetailOpen(false)}>Tutup</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
