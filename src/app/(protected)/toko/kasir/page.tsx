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
    Receipt, User, Loader2, ScanBarcode, Maximize, ShieldAlert, ShieldCheck, AlertTriangle, X
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { generateKasirReceiptPDF, type KasirReceiptData } from "@/lib/export-utils";
import { useBarcodeScanner } from "@/lib/hooks/use-barcode-scanner";

interface Product { id: number; sku: string; name: string; price: number; stock: number; }
interface CartItem { product: Product; quantity: number; }
interface MemberResult { id: number; memberNo: string; name: string; nrp?: string; }
interface LimitValidation { allowed: boolean; sisaLimit: number; plafonPiutang: number; totalTagihan: number; reason?: string; }

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
    
    // Gatekeeper limit info
    const [limitInfo, setLimitInfo] = React.useState<LimitValidation | null>(null);
    const [isValidatingLimit, setIsValidatingLimit] = React.useState(false);

    // Auto-detect member by NRP for Tunai/QRIS
    const [selectedCustomerObj, setSelectedCustomerObj] = React.useState<MemberResult | null>(null);

    React.useEffect(() => {
        const detectNrp = async () => {
            if (!customerName || customerName.length < 4) {
               if (selectedCustomerObj && selectedCustomerObj.nrp !== customerName) {
                   setSelectedCustomerObj(null);
               }
               return; 
            }
            if (selectedCustomerObj && (selectedCustomerObj.name === customerName || selectedCustomerObj.nrp === customerName)) return;

            try {
                const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(customerName)}`);
                const json = await res.json();
                if (json.data && json.data.length > 0) {
                    const exactMatch = json.data.find((m: any) => m.nrp === customerName || m.memberNo === customerName);
                    if (exactMatch) {
                        setSelectedCustomerObj(exactMatch);
                        setCustomerName(exactMatch.name); 
                        toast.success(`Anggota terdeteksi otomatis: ${exactMatch.name}`);
                    }
                }
            } catch (err) {}
        };
        const timeout = setTimeout(detectNrp, 800);
        return () => clearTimeout(timeout);
    }, [customerName, selectedCustomerObj]);

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

    // Hardware barcode gun support — fires when scanner sends rapid chars + Enter
    const addByBarcode = React.useCallback((code: string) => {
        const found = products.find(
            (p) => p.sku.toLowerCase() === code.toLowerCase() ||
                   p.sku.replace(/-/g, "") === code.replace(/-/g, "")
        );
        if (found) {
            addToCart(found);
            toast.success(`✓ ${found.name} ditambahkan ke keranjang`);
        } else {
            // Fall back to search filter so cashier can see results
            setSearchQuery(code);
            toast.info(`Barcode "${code}" tidak ditemukan di database`);
        }
    }, [products]);

    useBarcodeScanner(addByBarcode);

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

    // Validasi Gatekeeper
    React.useEffect(() => {
        const validateLimit = async () => {
            if (!selectedMember?.nrp || subtotal <= 0) return;
            setIsValidatingLimit(true);
            try {
                const res = await fetch("/api/unit-transactions/validate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nrp: selectedMember.nrp,
                        amount: subtotal,
                        unitType: "toko",
                    }),
                });
                const data = await res.json();
                setLimitInfo(data);
            } catch {
                toast.error("Gagal mengecek sisa limit plafon anggota.");
            } finally {
                setIsValidatingLimit(false);
            }
        };

        if (selectedMember) validateLimit();
        else setLimitInfo(null);
    }, [selectedMember, subtotal]);

    // Process payment (cash, qris, or salary_cut)
    const processPayment = async (method: "cash" | "qris" | "salary_cut") => {
        if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
        if (method === "cash" && Number(paymentAmount) < subtotal) { toast.error("Pembayaran kurang"); return; }
        if (method === "salary_cut" && !selectedMember) { toast.error("Pilih anggota untuk pembayaran potong gaji"); return; }

        setIsProcessing(true);
        try {
            const body: any = {
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
                customerName: method === "salary_cut" ? selectedMember?.name : (selectedCustomerObj?.name || customerName || undefined),
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
            } else if (selectedCustomerObj) {
                body.memberId = selectedCustomerObj.id; // Inject member ID for cash/qris!
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
            setSelectedCustomerObj(null);
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
            <PageHeader
                title="Kasir POS"
                description="Point of Sale — Penjualan Toko PRIMKOPPOL"
                actions={
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-primary/5 hover:bg-primary/10 border-primary/20"
                            onClick={() => {
                                if (!document.fullscreenElement) {
                                    document.documentElement.requestFullscreen().catch(() => {});
                                } else {
                                    document.exitFullscreen().catch(() => {});
                                }
                            }}
                        >
                            <Maximize className="mr-2 h-4 w-4" /> Mode POS (Fullscreen)
                        </Button>
                        <Badge variant="secondary" className="gap-1.5 text-xs">
                            <ScanBarcode className="h-3.5 w-3.5" />
                            Scanner Aktif
                        </Badge>
                    </div>
                }
            />

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
                                <Label className="text-xs">Identitas Pelanggan (opsional)</Label>
                                <div className="flex gap-2 mt-1 relative">
                                    <User className={`h-4 w-4 mt-2 ${selectedCustomerObj ? "text-emerald-500" : "text-muted-foreground"}`} />
                                    <Input placeholder="Nama Walk-in atau NRP" value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        className={selectedCustomerObj ? "border-emerald-500 bg-emerald-50/50 pr-28" : ""}
                                    />
                                    {selectedCustomerObj && (
                                        <div className="absolute right-2 top-1.5 flex items-center gap-1">
                                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">Terdeteksi</Badge>
                                            <button 
                                                type="button"
                                                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-emerald-200 text-emerald-700"
                                                onClick={() => {
                                                    setSelectedCustomerObj(null);
                                                    setCustomerName("");
                                                }}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">Ketik NRP/No. Anggota untuk sinkronisasi histori</p>
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
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Total Kredit</p>
                                            <p className="text-xl font-bold text-primary">{formatCurrency(subtotal)}</p>
                                        </div>
                                    </div>

                                    {/* Gatekeeper Check Card */}
                                    <div className={`mt-4 rounded-lg border p-3 text-sm space-y-1.5 transition-all ${
                                        isValidatingLimit ? "bg-muted/30 border-muted" :
                                        limitInfo?.allowed ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" :
                                        limitInfo ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" :
                                        "bg-muted/30 border-muted"
                                    }`}>
                                        {isValidatingLimit ? (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Memvalidasi limit piutang...</span>
                                            </div>
                                        ) : limitInfo ? (
                                            <>
                                                <div className="flex items-center gap-2 font-medium">
                                                    {limitInfo.allowed
                                                        ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                                        : <ShieldAlert className="h-4 w-4 text-red-600" />}
                                                    <span className={limitInfo.allowed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                                                        {limitInfo.allowed ? "Sisa limit mencukupi" : "Limit tidak mencukupi"}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mt-1">
                                                    <span className="text-muted-foreground">Sisa Limit Piutang Aktif</span>
                                                    <span className={`font-semibold ${limitInfo.allowed ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(limitInfo.sisaLimit)}</span>
                                                </div>
                                                {!limitInfo.allowed && (
                                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-start gap-1">
                                                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                                        {limitInfo.reason}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground text-xs">Informasi limit gagal dimuat.</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreditDialog(false)}>Batal</Button>
                        <Button 
                            disabled={!selectedMember || isProcessing || isValidatingLimit || (limitInfo !== null && !limitInfo.allowed)} 
                            onClick={() => processPayment("salary_cut")}
                            variant={limitInfo?.allowed === false ? "destructive" : "default"}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                             limitInfo?.allowed === false ? <ShieldAlert className="mr-2 h-4 w-4" /> :
                             <CreditCard className="mr-2 h-4 w-4" />}
                            {limitInfo?.allowed === false ? "Transaksi Ditolak" : "Proses Potong Gaji"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
