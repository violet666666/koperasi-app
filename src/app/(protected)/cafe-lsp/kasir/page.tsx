"use client";

import * as React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coffee, Search, Banknote, CreditCard, Loader2, Maximize, ShieldAlert, ShieldCheck, User, Trash2, Plus, Minus, ImageOff, AlertCircle, CheckCircle2, QrCode, Star, Clock, ListOrdered } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { ReceiptPrimkopol, type ReceiptData } from "@/components/patterns/receipt-primkopol";

interface Product { id: number; sku: string; name: string; price: number; isService: boolean; category?: string; imageUrl?: string | null; stock?: number; metadata?: any; }
interface CartItem { product: Product; quantity: number; notes?: string; }
interface MemberResult { id: number; memberNo: string; name: string; nrp?: string; }
interface LimitValidation { allowed: boolean; sisaLimit: number; plafonPiutang: number; totalTagihan: number; reason?: string; }
interface QueueOrder { id: string; queueNumber: string; items: string; time: string; status: "waiting" | "ready"; }

interface CafeLspState {
    cart: CartItem[];
    queueOrders: QueueOrder[];
    addToCart: (product: Product) => void;
    updateItem: (productId: number, updates: Partial<CartItem>) => void;
    removeItem: (productId: number) => void;
    clearCart: () => void;
    addQueueOrder: (order: QueueOrder) => void;
    updateQueueOrder: (id: string, status: "waiting" | "ready") => void;
}

const useCafeLspStore = create<CafeLspState>()(
    persist(
        (set) => ({
            cart: [],
            queueOrders: [],
            addToCart: (product) => set((state) => {
                const existing = state.cart.find(c => c.product.id === product.id);
                if (existing) {
                    return { cart: state.cart.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c) };
                }
                return { cart: [...state.cart, { product, quantity: 1, notes: "" }] };
            }),
            updateItem: (productId, updates) => set((state) => ({
                cart: state.cart.map(c => c.product.id === productId ? { ...c, ...updates } : c).filter(c => c.quantity > 0),
            })),
            removeItem: (productId) => set((state) => ({
                cart: state.cart.filter(c => c.product.id !== productId),
            })),
            clearCart: () => set({ cart: [] }),
            addQueueOrder: (order) => set((state) => ({
                queueOrders: [...state.queueOrders, order],
            })),
            updateQueueOrder: (id, status) => set((state) => ({
                queueOrders: state.queueOrders.map(o => o.id === id ? { ...o, status } : o),
            })),
        }),
        { name: "cafe-lsp-pos-storage" }
    )
);

export default function CafeLspKasirPage() {
    const { cart, queueOrders, addToCart, updateItem, removeItem, clearCart, addQueueOrder, updateQueueOrder } = useCafeLspStore();

    const [products, setProducts] = React.useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [activeCategory, setActiveCategory] = React.useState<string>("Semua");
    const [isLoading, setIsLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const [paymentAmount, setPaymentAmount] = React.useState("");
    const [lastReceipt, setLastReceipt] = React.useState<ReceiptData | null>(null);
    const [showReceipt, setShowReceipt] = React.useState(false);

    const [showCreditDialog, setShowCreditDialog] = React.useState(false);
    const [memberSearch, setMemberSearch] = React.useState("");
    const [memberResults, setMemberResults] = React.useState<MemberResult[]>([]);
    const [selectedMember, setSelectedMember] = React.useState<MemberResult | null>(null);
    const [isSearchingMember, setIsSearchingMember] = React.useState(false);
    const [limitInfo, setLimitInfo] = React.useState<LimitValidation | null>(null);
    const [isValidatingLimit, setIsValidatingLimit] = React.useState(false);

    const [showQrisDialog, setShowQrisDialog] = React.useState(false);
    const [qrisUrl, setQrisUrl] = React.useState<string | null>(null);

    const [shiftOpen, setShiftOpen] = React.useState<boolean | null>(null);
    const [activeShiftId, setActiveShiftId] = React.useState<number | null>(null);

    const [nextQueueNumber, setNextQueueNumber] = React.useState("A001");

    const quickKeyProducts = React.useMemo(() => {
        const flagged = products.filter(p => p.metadata?.isQuickKey === true);
        if (flagged.length > 0) return flagged.slice(0, 8);
        const seen = new Set<string>();
        return products.filter(p => {
            if (!p.category || seen.has(p.category)) return false;
            seen.add(p.category);
            return true;
        }).slice(0, 8);
    }, [products]);

    React.useEffect(() => {
        async function fetchProducts() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/toko/products?unitType=cafe_lsp");
                const json = await res.json();
                setProducts(json.data || []);
            } catch { toast.error("Gagal memuat menu"); } finally { setIsLoading(false); }
        }
        fetchProducts();
    }, []);

    React.useEffect(() => {
        if (!showQrisDialog) return;
        let cancelled = false;
        const fetchQris = async () => {
            try {
                const res = await fetch("/api/unit-layanan/qris?unitType=cafe_lsp");
                if (!res.ok) return;
                const json = await res.json();
                if (!cancelled && json.qrisUrl) setQrisUrl(json.qrisUrl);
            } catch {}
        };
        if (!qrisUrl) fetchQris();
        return () => { cancelled = true; };
    }, [showQrisDialog, qrisUrl]);

    // Shift check with unitType filter (fixes bug from Resto)
    React.useEffect(() => {
        async function checkShift() {
            try {
                const res = await fetch("/api/toko/shifts?status=open&unitType=cafe_lsp");
                const json = await res.json();
                const shifts = json.data || [];
                setShiftOpen(shifts.length > 0);
                if (shifts.length > 0) setActiveShiftId(shifts[0].id);
            } catch { setShiftOpen(false); }
        }
        checkShift();
    }, []);

    React.useEffect(() => {
        async function fetchQueueCount() {
            try {
                const res = await fetch(`/api/toko/sales?unitType=cafe_lsp&perPage=1`);
                const json = await res.json();
                const total = json.pagination?.total || 0;
                setNextQueueNumber(`A${String(total + 1).padStart(3, "0")}`);
            } catch { setNextQueueNumber("A001"); }
        }
        fetchQueueCount();
    }, [cart.length === 0]);

    const categories = React.useMemo(() => {
        const cats = new Set<string>();
        products.forEach(p => { if (p.category) cats.add(p.category); });
        return ["★ Quick", "Semua", ...Array.from(cats).sort()];
    }, [products]);

    const filteredMenu = React.useMemo(() => {
        if (activeCategory === "★ Quick") return quickKeyProducts;
        return products.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchCategory = activeCategory === "Semua" || p.category === activeCategory;
            return matchSearch && matchCategory;
        });
    }, [products, activeCategory, searchQuery, quickKeyProducts]);

    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    const searchMembers = async () => {
        if (!memberSearch.trim()) return;
        setIsSearchingMember(true);
        try {
            const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(memberSearch)}`);
            const json = await res.json();
            setMemberResults(json.data || []);
        } catch { toast.error("Gagal mencari anggota"); } finally { setIsSearchingMember(false); }
    };

    React.useEffect(() => {
        const validateLimit = async () => {
            if (!selectedMember?.nrp || subtotal <= 0) return;
            setIsValidatingLimit(true);
            try {
                const res = await fetch("/api/unit-transactions/validate", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nrp: selectedMember.nrp, amount: subtotal, unitType: "cafe_lsp" }),
                });
                setLimitInfo(await res.json());
            } catch { toast.error("Gagal mengecek sisa limit plafon anggota."); } finally { setIsValidatingLimit(false); }
        };
        if (selectedMember) validateLimit();
        else setLimitInfo(null);
    }, [selectedMember, subtotal]);

    const processPayment = async (method: "cash" | "qris" | "salary_cut") => {
        if (cart.length === 0) { toast.error("Pesanan kosong"); return; }
        if (shiftOpen === false) { toast.error("Buka shift terlebih dahulu!"); return; }
        for (const item of cart) {
            if (item.product.stock !== undefined && item.product.stock !== null && item.quantity > item.product.stock) {
                toast.error(`Stok "${item.product.name}" tidak cukup (sisa: ${item.product.stock}, diminta: ${item.quantity})`);
                return;
            }
        }
        if (method === "cash" && Number(paymentAmount) < subtotal) { toast.error("Pembayaran kas kurang"); return; }
        if (method === "salary_cut" && !selectedMember) { toast.error("Pilih anggota untuk potong gaji"); return; }

        setIsProcessing(true);
        try {
            const body: any = {
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
                customerName: selectedMember?.name || "Tamu",
                paymentMethod: method,
                unitType: "cafe_lsp",
                memberId: selectedMember?.id || undefined,
                shiftId: activeShiftId || undefined,
                metadata: { queueNumber: nextQueueNumber, orderType: "counter" },
            };

            if (method === "cash") body.cashReceived = Number(paymentAmount);
            if (method === "qris") body.cashReceived = subtotal;
            if (method === "salary_cut") body.memberId = selectedMember?.id;

            const res = await fetch("/api/toko/sales", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            const currentQueue = nextQueueNumber;
            toast.success(`Antrian ${currentQueue} Lunas!`);

            addQueueOrder({
                id: `order-${Date.now()}`,
                queueNumber: currentQueue,
                items: cart.map(i => `${i.quantity}x ${i.product.name}`).join(", "),
                time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
                status: "waiting",
            });

            const receiptInfo: ReceiptData = {
                notaNo: json.data.saleNo,
                tanggal: new Date().toLocaleString("id-ID"),
                nrpNip: selectedMember?.nrp || "-",
                namaAnggota: selectedMember?.name || "Tamu",
                kesatuan: "-",
                keterangan: `Cafe LSP - Counter [Antrian ${currentQueue}]`,
                total: subtotal,
                metode: method === "cash" ? "Tunai" : (method === "qris" ? "QRIS" : "Potong Gaji"),
                kasir: "Kasir Cafe LSP",
                unitType: "cafe_lsp",
                items: cart.map(i => ({ name: i.product.name, qty: i.quantity, price: i.product.price, subtotal: i.product.price * i.quantity })),
            };
            setLastReceipt(receiptInfo);
            setShowReceipt(true);

            clearCart();
            setPaymentAmount(""); setSelectedMember(null); setShowCreditDialog(false); setShowQrisDialog(false);
        } catch (error: any) {
            toast.error(error.message || "Gagal memproses transaksi");
        } finally { setIsProcessing(false); }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-3 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm shrink-0">
                <div>
                    <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                        <Coffee className="h-5 w-5 text-amber-600" /> Cafe LSP POS
                    </h1>
                    <p className="text-xs text-muted-foreground">Counter-Based</p>
                </div>
                <div className="flex items-center gap-3">
                    {shiftOpen === true && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Shift Aktif
                        </Badge>
                    )}
                    <Button variant="outline" size="sm" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
                        onClick={() => document.documentElement.requestFullscreen().catch(() => {})}>
                        <Maximize className="mr-2 h-4 w-4" /> Fullscreen
                    </Button>
                </div>
            </div>

            {/* Shift Warning */}
            {shiftOpen === false && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 shrink-0">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div className="flex-1">
                        <p className="font-semibold text-sm">Shift Kasir Belum Dibuka</p>
                        <p className="text-xs mt-0.5">Buka shift terlebih dahulu untuk mencatat transaksi.</p>
                    </div>
                    <Link href="/cafe-lsp/shift">
                        <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">Buka Shift</Button>
                    </Link>
                </div>
            )}

            {/* Main: Menu + Cart */}
            <div className="flex-1 min-h-0 flex gap-4">
                {/* Menu */}
                <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b py-3 px-4 shrink-0 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Cari menu..." className="pl-9 bg-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        {categories.length > 2 && (
                            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                                {categories.map(cat => (
                                    <button key={cat} onClick={() => setActiveCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                                            activeCategory === cat
                                                ? cat === "★ Quick" ? "bg-amber-500 text-white shadow-sm" : "bg-sky-600 text-white shadow-sm"
                                                : "bg-white text-slate-600 border border-slate-200 hover:border-sky-300 hover:text-sky-700"
                                        }`}
                                    >
                                        {cat === "★ Quick" && <Star className="h-3 w-3 mr-1 inline" />}
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 content-start">
                        {isLoading ? (
                            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
                        ) : filteredMenu.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                <Coffee className="h-10 w-10 mb-3 opacity-30" />
                                <p className="text-sm font-medium">Tidak ada menu ditemukan</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {filteredMenu.map(p => (
                                    <button key={p.id} onClick={() => addToCart(p)}
                                        className="bg-white border rounded-xl flex flex-col overflow-hidden hover:border-amber-300 hover:shadow-md transition-all active:scale-[0.97] text-left group"
                                    >
                                        <div className="h-20 w-full bg-gradient-to-br from-amber-50 to-orange-50 relative overflow-hidden">
                                            {p.imageUrl ? (
                                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Coffee className="h-8 w-8 text-amber-200" />
                                                </div>
                                            )}
                                            {p.category && (
                                                <span className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                                                    {p.category}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-2.5 flex flex-col flex-1">
                                            <p className="font-semibold text-xs text-slate-800 line-clamp-2 leading-tight flex-1">{p.name}</p>
                                            <p className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1.5 self-start">
                                                {formatCurrency(p.price)}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Cart */}
                <Card className="w-[400px] flex flex-col shadow-sm border-slate-200 shrink-0">
                    <CardHeader className="bg-slate-50 border-b py-3 px-4 shrink-0">
                        <CardTitle className="text-base flex items-center justify-between">
                            <span className="flex items-center gap-2"><ListOrdered className="h-4 w-4" /> Keranjang</span>
                            <Badge className="bg-amber-500">{cart.length}</Badge>
                        </CardTitle>
                        {nextQueueNumber && (
                            <p className="text-xs text-muted-foreground mt-1">Nomor Antrian: <span className="font-bold text-amber-600">{nextQueueNumber}</span></p>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-0">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50">
                                <Coffee className="h-12 w-12 mb-3 opacity-20" />
                                <p>Keranjang kosong.</p>
                                <p className="text-xs mt-1">Pilih menu di sebelah untuk mulai order.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {cart.map(item => (
                                    <div key={item.product.id} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-semibold text-sm leading-tight pr-4 text-slate-700">{item.product.name}</p>
                                            <p className="font-mono font-bold text-sm">{formatCurrency(item.product.price * item.quantity)}</p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <Input placeholder="Note..." className="h-7 text-[11px] w-32 bg-white" maxLength={60}
                                                value={item.notes} onChange={e => updateItem(item.product.id, { notes: e.target.value })} />
                                            <div className="flex items-center gap-2 bg-white border rounded-md shadow-sm">
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => {
                                                    if (item.quantity <= 1) removeItem(item.product.id);
                                                    else updateItem(item.product.id, { quantity: item.quantity - 1 });
                                                }}><Minus className="h-3 w-3" /></Button>
                                                <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={() => updateItem(item.product.id, { quantity: item.quantity + 1 })}><Plus className="h-3 w-3" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                    <div className="shrink-0 bg-white border-t p-4 space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-semibold text-slate-500">Subtotal</span>
                            <span className="text-2xl font-black tracking-tight text-slate-800">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex gap-2">
                            <Input type="number" placeholder="Tunai Diterima..." className="h-12 text-lg font-mono text-center flex-1"
                                value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                            <Button size="icon" variant="outline" className="h-12 w-12 shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => { if (confirm("Kosongkan keranjang?")) clearCart(); }}>
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 shadow-sm col-span-2" onClick={() => processPayment("cash")} disabled={cart.length === 0 || isProcessing || shiftOpen === false}>
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />} Bayar Tunai
                            </Button>
                            <Button variant="outline" className="h-10 border-sky-200 text-sky-700 hover:bg-sky-50" onClick={() => { if (cart.length === 0) { toast.error("Pesanan kosong"); return; } setShowQrisDialog(true); }} disabled={cart.length === 0 || isProcessing || shiftOpen === false}>
                                <CreditCard className="mr-2 h-4 w-4" /> QRIS
                            </Button>
                            <Button variant="outline" className="h-10 border-slate-300 text-slate-700 hover:bg-slate-50" onClick={() => { if (cart.length === 0) { toast.error("Pesanan kosong"); return; } setShowCreditDialog(true); }} disabled={cart.length === 0 || isProcessing || shiftOpen === false}>
                                <User className="mr-2 h-4 w-4" /> Potong Gaji
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Order Queue Panel */}
            {queueOrders.length > 0 && (
                <div className="shrink-0 bg-white border rounded-lg p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> ORDER QUEUE</h3>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {queueOrders.map(order => (
                            <div key={order.id} className={`shrink-0 w-48 rounded-lg border-2 p-2.5 transition-all ${
                                order.status === "waiting" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"
                            }`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-black text-lg">{order.queueNumber}</span>
                                    <Badge variant={order.status === "waiting" ? "outline" : "default"}
                                        className={order.status === "waiting" ? "border-amber-300 text-amber-700" : "bg-emerald-500"}>
                                        {order.status === "waiting" ? "Menunggu" : "Siap"}
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-2 mb-1.5">{order.items}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">{order.time}</span>
                                    {order.status === "waiting" && (
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                            onClick={() => updateQueueOrder(order.id, "ready")}>
                                            <CheckCircle2 className="h-3 w-3 mr-1" /> Selesai
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Credit Dialog */}
            <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cafe LSP - Potong Gaji</DialogTitle>
                        <DialogDescription>Pembayaran makan/minum ke gaji dinas.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                            <Input placeholder="Cari NRP anggota..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchMembers()} />
                            <Button onClick={searchMembers} disabled={isSearchingMember}>{isSearchingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
                        </div>
                        {memberResults.length > 0 && (
                            <div className="max-h-[150px] overflow-y-auto border rounded-md">
                                {memberResults.map(m => (
                                    <div key={m.id} className={`p-3 cursor-pointer hover:bg-slate-50 border-b last:border-0 ${selectedMember?.id === m.id ? "bg-amber-50 border-l-4 border-l-amber-500" : ""}`} onClick={() => setSelectedMember(m)}>
                                        <p className="font-semibold text-slate-800">{m.name}</p>
                                        <p className="text-xs text-slate-500">NRP: {m.nrp || "-"}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isValidatingLimit ? (
                            <div className="p-3 bg-slate-50 rounded text-sm text-slate-500 flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cek Limit...</div>
                        ) : limitInfo ? (
                            <div className={`p-3 rounded-md border ${limitInfo.allowed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                                <div className="flex items-center gap-2 font-bold mb-1">
                                    {limitInfo.allowed ? <ShieldCheck className="text-emerald-600 h-5 w-5" /> : <ShieldAlert className="text-red-600 h-5 w-5" />}
                                    <span className={limitInfo.allowed ? "text-emerald-700" : "text-red-700"}>
                                        {limitInfo.allowed ? "Sisa Limit Aman" : "Limit Tidak Cukup!"}
                                    </span>
                                </div>
                                <p className="text-sm">Sisa limit aktif: {formatCurrency(limitInfo.sisaLimit)}</p>
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreditDialog(false)}>Batal</Button>
                        <Button disabled={!selectedMember || isProcessing || (limitInfo !== null && !limitInfo.allowed)} onClick={() => processPayment("salary_cut")} variant={limitInfo?.allowed === false ? "destructive" : "default"}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 flex-shrink-0 animate-spin" /> : limitInfo?.allowed === false ? <ShieldAlert className="mr-2 h-4 w-4" /> : <CreditCard className="mr-2 h-4 w-4" />}
                            {limitInfo?.allowed === false ? "Ditolak Sistem" : "Proses Potong Gaji"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* QRIS Dialog */}
            <Dialog open={showQrisDialog} onOpenChange={setShowQrisDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Pembayaran QRIS - Cafe LSP</DialogTitle>
                        <DialogDescription>Minta pelanggan memindai QRIS di bawah.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-4">
                        <div className="bg-slate-50 p-4 border rounded-xl shadow-sm">
                            {qrisUrl ? (
                                <img src={qrisUrl} alt="QRIS Cafe LSP" className="w-56 h-56 object-contain" />
                            ) : (
                                <div className="w-56 h-56 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed bg-white">
                                    <QrCode className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-sm">QRIS Belum Diatur</p>
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
                            <AlertCircle className="h-4 w-4" /> Pastikan saldo sudah masuk sebelum menekan tombol.
                        </p>
                    </div>
                    <DialogFooter className="mt-2">
                        <Button variant="outline" onClick={() => setShowQrisDialog(false)} disabled={isProcessing}>Batal</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setShowQrisDialog(false); processPayment("qris"); }} disabled={!qrisUrl || isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Pelanggan Sudah Bayar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Receipt Dialog */}
            <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                <DialogContent className="sm:max-w-[400px] bg-slate-100 p-4">
                    <DialogHeader className="mb-2">
                        <DialogTitle className="text-center font-bold">Terima Kasih</DialogTitle>
                        <DialogDescription className="text-center">Siapkan printer thermal Anda.</DialogDescription>
                    </DialogHeader>
                    {lastReceipt && (
                        <div className="flex flex-col items-center">
                            <ReceiptPrimkopol data={lastReceipt} paperSize="80mm" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
