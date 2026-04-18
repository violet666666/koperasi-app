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
    Receipt, User, Loader2, ScanBarcode, Maximize, ShieldAlert, ShieldCheck, AlertTriangle, X, Check, QrCode, AlertCircle, CheckCircle2
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { generateKasirReceiptPDF, type KasirReceiptData } from "@/lib/export-utils";
import { useBarcodeScanner } from "@/lib/hooks/use-barcode-scanner";

interface Product { id: number; sku: string; name: string; price: number; discountType?: string; discountValue?: number; stock: number; stockToko: number; isService?: boolean; }
interface CartItem { product: Product; quantity: number; }
interface MemberResult { id: number; memberNo: string; name: string; nrp?: string; }
interface LimitValidation { allowed: boolean; sisaLimit: number; plafonPiutang: number; totalTagihan: number; reason?: string; }

export default function KasirPage() {
    const getEffectivePrice = React.useCallback((p: Product) => {
        if (!p.discountType || !p.discountValue || p.discountValue <= 0) return p.price;
        if (p.discountType === "percent") {
            return Math.round(p.price * (1 - p.discountValue / 100));
        }
        return Math.max(0, p.price - p.discountValue);
    }, []);

    const [searchQuery, setSearchQuery] = React.useState("");
    const [products, setProducts] = React.useState<Product[]>([]);
    const [cart, setCart] = React.useState<CartItem[]>([]);
    // customerName state dihapus — digantikan customerQuery + selectedCustomerObj (autocomplete)
    const [paymentAmount, setPaymentAmount] = React.useState("");
    const [changeAmount, setChangeAmount] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [lastReceipt, setLastReceipt] = React.useState<KasirReceiptData | null>(null);

    // Credit payment state
    const [showCreditDialog, setShowCreditDialog] = React.useState(false);
    
    // QRIS state
    const [showQrisDialog, setShowQrisDialog] = React.useState(false);
    const [qrisUrl, setQrisUrl] = React.useState<string | null>(null);
    const [memberSearch, setMemberSearch] = React.useState("");
    const [memberResults, setMemberResults] = React.useState<MemberResult[]>([]);
    const [selectedMember, setSelectedMember] = React.useState<MemberResult | null>(null);
    const [isSearchingMember, setIsSearchingMember] = React.useState(false);
    
    // Gatekeeper limit info
    const [limitInfo, setLimitInfo] = React.useState<LimitValidation | null>(null);
    const [isValidatingLimit, setIsValidatingLimit] = React.useState(false);

    // Autocomplete search untuk Tunai/QRIS
    const [customerQuery, setCustomerQuery] = React.useState(""); // teks yang diketik
    const [customerSuggestions, setCustomerSuggestions] = React.useState<MemberResult[]>([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = React.useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);
    const [selectedCustomerObj, setSelectedCustomerObj] = React.useState<MemberResult | null>(null);
    const customerRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
                setShowCustomerDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Debounce autocomplete: fetch saat ≥2 karakter
    React.useEffect(() => {
        if (selectedCustomerObj) return; // sudah dipilih, jangan fetch lagi
        if (!customerQuery || customerQuery.length < 2) {
            setCustomerSuggestions([]);
            setShowCustomerDropdown(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingCustomer(true);
            try {
                const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(customerQuery)}`);
                const json = await res.json();
                const results: MemberResult[] = json.data || [];
                setCustomerSuggestions(results);
                setShowCustomerDropdown(results.length > 0);
            } catch {
                setCustomerSuggestions([]);
            } finally {
                setIsSearchingCustomer(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [customerQuery, selectedCustomerObj]);

    const selectCustomer = (m: MemberResult) => {
        setSelectedCustomerObj(m);
        setCustomerQuery(m.name);
        setCustomerSuggestions([]);
        setShowCustomerDropdown(false);
    };

    const clearCustomer = () => {
        setSelectedCustomerObj(null);
        setCustomerQuery("");
        setCustomerSuggestions([]);
        setShowCustomerDropdown(false);
    };


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
        
        async function fetchUnitStats() {
            try {
                const res = await fetch("/api/unit-layanan/stats?unitType=toko");
                const json = await res.json();
                if (json.data?.qrisUrl) {
                    setQrisUrl(json.data.qrisUrl);
                }
            } catch (e) {
                console.error("Gagal memuat info QRIS toko", e);
            }
        }
        
        fetchProducts();
        fetchUnitStats();
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
            const effStock = found.isService ? "∞" : (found.stockToko > 0 ? found.stockToko : found.stock);
            toast.success(`✓ ${found.name} ditambahkan. (Sisa Stok: ${effStock})`);
        } else {
            // Fall back to search filter so cashier can see results
            setSearchQuery(code);
            toast.info(`Barcode "${code}" tidak ditemukan di database`);
        }
    }, [products]);

    useBarcodeScanner(addByBarcode);

    const subtotal = cart.reduce((sum, item) => sum + (getEffectivePrice(item.product) * (Number(item.quantity) || 0)), 0);
    const change = Number(paymentAmount) - subtotal;

    const getEffectiveStock = (product: Product) => {
        if (product.isService) return 999;
        return product.stockToko > 0 ? product.stockToko : product.stock;
    };

    const addToCart = (product: Product) => {
        const effectiveStock = getEffectiveStock(product);
        if (!product.isService && effectiveStock <= 0) {
            toast.error(`${product.name}: Stok habis`);
            return;
        }
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (!product.isService && existing.quantity >= effectiveStock) {
                    toast.error(`Stok ${product.name} tidak mencukupi (sisa: ${effectiveStock})`);
                    return prev;
                }
                return prev.map(item => item.product.id === product.id ? { ...item, quantity: (Number(item.quantity) || 0) + 1 } : item);
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id !== productId) return item;
            const currentQty = Number(item.quantity) || 0;
            const newQty = currentQty + delta;
            if (newQty <= 0) return item;
            const effectiveStock = getEffectiveStock(item.product);
            if (!item.product.isService && newQty > effectiveStock) {
                toast.error(`Stok ${item.product.name} tidak mencukupi (sisa: ${effectiveStock})`);
                return item;
            }
            return { ...item, quantity: newQty };
        }));
    };

    const setItemQuantity = (productId: number, rawValue: string) => {
        setCart(prev => prev.map(item => {
            if (item.product.id !== productId) return item;
            if (rawValue === "") return { ...item, quantity: "" as any };
            
            let qty = parseInt(rawValue, 10);
            if (isNaN(qty)) return item;
            
            const effectiveStock = getEffectiveStock(item.product);
            if (!item.product.isService && qty > effectiveStock) {
                toast.error(`Maksimal stok membatasi input ke: ${effectiveStock}`);
                return { ...item, quantity: effectiveStock };
            }
            return { ...item, quantity: qty };
        }));
    };

    const handleQuantityBlur = (productId: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id !== productId) return item;
            if ((item.quantity as any) === "" || Number(item.quantity) <= 0) {
                return { ...item, quantity: 1 };
            }
            return item;
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
        // Untuk Tunai: jika nominal kosong, otomatis isi exact (tanpa kembalian)
        const effectivePayment = method === "cash"
            ? (paymentAmount === "" ? subtotal : Number(paymentAmount))
            : 0;
        if (method === "cash" && effectivePayment < subtotal) { toast.error("Pembayaran kurang dari total belanja"); return; }
        if (method === "salary_cut" && !selectedMember) { toast.error("Pilih anggota untuk pembayaran potong gaji"); return; }

        setIsProcessing(true);
        try {
            const body: any = {
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
                customerName: method === "salary_cut" ? selectedMember?.name : (selectedCustomerObj?.name || customerQuery || undefined),
                paymentMethod: method,
                unitType: "toko",
            };
            if (method === "cash") {
                body.cashReceived = effectivePayment; // pakai effectivePayment bukan paymentAmount string
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
                customerName: method === "salary_cut" ? selectedMember?.name : (selectedCustomerObj?.name || customerQuery || undefined),
                cashierName: "Kasir Toko",
                items: cart.map(item => {
                    const price = getEffectivePrice(item.product);
                    return {
                        name: item.product.name,
                        quantity: item.quantity,
                        price: price,
                        subtotal: price * item.quantity
                    };
                }),
                totalAmount: subtotal,
                paymentMethod: method,
                cashReceived: method === "cash" ? effectivePayment : undefined,
                changeAmount: json.data.changeAmount
            };
            setLastReceipt(receiptData);
            
            // Auto trigger pdf download/print window for 58mm POS thermal
            generateKasirReceiptPDF(receiptData);

            setCart([]);
            setPaymentAmount("");
            clearCustomer();
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
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && searchQuery.trim() !== "") {
                                            const code = searchQuery.trim();
                                            const found = products.find(
                                                (p) => p.sku.toLowerCase() === code.toLowerCase() ||
                                                       p.sku.replace(/-/g, "") === code.replace(/-/g, "")
                                            );
                                            if (found) {
                                                addToCart(found);
                                                const effStock = found.isService ? "∞" : (found.stockToko > 0 ? found.stockToko : found.stock);
                                                toast.success(`✓ ${found.name} ditambahkan. (Sisa Stok: ${effStock})`);
                                                setSearchQuery(""); // Kosongkan input setelah sukses
                                            } else {
                                                toast.info(`Barcode "${code}" tidak ditemukan`);
                                                e.currentTarget.select(); // Blok teks agar scan berikutnya otomatis menimpa
                                            }
                                        }
                                    }}
                                    className="pl-10" />
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
                                            {filteredProducts.map((product) => {
                                                const effStock = product.isService ? 999 : (product.stockToko > 0 ? product.stockToko : product.stock);
                                                const isOutOfStock = !product.isService && effStock <= 0;
                                                return (
                                                <TableRow key={product.id} 
                                                    className={`cursor-pointer hover:bg-muted/50 ${isOutOfStock ? "opacity-50" : ""}`}
                                                    onClick={() => addToCart(product)}
                                                >
                                                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                                                    <TableCell className="font-medium">
                                                        {product.name}
                                                        {isOutOfStock && <span className="ml-2 text-xs text-destructive font-normal">(Stok Habis)</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {product.discountType && product.discountValue && product.discountValue > 0 ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                                                                <span className="text-red-600 font-bold">{formatCurrency(getEffectivePrice(product))}</span>
                                                            </div>
                                                        ) : (
                                                            formatCurrency(product.price)
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant={effStock > 0 ? "secondary" : "destructive"}>{product.isService ? "∞" : effStock}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button size="sm" variant="ghost" disabled={isOutOfStock} onClick={(e) => { e.stopPropagation(); addToCart(product); }}>
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                                );
                                            })}
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
                                <div className="mt-1 relative" ref={customerRef}>
                                    <div className="relative">
                                        {selectedCustomerObj ? (
                                            <Check className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                        ) : isSearchingCustomer ? (
                                            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                        ) : (
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        )}
                                        <Input
                                            placeholder="Cari nama atau NRP anggota..."
                                            value={customerQuery}
                                            disabled={!!selectedCustomerObj}
                                            onChange={(e) => {
                                                setCustomerQuery(e.target.value);
                                                if (selectedCustomerObj) clearCustomer();
                                            }}
                                            onFocus={() => customerSuggestions.length > 0 && setShowCustomerDropdown(true)}
                                            className={`pl-9 pr-8 ${
                                                selectedCustomerObj
                                                    ? "border-emerald-500 bg-emerald-50/50"
                                                    : ""
                                            }`}
                                        />
                                        {(selectedCustomerObj || customerQuery) && (
                                            <button
                                                type="button"
                                                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
                                                onClick={clearCustomer}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Autocomplete dropdown */}
                                    {showCustomerDropdown && customerSuggestions.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">
                                            {customerSuggestions.map((m) => (
                                                <div
                                                    key={m.id}
                                                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors"
                                                    onMouseDown={(e) => { e.preventDefault(); selectCustomer(m); }}
                                                >
                                                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                        {m.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{m.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            NRP: {m.nrp || "-"}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Selected member info bar */}
                                    {selectedCustomerObj && (
                                        <div className="mt-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                            <div className="text-xs text-emerald-800 min-w-0">
                                                <span className="font-semibold">{selectedCustomerObj.name}</span>
                                                <span className="text-emerald-600 ml-1.5">NRP: {selectedCustomerObj.nrp || "-"}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">Ketik nama/NRP anggota untuk autocomplete (opsional)</p>
                            </div>

                            <Separator />

                            <div className="max-h-[250px] overflow-y-auto space-y-2">
                                {cart.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Keranjang kosong</p>
                                ) : cart.map((item) => (
                                    <div key={item.product.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.product.name}</p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                                                {item.product.discountType && item.product.discountValue && item.product.discountValue > 0 ? (
                                                    <span className="flex items-center gap-1">
                                                        <Badge variant="destructive" className="h-5 px-1 py-0 text-[10px] rounded-sm">
                                                            {item.product.discountType === "percent" ? `${item.product.discountValue}%` : `-${formatCurrency(item.product.discountValue)}`}
                                                        </Badge>
                                                        <span>{formatCurrency(getEffectivePrice(item.product))} × {item.quantity}</span>
                                                    </span>
                                                ) : (
                                                    <span>{formatCurrency(item.product.price)} × {item.quantity}</span>
                                                )}
                                                <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                    Sisa Stok: {item.product.isService ? "∞" : (item.product.stockToko > 0 ? item.product.stockToko : item.product.stock)}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                                            <Input
                                                type="text"
                                                inputMode="numeric"
                                                className="w-12 h-7 text-center px-1 text-sm font-medium focus-visible:ring-1"
                                                value={(item.quantity as any) === "" ? "" : item.quantity}
                                                onChange={(e) => setItemQuantity(item.product.id, e.target.value.replace(/[^0-9]/g, ""))}
                                                onBlur={() => handleQuantityBlur(item.product.id)}
                                                onClick={(e) => e.currentTarget.select()}
                                            />
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
                                <Input type="number" placeholder={`Kosongkan = tepat ${formatCurrency(subtotal)}`} value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="text-right text-lg font-bold" />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Biarkan kosong untuk bayar pas (tanpa kembalian)
                                </p>
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
                                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowQrisDialog(true)}
                                    disabled={cart.length === 0 || isProcessing}>
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                                    QRIS
                                </Button>
                            </div>

                            {/* Credit Payment */}
                            <Button variant="outline" className="w-full mb-3" disabled={cart.length === 0}
                                onClick={() => {
                                    if (selectedCustomerObj) {
                                        setSelectedMember(selectedCustomerObj);
                                        setMemberSearch(selectedCustomerObj.name);
                                        setMemberResults([selectedCustomerObj]);
                                    }
                                    setShowCreditDialog(true);
                                }}>
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

            {/* QRIS Payment Dialog */}
            <Dialog open={showQrisDialog} onOpenChange={setShowQrisDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Pembayaran QRIS — Toko PRIMKOPPOL</DialogTitle>
                        <DialogDescription>
                            Minta pelanggan untuk memindai barcode QRIS di bawah ini dengan nominal pembayaran.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center justify-center p-4">
                        <div className="bg-slate-50 p-4 border rounded-xl shadow-sm relative group overflow-hidden">
                            {qrisUrl ? (
                                <img
                                    src={qrisUrl}
                                    alt="QRIS Toko"
                                    className="w-56 h-56 object-contain"
                                />
                            ) : (
                                <div className="w-56 h-56 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed bg-white">
                                    <QrCode className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-sm">Kode QRIS Belum Diatur!</p>
                                    <p className="text-xs text-center mt-1 px-4">Hubungi Admin Toko untuk mengatur gambar QRIS pada unit ini.</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 text-center space-y-1">
                            <p className="text-sm text-muted-foreground">Total Tagihan:</p>
                            <p className="text-3xl font-bold text-primary">{formatCurrency(subtotal)}</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <p className="text-xs text-amber-800 text-center flex justify-center items-center gap-1.5 font-medium">
                            <AlertCircle className="h-4 w-4" /> Pastikan saldo benar-benar sudah masuk rekening sebelum menekan tombol di bawah.
                        </p>
                    </div>

                    <DialogFooter className="mt-2">
                        <Button variant="outline" onClick={() => setShowQrisDialog(false)} disabled={isProcessing}>
                            Batal
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => {
                                setShowQrisDialog(false);
                                processPayment("qris");
                            }}
                            disabled={!qrisUrl || isProcessing}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Pelanggan Sudah Bayar (Proses Resi)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
