"use client";

import * as React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Coffee, Search, Utensils, Banknote, CreditCard, Loader2, Maximize, ShieldAlert, ShieldCheck, User, Trash2, Plus, Minus, Printer, LayoutGrid, Clock, ImageOff, AlertCircle, CheckCircle2, QrCode } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { ReceiptPrimkopol, type ReceiptData } from "@/components/patterns/receipt-primkopol";

interface Product { id: number; sku: string; name: string; price: number; isService: boolean; category?: string; imageUrl?: string | null; stock?: number; }
interface CartItem { product: Product; quantity: number; notes?: string; }
interface MemberResult { id: number; memberNo: string; name: string; nrp?: string; }
interface LimitValidation { allowed: boolean; sisaLimit: number; plafonPiutang: number; totalTagihan: number; reason?: string; }

// --- Zustand Store for Table Management & Hold Bills ---
interface RestoTable { id: string; label: string; type: "dine_in" | "takeaway"; cart: CartItem[]; customerName: string; }
interface RestoState {
    tables: RestoTable[];
    activeTableId: string | null;
    setActiveTable: (id: string | null) => void;
    updateCart: (tableId: string, item: CartItem, action: "add" | "update" | "remove") => void;
    setCustomer: (tableId: string, name: string) => void;
    clearTable: (tableId: string) => void;
    addTakeaway: () => void;
}

const DEFAULT_TABLES: RestoTable[] = Array.from({ length: 12 }, (_, i) => ({
    id: `M${i + 1}`, label: `Meja ${i + 1}`, type: "dine_in", cart: [], customerName: ""
}));

const useRestoStore = create<RestoState>()(
    persist(
        (set, get) => ({
            tables: [...DEFAULT_TABLES, { id: "T1", label: "Takeaway 1", type: "takeaway", cart: [], customerName: "" }],
            activeTableId: null,
            setActiveTable: (id) => set({ activeTableId: id }),
            updateCart: (tableId, item, action) => set((state) => {
                const tables = state.tables.map(t => {
                    if (t.id !== tableId) return t;
                    let newCart = [...t.cart];
                    const existing = newCart.find(c => c.product.id === item.product.id);
                    if (action === "add") {
                        if (existing) existing.quantity += 1;
                        else newCart.push({ product: item.product, quantity: 1, notes: "" });
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
                return { tables };
            }),
            setCustomer: (tableId, name) => set((state) => ({
                tables: state.tables.map(t => t.id === tableId ? { ...t, customerName: name } : t)
            })),
            clearTable: (tableId) => set((state) => {
                const tables = state.tables.map(t => t.id === tableId ? { ...t, cart: [], customerName: "" } : t);
                return { tables };
            }),
            addTakeaway: () => set((state) => {
                const takes = state.tables.filter(t => t.type === "takeaway");
                const newId = `T${takes.length + 1}`;
                return { tables: [...state.tables, { id: newId, label: `Takeaway ${takes.length + 1}`, type: "takeaway", cart: [], customerName: "" }] };
            })
        }),
        { name: "resto-pos-storage" }
    )
);

export default function RestoKasirPage() {
    const { tables, activeTableId, setActiveTable, updateCart, setCustomer, clearTable, addTakeaway } = useRestoStore();
    const activeTable = tables.find(t => t.id === activeTableId);

    const [products, setProducts] = React.useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [activeCategory, setActiveCategory] = React.useState<string>("Semua");
    const [isLoading, setIsLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);
    
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

    // QRIS
    const [showQrisDialog, setShowQrisDialog] = React.useState(false);
    const [qrisUrl, setQrisUrl] = React.useState<string | null>(null);

    // Shift state
    const [shiftOpen, setShiftOpen] = React.useState<boolean | null>(null); // null = loading

    React.useEffect(() => {
        async function fetchProducts() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/toko/products?unitType=resto");
                const json = await res.json();
                setProducts(json.data || []);
            } catch { toast.error("Gagal memuat menu resto"); } finally { setIsLoading(false); }
        }
        async function fetchQris() {
            try {
                const res = await fetch("/api/unit-layanan/stats?unitType=resto");
                const json = await res.json();
                if (json.data?.qrisUrl) setQrisUrl(json.data.qrisUrl);
            } catch {}
        }
        fetchProducts();
        fetchQris();
    }, []);

    // Check shift status
    React.useEffect(() => {
        async function checkShift() {
            try {
                const res = await fetch("/api/toko/shifts?status=open");
                const json = await res.json();
                const shifts = json.data || [];
                setShiftOpen(shifts.length > 0);
            } catch { setShiftOpen(false); }
        }
        checkShift();
    }, []);

    // Derive unique categories from products
    const categories = React.useMemo(() => {
        const cats = new Set<string>();
        products.forEach(p => { if (p.category) cats.add(p.category); });
        return ["Semua", ...Array.from(cats).sort()];
    }, [products]);

    const filteredMenu = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchCategory = activeCategory === "Semua" || p.category === activeCategory;
        return matchSearch && matchCategory;
    });
    const cart = activeTable?.cart || [];
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const change = Number(paymentAmount) - subtotal;

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
                    body: JSON.stringify({ nrp: selectedMember.nrp, amount: subtotal, unitType: "resto" }),
                });
                setLimitInfo(await res.json());
            } catch { toast.error("Gagal mengecek sisa limit plafon anggota."); } finally { setIsValidatingLimit(false); }
        };
        if (selectedMember) validateLimit();
        else setLimitInfo(null);
    }, [selectedMember, subtotal]);

    const processPayment = async (method: "cash" | "qris" | "salary_cut") => {
        if (!activeTable) return;
        if (cart.length === 0) { toast.error("Pesanan kosong"); return; }
        // Validate stock availability before sending to API
        for (const item of cart) {
            if (item.product.stock !== undefined && item.product.stock !== null && item.quantity > item.product.stock) {
                toast.error(`Stok "${item.product.name}" tidak cukup (sisa: ${item.product.stock}, diminta: ${item.quantity})`);
                return;
            }
        }
        if (method === "cash" && Number(paymentAmount) < subtotal) { toast.error("Pembayaran kas kurang"); return; }
        if (method === "salary_cut" && !selectedMember) { toast.error("Pilih anggota u/ potong gaji"); return; }

        setIsProcessing(true);
        try {
            const body: any = {
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
                customerName: activeTable.customerName || (method === "salary_cut" ? selectedMember?.name : "Tamu"),
                paymentMethod: method,
                unitType: "resto",
                memberId: selectedMember?.id || undefined,
                metadata: { tableNo: activeTable.label, orderType: activeTable.type, guestName: activeTable.customerName }
            };
            
            if (method === "cash") body.cashReceived = Number(paymentAmount);
            if (method === "qris") body.cashReceived = subtotal;
            if (method === "salary_cut") body.memberId = selectedMember?.id;

            const res = await fetch("/api/toko/sales", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            toast.success(`Bill Meja ${activeTable.label} Lunas!`);

            const receiptInfo: ReceiptData = {
                notaNo: json.data.saleNo,
                tanggal: new Date().toLocaleString("id-ID"),
                nrpNip: selectedMember?.nrp || "-",
                namaAnggota: selectedMember?.name || activeTable.customerName || "Tamu",
                kesatuan: "-",
                keterangan: `Restoran / Latar Cafe - ${activeTable.type === "dine_in" ? "Dine In" : "Takeaway"} [${activeTable.label}]`,
                total: subtotal,
                metode: method === "cash" ? "Tunai" : (method === "qris" ? "QRIS" : "Potong Gaji"),
                kasir: "Kasir Resto"
            };
            setLastReceipt(receiptInfo);
            setShowReceipt(true);

            // Clear table state
            clearTable(activeTable.id);
            setActiveTable(null);
            setPaymentAmount(""); setSelectedMember(null); setShowCreditDialog(false); setShowQrisDialog(false);
        } catch (error: any) {
            toast.error(error.message || "Gagal memproses transaksi");
        } finally { setIsProcessing(false); }
    };

    // --- Table Dashboard View ---
    if (!activeTableId) {
        const getTableColor = (t: RestoTable) => {
            if (t.cart.length > 0) return "bg-sky-500 border-sky-600 text-white shadow-md shadow-sky-200/50";
            return "bg-white border-slate-200 text-slate-700 hover:border-sky-300 hover:shadow-sm";
        };

        const dineInTables = tables.filter(t => t.type === "dine_in");
        const takeawayTables = tables.filter(t => t.type === "takeaway");

        return (
            <div className="space-y-6">
                <PageHeader
                    title="Resto & Coffe Latar POS"
                    description="Manajemen Meja Dine-In & Takeaway Koperasi"
                    actions={
                        <Button variant="outline" size="sm" className="bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200"
                            onClick={() => document.documentElement.requestFullscreen().catch(()=>{})}>
                            <Maximize className="mr-2 h-4 w-4" /> Fullscreen POS
                        </Button>
                    }
                />
                
                <div className="space-y-6 max-w-6xl mx-auto">
                    {/* Shift Warning Banner */}
                    {shiftOpen === false && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <div className="flex-1">
                                <p className="font-semibold text-sm">Shift Kasir Belum Dibuka</p>
                                <p className="text-xs mt-0.5">Buka shift terlebih dahulu agar transaksi tercatat di rekap shift kasir.</p>
                            </div>
                            <Link href="/toko/shift">
                                <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">Buka Shift</Button>
                            </Link>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center text-slate-700"><Utensils className="mr-2 h-5 w-5" /> Denah Meja (Dine In)</h2>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                        {dineInTables.map(t => (
                            <button key={t.id} onClick={() => setActiveTable(t.id)}
                                className={`h-24 rounded-2xl flex flex-col items-center justify-center border-2 transition-all group relative overflow-hidden ${getTableColor(t)}`}
                            >
                                <span className={`font-black text-xl mb-1 ${t.cart.length > 0 ? "text-white" : "text-slate-800"}`}>{t.id}</span>
                                {t.cart.length > 0 ? (
                                    <div className="flex items-center gap-1 text-xs opacity-90"><Clock className="h-3 w-3" /> Berisi</div>
                                ) : (
                                    <div className="text-xs opacity-50 font-medium">Kosong</div>
                                )}
                            </button>
                        ))}
                    </div>

                    <Separator className="my-8" />

                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center text-slate-700"><Coffee className="mr-2 h-5 w-5" /> Antrean Takeaway</h2>
                        <Button size="sm" variant="outline" onClick={addTakeaway}><Plus className="h-4 w-4 mr-2" /> Tambah Takeaway</Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {takeawayTables.map(t => (
                            <button key={t.id} onClick={() => setActiveTable(t.id)}
                                className={`h-20 rounded-xl flex items-center px-4 border-2 transition-all justify-between ${getTableColor(t)}`}
                            >
                                <div>
                                    <div className="font-bold text-sm">{t.label}</div>
                                    <div className="text-xs opacity-80 mt-0.5">{t.customerName || "Anonim"}</div>
                                </div>
                                {t.cart.length > 0 && <Badge variant="secondary" className="bg-white/20 text-white">{t.cart.length} item</Badge>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!activeTable) return null;

    // --- Order View (Inside a Table) ---
    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => setActiveTable(null)}><LayoutGrid className="h-4 w-4" /></Button>
                    <div>
                        <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                            {activeTable.label}
                            <Badge variant={activeTable.type === "dine_in" ? "default" : "secondary"}>
                                {activeTable.type === "dine_in" ? "DINE IN" : "TAKEAWAY"}
                            </Badge>
                        </h1>
                        <p className="text-xs text-muted-foreground">Order/Bill Aktif</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-1/3 relative">
                    <div className="relative flex-1">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Cari nama / NRP anggota..."
                            className="pl-9"
                            value={activeTable.customerName}
                            onChange={e => {
                                const val = e.target.value;
                                setCustomer(activeTable.id, val);
                                // Debounced member search
                                if (val.length >= 2) {
                                    const timer = setTimeout(async () => {
                                        try {
                                            const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(val)}`);
                                            const json = await res.json();
                                            setMemberResults(json.data || []);
                                        } catch {}
                                    }, 400);
                                    return () => clearTimeout(timer);
                                } else {
                                    setMemberResults([]);
                                }
                            }}
                            onFocus={() => {
                                if (activeTable.customerName.length >= 2) {
                                    // Re-trigger search on focus
                                    fetch(`/api/members/lookup?q=${encodeURIComponent(activeTable.customerName)}`)
                                        .then(r => r.json()).then(j => setMemberResults(j.data || [])).catch(() => {});
                                }
                            }}
                        />
                        {/* Member Search Dropdown */}
                        {memberResults.length > 0 && activeTable.customerName.length >= 2 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-lg shadow-xl max-h-[200px] overflow-y-auto">
                                {memberResults.map(m => (
                                    <button key={m.id} type="button"
                                        className="w-full text-left px-3 py-2.5 hover:bg-sky-50 border-b last:border-0 transition-colors"
                                        onClick={() => {
                                            setCustomer(activeTable.id, m.name);
                                            setSelectedMember(m);
                                            setMemberResults([]);
                                        }}
                                    >
                                        <p className="font-semibold text-sm text-slate-800">{m.name}</p>
                                        <p className="text-[11px] text-slate-500">NRP: {m.nrp || "-"} • No: {m.memberNo}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50 shrink-0" disabled={cart.length === 0} onClick={() => {
                        if (cart.length === 0) { toast.error("Pesanan kosong, tidak ada yang dicetak ke dapur."); return; }
                        const kotItems = cart.map(i => `${i.quantity}x ${i.product.name}${i.notes ? ` (${i.notes})` : ""}`).join(", ");
                        toast.success(`KOT Dapur dicatat — ${cart.length} item: ${kotItems}`);
                    }}><Printer className="h-4 w-4 mr-2" /> KOT Dapur</Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex gap-4">
                {/* Menu Area (Left) */}
                <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b py-3 px-4 shrink-0 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Cari Nasi Goreng, Es Teh..." className="pl-9 bg-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        {/* Category Filter Tabs */}
                        {categories.length > 1 && (
                            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                                            activeCategory === cat
                                                ? "bg-sky-600 text-white shadow-sm"
                                                : "bg-white text-slate-600 border border-slate-200 hover:border-sky-300 hover:text-sky-700"
                                        }`}
                                    >
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
                                <Utensils className="h-10 w-10 mb-3 opacity-30" />
                                <p className="text-sm font-medium">Tidak ada menu ditemukan</p>
                                <p className="text-xs mt-1">Coba ubah filter atau kata kunci pencarian</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {filteredMenu.map(p => (
                                    <button key={p.id} onClick={() => updateCart(activeTable.id, { product: p, quantity: 1 }, "add")}
                                        className="bg-white border rounded-xl flex flex-col overflow-hidden hover:border-sky-300 hover:shadow-md transition-all active:scale-[0.97] text-left group"
                                    >
                                        {/* Image Area */}
                                        <div className="h-20 w-full bg-gradient-to-br from-slate-100 to-slate-50 relative overflow-hidden">
                                            {p.imageUrl ? (
                                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Utensils className="h-8 w-8 text-slate-200" />
                                                </div>
                                            )}
                                            {p.category && (
                                                <span className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                                                    {p.category}
                                                </span>
                                            )}
                                        </div>
                                        {/* Info */}
                                        <div className="p-2.5 flex flex-col flex-1">
                                            <p className="font-semibold text-xs text-slate-800 line-clamp-2 leading-tight flex-1">{p.name}</p>
                                            <p className="text-xs font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full mt-1.5 self-start">
                                                {formatCurrency(p.price)}
                                            </p>
                                        </div>
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
                            Daftar Pesanan <Badge className="bg-sky-500">{cart.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-0">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50">
                                <Utensils className="h-12 w-12 mb-3 opacity-20" />
                                <p>Meja kosong.</p>
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
                                            <Input placeholder="Note (Pedes, Es dipisah)..." className="h-7 text-[11px] w-32 bg-white" maxLength={60}
                                                value={item.notes} onChange={e => updateCart(activeTable.id, { ...item, notes: e.target.value }, "update")} />
                                            <div className="flex items-center gap-2 bg-white border rounded-md shadow-sm">
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => updateCart(activeTable.id, { ...item, quantity: item.quantity - 1 }, "update")}><Minus className="h-3 w-3" /></Button>
                                                <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={() => updateCart(activeTable.id, { product: item.product, quantity: 1 }, "add")}><Plus className="h-3 w-3" /></Button>
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
                                onClick={() => { if(confirm("Kosongkan meja ini?")) clearTable(activeTable.id); }}>
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 shadow-sm col-span-2" onClick={() => processPayment("cash")} disabled={cart.length === 0 || isProcessing}>
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />} Bayar Tunai & Cetak Struk
                            </Button>
                            <Button variant="outline" className="h-10 border-sky-200 text-sky-700 hover:bg-sky-50" onClick={() => { if (cart.length === 0) { toast.error("Pesanan kosong"); return; } setShowQrisDialog(true); }} disabled={cart.length === 0 || isProcessing}>
                                <CreditCard className="mr-2 h-4 w-4" /> QRIS
                            </Button>
                            <Button variant="outline" className="h-10 border-slate-300 text-slate-700 hover:bg-slate-50" onClick={() => { if (cart.length === 0) { toast.error("Pesanan kosong"); return; } setShowCreditDialog(true); }} disabled={cart.length === 0 || isProcessing}>
                                <User className="mr-2 h-4 w-4" /> Potong Gaji
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Credit Salary Cut Dialog */}
            <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                {/* ... Dialog contents identical for Core Banking Gatekeeper ... */}
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kredit Makan Resto - Potong Gaji</DialogTitle>
                        <DialogDescription>Pengajuan pembayaran makan/minum ke gaji dinas.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                            <Input placeholder="Cari NRP anggota..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchMembers()} />
                            <Button onClick={searchMembers} disabled={isSearchingMember}>{isSearchingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
                        </div>
                        {memberResults.length > 0 && (
                            <div className="max-h-[150px] overflow-y-auto border rounded-md">
                                {memberResults.map(m => (
                                    <div key={m.id} className={`p-3 cursor-pointer hover:bg-slate-50 border-b last:border-0 ${selectedMember?.id === m.id ? "bg-sky-50 border-l-4 border-l-sky-500" : ""}`} onClick={() => setSelectedMember(m)}>
                                        <p className="font-semibold text-slate-800">{m.name}</p>
                                        <p className="text-xs text-slate-500">NRP: {m.nrp || "-"}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Gatekeeper Validation */}
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
                        <DialogTitle>Pembayaran QRIS — Resto &amp; Cafe</DialogTitle>
                        <DialogDescription>Minta pelanggan untuk memindai barcode QRIS di bawah ini.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-4">
                        <div className="bg-slate-50 p-4 border rounded-xl shadow-sm">
                            {qrisUrl ? (
                                <img src={qrisUrl} alt="QRIS Resto" className="w-56 h-56 object-contain" />
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
                <DialogContent className="sm:max-w-[400px] bg-slate-100 p-4">
                    <DialogHeader className="mb-2">
                        <DialogTitle className="text-center font-bold">Terima Kasih</DialogTitle>
                        <DialogDescription className="text-center">Silakan siapkan printer thermal Anda.</DialogDescription>
                    </DialogHeader>
                    {lastReceipt && (
                        <div className="flex flex-col items-center">
                            <ReceiptPrimkopol data={lastReceipt} paperSize="80mm" /> {/* Resto often uses 80mm */}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
