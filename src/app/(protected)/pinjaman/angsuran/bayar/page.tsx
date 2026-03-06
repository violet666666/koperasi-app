"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function BayarAngsuranPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const loanId = searchParams.get("loanId");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [amount, setAmount] = React.useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loanId || !amount) {
            toast.error("Lengkapi data pembayaran");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/loans/${loanId}/payments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: parseFloat(amount), paymentMethod: "cash", paymentDate: new Date().toISOString().split("T")[0] }),
            });
            if (!res.ok) throw new Error("Gagal");
            toast.success("Pembayaran angsuran berhasil!");
            router.push(`/pinjaman/${loanId}`);
        } catch {
            toast.error("Gagal memproses pembayaran angsuran");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Bayar Angsuran" description="Proses pembayaran angsuran pinjaman" backHref="/pinjaman/angsuran" />
            <Card className="max-w-lg">
                <CardHeader><CardTitle>Form Pembayaran</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label>ID Pinjaman</Label>
                            <Input value={loanId || ""} disabled />
                        </div>
                        <div>
                            <Label>Jumlah Pembayaran (Rp)</Label>
                            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
                        </div>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</> : "Bayar Angsuran"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
