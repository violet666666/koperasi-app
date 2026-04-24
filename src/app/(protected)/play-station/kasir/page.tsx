"use client";

import * as React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Gamepad2, Search, Banknote, CreditCard, Loader2, Maximize, ShieldAlert, ShieldCheck, User, Trash2, Plus, Minus, Play, Square, TimerReset, AlertTriangle, X, AlertCircle, CheckCircle2, QrCode } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { ReceiptPrimkopol, type ReceiptData } from "@/components/patterns/receipt-primkopol";

interface Product { id: number; sku: string; name: string; price: number; isService: boolean; }
interface CartItem { product: Product; quantity: number; notes?: string; }
interface MemberResult { id: number; memberNo: string; name: string; nrp?: string; }
interface LimitValidation { allowed: boolean; sisaLimit: number; plafonPiutang: number; totalTagihan: number; reason?: string; }

// --- Zustand Store for PS Timers & Carts ---
interface PSTvState { 
    id: string; 
    label: string; 
    cart: CartItem[]; 
    customerName: string;
    startTime: number | null; // null if stopped
}

interface PSStoreState {
    tvs: PSTvState[];
    activeTvId: string | null;
    setActiveTv: (id: string | null) => void;
    startTimer: (tvId: string) => void;
    stopTimer: (tvId: string) => void;
    updateCart: (tvId: string, item: CartItem, action: "add" | "update" | "remove") => void;
    setCustomer: (tvId: string, name: string) => void;
    clearTv: (tvId: string) => void;
}

const DEFAULT_TVS: PSTvState[] = Array.from({ length: 8 }, (_, i) => ({
    id: `TV-${i + 1}`, label: `TV ${i + 1} (PS5)`, cart: [], customerName: "", startTime: null
}));

const usePSStore = create<PSStoreState>()(
    persist(
        (set, get) => ({
            tvs: [...DEFAULT_TVS],
            activeTvId: null,
            setActiveTv: (id) => set({ activeTvId: id }),
            startTimer: (tvId) => set((state) => ({
                tvs: state.tvs.map(t => t.id === tvId ? { ...t, startTime: Date.now() } : t)
            })),
            stopTimer: (tvId) => set((state) => ({
                tvs: state.tvs.map(t => t.id === tvId ? { ...t, startTime: null } : t)
            })),
            updateCart: (tvId, item, action) => set((state) => {
                const tvs = state.tvs.map(t => {
                    if (t.id !== tvId) return t;
                    let newCart = [...t.cart];
                    const existing = newCart.find(c => c.product.id === item.product.id);
                    if (action === "add") {
                        if (existing) existing.quantity += 1;
                        else newCart.push({ product: item.product, quantity: item.quantity, notes: "" });
                    } else if (action === "update") {
                        if (existing) {
                            existing.quantity = item.quantity;
                            if (item.notes !== undefined) existing.notes = item.notes;
                            if (existing.quantity <= 0) newCart = newCart.filter(c => c.product.id !== item.product.id);
                        }
                    } else if (action === "remove") {
                        newCart = newCart.filter(c => c.product.id !== item.product.id);
                    }
                    return { ...t, cart: newCart };
                });
                return { tvs };
            }),
            setCustomer: (tvId, name) => set((state) => ({
                tvs: state.tvs.map(t => t.id === tvId ? { ...t, customerName: name } : t)
            })),
            clearTv: (tvId) => set((state) => ({
                tvs: state.tvs.map(t => t.id === tvId ? { ...t, cart: [], customerName: "", startTime: null } : t)
            })),
        }),
        { name: "ps-pos-storage" }
    )
);

// Constants
const PS_RATE_PER_HOURS = 15000; // Rp 15,000 per hour
const MINIMUM_DURATION_MINS = 15; // Minimum 15 mins bill

function calculateDurationString(startTime: number | null): string {
    if (!startTime) return "00:00:00";
    const diffBytes = Date.now() - startTime;
    const hrs = Math.floor(diffBytes / 3600000);
    const mins = Math.floor((diffBytes % 3600000) / 60000);
    const secs = Math.floor((diffBytes % 60000) / 1000);
    return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

export default function PSKasirPage() {
    const { tvs, activeTvId, setActiveTv, startTimer, stopTimer, updateCart, setCustomer, clearTv } = usePSStore();
    const activeTv = tvs.find(t => t.id === activeTvId);

    const [products, setProducts] = React.useState<Product[]>([]);
    const [rentalProduct, setRentalProduct] = React.useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);
    
    // Timer display re-render trigger
    const [, setTick] = React.useState(0);
    React.useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    // Payment state
    const [paymentAmount, setPaymentAmount] = React.useState("");
    const [lastReceipt, setLastReceipt] = React.useState<ReceiptData | null>(null);
    const [showReceipt, setShowReceipt] = React.useState(false);

    // Credit Payment
    const [showCreditDialog, setShowCreditDialog] = React.useState(false);
    const [memberSearch, setMemberSearch] = React.useState("");
    const [memberResults, setMemberResults] = React.useState<MemberResult[]>([]);
    const [selectedMember, setSelectedMember] = React.useState<MemberResult | null>(null);
    const [isSearchingMember, setIsSearchingMember] = React.useState(false);
    const [limitInfo, setLimitInfo] = React.useState<LimitValidation | null>(null);
    const [isValidatingLimit, setIsValidatingLimit] = React.useState(false);

    // Customer autocomplete (NRP/Nama)
    const [customerSuggestions, setCustomerSuggestions] = React.useState<MemberResult[]>([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = React.useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);
    const [selectedCustomerObj, setSelectedCustomerObj] = React.useState<MemberResult | null>(null);
    const customerRef = React.useRef<HTMLDivElement>(null);

    // QRIS
    const [showQrisDialog, setShowQrisDialog] = React.useState(false);
    const [qrisUrl, setQrisUrl] = React.useState<string | null>(null);

    // Close customer dropdown on outside click
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowCustomerDropdown(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Debounce NRP/Name autocomplete for customer field
    React.useEffect(() => {
        if (selectedCustomerObj) return;
        const q = activeTv?.customerName || "";
        if (!q || q.length < 2) { setCustomerSuggestions([]); setShowCustomerDropdown(false); return; }
        const timer = setTimeout(async () => {
            setIsSearchingCustomer(true);
            try {
                const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(q)}`);
                const json = await res.json();
                const results: MemberResult[] = json.data || [];
                setCustomerSuggestions(results); setShowCustomerDropdown(results.length > 0);
            } catch { setCustomerSuggestions([]); }
            finally { setIsSearchingCustomer(false); }
        }, 350);
        return () => clearTimeout(timer);
    }, [activeTv?.customerName, selectedCustomerObj]);

    const selectCustomer = (m: MemberResult) => {
        if (activeTv) setCustomer(activeTv.id, m.name);
        setSelectedCustomerObj(m);
        setCustomerSuggestions([]); setShowCustomerDropdown(false);
    };
    const clearCustomerSelection = () => {
        setSelectedCustomerObj(null);
        setCustomerSuggestions([]); setShowCustomerDropdown(false);
    };

    React.useEffect(() => {
        async function fetchProducts() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/toko/products?unitType=playstation");
                const json = await res.json();
                const all = json.data || [];
                // Separate rental service product from F&B (if it's flagged isService)
                const rental = all.find((p: any) => p.isService);
                if (rental) setRentalProduct(rental);

                const fb = all.filter((p: any) => !p.isService);
                setProducts(fb);
            } catch { toast.error("Gagal memuat katalog produk/jasa"); } finally { setIsLoading(false); }
        }
        async function fetchQris() {
            try {
                const res = await fetch("/api/unit-layanan/stats?unitType=playstation");
                const json = await res.json();
                if (json.data?.qrisUrl) setQrisUrl(json.data.qrisUrl);
            } catch {}
        }
        fetchProducts();
        fetchQris();
    }, []);

    const filteredMenu = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const cart = activeTv?.cart || [];
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const change = Number(paymentAmount) - subtotal;

    const handleStopTV = (tv: PSTvState) => {
        if (!tv.startTime) return;
        const diffMs = Date.now() - tv.startTime;
        let diffMins = Math.ceil(diffMs / 60000);
        if (diffMins < MINIMUM_DURATION_MINS) diffMins = MINIMUM_DURATION_MINS; // Minimum billable 15 mins
        
        stopTimer(tv.id); // Stop real timer

        if (rentalProduct) {
            // Find if rental is already in cart, if yes update it
            const hoursRounded = +(diffMins / 60).toFixed(2);
            updateCart(tv.id, { product: rentalProduct, quantity: hoursRounded }, "add");
            toast.success(`Timer TV Dihentikan. Jasa rental sebesar ${hoursRounded} Jam masuk ke tagihan.`);
        } else {
            toast.warning("Produk 'Sewa/Rental PS' tidak ditemukan di database. Tambahkan manual.");
        }
    };

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
                    body: JSON.stringify({ nrp: selectedMember.nrp, amount: subtotal, unitType: "playstation" }),
                });
                setLimitInfo(await res.json());
            } catch { toast.error("Gagal mengecek sisa limit plafon anggota."); } finally { setIsValidatingLimit(false); }
        };
        if (selectedMember) validateLimit();
        else setLimitInfo(null);
    }, [selectedMember, subtotal]);

    const processPayment = async (method: "cash" | "qris" | "salary_cut") => {
        if (!activeTv) return;
        if (activeTv.startTime) { toast.error("Hentikan timer Console terlebih dahulu sebelum pembayaran!"); return; }
        if (cart.length === 0) { toast.error("Pesanan kosong"); return; }
        if (method === "cash" && Number(paymentAmount) < subtotal) { toast.error("Pembayaran kas kurang"); return; }
        if (method === "salary_cut" && !selectedMember) { toast.error("Pilih anggota u/ potong gaji"); return; }

        setIsProcessing(true);
        try {
            const body: any = {
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
                customerName: activeTv.customerName || (method === "salary_cut" ? selectedMember?.name : "Player Umum"),
                paymentMethod: method,
                unitType: "playstation",
                memberId: selectedCustomerObj?.id || (method === "salary_cut" ? selectedMember?.id : undefined),
                metadata: { psNumber: activeTv.label, guestName: activeTv.customerName }
            };
            
            if (method === "cash") body.cashReceived = Number(paymentAmount);
            if (method === "qris") body.cashReceived = subtotal;
            if (method === "salary_cut") body.memberId = selectedMember?.id;

            const res = await fetch("/api/toko/sales", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            toast.success(`Bill rental ${activeTv.label} Lunas!`);

            const receiptInfo: ReceiptData = {
                notaNo: json.data.saleNo,
                tanggal: new Date().toLocaleString("id-ID"),
                nrpNip: selectedMember?.nrp || selectedCustomerObj?.nrp || "-",
                namaAnggota: selectedMember?.name || selectedCustomerObj?.name || activeTv.customerName || "Player Umum",
                kesatuan: "-",
                keterangan: `Rental Console [${activeTv.label}] & F&B`,
                total: subtotal,
                metode: method === "cash" ? "Tunai" : (method === "qris" ? "QRIS" : "Potong Gaji"),
                kasir: "Kasir Play Station"
            };
            setLastReceipt(receiptInfo);
            setShowReceipt(true);

            // Clear table state
            clearTv(activeTv.id);
            setActiveTv(null);
            setPaymentAmount(""); setSelectedMember(null); setShowCreditDialog(false); setShowQrisDialog(false); clearCustomerSelection();
        } catch (error: any) {
            toast.error(error.message || "Gagal memproses transaksi");
        } finally { setIsProcessing(false); }
    };

    // --- TV Dashboard View ---
    if (!activeTvId) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Play Station Rental POS"
                    description="Manajemen Billing Timer TV & Pesanan Makan/Minum"
                    actions={
                        <Button variant="outline" size="sm" className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                            onClick={() => document.documentElement.requestFullscreen().catch(()=>{})}>
                            <Maximize className="mr-2 h-4 w-4" /> Fullscreen Mode
                        </Button>
                    }
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {tvs.map(t => {
                        const isRunning = t.startTime !== null;
                        const hasCart = t.cart.length > 0;
                        return (
                            <Card key={t.id} className={`overflow-hidden transition-all border-2 ${isRunning ? 'border-purple-400 shadow-md shadow-purple-100' : hasCart ? 'border-sky-300' : 'border-slate-200'}`}>
                                <div className={`p-4 bg-gradient-to-br ${isRunning ? 'from-purple-500 to-indigo-600 text-white' : 'from-slate-100 to-slate-200 text-slate-800'} flex items-center justify-between cursor-pointer`} onClick={() => setActiveTv(t.id)}>
                                    <div className="flex items-center gap-2">
                                        <Gamepad2 className={`h-6 w-6 ${isRunning ? 'opacity-80' : 'text-slate-500'}`} />
                                        <span className="font-bold text-lg">{t.label}</span>
                                    </div>
                                    {hasCart && <Badge variant="secondary" className={isRunning ? "bg-white/20" : "bg-sky-200 border-sky-300 text-sky-800"}>{t.cart.length} Pesanan</Badge>}
                                </div>
                                <CardContent className="p-4 bg-white space-y-3">
                                    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-50 border font-mono">
                                        <span className={`text-2xl font-black ${isRunning ? 'text-purple-600' : 'text-slate-400'}`}>
                                            {calculateDurationString(t.startTime)}
                                        </span>
                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                                            {isRunning ? 'Billing Aktif' : 'Standby / Stopped'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Player</span>
                                        <span className="font-semibold text-slate-800 truncate" title={t.customerName}>{t.customerName || "-"}</span>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-3 bg-slate-50 border-t flex gap-2">
                                    {!isRunning ? (
                                        <Button className="w-full bg-slate-800 hover:bg-slate-900 shadow-sm" onClick={() => startTimer(t.id)}>
                                            <Play className="h-4 w-4 mr-2" /> Start Rental
                                        </Button>
                                    ) : (
                                        <Button className="w-full" variant="destructive" onClick={() => handleStopTV(t)}>
                                            <Square className="h-4 w-4 mr-2" /> Stop & Insert Bill
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            </div>
        );
    }

    if (!activeTv) return null;

    // Defensive check to appease TypeScript
    if (!activeTv) return null;

    // --- Order View (Inside a Table) ---
    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => setActiveTv(null)}><Gamepad2 className="h-4 w-4" /></Button>
                    <div>
                        <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                            {activeTv.label}
                            {activeTv.startTime ? (
                                <Badge className="bg-purple-500 animate-pulse">Running</Badge>
                            ) : (
                                <Badge variant="secondary">Standby</Badge>
                            )}
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono">{calculateDurationString(activeTv.startTime)} Timer</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-1/4" ref={customerRef}>
                    <div className="relative w-full">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="NRP / Nama Player..." className={`pl-9 pr-8 ${selectedCustomerObj ? 'border-purple-400 bg-purple-50/50' : ''}`}
                            value={activeTv.customerName}
                            onChange={e => { setCustomer(activeTv.id, e.target.value); if (selectedCustomerObj) setSelectedCustomerObj(null); }} />
                        {selectedCustomerObj && <button onClick={() => { setCustomer(activeTv.id, ""); clearCustomerSelection(); }} className="absolute right-2 top-2.5"><X className="h-4 w-4 text-slate-400" /></button>}
                        {isSearchingCustomer && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                        {showCustomerDropdown && customerSuggestions.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full max-h-[150px] overflow-y-auto bg-white border rounded-md shadow-lg">
                                {customerSuggestions.map(m => (
                                    <div key={m.id} className="p-2 cursor-pointer hover:bg-purple-50 border-b last:border-0 text-sm" onClick={() => selectCustomer(m)}>
                                        <span className="font-semibold">{m.name}</span>
                                        <span className="text-xs text-slate-500 ml-2">NRP: {m.nrp || "-"}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {selectedCustomerObj && <p className="text-xs text-purple-600 mt-0.5">✓ {selectedCustomerObj.name} (NRP: {selectedCustomerObj.nrp})</p>}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex gap-4">
                {/* Snack/Minuman Area (Left) */}
                <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b py-3 px-4 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Cari Mie Instan, Kopi, Snack..." className="pl-9 bg-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 content-start">
                        {isLoading ? (
                            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
                        ) : (
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {filteredMenu.map(p => (
                                    <button key={p.id} onClick={() => updateCart(activeTv.id, { product: p, quantity: 1 }, "add")}
                                        className="bg-white border rounded-xl p-3 flex flex-col h-28 hover:border-purple-300 hover:shadow-md transition-all active:scale-95 text-left"
                                    >
                                        <p className="font-semibold text-sm text-slate-800 line-clamp-2 leading-tight flex-1">{p.name}</p>
                                        <p className="text-xs font-mono font-bold text-purple-600 self-start bg-purple-50 px-2 py-0.5 rounded-full mt-2">
                                            {formatCurrency(p.price)}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Cart Area (Right) */}
                <Card className="w-[400px] flex flex-col shadow-sm border-slate-200 shrink-0">
                    <CardHeader className="bg-slate-50 border-b py-3 px-4 shrink-0">
                        <CardTitle className="text-base flex items-center justify-between">
                            Tagihan Billing & F&B <Badge className="bg-purple-500">{cart.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-0">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50">
                                <TimerReset className="h-12 w-12 mb-3 opacity-20" />
                                <p>Tagihan kosong.</p>
                                <p className="text-xs mt-1">Hentikan timer Console untuk memasukkan otomatis Jasa Rental, atau pilih menu snack di samping.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {cart.map(item => (
                                    <div key={item.product.id} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-semibold text-sm leading-tight pr-4 text-slate-700">{item.product.name}</p>
                                            <p className="font-mono font-bold text-sm">{formatCurrency(item.product.price * item.quantity)}</p>
                                        </div>
                                        <div className="flex justify-end items-center">
                                            <div className="flex items-center gap-2 bg-white border rounded-md shadow-sm">
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => updateCart(activeTv.id, { ...item, quantity: item.quantity - 1 }, "update")}><Minus className="h-3 w-3" /></Button>
                                                <Input type="number" 
                                                    className="w-12 text-center text-sm font-bold border-0 h-6 p-0 focus-visible:ring-0" 
                                                    value={item.quantity} 
                                                    onChange={e => updateCart(activeTv.id, { ...item, quantity: Number(e.target.value) || 0 }, "update")}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={() => updateCart(activeTv.id, { product: item.product, quantity: 1 }, "add")}><Plus className="h-3 w-3" /></Button>
                                            </div>
                                        </div>
                                        {/* For floating quantity, e.g. 1.25 hours */}
                                        {item.product.isService && (
                                            <p className="text-[10px] text-slate-400 text-right mt-1">*Kuantitas melambangkan Jam (Hours)</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                    <div className="shrink-0 bg-white border-t p-4 space-y-4">
                        {activeTv.startTime && (
                            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-amber-800 text-sm flex items-center mb-2 font-medium">
                                <AlertTriangle className="h-4 w-4 mr-2" /> Stop timer console dulu sebelum Checkout.
                            </div>
                        )}

                        <div className="flex justify-between items-end">
                            <span className="text-sm font-semibold text-slate-500">Total Tagihan</span>
                            <span className="text-2xl font-black tracking-tight text-slate-800">{formatCurrency(subtotal)}</span>
                        </div>
                        
                        <div className="flex gap-2">
                            <Input type="number" placeholder="Tunai Diterima..." className="h-12 text-lg font-mono text-center flex-1"
                                value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} disabled={activeTv.startTime !== null} />
                            <Button size="icon" variant="outline" className="h-12 w-12 shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => { if(confirm("Bersihkan tagihan TV ini?")) clearTv(activeTv.id); }}>
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 shadow-sm col-span-2" onClick={() => processPayment("cash")} disabled={cart.length === 0 || isProcessing || activeTv.startTime !== null}>
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />} Setor Tunai
                            </Button>
                            <Button variant="outline" className="h-10 border-sky-200 text-sky-700 hover:bg-sky-50" onClick={() => { if (cart.length === 0) { toast.error("Pesanan kosong"); return; } if (activeTv.startTime) { toast.error("Stop timer dulu!"); return; } setShowQrisDialog(true); }} disabled={cart.length === 0 || isProcessing || activeTv.startTime !== null}>
                                <CreditCard className="mr-2 h-4 w-4" /> QRIS
                            </Button>
                            <Button variant="outline" className="h-10 border-slate-300 text-slate-700 hover:bg-slate-50" onClick={() => setShowCreditDialog(true)} disabled={cart.length === 0 || isProcessing || activeTv.startTime !== null}>
                                <User className="mr-2 h-4 w-4" /> Potong Gaji
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Credit Salary Cut Dialog */}
            <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                {/* ... Gatekeeper Dialog logic ... */}
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kredit Tagihan Playstation - Potong Gaji</DialogTitle>
                        <DialogDescription>Pengajuan pembayaran otomatis via gaji.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                            <Input placeholder="Cari NRP anggota..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchMembers()} />
                            <Button onClick={searchMembers} disabled={isSearchingMember}>{isSearchingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
                        </div>
                        {memberResults.length > 0 && (
                            <div className="max-h-[150px] overflow-y-auto border rounded-md">
                                {memberResults.map(m => (
                                    <div key={m.id} className={`p-3 cursor-pointer hover:bg-slate-50 border-b last:border-0 ${selectedMember?.id === m.id ? "bg-purple-50 border-l-4 border-l-purple-500" : ""}`} onClick={() => setSelectedMember(m)}>
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

            {/* QRIS Payment Dialog */}
            <Dialog open={showQrisDialog} onOpenChange={setShowQrisDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Pembayaran QRIS — Play Station</DialogTitle>
                        <DialogDescription>Minta pelanggan untuk memindai barcode QRIS di bawah ini.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-4">
                        <div className="bg-slate-50 p-4 border rounded-xl shadow-sm">
                            {qrisUrl ? (
                                <img src={qrisUrl} alt="QRIS Play Station" className="w-56 h-56 object-contain" />
                            ) : (
                                <div className="w-56 h-56 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed bg-white">
                                    <QrCode className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-sm">Kode QRIS Belum Diatur!</p>
                                    <p className="text-xs text-center mt-1 px-4">Hubungi Admin unit untuk mengatur QRIS.</p>
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
                            <AlertCircle className="h-4 w-4" /> Pastikan saldo sudah masuk rekening sebelum menekan tombol.
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

            <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                <DialogContent className="sm:max-w-[360px] bg-slate-100 p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-center font-bold">Terima Kasih</DialogTitle>
                        <DialogDescription className="text-center">Silakan siapkan printer thermal Anda.</DialogDescription>
                    </DialogHeader>
                    {lastReceipt && (
                        <div className="flex flex-col items-center">
                            <ReceiptPrimkopol data={lastReceipt} paperSize="58mm" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
