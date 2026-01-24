"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Save, Search, User } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

// Mock member search result
const MOCK_MEMBERS = [
    { id: 1, member_no: "A-001", name: "Budi Santoso", savings_balance: 5000000 },
    { id: 2, member_no: "A-002", name: "Siti Aminah", savings_balance: 3500000 },
    { id: 3, member_no: "A-003", name: "Joko Widodo", savings_balance: 2200000 },
];

export default function TambahSimpananPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedMember, setSelectedMember] = React.useState<typeof MOCK_MEMBERS[0] | null>(null);

    // Form state
    const [formData, setFormData] = React.useState({
        type: "deposit",
        product_id: "",
        amount: "",
        payment_method: "cash",
        bank_account_id: "",
        reference_no: "",
        notes: "",
        transaction_date: new Date().toISOString().split("T")[0],
    });

    // Auto-select member from URL params
    React.useEffect(() => {
        const memberId = searchParams.get("member_id");
        if (memberId) {
            const member = MOCK_MEMBERS.find((m) => m.id === parseInt(memberId));
            if (member) {
                setSelectedMember(member);
            }
        }
    }, [searchParams]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleMemberSearch = () => {
        // Simulate member search
        const member = MOCK_MEMBERS.find(
            (m) => m.member_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (member) {
            setSelectedMember(member);
        } else {
            toast.error("Anggota tidak ditemukan");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedMember) {
            toast.error("Pilih anggota terlebih dahulu");
            return;
        }

        if (!formData.product_id) {
            toast.error("Pilih produk simpanan");
            return;
        }

        setIsLoading(true);

        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const typeLabel = formData.type === "deposit" ? "Setoran" : "Penarikan";
            toast.success(`${typeLabel} simpanan berhasil dicatat`);
            router.push("/simpanan/transaksi");
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
                title="Transaksi Simpanan Baru"
                description="Catat setoran atau penarikan simpanan anggota"
                backHref="/simpanan/transaksi"
            />

            <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
                {/* Member Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Anggota</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!selectedMember ? (
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Cari nama atau no. anggota..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleMemberSearch())}
                                        className="pl-9"
                                    />
                                </div>
                                <Button type="button" onClick={handleMemberSearch}>
                                    Cari
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                                        {selectedMember.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                    </div>
                                    <div>
                                        <p className="font-medium">{selectedMember.name}</p>
                                        <p className="text-sm text-muted-foreground">{selectedMember.member_no}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Total Simpanan</p>
                                    <p className="text-lg font-bold text-emerald-600 tabular-nums">
                                        {formatCurrency(selectedMember.savings_balance)}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedMember(null)}
                                >
                                    Ganti
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Transaction Type */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Jenis Transaksi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RadioGroup
                            value={formData.type}
                            onValueChange={(value) => handleSelectChange("type", value)}
                            className="flex gap-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="deposit" id="deposit" />
                                <Label htmlFor="deposit" className="cursor-pointer">Setoran</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="withdrawal" id="withdrawal" />
                                <Label htmlFor="withdrawal" className="cursor-pointer">Penarikan</Label>
                            </div>
                        </RadioGroup>
                    </CardContent>
                </Card>

                {/* Transaction Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Detail Transaksi</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="product_id">Produk Simpanan *</Label>
                            <Select
                                value={formData.product_id}
                                onValueChange={(value) => handleSelectChange("product_id", value)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih produk" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Simpanan Pokok</SelectItem>
                                    <SelectItem value="2">Simpanan Wajib</SelectItem>
                                    <SelectItem value="3">Simpanan Sukarela</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="amount">Jumlah *</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    Rp
                                </span>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    placeholder="0"
                                    min="0"
                                    required
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="payment_method">Metode Pembayaran *</Label>
                            <Select
                                value={formData.payment_method}
                                onValueChange={(value) => handleSelectChange("payment_method", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih metode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Tunai</SelectItem>
                                    <SelectItem value="bank_transfer">Transfer Bank</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="transaction_date">Tanggal Transaksi *</Label>
                            <Input
                                id="transaction_date"
                                name="transaction_date"
                                type="date"
                                value={formData.transaction_date}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {formData.payment_method === "bank_transfer" && (
                            <div>
                                <Label htmlFor="bank_account_id">Rekening Bank</Label>
                                <Select
                                    value={formData.bank_account_id}
                                    onValueChange={(value) => handleSelectChange("bank_account_id", value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih rekening" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">BCA - 1234567890</SelectItem>
                                        <SelectItem value="2">Mandiri - 0987654321</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div>
                            <Label htmlFor="reference_no">No. Referensi</Label>
                            <Input
                                id="reference_no"
                                name="reference_no"
                                value={formData.reference_no}
                                onChange={handleChange}
                                placeholder="Opsional"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <Label htmlFor="notes">Catatan</Label>
                            <Textarea
                                id="notes"
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                placeholder="Catatan tambahan (opsional)"
                                rows={2}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Batal
                    </Button>
                    <Button type="submit" disabled={isLoading || !selectedMember}>
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
                </div>
            </form>
        </div>
    );
}
