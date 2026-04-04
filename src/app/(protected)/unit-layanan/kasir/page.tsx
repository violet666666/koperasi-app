"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search, Banknote, CreditCard, User } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

export default function KasirCepatPage() {
    const [unitType, setUnitType] = React.useState<string>("carwash");
    const [amount, setAmount] = React.useState<string>("");
    const [customerName, setCustomerName] = React.useState<string>("");
    const [description, setDescription] = React.useState<string>("");

    const [isProcessing, setIsProcessing] = React.useState(false);

    // Member search for salary cut
    const [showCreditDialog, setShowCreditDialog] = React.useState(false);
    const [memberSearch, setMemberSearch] = React.useState("");
    const [isSearchingMember, setIsSearchingMember] = React.useState(false);
    const [memberResults, setMemberResults] = React.useState<any[]>([]);
    const [selectedMember, setSelectedMember] = React.useState<any | null>(null);

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

    return (
        <div className="space-y-6">
            <PageHeader title="Kasir Cepat Unit Layanan" description="Point of Sale untuk jasa layanan tanpa master stok" />

            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>Form Transaksi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label>Unit Usaha *</Label>
                            <Select value={unitType} onValueChange={setUnitType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="carwash">Car Wash (Cuci Mobil)</SelectItem>
                                    <SelectItem value="barbershop">Barbershop</SelectItem>
                                    <SelectItem value="play_station">Play Station</SelectItem>
                                    <SelectItem value="fitness">Fitnes</SelectItem>
                                    <SelectItem value="properti">Properti (Tanah Kapling)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

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
            </div>

            {/* Dialog Potong Gaji */}
            <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kredit — Potong Gaji</DialogTitle>
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
