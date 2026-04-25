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
import { Car, Search, Droplets, Banknote, CreditCard, Receipt, Loader2, Maximize, AlertTriangle, ShieldAlert, ShieldCheck, User, Trash2, Plus, Minus, X } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { generateRawText, ReceiptPrimkopol, type ReceiptData } from "@/components/patterns/receipt-primkopol";

interface Product { id: number; sku: string; name: string; price: number; isService: boolean; category?: string; }
interface CartItem { product: Product; quantity: number; }
interface MemberResult { id: number; memberNo: string; name: string; nrp?: string; }
interface LimitValidation { allowed: boolean; sisaLimit: number; plafonPiutang: number; totalTagihan: number; reason?: string; }

export default function CuciMobilKasirPage() {
    const [products, setProducts] = React.useState<Product[]>([]);
    const [cart, setCart] = React.useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);
    
    // Cuci Mobil specific metadata
    const [vehiclePlate, setVehiclePlate] = React.useState("");
    const [washerName, setWasherName] = React.useState("");

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
    
    // Customer autocomplete
    const [customerQuery, setCustomerQuery] = React.useState("");
    const [customerSuggestions, setCustomerSuggestions] = React.useState<MemberResult[]>([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = React.useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);
    const [selectedCustomerObj, setSelectedCustomerObj] = React.useState<MemberResult | null>(null);
    const customerRef = React.useRef<HTMLDivElement>(null);

    // Gatekeeper
    const [limitInfo, setLimitInfo] = React.useState<LimitValidation | null>(null);
    const [isValidatingLimit, setIsValidatingLimit] = React.useState(false);

    const selectCustomer = (m: MemberResult) => { setSelectedCustomerObj(m); setCustomerQuery(m.name); setCustomerSuggestions([]); setShowCustomerDropdown(false); };
    const clearCustomer = () => { setSelectedCustomerObj(null); setCustomerQuery(""); setCustomerSuggestions([]); setShowCustomerDropdown(false); };

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowCustomerDropdown(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

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

    React.useEffect(() => {
        async function fetchProducts() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/toko/products?unitType=cuci_mobil");
                const json = await res.json();
                setProducts(json.data || []);
            } catch {
                toast.error("Gagal memuat layanan Cuci Mobil");
            } finally { setIsLoading(false); }
        }
        fetchProducts();
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
        } catch {
            toast.error("Gagal mencari anggota");
        } finally { setIsSearchingMember(false); }
    };

    React.useEffect(() => {
        const validateLimit = async () => {
            if (!selectedMember?.nrp || subtotal <= 0) return;
            setIsValidatingLimit(true);
            try {
                const res = await fetch("/api/unit-transactions/validate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nrp: selectedMember.nrp, amount: subtotal, unitType: "cuci_mobil" }),
                });
                setLimitInfo(await res.json());
            } catch {
                toast.error("Gagal mengecek sisa limit plafon anggota.");
            } finally { setIsValidatingLimit(false); }
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
        if (!vehiclePlate) { toast.error("Plat Nomor kendaraan wajib diisi!"); return; }
        if (method === "cash" && Number(paymentAmount) < subtotal) { toast.error("Pembayaran kurang"); return; }
        if (method === "salary_cut" && !selectedMember) { toast.error("Pilih anggota u/ potong gaji"); return; }

        setIsProcessing(true);
        try {
            const desc = cart.map(i => `${i.product.name} x${i.quantity}`).join(", ");
            const body: any = {
                unitType: "cuci_mobil",
                amount: subtotal,
                paymentMethod: method,
                description: desc,
                customerName: vehiclePlate || "Walk-in",
                vehiclePlate,
            };
            
            // Selalu kirim memberId jika anggota terpilih, apapun metode bayarnya
            if (selectedMember?.id) body.memberId = selectedMember.id;
            else if (selectedCustomerObj?.id) body.memberId = selectedCustomerObj.id;

            const res = await fetch("/api/unit-layanan/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            toast.success(`Transaksi Cuci Mobil ${json.data.transactionNo} Berhasil!`);

            const receiptInfo: ReceiptData = {
                notaNo: json.data.transactionNo,
                tanggal: new Date().toLocaleString("id-ID"),
                nrpNip: selectedMember?.nrp || selectedCustomerObj?.nrp || "-",
                namaAnggota: selectedMember?.name || selectedCustomerObj?.name || customerQuery || "Umum",
                kesatuan: "-",
                keterangan: `Cuci Mobil [Nopol: ${vehiclePlate}] - Pencuci: ${washerName || "Tim"}`,
                total: subtotal,
                metode: method === "cash" ? "Tunai" : (method === "qris" ? "QRIS" : "Kredit/Potong Gaji"),
                kasir: "Kasir Cuci Mobil"
            };
            setLastReceipt(receiptInfo);
            setShowReceipt(true);

            // Reset
            setCart([]); setPaymentAmount(""); setVehiclePlate(""); setWasherName(""); clearCustomer();
            setSelectedMember(null); setShowCreditDialog(false);
        } catch (error: any) {
            toast.error(error.message || "Gagal memproses transaksi");
        } finally { setIsProcessing(false); }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="POS Cuci Mobil"
                description="Manajemen Penjualan Layanan Cuci Kendaraan"
                actions={
                    <Button variant="outline" size="sm" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                        onClick={() => document.documentElement.requestFullscreen().catch(()=>{})}>
                        <Maximize className="mr-2 h-4 w-4" /> Fullscreen POS
                    </Button>
                }
            />

            <div className="grid gap-6 lg:grid-cols-12 max-w-6xl mx-auto">
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Operational Details Input */}
                    <Card className="border-blue-100 shadow-sm">
                        <CardHeader className="bg-blue-50/50 pb-4 border-b">
                            <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                                <Car className="h-5 w-5" /> Data Kendaraan
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nomor Polisi (Plat) <span className="text-red-500">*</span></Label>
                                <Input placeholder="Contoh: N 1234 XY" className="uppercase font-mono text-lg tracking-wider" 
                                    value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value.toUpperCase())} />
                            </div>
                            <div className="space-y-2">
                                <Label>Nama Petugas Cuci (Washer)</Label>
                                <Input placeholder="Untuk perhitungan komisi..." 
                                    value={washerName} onChange={e => setWasherName(e.target.value)} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Services Selection Grid */}
                    <Card className="flex-1 border-slate-200 shadow-sm">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Droplets className="h-5 w-5 text-sky-500" /> Katalog Layanan
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {products.map(p => (
                                        <button key={p.id} onClick={() => addToCart(p)}
                                            className="min-h-[100px] p-4 rounded-xl border-2 border-transparent bg-slate-50 hover:bg-sky-50 hover:border-sky-200 text-left transition-all active:scale-95 group relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <Droplets className="h-12 w-12 text-sky-600" />
                                            </div>
                                            <div className="relative z-10 flex-1">
                                                <p className="font-bold text-sm text-slate-800 leading-tight">{p.name}</p>
                                                {p.category && (
                                                    <p className="text-[11px] text-slate-500 mt-1.5 leading-tight opacity-90 line-clamp-2">Contoh: {p.category}</p>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="mt-3 bg-white relative z-10 text-sky-700 border-sky-200">{formatCurrency(p.price)}</Badge>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Cart & Checkout Panel */}
                <div className="lg:col-span-4">
                    <Card className="sticky top-6 shadow-md border-slate-200">
                        <CardHeader className="bg-slate-50 border-b pb-4">
                            <CardTitle className="text-lg flex items-center justify-between">
                                Keranjang
                                {cart.length > 0 && <Badge className="bg-primary">{cart.length} item</Badge>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {/* Customer Autocomplete */}
                            <div className="space-y-1" ref={customerRef}>
                                <Label className="text-xs text-slate-500">Pelanggan / NRP Anggota (opsional)</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                                    <Input placeholder="Ketik NRP/Nama anggota..." value={customerQuery}
                                        onChange={e => { setCustomerQuery(e.target.value); if (selectedCustomerObj) setSelectedCustomerObj(null); }}
                                        className={`h-8 text-sm pl-9 pr-8 ${selectedCustomerObj ? 'border-blue-400 bg-blue-50/50' : ''}`} />
                                    {selectedCustomerObj && <button onClick={clearCustomer} className="absolute right-2 top-2"><X className="h-4 w-4 text-slate-400" /></button>}
                                    {isSearchingCustomer && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-slate-400" />}
                                </div>
                                {showCustomerDropdown && customerSuggestions.length > 0 && (
                                    <div className="absolute z-50 mt-1 w-[calc(100%-2rem)] max-h-[150px] overflow-y-auto bg-white border rounded-md shadow-lg">
                                        {customerSuggestions.map(m => (
                                            <div key={m.id} className="p-2 cursor-pointer hover:bg-blue-50 border-b last:border-0 text-sm" onClick={() => selectCustomer(m)}>
                                                <span className="font-semibold">{m.name}</span>
                                                <span className="text-xs text-slate-500 ml-2">NRP: {m.nrp || "-"}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {selectedCustomerObj && <p className="text-xs text-blue-600 mt-0.5">✓ {selectedCustomerObj.name} (NRP: {selectedCustomerObj.nrp})</p>}
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
                                {cart.length === 0 ? (
                                    <p className="text-sm text-center text-slate-400 py-8">Belum ada layanan dipilih</p>
                                ) : cart.map(item => (
                                    <div key={item.product.id} className="flex flex-col gap-2 p-3 bg-white border rounded-lg shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-semibold text-slate-700 leading-tight pr-4">{item.product.name}</p>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-red-500 hover:bg-red-50" onClick={() => removeFromCart(item.product.id)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-sm font-mono text-slate-600">{formatCurrency(item.product.price)}</p>
                                            <div className="flex items-center bg-slate-100 rounded-md">
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                                                <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl space-y-2 border">
                                <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                                <Separator className="my-1" />
                                <div className="flex justify-between text-xl font-bold text-slate-800">
                                    <span>Total Bayar</span><span className="tracking-tight">{formatCurrency(subtotal)}</span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Uang Diterima (Tunai)</Label>
                                <Input type="number" placeholder="Input uang cash..." value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)} className="text-lg font-mono text-right border-slate-300" />
                                {Number(paymentAmount) >= subtotal && subtotal > 0 && (
                                    <p className="text-sm font-semibold text-emerald-600 text-right bg-emerald-50 p-2 rounded-md">
                                        Kembalian: {formatCurrency(change)}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 shadow-sm" onClick={() => processPayment("cash")} disabled={cart.length === 0 || isProcessing}>
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />} Tunai
                                </Button>
                                <Button size="lg" className="bg-sky-600 hover:bg-sky-700 shadow-sm" onClick={() => processPayment("qris")} disabled={cart.length === 0 || isProcessing}>
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />} QRIS
                                </Button>
                            </div>
                            <Button variant="outline" size="lg" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 mt-2" 
                                disabled={cart.length === 0} onClick={() => setShowCreditDialog(true)}>
                                <User className="mr-2 h-4 w-4" /> Via Potong Gaji (Kredit)
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Credit Salary Cut Dialog */}
            <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kredit Cuci Mobil</DialogTitle>
                        <DialogDescription>Tarikan piutang bulanan ke gaji anggota.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                            <Input placeholder="Cari NRP anggota..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchMembers()} />
                            <Button onClick={searchMembers} disabled={isSearchingMember}>{isSearchingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
                        </div>
                        {memberResults.length > 0 && (
                            <div className="max-h-[150px] overflow-y-auto border rounded-md">
                                {memberResults.map(m => (
                                    <div key={m.id} className={`p-3 cursor-pointer hover:bg-slate-50 border-b last:border-0 ${selectedMember?.id === m.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`} onClick={() => setSelectedMember(m)}>
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
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 flex-shrink-0 animate-spin" /> : limitInfo?.allowed === false ? <AlertTriangle className="mr-2 h-4 w-4" /> : <CreditCard className="mr-2 h-4 w-4" />}
                            {limitInfo?.allowed === false ? "Akses Ditolak" : "Proses Tagihan Kas"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Receipt Print Overlay */}
            <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Struk Pembayaran</DialogTitle>
                        <DialogDescription>Siapkan printer thermal untuk mencetak struk.</DialogDescription>
                    </DialogHeader>
                    {lastReceipt && (
                        <div className="flex flex-col items-center p-4 bg-slate-100 rounded-lg">
                            <ReceiptPrimkopol data={lastReceipt} paperSize="58mm" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}
