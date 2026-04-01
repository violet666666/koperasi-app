"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Search } from "lucide-react";
import { receiptsApi, memberLookupApi, type Member } from "@/lib/api/services";
import { PAYMENT_METHODS } from "@/lib/terbilang";

export default function TambahKwitansiPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSearching, setIsSearching] = React.useState(false);
    const [member, setMember] = React.useState<Member | null>(null);

    const [formData, setFormData] = React.useState({
        nrp: "",
        type: "",
        referenceNo: "",
        amount: "",
        description: "",
        paymentMethod: "cash",
        notes: "",
        receiptDate: new Date().toISOString().split("T")[0],
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const searchMember = async () => {
        if (!formData.nrp) {
            toast.error("Masukkan NRP terlebih dahulu");
            return;
        }
        setIsSearching(true);
        try {
            const response = await memberLookupApi.byNrp(formData.nrp);
            // API returns { data: Member[] } (array), pick the first match
            const members = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
            if (members.length > 0) {
                setMember(members[0]);
                toast.success("Anggota ditemukan");
            } else {
                setMember(null);
                toast.error("Anggota tidak ditemukan");
            }
        } catch {
            setMember(null);
            toast.error("Anggota tidak ditemukan");
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            searchMember();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!member) {
            toast.error("Silakan cari anggota lewat NRP terlebih dahulu");
            return;
        }
        if (!formData.type) {
            toast.error("Pilih jenis transaksi");
            return;
        }

        setIsLoading(true);
        try {
            await receiptsApi.create({
                memberId: member.id,
                type: formData.type,
                referenceNo: formData.referenceNo || undefined,
                amount: Number(formData.amount),
                description: formData.description,
                receivedFrom: member.name,
                paymentMethod: formData.paymentMethod,
                notes: formData.notes || undefined,
                receiptDate: formData.receiptDate,
            });

            toast.success("Draft kwitansi berhasil dibuat");
            router.push("/kwitansi");
        } catch {
            toast.error("Gagal membuat kwitansi");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Buat Kwitansi Baru"
                description="Buat draft kwitansi untuk transaksi PRIMKOPPOL"
                backHref="/kwitansi"
            />

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">Form Kwitansi</CardTitle>
                        <CardDescription>Isi data kwitansi untuk draft</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
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
                                    <Button type="button" variant="secondary" onClick={searchMember} disabled={isSearching || !formData.nrp}>
                                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="type">Jenis Transaksi *</Label>
                                <Select value={formData.type} onValueChange={(v) => handleSelectChange("type", v)} required>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Pilih jenis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="simpanan">Setoran Simpanan</SelectItem>
                                        <SelectItem value="pinjaman">Pencairan Pinjaman</SelectItem>
                                        <SelectItem value="angsuran">Pembayaran Angsuran</SelectItem>
                                        <SelectItem value="unit_transaction">Transaksi Unit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="referenceNo">No. Referensi (Opsional)</Label>
                                <Input
                                    id="referenceNo"
                                    name="referenceNo"
                                    value={formData.referenceNo}
                                    onChange={handleChange}
                                    placeholder="No. transaksi terkait"
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="description">Keterangan *</Label>
                                <Input
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Cth: Setoran simpanan wajib bulan Maret 2026"
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
                                <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
                                <Select value={formData.paymentMethod} onValueChange={(v) => handleSelectChange("paymentMethod", v)}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAYMENT_METHODS.map((m) => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="receiptDate">Tanggal Kwitansi *</Label>
                                <Input
                                    id="receiptDate"
                                    name="receiptDate"
                                    type="date"
                                    value={formData.receiptDate}
                                    onChange={handleChange}
                                    required
                                    className="mt-1"
                                />
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

                            <Button type="submit" disabled={isLoading || !member} className="w-full mt-4">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Simpan Draft Kwitansi
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

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
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${member.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                            {member.status === "active" ? "Aktif" : "Non-Aktif"}
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
