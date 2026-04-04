"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Search, History } from "lucide-react";
import { unitTransactionsApi, memberLookupApi, Member } from "@/lib/api/services";

export default function TransaksiUnitPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSearching, setIsSearching] = React.useState(false);
    const [member, setMember] = React.useState<Member | null>(null);

    // Form state
    const [formData, setFormData] = React.useState({
        nrp: "",
        unitType: "",
        description: "",
        amount: "",
        transactionDate: new Date().toISOString().split("T")[0],
        isPaid: false,
        notes: "",
        carwashCategory: "",
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => {
            const updates = { ...prev, [name]: value };
            
            // Auto-fill amount for carwash
            if (name === "carwashCategory") {
                const prices: Record<string, string> = {
                    "Motor": "15000",
                    "Mobil kecil": "35000",
                    "Mobil sedang": "40000",
                    "Mobil besar": "45000",
                    "Mobil jumbo": "50000"
                };
                if (prices[value]) {
                    updates.amount = prices[value];
                }
            }
            
            return updates;
        });
    };

    const handleSwitchChange = (checked: boolean) => {
        setFormData((prev) => ({ ...prev, isPaid: checked }));
    };

    const searchMember = async () => {
        if (!formData.nrp) {
            toast.error("Masukkan NRP terlebih dahulu");
            return;
        }

        setIsSearching(true);
        try {
            const response = await memberLookupApi.byNrp(formData.nrp);
            if (response.data) {
                setMember(response.data);
                toast.success("Anggota ditemukan");
            } else {
                setMember(null);
                toast.error("Anggota tidak ditemukan");
            }
        } catch (error) {
            console.error("Lookup error:", error);
            setMember(null);
            toast.error("Anggota tidak ditemukan atau terjadi kesalahan");
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchMember();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!member) {
            toast.error("Silakan cari anggota berdasarkan NRP terlebih dahulu");
            return;
        }

        if (!formData.unitType) {
            toast.error("Silakan pilih Unit Transaksi");
            return;
        }

        if (formData.unitType === "cuci_mobil" && !formData.carwashCategory) {
            toast.error("Silakan pilih Kategori Kendaraan (Mobil/Motor)");
            return;
        }

        setIsLoading(true);

        try {
            const finalDescription = formData.unitType === "cuci_mobil"
                ? `[${formData.carwashCategory}] ${formData.description}`
                : formData.description;

            await unitTransactionsApi.create({
                nrp: formData.nrp,
                unitType: formData.unitType,
                description: finalDescription,
                amount: Number(formData.amount),
                transactionDate: formData.transactionDate,
                isPaid: formData.isPaid,
                notes: formData.notes,
            });

            toast.success("Transaksi unit berhasil dicatat");

            // Reset form but keep the date
            setFormData(prev => ({
                nrp: "",
                unitType: "",
                description: "",
                amount: "",
                transactionDate: prev.transactionDate,
                isPaid: false,
                notes: "",
                carwashCategory: "",
            }));
            setMember(null);

            // Ask if they want to view history
            toast("Lihat Riwayat Transaksi?", {
                action: {
                    label: "Lihat",
                    onClick: () => router.push("/transaksi-unit/riwayat")
                }
            });
        } catch (error) {
            toast.error("Gagal mencatat transaksi");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Input Transaksi Unit"
                description="Catat mutasi transaksi dari berbagai unit PRIMKOPPOL"
                actions={(
                    <Button variant="outline" asChild>
                        <Link href="/transaksi-unit/riwayat">
                            <History className="mr-2 h-4 w-4" />
                            Riwayat Transaksi
                        </Link>
                    </Button>
                )}
            />

            <div className="grid gap-6 md:grid-cols-2">
                {/* Panel Kiri: Pencarian Anggota & Form Transaksi */}
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">Form Transaksi</CardTitle>
                        <CardDescription>Masukkan NRP dan detail transaksi</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="nrp">NRP Anggota *</Label>
                                    <div className="flex mt-1 gap-2">
                                        <Input
                                            id="nrp"
                                            name="nrp"
                                            value={formData.nrp}
                                            onChange={handleChange}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Masukkan NRP..."
                                            required
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={searchMember}
                                            disabled={isSearching || !formData.nrp}
                                        >
                                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="unitType">Pilih Unit *</Label>
                                    <Select
                                        value={formData.unitType}
                                        onValueChange={(value) => handleSelectChange("unitType", value)}
                                        required
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Pilih unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="toko">Toko / Retail</SelectItem>
                                            <SelectItem value="simpan_pinjam">Simpan Pinjam (Admin Fee)</SelectItem>
                                            <SelectItem value="fotocopy">FotoCopy & ATK</SelectItem>
                                            <SelectItem value="cuci_mobil">Cuci Mobil</SelectItem>
                                            <SelectItem value="fitness">Fitness Center</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.unitType === "cuci_mobil" && (
                                    <div>
                                        <Label htmlFor="carwashCategory">Kategori Kendaraan *</Label>
                                        <Select
                                            value={formData.carwashCategory}
                                            onValueChange={(value) => handleSelectChange("carwashCategory", value)}
                                            required
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Pilih kategori (Mobil / Motor)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Motor">Motor (Rp 15.000)</SelectItem>
                                                <SelectItem value="Mobil kecil">Mobil kecil (Rp 35.000)</SelectItem>
                                                <SelectItem value="Mobil sedang">Mobil sedang (Rp 40.000)</SelectItem>
                                                <SelectItem value="Mobil besar">Mobil besar (Rp 45.000)</SelectItem>
                                                <SelectItem value="Mobil jumbo">Mobil jumbo (Rp 50.000)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="description">Deskripsi Transaksi *</Label>
                                    <Input
                                        id="description"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        placeholder="Cth: Cuci Reguler"
                                        required
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="amount">Nominal (Rp) *</Label>
                                    <Input
                                        id="amount"
                                        name="amount"
                                        type="number"
                                        min="0"
                                        value={formData.amount}
                                        onChange={handleChange}
                                        placeholder="0"
                                        required
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="transactionDate">Tanggal Transaksi *</Label>
                                    <Input
                                        id="transactionDate"
                                        name="transactionDate"
                                        type="date"
                                        value={formData.transactionDate}
                                        onChange={handleChange}
                                        required
                                        className="mt-1"
                                    />
                                </div>

                                <div className="flex items-center space-x-2 py-2 border rounded-md px-3 bg-muted/30">
                                    <Switch
                                        id="isPaid"
                                        checked={formData.isPaid}
                                        onCheckedChange={handleSwitchChange}
                                    />
                                    <Label htmlFor="isPaid" className="cursor-pointer">Status: LUNAS</Label>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        (Geser jika pembayaran langung lunas)
                                    </span>
                                </div>

                                <div>
                                    <Label htmlFor="notes">Catatan (Opsional)</Label>
                                    <Textarea
                                        id="notes"
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleChange}
                                        placeholder="Catatan tambahan..."
                                        rows={2}
                                        className="mt-1"
                                    />
                                </div>

                                {/* Dokumen Pendukung - hanya untuk Simpan Pinjam */}
                                {formData.unitType === "simpan_pinjam" && (
                                    <div className="border rounded-lg p-3 bg-blue-50/50">
                                        <Label htmlFor="supportingDoc" className="flex items-center gap-2 text-sm font-medium">
                                            📎 Dokumen Pendukung (Opsional)
                                        </Label>
                                        <p className="text-xs text-muted-foreground mb-2">Upload dokumen pendukung untuk transaksi simpan pinjam (PDF, JPG, PNG, max 5MB)</p>
                                        <Input
                                            id="supportingDoc"
                                            name="supportingDoc"
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            className="mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-primary/20"
                                        />
                                    </div>
                                )}
                            </div>

                            <Button type="submit" disabled={isLoading || !member} className="w-full mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Simpan Transaksi
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Panel Kanan: Info Anggota */}
                <div>
                    {member ? (
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader>
                                <CardTitle className="text-lg">Detail Anggota</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-2 py-2 border-b">
                                    <div className="text-sm text-muted-foreground">Nama</div>
                                    <div className="col-span-2 font-medium">{member.name}</div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 py-2 border-b">
                                    <div className="text-sm text-muted-foreground">NRP</div>
                                    <div className="col-span-2">{member.nrp || "-"}</div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 py-2 border-b">
                                    <div className="text-sm text-muted-foreground">No. Anggota</div>
                                    <div className="col-span-2">{member.memberNo}</div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 py-2 border-b">
                                    <div className="text-sm text-muted-foreground">Status</div>
                                    <div className="col-span-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {member.status === 'active' ? 'Aktif' : 'Non-Aktif'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                            <Search className="h-10 w-10 mb-4 opacity-50" />
                            <p>Masukkan NRP untuk melihat detail anggota</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
