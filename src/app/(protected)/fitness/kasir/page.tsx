"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Dumbbell, Search, Banknote, CreditCard, Loader2, Maximize, ShieldAlert, ShieldCheck, User, Plus, Minus, Package, X, AlertCircle, CheckCircle2, QrCode } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { ReceiptPrimkopol, type ReceiptData } from "@/components/patterns/receipt-primkopol";

interface Product { id: number; sku: string; name: string; price: number; isService: boolean; }
interface CartItem { product: Product; quantity: number; }
interface MemberResult { id: number; memberNo: string; name: string; nrp?: string; }
interface LimitValidation { allowed: boolean; sisaLimit: number; plafonPiutang: number; totalTagihan: number; reason?: string; }

export default function FitnessKasirPage() {
    const [products, setProducts] = React.useState<Product[]>([]);
    const [cart, setCart] = React.useState<CartItem[]>([]);
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

    // Customer autocomplete (NRP/Nama)
    const [customerQuery, setCustomerQuery] = React.useState("");
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

    // Debounce NRP/Name autocomplete
    React.useEffect(() => {
        if (selectedCustomerObj) return;
        if (!customerQuery || customerQuery.length < 2) { setCustomerSuggestions([]); setShowCustomerDropdown(false); return; }
        const timer = setTimeout(async () => {
            setIsSearchingCustomer(true);
            try {
                const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(customerQuery)}`);
                const json = await res.json();
                const results: MemberResult[] = json.data || [];
                setCustomerSuggestions(results); setShowCustomerDropdown(results.length > 0);
            } catch { setCustomerSuggestions([]); }
            finally { setIsSearchingCustomer(false); }
        }, 350);
        return () => clearTimeout(timer);
    }, [customerQuery, selectedCustomerObj]);

    const selectCustomer = (m: MemberResult) => { setSelectedCustomerObj(m); setCustomerQuery(m.name); setCustomerSuggestions([]); setShowCustomerDropdown(false); };
    const clearCustomer = () => { setSelectedCustomerObj(null); setCustomerQuery(""); setCustomerSuggestions([]); setShowCustomerDropdown(false); };

    React.useEffect(() => {
        async function fetchProducts() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/toko/products?unitType=fitness");
                const json = await res.json();
                setProducts(json.data || []);
            } catch { toast.error("Gagal memuat layanan Fitness"); }
            finally { setIsLoading(false); }
        }
        async function fetchQris() {
            try {
                const res = await fetch("/api/unit-layanan/stats?unitType=fitness");
                const json = await res.json();
                if (json.data?.qrisUrl) setQrisUrl(json.data.qrisUrl);
            } catch {}
        }
        fetchProducts();
        fetchQris();
    }, []);

    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const change = Number(paymentAmount) - subtotal;

    const MAX_QTY = 999;

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                const newQty = Math.min(existing.quantity + 1, MAX_QTY);
                return prev.map(item => item.product.id === product.id ? { ...item, quantity: newQty } : item);
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id !== productId) return item;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return item;
            if (newQty > MAX_QTY) return item;
            return { ...item, quantity: newQty };
        }));
    };

    const removeFromCart = (productId: number) => setCart(prev => prev.filter(item => item.product.id !== productId));

    const searchMembers = async () => {
        if (!memberSearch.trim()) return;
        setIsSearchingMember(true);
        try {
            const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(memberSearch)}`);
            const json = await res.json();
            setMemberResults(json.data || []);
        } catch { toast.error("Gagal mencari anggota"); }
        finally { setIsSearchingMember(false); }
    };

    React.useEffect(() => {
        const validateLimit = async () => {
            if (!selectedMember?.nrp || subtotal <= 0) return;
            setIsValidatingLimit(true);
            try {
                const res = await fetch("/api/unit-transactions/validate", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nrp: selectedMember.nrp, amount: subtotal, unitType: "fitness" }),
                });
                setLimitInfo(await res.json());
            } catch { toast.error("Gagal cek limit plafon anggota."); }
            finally { setIsValidatingLimit(false); }
        };
        if (selectedMember) validateLimit();
        else setLimitInfo(null);
    }, [selectedMember, subtotal]);

    const processPayment = async (method: "cash" | "qris" | "salary_cut") => {
        if (cart.length === 0) { toast.error("Pilih layanan terlebih dahulu"); return; }
        const invalidItem = cart.find(item => !item.quantity || isNaN(item.quantity) || item.quantity <= 0);
        if (invalidItem) { toast.error(`Jumlah "${invalidItem.product.name}" tidak valid (harus > 0)`); return; }
        const overMaxItem = cart.find(item => item.quantity > MAX_QTY);
        if (overMaxItem) { toast.error(`Jumlah "${overMaxItem.product.name}" melebihi batas maksimal (${MAX_QTY})`); return; }
        if (method === "cash" && Number(paymentAmount) < subtotal) { toast.error("Pembayaran kurang"); return; }
        if (method === "salary_cut" && !selectedMember) { toast.error("Pilih anggota u/ potong gaji"); return; }

        setIsProcessing(true);
        try {
            const body: any = {
                items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
                customerName: customerQuery || (method === "salary_cut" ? selectedMember?.name : "Umum"),
                paymentMethod: method, unitType: "fitness",
                memberId: selectedCustomerObj?.id || (method === "salary_cut" ? selectedMember?.id : undefined),
            };
            if (method === "cash") body.cashReceived = Number(paymentAmount);
            if (method === "qris") body.cashReceived = subtotal;
            if (method === "salary_cut") body.memberId = selectedMember?.id;

            const res = await fetch("/api/toko/sales", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            toast.success(`Transaksi Fitness ${json.data.saleNo} Berhasil!`);
            setLastReceipt({
                notaNo: json.data.saleNo, tanggal: new Date().toLocaleString("id-ID"),
                nrpNip: selectedMember?.nrp || selectedCustomerObj?.nrp || "-",
                namaAnggota: selectedMember?.name || selectedCustomerObj?.name || customerQuery || "Umum",
                kesatuan: "-", keterangan: "Fitness / Gym",
                total: subtotal,
                metode: method === "cash" ? "Tunai" : (method === "qris" ? "QRIS" : "Kas/Potong Gaji"),
                kasir: "Kasir Fitness"
            });
            setShowReceipt(true);
            setCart([]); setPaymentAmount(""); clearCustomer();
            setSelectedMember(null); setShowCreditDialog(false); setShowQrisDialog(false);
        } catch (error: any) {
            toast.error(error.message || "Gagal memproses transaksi");
        } finally { setIsProcessing(false); }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="POS Fitness & Gym"
                description="Manajemen Kasir Layanan Fitness"
                actions={
                    <Button variant="outline" size="sm" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                        onClick={() => document.documentElement.requestFullscreen().catch(()=>{})}>
                        <Maximize className="mr-2 h-4 w-4" /> Mode Terminal
                    </Button>
                }
            />

            <div className="grid gap-6 lg:grid-cols-12 max-w-6xl mx-auto">
                {/* Checkout Panel */}
                <div className="lg:col-span-4">
                    <Card className="sticky top-6 shadow-md border-slate-200">
                        <CardHeader className="bg-emerald-400/10 border-b pb-4">
                            <CardTitle className="text-lg flex items-center justify-between text-emerald-900">
                                Info Checkout
                                {cart.length > 0 && <Badge className="bg-emerald-600">{cart.length} item</Badge>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-3 bg-white p-3 rounded-md border border-slate-100 shadow-sm">
                                <div className="space-y-1" ref={customerRef}>
                                    <Label className="text-xs">Pelanggan / NRP Anggota</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                                        <Input placeholder="Ketik NRP/Nama anggota..." value={customerQuery}
                                            onChange={e => { setCustomerQuery(e.target.value); if (selectedCustomerObj) setSelectedCustomerObj(null); }}
                                            className={`h-8 text-sm pl-9 pr-8 ${selectedCustomerObj ? 'border-emerald-400 bg-emerald-50/50' : ''}`} />
                                        {selectedCustomerObj && <button onClick={clearCustomer} className="absolute right-2 top-2"><X className="h-4 w-4 text-slate-400" /></button>}
                                        {isSearchingCustomer && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-slate-400" />}
                                    </div>
                                    {showCustomerDropdown && customerSuggestions.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-[calc(100%-1.5rem)] max-h-[150px] overflow-y-auto bg-white border rounded-md shadow-lg">
                                            {customerSuggestions.map(m => (
                                                <div key={m.id} className="p-2 cursor-pointer hover:bg-emerald-50 border-b last:border-0 text-sm" onClick={() => selectCustomer(m)}>
                                                    <span className="font-semibold">{m.name}</span>
                                                    <span className="text-xs text-slate-500 ml-2">NRP: {m.nrp || "-"}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectedCustomerObj && <p className="text-xs text-emerald-600 mt-0.5">✓ {selectedCustomerObj.name} (NRP: {selectedCustomerObj.nrp})</p>}
                                </div>
                            </div>

                            <Separator />

                            <div className="max-h-[250px] overflow-y-auto space-y-2 pr-2">
                                {cart.length === 0 ? (
                                    <p className="text-sm text-center text-slate-400 py-4">Pilih layanan/paket di samping</p>
                                ) : cart.map(item => (
                                    <div key={item.product.id} className="flex justify-between items-center py-2 border-b border-dashed last:border-0 border-slate-200">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className="text-sm font-semibold text-slate-700 leading-tight">{item.product.name}</p>
                                            <p className="text-xs text-slate-500">{formatCurrency(item.product.price)} x {item.quantity}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                                            <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                                            <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-emerald-50 p-4 rounded-xl space-y-2 border border-emerald-100">
                                <div className="flex justify-between text-2xl font-black text-emerald-950">
                                    <span>Total</span><span className="tracking-tight">{formatCurrency(subtotal)}</span>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <Input type="number" placeholder="Input Pembayaran Kas..." value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)} className="text-lg font-mono text-center border-slate-300 h-12" />
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={() => processPayment("cash")} disabled={cart.length === 0 || isProcessing}>
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />} Tunai
                                </Button>
                                <Button size="lg" className="bg-sky-600 hover:bg-sky-700 shadow-sm" onClick={() => { if (cart.length === 0) { toast.error("Pilih layanan"); return; } setShowQrisDialog(true); }} disabled={cart.length === 0 || isProcessing}>
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />} QRIS
                                </Button>
                            </div>
                            <Button variant="outline" size="lg" className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 mt-2" 
                                disabled={cart.length === 0} onClick={() => setShowCreditDialog(true)}>
                                <User className="mr-2 h-4 w-4 text-slate-400" /> Bayar Anggota (Gaji)
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Services Grid */}
                <div className="lg:col-span-8">
                    <Card className="h-full border-slate-200 shadow-sm min-h-[500px]">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Dumbbell className="h-5 w-5 text-emerald-600" /> Menu Layanan Fitness
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                            ) : products.length === 0 ? (
                                <div className="text-center py-16 text-slate-400">
                                    <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">Belum ada layanan</p>
                                    <p className="text-sm mt-1">Admin dapat menambahkan layanan melalui menu Manajemen Layanan</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {products.map(p => (
                                        <button key={p.id} onClick={() => addToCart(p)}
                                            className="relative flex flex-col items-center justify-center h-32 p-3 rounded-2xl border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 group"
                                        >
                                            <div className={`p-3 rounded-full mb-2 ${p.isService ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {p.isService ? <Dumbbell className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                                            </div>
                                            <p className="font-semibold text-slate-800 text-sm text-center leading-tight line-clamp-2">{p.name}</p>
                                            <span className="text-xs font-mono font-bold text-slate-500 mt-1">{formatCurrency(p.price)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Credit Dialog */}
            <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kredit Fitness - Potong Gaji</DialogTitle>
                        <DialogDescription>Pengajuan pembayaran bulanan ke gaji dinas.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                            <Input placeholder="Cari NRP anggota..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchMembers()} />
                            <Button onClick={searchMembers} disabled={isSearchingMember}>{isSearchingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
                        </div>
                        {memberResults.length > 0 && (
                            <div className="max-h-[150px] overflow-y-auto border rounded-md">
                                {memberResults.map(m => (
                                    <div key={m.id} className={`p-3 cursor-pointer hover:bg-slate-50 border-b last:border-0 ${selectedMember?.id === m.id ? "bg-emerald-50 border-l-4 border-l-emerald-500" : ""}`} onClick={() => setSelectedMember(m)}>
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
                                    <span className={limitInfo.allowed ? "text-emerald-700" : "text-red-700"}>{limitInfo.allowed ? "Sisa Limit Aman" : "Limit Tidak Cukup!"}</span>
                                </div>
                                <p className="text-sm">Sisa limit aktif: {formatCurrency(limitInfo.sisaLimit)}</p>
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreditDialog(false)}>Batal</Button>
                        <Button disabled={!selectedMember || isProcessing || (limitInfo !== null && !limitInfo.allowed)} onClick={() => processPayment("salary_cut")}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                            Proses Potong Gaji
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* QRIS Payment Dialog */}
            <Dialog open={showQrisDialog} onOpenChange={setShowQrisDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Pembayaran QRIS — Fitness</DialogTitle>
                        <DialogDescription>Minta pelanggan untuk memindai barcode QRIS di bawah ini.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-4">
                        <div className="bg-slate-50 p-4 border rounded-xl shadow-sm">
                            {qrisUrl ? (
                                <img src={qrisUrl} alt="QRIS Fitness" className="w-56 h-56 object-contain" />
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

            {/* Receipt */}
            <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                <DialogContent className="sm:max-w-[360px] bg-slate-100 p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-center font-bold">Terima Kasih</DialogTitle>
                        <DialogDescription className="text-center">Silakan siapkan printer thermal Anda.</DialogDescription>
                    </DialogHeader>
                    {lastReceipt && <div className="flex flex-col items-center"><ReceiptPrimkopol data={lastReceipt} paperSize="58mm" /></div>}
                </DialogContent>
            </Dialog>
        </div>
    );
}
