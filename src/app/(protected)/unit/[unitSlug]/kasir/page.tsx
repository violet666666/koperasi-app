"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Search, Banknote, CreditCard, User, ShieldX, Car, Scissors, Gamepad2, Dumbbell, Shirt, UtensilsCrossed, Store, QrCode, AlertCircle, CheckCircle2, Maximize, X, Check, CalendarDays } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useAuth } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";

// Allowed roles for this page
const ALLOWED_ROLES = ["kasir", "admin", "operator"];

// Unit types with display config
const UNIT_OPTIONS = [
    { value: "cuci_mobil", label: "Cuci Mobil & Motor", icon: Car },
    { value: "barbershop", label: "Barbershop", icon: Scissors },
    { value: "playstation", label: "Play Station", icon: Gamepad2 },
    { value: "fitness", label: "Fitness", icon: Dumbbell },
    { value: "laundry", label: "Laundry", icon: Shirt },
    { value: "resto_cafe", label: "Resto & Cafe (Latar)", icon: UtensilsCrossed },
    { value: "toko", label: "Toko PRIMKOPPOL", icon: Store },
];

export default function DedicatedKasirPage({ params }: { params: Promise<{ unitSlug: string }> }) {
    const { user } = useAuth();
    const resolvedParams = React.use(params);
    const unitSlug = resolvedParams.unitSlug;
    const unitType = unitSlug ? unitSlug.replace(/-/g, '_') : "";
    
    // Auto-detect unit from user profile
    const userUnitType = (user as any)?.unitType as string | null | undefined;
    const roleName = typeof user?.role === "string" ? user.role : (user?.role as any)?.name ?? "";
    const isKasir = roleName === "kasir";
    const isOperator = roleName === "operator" || user?.permissions?.includes("manage_all");
    const isAdmin = roleName === "admin" && userUnitType === unitType;

    const [amount, setAmount] = React.useState<string>("");
    const [customerName, setCustomerName] = React.useState<string>("");
    const [description, setDescription] = React.useState<string>("");
    const [selectedPackage, setSelectedPackage] = React.useState<string>("");
    const [vehiclePlate, setVehiclePlate] = React.useState<string>(""); // Plat Nomor (Cuci Mobil)
    const [transactionDate, setTransactionDate] = React.useState<string>(""); // Tanggal transaksi (backdate)

    const [isProcessing, setIsProcessing] = React.useState(false);

    // Member search for salary cut
    const [showCreditDialog, setShowCreditDialog] = React.useState(false);
    const [memberSearch, setMemberSearch] = React.useState("");
    const [isSearchingMember, setIsSearchingMember] = React.useState(false);
    const [memberResults, setMemberResults] = React.useState<any[]>([]);
    const [selectedMember, setSelectedMember] = React.useState<any | null>(null);
    
    // Limit piutang check
    const [limitInfo, setLimitInfo] = React.useState<{ sisaLimit: number; plafonPiutang: number; totalTagihan: number } | null>(null);
    const [isLoadingLimit, setIsLoadingLimit] = React.useState(false);
    
    // Token intercept
    const [showQrisDialog, setShowQrisDialog] = React.useState(false);

    // Auto-detect member by NRP for Tunai/QRIS
    const [selectedCustomerObj, setSelectedCustomerObj] = React.useState<any | null>(null);
    const [customerSearchResults, setCustomerSearchResults] = React.useState<any[]>([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = React.useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);
    const customerInputRef = React.useRef<HTMLInputElement>(null);
    const customerDropdownRef = React.useRef<HTMLDivElement>(null);

    // Search by NRP or Nama
    React.useEffect(() => {
        if (selectedCustomerObj) return; // Sudah dipilih, tidak perlu search
        if (!customerName || customerName.length < 2) {
            setCustomerSearchResults([]);
            setShowCustomerDropdown(false);
            return;
        }

        const timeout = setTimeout(async () => {
            setIsSearchingCustomer(true);
            try {
                const res = await fetch(`/api/members?search=${encodeURIComponent(customerName)}&limit=8`);
                const json = await res.json();
                const results = json.data || [];
                setCustomerSearchResults(results);
                setShowCustomerDropdown(results.length > 0);
            } catch {
                setCustomerSearchResults([]);
                setShowCustomerDropdown(false);
            } finally {
                setIsSearchingCustomer(false);
            }
        }, 350);

        return () => clearTimeout(timeout);
    }, [customerName, selectedCustomerObj]);

    // Tutup dropdown saat klik di luar
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node) &&
                customerInputRef.current && !customerInputRef.current.contains(e.target as Node)
            ) {
                setShowCustomerDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selectCustomer = (member: any) => {
        setSelectedCustomerObj(member);
        setCustomerName(member.name);
        setCustomerSearchResults([]);
        setShowCustomerDropdown(false);
        toast.success(`✓ Anggota dipilih: ${member.name} (${member.nrp || member.memberNo})`);
    };

    const clearCustomer = () => {
        setSelectedCustomerObj(null);
        setCustomerName("");
        setCustomerSearchResults([]);
        setShowCustomerDropdown(false);
        customerInputRef.current?.focus();
    };

    // Check role access
    const role = roleName;
    const hasAccess = isOperator || isKasir || isAdmin;
    
    // Security layer: If Kasir/Admin accesses wrong slug
    const isWrongUnit = !isOperator && userUnitType !== unitType;

    // Fetch dynamic packages for this unit
    const { data: availablePackages = [], isLoading: isLoadingPackages } = useQuery({
        queryKey: ["unit-packages-active", unitSlug],
        queryFn: async () => {
            const res = await fetch(`/api/unit/${unitSlug}/packages`);
            if (!res.ok) throw new Error("Gagal load paket");
            const data = await res.json();
            return data.filter((pkg: any) => pkg.isActive);
        },
        enabled: hasAccess && !isWrongUnit
    });

    // Fetch QRIS image from DB via stats API
    const { data: qrisUrl } = useQuery({
        queryKey: ["unit-qris-url", unitType],
        queryFn: async () => {
            const res = await fetch(`/api/unit-layanan/stats?unitType=${unitType}`);
            if (!res.ok) return null;
            const json = await res.json();
            return json.data?.qrisUrl ?? null;
        },
        enabled: hasAccess && !isWrongUnit && !!unitType,
        staleTime: 30000,
    });

    const currentUnit = UNIT_OPTIONS.find(u => u.value === unitType);

    // When a package is selected, auto-fill amount and description
    const handlePackageSelect = (pkgLabel: string) => {
        const pkg = availablePackages.find((p: any) => p.name === pkgLabel);
        if (pkg) {
            setSelectedPackage(pkgLabel);
            setAmount(String(pkg.price));
            setDescription(pkgLabel);
        }
    };

    const searchMembers = async () => {
        if (!memberSearch || memberSearch.length < 2) {
            toast.error("Masukkan minimal 2 karakter pencarian");
            return;
        }
        setIsSearchingMember(true);
        try {
            const res = await fetch(`/api/members?search=${encodeURIComponent(memberSearch)}`);
            const json = await res.json();
            setMemberResults(json.data || []);
            if (json.data?.length === 0) toast.error("Anggota tidak ditemukan");
        } catch {
            toast.error("Gagal mencari anggota");
        } finally { setIsSearchingMember(false); }
    };

    const selectMemberAndCheckLimit = async (member: any) => {
        setSelectedMember(member);
        setLimitInfo(null);
        setIsLoadingLimit(true);
        try {
            const res = await fetch(`/api/unit-transactions/validate?memberId=${member.id}&amount=${Number(amount) || 0}`);
            const json = await res.json();
            if (json.data) {
                setLimitInfo({
                    sisaLimit: json.data.sisaLimit ?? 0,
                    plafonPiutang: json.data.plafonPiutang ?? 0,
                    totalTagihan: json.data.totalTagihan ?? 0,
                });
            }
        } catch {
            // If validate API fails, let server block it
        } finally {
            setIsLoadingLimit(false);
        }
    };

    const processPayment = async (method: "cash" | "qris" | "salary_cut") => {
        const nominal = Number(amount);
        if (nominal <= 0) { toast.error("Masukkan nominal transaksi yang valid"); return; }
        if (method === "salary_cut" && !selectedMember) { toast.error("Pilih anggota untuk potong gaji"); return; }

        setIsProcessing(true);
        try {
            const body: any = {
                unitType,
                amount: nominal,
                paymentMethod: method,
                customerName: method === "salary_cut" ? selectedMember?.name : (selectedCustomerObj?.name || customerName || undefined),
                description: description || undefined,
                vehiclePlate: vehiclePlate.trim() || undefined, // Plat nomor untuk cuci mobil
                transactionDate: transactionDate || undefined, // Tanggal backdate
            };

            if (method === "salary_cut") {
                body.memberId = selectedMember?.id;
            } else if (selectedCustomerObj) {
                body.memberId = selectedCustomerObj.id;
            }

            const res = await fetch("/api/unit-layanan/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();

            if (!res.ok) { toast.error(json.message || "Gagal memproses transaksi"); return; }

            toast.success(
                method === "salary_cut"
                    ? `Transaksi Potong Gaji ${json.data.transactionNo} berhasil dicatat untuk ${selectedMember?.name}!`
                    : `Transaksi ${method === "cash" ? "Tunai" : "QRIS"} ${json.data.transactionNo} berhasil menjurnal!`
            );

            // Reset form
            setAmount("");
            setCustomerName("");
            setDescription("");
            setSelectedPackage("");
            setVehiclePlate(""); // Reset plat nomor
            setTransactionDate(""); // Reset tanggal
            setSelectedMember(null);
            setSelectedCustomerObj(null);
            setCustomerSearchResults([]);
            setShowCustomerDropdown(false);
            setShowCreditDialog(false);
            setShowQrisDialog(false);
            setMemberSearch("");
            setMemberResults([]);

        } catch (error) {
            toast.error("Terjadi kesalahan pada sistem");
        } finally {
            setIsProcessing(false);
        }
    };

    // ACCESS DENIED view
    if (!hasAccess || isWrongUnit) {
        return (
            <div className="space-y-6">
                <PageHeader title="Kasir Cepat Unit Layanan" description="Point of Sale untuk jasa layanan" />
                <div className="max-w-md mx-auto mt-12">
                    <Alert className="border-destructive/50 bg-destructive/5">
                        <ShieldX className="h-5 w-5 text-destructive" />
                        <AlertTitle className="text-destructive font-semibold">Akses Ditolak</AlertTitle>
                        <AlertDescription>
                            Anda mencoba mengakses POS Unit yang bukan hak Anda.
                            <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                                <li>Anda terdaftar di unit: <strong>{userUnitType || "Pusat"}</strong></li>
                                <li>Anda mencoba mengakses: <strong>{unitType}</strong></li>
                            </ul>
                            <p className="mt-3 text-sm text-muted-foreground">Kembali ke Dashboard atau hubungi Admin.</p>
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <PageHeader 
                title={`Kasir: ${currentUnit?.label || formatUnitName(unitSlug)}`} 
                description="Point of Sale terdedikasi"
                actions={
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
                }
            />

            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>Form Transaksi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label>Unit Usaha</Label>
                            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                                {(() => {
                                    const UnitIcon = currentUnit?.icon ?? Store;
                                    return (
                                        <>
                                            <UnitIcon className="h-5 w-5 text-primary" />
                                            <span className="font-medium text-lg">{currentUnit?.label ?? unitType}</span>
                                            <Badge variant="secondary" className="ml-auto">Active POS</Badge>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Package selector */}
                        {isLoadingPackages ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : availablePackages.length > 0 ? (
                            <div className="space-y-2">
                                <Label>Buku Tarif / Paket Layanan</Label>
                                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 pb-2">
                                    {availablePackages.map((pkg: any) =>
                                        <button
                                            key={pkg.id}
                                            type="button"
                                            onClick={() => handlePackageSelect(pkg.name)}
                                            className={`flex items-center justify-between px-4 py-3 border rounded-lg text-sm transition-all hover:border-primary/50 shadow-sm ${
                                                selectedPackage === pkg.name
                                                    ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary/30"
                                                    : "border-border bg-background"
                                            }`}
                                        >
                                            <div className="text-left">
                                                <span className="block font-medium">{pkg.name}</span>
                                                {pkg.description && (
                                                    <span className="text-xs text-muted-foreground block mt-0.5 line-clamp-1">{pkg.description}</span>
                                                )}
                                            </div>
                                            <span className={`font-bold shrink-0 ml-2 text-lg ${selectedPackage === pkg.name ? "text-primary" : "text-muted-foreground"}`}>
                                                {formatCurrency(pkg.price)}
                                            </span>
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">*Pilih paket untuk mengisi nominal otomatis</p>
                            </div>
                        ) : (
                            <div className="p-4 bg-muted/30 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
                                Belum ada daftar layanan untuk unit ini. Admin Unit dapat membuatnya di menu <strong>Kelola Layanan</strong>.
                            </div>
                        )}

                        {/* Nominal */}
                        <div className="space-y-2">
                            <Label>Nominal Transaksi (Rp) *</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                className="text-xl font-bold text-right"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Keterangan / Jasa (Opsional)</Label>
                            <Input
                                placeholder="Misal: Paket Cuci Salju Ekstra"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {/* Input Plat Nomor — Khusus Unit Cuci Mobil */}
                        {unitType === "cuci_mobil" && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    🚗 Plat Nomor Kendaraan
                                    <span className="text-xs text-muted-foreground font-normal">(Opsional, untuk arsip)</span>
                                </Label>
                                <Input
                                    placeholder="Misal: N 5844 YBW"
                                    value={vehiclePlate}
                                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                                    className="font-mono tracking-widest uppercase"
                                    maxLength={12}
                                />
                            </div>
                        )}

                        {/* Tanggal Transaksi — Backdate untuk input transaksi lama */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5 text-sm">
                                <CalendarDays className="h-3.5 w-3.5" /> Tanggal Transaksi
                            </Label>
                            <Input
                                type="date"
                                value={transactionDate}
                                onChange={(e) => setTransactionDate(e.target.value)}
                                max={new Date().toISOString().split("T")[0]}
                            />
                            {!transactionDate && (
                                <p className="text-[11px] text-muted-foreground">Kosongkan = hari ini</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center justify-between">
                                <span>Identitas Pelanggan (Walk-In / Opsional)</span>
                                {selectedCustomerObj && (
                                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">
                                        ✓ Anggota Terpilih
                                    </Badge>
                                )}
                            </Label>
                            <div className="relative">
                                <div className="flex gap-2 relative">
                                    <User className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10 ${selectedCustomerObj ? "text-emerald-500" : "text-muted-foreground"}`} />
                                    <Input
                                        ref={customerInputRef}
                                        placeholder="Ketik nama atau NRP anggota..."
                                        value={customerName}
                                        onChange={(e) => {
                                            if (selectedCustomerObj) setSelectedCustomerObj(null);
                                            setCustomerName(e.target.value);
                                        }}
                                        onFocus={() => {
                                            if (customerSearchResults.length > 0) setShowCustomerDropdown(true);
                                        }}
                                        className={`pl-10 ${
                                            selectedCustomerObj 
                                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 pr-8" 
                                                : isSearchingCustomer 
                                                ? "border-blue-300 pr-8" 
                                                : ""
                                        }`}
                                        autoComplete="off"
                                    />
                                    {/* Icon state */}
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {isSearchingCustomer && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                                        {selectedCustomerObj && (
                                            <button
                                                type="button"
                                                onClick={clearCustomer}
                                                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-emerald-200 text-emerald-600"
                                                title="Hapus pilihan"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Autocomplete Dropdown */}
                                {showCustomerDropdown && customerSearchResults.length > 0 && (
                                    <div
                                        ref={customerDropdownRef}
                                        className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-border rounded-lg shadow-xl overflow-hidden"
                                    >
                                        <div className="px-3 py-1.5 bg-muted/50 border-b">
                                            <p className="text-[10px] text-muted-foreground font-medium">
                                                {customerSearchResults.length} anggota ditemukan — klik untuk pilih
                                            </p>
                                        </div>
                                        <div className="max-h-52 overflow-y-auto">
                                            {customerSearchResults.map((member: any) => (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    onClick={() => selectCustomer(member)}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-primary/5 transition-colors border-b border-border/40 last:border-0"
                                                >
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">{member.name}</p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {member.nrp || member.memberNo}
                                                            {member.category && <span className="ml-1 text-blue-500">· {member.category}</span>}
                                                        </p>
                                                    </div>
                                                    <Check className="h-4 w-4 text-primary shrink-0 opacity-0 group-hover:opacity-100" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Info / selected state */}
                            {selectedCustomerObj ? (
                                <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-50 border border-emerald-200 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 text-[10px] font-bold">
                                        {selectedCustomerObj.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-emerald-800 truncate">{selectedCustomerObj.name}</p>
                                        <p className="text-[10px] text-emerald-600">{selectedCustomerObj.nrp || selectedCustomerObj.memberNo} · {selectedCustomerObj.category || "Anggota"}</p>
                                    </div>
                                    <Badge className="text-[9px] bg-emerald-600 text-white border-0 shrink-0">✓ Terpilih</Badge>
                                </div>
                            ) : (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Cari NRP atau nama anggota untuk tercatat di riwayat portal
                                </p>
                            )}
                        </div>

                        <div className="pt-4 space-y-3">
                            <Label className="text-base font-semibold">Tuntaskan Pembayaran</Label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                    className="flex-1 py-6 text-base shadow-md hover:shadow-lg"
                                    disabled={!amount || Number(amount) <= 0 || isProcessing}
                                    onClick={() => setTimeout(() => processPayment("cash"), 15)}
                                >
                                    {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Banknote className="mr-2 h-5 w-5" />}
                                    Bayar Tunai
                                </Button>
                                <Button
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 py-6 text-base shadow-md hover:shadow-lg"
                                    disabled={!amount || Number(amount) <= 0 || isProcessing}
                                    onClick={() => setShowQrisDialog(true)}
                                >
                                    {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <QrCode className="mr-2 h-5 w-5" />}
                                    Bayar QRIS
                                </Button>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full border-primary/50 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50"
                                disabled={!amount || Number(amount) <= 0 || isProcessing}
                                onClick={() => setShowCreditDialog(true)}
                            >
                                <User className="mr-2 h-4 w-4" />
                                Bayar via Potong Gaji (Bon Anggota)
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Info card */}
                <div className="space-y-6">
                    <Card className="bg-muted/10 border-dashed border-2">
                        <CardHeader>
                            <CardTitle className="text-base">Panduan POS Terdedikasi</CardTitle>
                            <CardDescription>Sistem Kasir Aman Terkunci ke {currentUnit?.label || 'Unit'}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="space-y-2">
                                <p className="font-semibold">💰 Aliran Dana:</p>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li><strong>Tunai</strong> — Uang masuk ke akun Kas Internal Unit</li>
                                    <li><strong>QRIS</strong> — Uang masuk ke akun Bank Koperasi</li>
                                    <li><strong>Potong Gaji</strong> — Tercatat otomatis sebagai Piutang Anggota yang dipilih</li>
                                </ul>
                            </div>
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                                <p className="font-semibold text-sm mb-1 flex items-center">
                                    <ShieldX className="h-4 w-4 mr-1 inline" /> 
                                    Isolasi Keamanan
                                </p>
                                <p>Kasir hanya dapat melihat, melayani, dan mengajukan pembatalan (void) pada transaksi milik unit ini (<strong>{formatUnitName(unitSlug)}</strong>).</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Dialog Potong Gaji */}
            <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                {/* ... existing dialog potentional unchanged ... same implementation as before ...*/}
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kredit — Potong Gaji Anggota</DialogTitle>
                        <DialogDescription>
                            Cari anggota berdasarkan NRP atau Nama. Tagihan akan masuk ke Sistem Piutang.
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
                                        onClick={() => selectMemberAndCheckLimit(m)}>
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
                            <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">{selectedMember.name}</p>
                                        <p className="text-sm text-muted-foreground">NRP: {selectedMember.nrp || "-"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Tagihan ini</p>
                                        <p className="font-bold text-primary">{formatCurrency(Number(amount))}</p>
                                    </div>
                                </div>
                                {isLoadingLimit ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Memeriksa limit piutang...</div>
                                ) : limitInfo ? (
                                    <div className={`p-2 rounded text-xs space-y-1 border ${
                                        limitInfo.sisaLimit >= Number(amount)
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                            : "bg-red-50 border-red-200 text-red-800"
                                    }`}>
                                        <div className="flex justify-between"><span>Plafon Piutang:</span><strong>{formatCurrency(limitInfo.plafonPiutang)}</strong></div>
                                        <div className="flex justify-between"><span>Tagihan Aktif:</span><strong>{formatCurrency(limitInfo.totalTagihan)}</strong></div>
                                        <div className="flex justify-between border-t pt-1 mt-1 font-semibold">
                                            <span>Sisa Limit:</span>
                                            <strong className={limitInfo.sisaLimit >= Number(amount) ? "text-emerald-700" : "text-red-700"}>
                                                {formatCurrency(limitInfo.sisaLimit)}
                                            </strong>
                                        </div>
                                        {limitInfo.sisaLimit < Number(amount) && (
                                            <p className="text-red-700 font-semibold pt-1">⚠️ Sisa limit tidak mencukupi untuk transaksi ini!</p>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowCreditDialog(false); setLimitInfo(null); }}>Batal</Button>
                        <Button 
                            disabled={!selectedMember || isProcessing || isLoadingLimit || (limitInfo !== null && limitInfo.sisaLimit < Number(amount))} 
                            onClick={() => processPayment("salary_cut")}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                            Proses Potong Gaji
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog QRIS Intercept */}
            <Dialog open={showQrisDialog} onOpenChange={setShowQrisDialog}>
                {/* ... existing QRIS dialog implementation ... */}
                <DialogContent className="sm:max-w-md text-center">
                    <DialogHeader>
                        <DialogTitle className="text-center text-2xl font-bold flex items-center justify-center gap-2">
                            <QrCode className="h-6 w-6 text-blue-600" />
                            Pembayaran QRIS
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Arahkan pelanggan untuk melakukan scan Barcode di bawah ini
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/50 min-h-[300px] relative">
                        <img 
                            src={qrisUrl || undefined} 
                            alt={`QRIS ${unitType}`}
                            className="max-h-[350px] object-contain shadow-lg rounded-xl border-4 border-white"
                            style={{ display: qrisUrl ? 'block' : 'none' }}
                        />
                        <div className={`${qrisUrl ? 'hidden' : 'flex'} flex-col items-center text-muted-foreground mt-4`}>
                            <AlertCircle className="h-16 w-16 mb-2 text-red-400" />
                            <p className="text-sm font-semibold text-red-600">Kode QRIS Unit Belum Diatur!</p>
                            <p className="text-xs max-w-[250px] text-center mt-1">
                                Minta Admin Unit atau sistem untuk mendeklarasikan foto Barcode QRIS di Pengaturan Koperasi.
                            </p>
                        </div>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg flex justify-between items-center text-left">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Tagihan:</p>
                            <p className="text-xl font-bold text-blue-600">{formatCurrency(Number(amount))}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">Keterangan:</p>
                            <p className="text-xs font-medium truncate max-w-[150px]">{description || `Jasa ${unitType}`}</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-2 w-full">
                        <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-base py-6"
                            disabled={isProcessing} 
                            onClick={() => {
                                // Add 15ms timeout to yield main thread and resolve INP rendering backlog 
                                setTimeout(() => processPayment("qris"), 15);
                            }}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                            Pelanggan Sudah Membayar
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => setShowQrisDialog(false)}>
                            Batal
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function formatUnitName(slug: string) {
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
