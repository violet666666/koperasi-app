"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { receiptsApi } from "@/lib/api/services";
import { PAYMENT_METHODS } from "@/lib/terbilang";

interface ReceiptDetail {
    id: number;
    receiptNo: string;
    type: string;
    referenceNo?: string;
    description: string;
    amount: number;
    receivedFrom: string;
    paymentMethod: string;
    status: string;
    notes?: string;
    receiptDate: string;
    member?: { id: number; memberNo: string; nrp?: string; name: string };
    createdBy?: { id: number; name: string };
}

const typeLabels: Record<string, string> = {
    simpanan: "Setoran Simpanan",
    pinjaman: "Pencairan Pinjaman",
    angsuran: "Pembayaran Angsuran",
    unit_transaction: "Transaksi Unit",
};

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

export default function EditKwitansiPage() {
    const params = useParams();
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [receipt, setReceipt] = React.useState<ReceiptDetail | null>(null);

    const [formData, setFormData] = React.useState({
        type: "",
        referenceNo: "",
        amount: "",
        description: "",
        paymentMethod: "cash",
        notes: "",
        receiptDate: "",
    });

    // Load receipt data
    React.useEffect(() => {
        if (!params.id) return;
        async function loadReceipt() {
            setIsLoading(true);
            try {
                const response = await receiptsApi.get(Number(params.id));
                const data = (response as unknown as { data: ReceiptDetail }).data;
                setReceipt(data);

                if (data.status !== "draft") {
                    toast.error("Hanya kwitansi draft yang dapat diedit");
                    router.push("/kwitansi");
                    return;
                }

                setFormData({
                    type: data.type,
                    referenceNo: data.referenceNo || "",
                    amount: String(data.amount),
                    description: data.description,
                    paymentMethod: data.paymentMethod,
                    notes: data.notes || "",
                    receiptDate: new Date(data.receiptDate).toISOString().split("T")[0],
                });
            } catch (error) {
                console.error("Failed to load receipt:", error);
                toast.error("Gagal memuat data kwitansi");
            } finally {
                setIsLoading(false);
            }
        }
        loadReceipt();
    }, [params.id, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!receipt) return;

        setIsSaving(true);
        try {
            await receiptsApi.update(receipt.id, {
                type: formData.type,
                referenceNo: formData.referenceNo || undefined,
                amount: formData.amount,
                description: formData.description,
                paymentMethod: formData.paymentMethod,
                notes: formData.notes || undefined,
                receiptDate: formData.receiptDate,
            });

            toast.success("Kwitansi berhasil diperbarui");
            router.push("/kwitansi");
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Gagal menyimpan perubahan");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!receipt) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                Kwitansi tidak ditemukan
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Edit Kwitansi: ${receipt.receiptNo}`}
                description="Edit data kwitansi draft"
                backHref="/kwitansi"
            />

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">Edit Data Kwitansi</CardTitle>
                        <CardDescription>Perubahan hanya berlaku untuk kwitansi berstatus Draft</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
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

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
                                    Batal
                                </Button>
                                <Button type="submit" disabled={isSaving} className="flex-1">
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Simpan Perubahan
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Info Panel */}
                <div className="space-y-4">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-lg">Info Anggota</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-3 gap-2 py-2 border-b">
                                <div className="text-sm text-muted-foreground">Nama</div>
                                <div className="col-span-2 font-medium">{receipt.member?.name || receipt.receivedFrom}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 py-2 border-b">
                                <div className="text-sm text-muted-foreground">No. Anggota</div>
                                <div className="col-span-2">{receipt.member?.memberNo || "-"}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 py-2 border-b">
                                <div className="text-sm text-muted-foreground">NRP</div>
                                <div className="col-span-2">{receipt.member?.nrp || "-"}</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg text-amber-700">⚠ Catatan Penting</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2 text-muted-foreground">
                            <p>• Hanya kwitansi berstatus <strong>Draft</strong> yang dapat diedit.</p>
                            <p>• Kwitansi yang sudah <strong>Dicetak</strong> harus di-<strong>Void</strong> (batalkan) terlebih dahulu jika terjadi kesalahan.</p>
                            <p>• Perubahan anggota tidak dapat dilakukan di halaman edit. Jika salah anggota, hapus dan buat kwitansi baru.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
