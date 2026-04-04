"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    ShoppingCart, Search, Plus, Minus, Trash2, Banknote, CreditCard,
    Receipt, User, Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { generateKasirReceiptPDF, type KasirReceiptData } from "@/lib/export-utils";

interface Product { id: number; sku: string; name: string; price: number; stock: number; }
interface CartItem { product: Product; quantity: number; }
interface MemberResult { id: number; memberNo: string; name: string; nrp?: string; }

export default function KasirPage() {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [products, setProducts] = React.useState<Product[]>([]);
    const [cart, setCart] = React.useState<CartItem[]>([]);
    const [customerName, setCustomerName] = React.useState("");
    const [paymentAmount, setPaymentAmount] = React.useState("");
    const [changeAmount, setChangeAmount] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [lastReceipt, setLastReceipt] = React.useState<KasirReceiptData | null>(null);

    // Credit payment state
    const [showCreditDialog, setShowCreditDialog] = React.useState(false);
    const [memberSearch, setMemberSearch] = React.useState("");
    const [memberResults, setMemberResults] = React.useState<MemberResult[]>([]);
    const [selectedMember, setSelectedMember] = React.useState<MemberResult | null>(null);
    const [isSearchingMember, setIsSearchingMember] = React.useState(false);

    React.useEffect(() => {
        async function fetchProducts() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/toko/products");
                const json = await res.json();
                setProducts(json.data || []);
            } catch {
                toast.error("Gagal memuat produk");
            } finally { setIsLoading(false); }
        }
        fetchProducts();
    }, []);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const change = Number(paymentAmount) - subtotal;

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) { toast.error("Stok tidak mencukupi"); return prev; }
                return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id !== productId) return item;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return item;
            if (newQty > item.product.stock) { toast.error("Stok tidak mencukupi"); return item; }
            return { ...item, quantity: newQty };
        }));
    };

    const removeFromCart = (productId: number) => setCart(prev => prev.filter(item => item.product.id !== productId));

    // Search members for credit payment
    const searchMembers = async () => {
        if (!memberSearch.trim()) return;
        setIsSearchingMember(true);
        try {
            const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(memberSearch)}`);
            const json = await res.json();
            setMemberResults(json.data || []);
        } catch {
            toast.error("Gagal mencari anggota");
        } finally { setIsSearchingMember(false); }
    };

    // Process payment (cash, qris, or salary_cut)
    const processPayment = async (method: "cash" | "qris" | "salary_cut") => {
        if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
        if (method === "cash" && Number(paymentAmount) < subtotal) { toast.error("Pembayaran kurang"); return; }
        if (method === "salary_cut" && !selectedMember) { toast.error("Pilih anggota untuk pembayaran potong gaji"); return; }

        setIsProcessing(true);
        try {
            const body: any = {
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
                customerName: method === "salary_cut" ? selectedMember?.name : (customerName || undefined),
                paymentMethod: method,
                unitType: "toko",
            };
            if (method === "cash") {
                body.cashReceived = Number(paymentAmount);
            }
            if (method === "qris") {
                body.cashReceived = subtotal; // Qris exact amount exact
            }
            if (method === "salary_cut") {
                body.memberId = selectedMember?.id;
            }

            const res = await fetch("/api/toko/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Gagal memproses transaksi"); return; }

            if (method === "cash") {
                toast.success(`Transaksi ${json.data.saleNo} berhasil! Kembalian: ${formatCurrency(json.data.changeAmount)}`);
            } else if (method === "qris") {
                toast.success(`Transaksi QRIS ${json.data.saleNo} berhasil!`);
            } else {
                toast.success(`Transaksi kredit ${json.data.saleNo} berhasil! Potong gaji anggota ${selectedMember?.name}`);
            }

            // Generate receipt automatically and enable re-print
            const receiptData: KasirReceiptData = {
                saleNo: json.data.saleNo,
                saleDate: new Date().toISOString(),
                customerName: method === "salary_cut" ? selectedMember?.name : customerName,
                cashierName: "Kasir Toko",
                items: cart.map(item => ({
                    name: item.product.name,
                    quantity: item.quantity,
                    price: item.product.price,
                    subtotal: item.product.price * item.quantity
                })),
                totalAmount: subtotal,
                paymentMethod: method,
                cashReceived: method === "cash" ? Number(paymentAmount) : undefined,
                changeAmount: json.data.changeAmount
            };
            setLastReceipt(receiptData);
            
            // Auto trigger pdf download/print window for 58mm POS thermal
            generateKasirReceiptPDF(receiptData);

            setCart([]);
            setPaymentAmount("");
            setCustomerName("");
            setSelectedMember(null);
            setShowCreditDialog(false);

            const productsRes = await fetch("/api/toko/products");
            const productsJson = await productsRes.json();
            setProducts(productsJson.data || []);
        } catch {
            toast.error("Gagal memproses pembayaran");
        } finally { setIsProcessing(false); }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Kasir / POS" description="Point of Sale - Penjualan toko" />

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Product Search */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input placeholder="Cari produk atau scan barcode..." value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[400px] overflow-y-auto">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        <span className="ml-2 text-sm text-muted-foreground">Memuat produk...</span>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>SKU</TableHead><TableHead>Produk</TableHead>
                                                <TableHead className="text-right">Harga</TableHead>
                                                <TableHead className="text-center">Stok</TableHead><TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredProducts.map((product) => (
                                                <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => addToCart(product)}>
                                                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                                                    <TableCell className="font-medium">{product.name}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{formatCurrency(product.price)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>{product.stock}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); addToCart(product); }}>
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredProducts.length === 0 && (
                                                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    {searchQuery ? "Produk tidak ditemukan" : "Belum ada produk"}
                                                </TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Cart */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5" /> Keranjang
                                {cart.length > 0 && <Badge variant="secondary">{cart.length} item</Badge>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-xs">Nama Pelanggan (opsional)</Label>
                                <div className="flex gap-2 mt-1">
                                    <User className="h-4 w-4 text-muted-foreground mt-2" />
                                    <Input placeholder="Nama atau NRP" value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)} />
                                </div>
                            </div>

                            <Separator />

                            <div className="max-h-[250px] overflow-y-auto space-y-2">
                                {cart.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Keranjang kosong</p>
                                ) : cart.map((item) => (
                                    <div key={item.product.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.product.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)} × {item.quantity}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeFromCart(item.product.id)}><Trash2 className="h-3 w-3" /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Separator />

                            <div className="flex justify-between text-lg font-bold">
                                <span>Total</span>
                                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                            </div>

                            <Separator />

                            {/* Cash Payment */}
                            <div>
                                <Label>Bayar Tunai</Label>
                                <Input type="number" placeholder="0" value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="text-right text-lg font-bold" />
                                {Number(paymentAmount) >= subtotal && subtotal > 0 && (
                                    <p className="text-sm text-emerald-600 mt-1">Kembalian: {formatCurrency(change)}</p>
                                )}
                            </div>

                            <div className="flex gap-2 mt-4 space-y-0 pb-3">
                                <Button className="flex-1" onClick={() => processPayment("cash")}
                                    disabled={cart.length === 0 || isProcessing}>
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
                                    Bayar Tunai
                                </Button>
                                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => processPayment("qris")}
                                    disabled={cart.length === 0 || isProcessing}>
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                                    QRIS
                                </Button>
                            </div>

                            {/* Credit Payment */}
                            <Button variant="outline" className="w-full mb-3" disabled={cart.length === 0}
                                onClick={() => setShowCreditDialog(true)}>
                                <User className="mr-2 h-4 w-4" />
                                Bayar via Potong Gaji
                            </Button>

                            <Button variant="outline" className="w-full" disabled={!lastReceipt}
                                onClick={() => lastReceipt && generateKasirReceiptPDF(lastReceipt)}>
                                <Receipt className="mr-2 h-4 w-4" />Cetak Struk Transaksi Terakhir
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Credit Payment Dialog */}
            <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pembayaran Kredit — Potong Gaji</DialogTitle>
                        <DialogDescription>
                            Cari anggota berdasarkan NRP/Nama. Pembelian akan dicatat sebagai piutang toko dan dipotong dari gaji.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Input placeholder="Cari NRP atau Nama anggota..."
                                value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && searchMembers()} />
                            <Button onClick={searchMembers} disabled={isSearchingMember}>
                                {isSearchingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                        </div>

                        {memberResults.length > 0 && (
                            <div className="max-h-[200px] overflow-y-auto border rounded-md">
                                {memberResults.map((m) => (
                                    <div key={m.id}
                                        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 ${selectedMember?.id === m.id ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                                        onClick={() => setSelectedMember(m)}>
                                        <div>
                                            <p className="font-medium">{m.name}</p>
                                            <p className="text-sm text-muted-foreground">{m.memberNo} {m.nrp ? `· NRP: ${m.nrp}` : ""}</p>
                                        </div>
                                        {selectedMember?.id === m.id && <Badge>Dipilih</Badge>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedMember && (
                            <Card>
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{selectedMember.name}</p>
                                            <p className="text-sm text-muted-foreground">{selectedMember.memberNo}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-muted-foreground">Total Kredit</p>
                                            <p className="text-lg font-bold text-primary">{formatCurrency(subtotal)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreditDialog(false)}>Batal</Button>
                        <Button disabled={!selectedMember || isProcessing} onClick={() => processPayment("salary_cut")}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                            Proses Potong Gaji
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
