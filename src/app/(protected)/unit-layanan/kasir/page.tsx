"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Search, Banknote, CreditCard, User, ShieldX, Car, Scissors, Gamepad2, Dumbbell, Shirt, UtensilsCrossed, Store } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useAuth } from "@/lib/hooks";

// Allowed roles for this page
const ALLOWED_ROLES = ["kasir", "admin", "operator_unit"];

// Unit types with display config
const UNIT_OPTIONS = [
    { value: "cuci_mobil", label: "Cuci Mobil & Motor", icon: Car },
    { value: "barbershop", label: "Barbershop", icon: Scissors },
    { value: "playstation", label: "Play Station", icon: Gamepad2 },
    { value: "fitness", label: "Fitness", icon: Dumbbell },
    { value: "laundry", label: "Laundry", icon: Shirt },
    { value: "resto_cafe", label: "Resto & Cafe (Latar)", icon: UtensilsCrossed },
    { value: "toko", label: "Toko Sembako", icon: Store },
];

// Carwash packages with fixed prices
const CARWASH_PACKAGES = [
    { label: "Motor", price: 15000 },
    { label: "Mobil Kecil (Avanza, Xenia, dll)", price: 35000 },
    { label: "Mobil Sedang (Innova, Ertiga, dll)", price: 40000 },
    { label: "Mobil Besar (Fortuner, Pajero, dll)", price: 45000 },
    { label: "Mobil Jumbo (Hiace, Minibus, dll)", price: 50000 },
];

// Barbershop packages
const BARBERSHOP_PACKAGES = [
    { label: "Potong Rambut Biasa", price: 15000 },
    { label: "Potong + Creambath", price: 30000 },
    { label: "Cukur Jenggot", price: 10000 },
    { label: "Potong + Pewarnaan", price: 50000 },
];

function getPackagesForUnit(unitType: string): { label: string; price: number }[] {
    switch (unitType) {
        case "cuci_mobil": return CARWASH_PACKAGES;
        case "barbershop": return BARBERSHOP_PACKAGES;
        default: return [];
    }
}

export default function KasirCepatPage() {
    const { user } = useAuth();
    const [unitType, setUnitType] = React.useState<string>("cuci_mobil");
    const [amount, setAmount] = React.useState<string>("");
    const [customerName, setCustomerName] = React.useState<string>("");
    const [description, setDescription] = React.useState<string>("");
    const [selectedPackage, setSelectedPackage] = React.useState<string>("");

    const [isProcessing, setIsProcessing] = React.useState(false);

    // Member search for salary cut
    const [showCreditDialog, setShowCreditDialog] = React.useState(false);
    const [memberSearch, setMemberSearch] = React.useState("");
    const [isSearchingMember, setIsSearchingMember] = React.useState(false);
    const [memberResults, setMemberResults] = React.useState<any[]>([]);
    const [selectedMember, setSelectedMember] = React.useState<any | null>(null);

    // Check role access
    const role = user?.role?.name ?? "";
    const hasAccess = ALLOWED_ROLES.includes(role) || role === "admin";

    // When unitType changes, reset package selection
    const handleUnitChange = (val: string) => {
        setUnitType(val);
        setSelectedPackage("");
        setAmount("");
        setDescription("");
    };

    // When a package is selected, auto-fill amount and description
    const handlePackageSelect = (pkgLabel: string) => {
        const packages = getPackagesForUnit(unitType);
        const pkg = packages.find(p => p.label === pkgLabel);
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
                customerName: method === "salary_cut" ? selectedMember?.name : (customerName || undefined),
                description: description || undefined,
            };

            if (method === "salary_cut") {
                body.memberId = selectedMember?.id;
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
            setSelectedMember(null);
            setShowCreditDialog(false);
            setMemberSearch("");
            setMemberResults([]);

        } catch (error) {
            toast.error("Terjadi kesalahan pada sistem");
        } finally {
            setIsProcessing(false);
        }
    };

    // ACCESS DENIED view for operators
    if (!hasAccess) {
        return (
            <div className="space-y-6">
                <PageHeader title="Kasir Cepat Unit Layanan" description="Point of Sale untuk jasa layanan tanpa master stok" />
                <div className="max-w-md mx-auto mt-12">
                    <Alert className="border-destructive/50 bg-destructive/5">
                        <ShieldX className="h-5 w-5 text-destructive" />
                        <AlertTitle className="text-destructive font-semibold">Akses Dibatasi</AlertTitle>
                        <AlertDescription>
                            Halaman <strong>Kasir Cepat</strong> hanya dapat diakses oleh:
                            <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                                <li>Admin Sistem</li>
                                <li>Kasir Unit</li>
                                <li>Operator Unit</li>
                            </ul>
                            <p className="mt-3 text-sm text-muted-foreground">Jika Anda merasa ini kesalahan, hubungi Admin PRIMKOPPOL.</p>
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    const availablePackages = getPackagesForUnit(unitType);
    const currentUnit = UNIT_OPTIONS.find(u => u.value === unitType);

    return (
        <div className="space-y-6">
            <PageHeader title="Kasir Cepat Unit Layanan" description="Point of Sale untuk jasa layanan tanpa master stok" />

            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>Form Transaksi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Unit Selector */}
                        <div className="space-y-2">
                            <Label>Unit Usaha *</Label>
                            <Select value={unitType} onValueChange={handleUnitChange}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {UNIT_OPTIONS.map(u => (
                                        <SelectItem key={u.value} value={u.value}>
                                            <span className="flex items-center gap-2">
                                                <u.icon className="h-4 w-4" />
                                                {u.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Package selector for specific units */}
                        {availablePackages.length > 0 && (
                            <div className="space-y-2">
                                <Label>Paket Layanan {currentUnit?.label}</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {availablePackages.map(pkg => (
                                        <button
                                            key={pkg.label}
                                            type="button"
                                            onClick={() => handlePackageSelect(pkg.label)}
                                            className={`flex items-center justify-between px-4 py-3 border rounded-lg text-sm transition-all hover:border-primary/50 ${
                                                selectedPackage === pkg.label
                                                    ? "border-primary bg-primary/5 text-primary font-semibold"
                                                    : "border-border bg-background"
                                            }`}
                                        >
                                            <span>{pkg.label}</span>
                                            <span className={`font-bold ${selectedPackage === pkg.label ? "text-primary" : "text-muted-foreground"}`}>
                                                {formatCurrency(pkg.price)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">*Pilih paket untuk mengisi nominal otomatis</p>
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

                        <div className="space-y-2">
                            <Label>Nama Pelanggan Walk-In (Opsional)</Label>
                            <Input
                                placeholder="Tulis nama pelanggan..."
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 space-y-3">
                            <Label>Metode Pembayaran</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    className="w-full"
                                    disabled={!amount || Number(amount) <= 0 || isProcessing}
                                    onClick={() => processPayment("cash")}
                                >
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
                                    Bayar Tunai
                                </Button>
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                    disabled={!amount || Number(amount) <= 0 || isProcessing}
                                    onClick={() => processPayment("qris")}
                                >
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                                    Bayar QRIS
                                </Button>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full border-primary/50"
                                disabled={!amount || Number(amount) <= 0 || isProcessing}
                                onClick={() => setShowCreditDialog(true)}
                            >
                                <User className="mr-2 h-4 w-4" />
                                Bayar via Potong Gaji Anggota
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Info card */}
                <Card className="bg-muted/30 border-dashed">
                    <CardHeader>
                        <CardTitle className="text-base">Panduan Kasir Cepat</CardTitle>
                        <CardDescription>Layanan tanpa pendataan stok barang</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="space-y-2">
                            <p className="font-semibold">💰 Metode Pembayaran:</p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li><strong>Tunai</strong> — Uang masuk ke akun Kas Unit</li>
                                <li><strong>QRIS</strong> — Uang masuk ke akun Bank Unit</li>
                                <li><strong>Potong Gaji</strong> — Tercatat sebagai piutang anggota yang dipotong dari gaji bulan berikutnya</li>
                            </ul>
                        </div>
                        {unitType === "cuci_mobil" && (
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-1">
                                <p className="font-semibold text-blue-700">🚗 Tarif Cuci Mobil & Motor:</p>
                                {CARWASH_PACKAGES.map(p => (
                                    <div key={p.label} className="flex justify-between text-xs text-blue-800">
                                        <span>{p.label}</span>
                                        <span className="font-bold">{formatCurrency(p.price)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                            <p className="font-semibold">⚠️ Catatan:</p>
                            <p>Untuk metode Potong Gaji, wajib memilih Anggota yang bersangkutan untuk mencatat piutang secara akurat.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Dialog Potong Gaji */}
            <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
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
                            <div className="p-3 border rounded-lg bg-muted/30 flex justify-between items-center">
                                <div>
                                    <p className="font-medium">{selectedMember.name}</p>
                                    <p className="text-sm text-muted-foreground">NRP: {selectedMember.nrp || "-"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Tagihan</p>
                                    <p className="font-bold text-primary">{formatCurrency(Number(amount))}</p>
                                </div>
                            </div>
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
