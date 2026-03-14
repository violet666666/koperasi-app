"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Printer, Loader2, ArrowLeft } from "lucide-react";
import { receiptsApi } from "@/lib/api/services";
import { generateReceiptPDF, type ReceiptData } from "@/lib/export-utils";
import Link from "next/link";

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
    printedAt?: string;
    member?: { id: number; memberNo: string; nrp?: string; name: string; phone?: string; category?: string };
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

export default function CetakKwitansiPage() {
    const params = useParams();
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [receipt, setReceipt] = React.useState<ReceiptDetail | null>(null);

    React.useEffect(() => {
        if (!params.id) return;
        async function fetchReceipt() {
            setIsLoading(true);
            try {
                const response = await receiptsApi.get(Number(params.id));
                setReceipt((response as unknown as { data: ReceiptDetail }).data);
            } catch (error) {
                console.error("Failed to fetch receipt:", error);
                toast.error("Gagal memuat data kwitansi");
            } finally {
                setIsLoading(false);
            }
        }
        fetchReceipt();
    }, [params.id]);

    const handlePrint = async () => {
        if (!receipt) return;

        setIsPrinting(true);
        try {
            // Generate PDF
            const pdfData: ReceiptData = {
                receiptNo: receipt.receiptNo,
                receiptDate: receipt.receiptDate,
                receivedFrom: receipt.receivedFrom,
                memberNo: receipt.member?.memberNo || "-",
                type: receipt.type,
                description: receipt.description,
                amount: receipt.amount,
                paymentMethod: receipt.paymentMethod,
                notes: receipt.notes,
                createdBy: receipt.createdBy?.name || "-",
            };

            generateReceiptPDF(pdfData);

            // Mark as printed
            if (receipt.status === "draft") {
                await receiptsApi.update(receipt.id, { status: "printed" });
                setReceipt((prev) => prev ? { ...prev, status: "printed", printedAt: new Date().toISOString() } : null);
            }

            toast.success("Kwitansi berhasil dicetak");
        } catch {
            toast.error("Gagal mencetak kwitansi");
        } finally {
            setIsPrinting(false);
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
            <div className="text-center py-12">
                <p className="text-muted-foreground">Kwitansi tidak ditemukan</p>
                <Button variant="link" asChild>
                    <Link href="/kwitansi">Kembali</Link>
                </Button>
            </div>
        );
    }

    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
        draft: { label: "Draft", variant: "outline" },
        printed: { label: "Dicetak", variant: "default" },
        void: { label: "Batal", variant: "destructive" },
    };
    const sc = statusConfig[receipt.status] || { label: receipt.status, variant: "outline" as const };

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Kwitansi ${receipt.receiptNo}`}
                description="Preview dan cetak kwitansi"
                backHref="/kwitansi"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/kwitansi">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Kembali
                            </Link>
                        </Button>
                        <Button onClick={handlePrint} disabled={isPrinting || receipt.status === "void"}>
                            {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                            {receipt.status === "draft" ? "Cetak & Finalisasi" : "Cetak Ulang"}
                        </Button>
                    </div>
                }
            />

            {/* Receipt Preview */}
            <Card className="max-w-2xl mx-auto">
                <CardContent className="p-8">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold tracking-tight">KWITANSI</h2>
                        <p className="text-sm text-muted-foreground">KOPERASI PRIMKOPPOL POLDA RIAU</p>
                        <Separator className="mt-4" />
                    </div>

                    {/* Receipt Info */}
                    <div className="flex justify-between mb-6">
                        <div>
                            <span className="text-sm text-muted-foreground">No. Kwitansi:</span>
                            <span className="ml-2 font-mono font-bold">{receipt.receiptNo}</span>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Tanggal:</span>
                            <span className="ml-2">{new Date(receipt.receiptDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                        </div>
                    </div>

                    <div className="flex justify-end mb-6">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                    </div>

                    {/* Details */}
                    <div className="space-y-3 mb-6">
                        {[
                            ["Diterima dari", receipt.receivedFrom],
                            ["No. Anggota", receipt.member?.memberNo || "-"],
                            ["NRP", receipt.member?.nrp || "-"],
                            ["Jenis Transaksi", typeLabels[receipt.type] || receipt.type],
                            ["Keterangan", receipt.description],
                            ["Metode Pembayaran", receipt.paymentMethod === "cash" ? "Tunai" : "Transfer Bank"],
                        ].map(([label, value]) => (
                            <div key={label} className="grid grid-cols-3 gap-2">
                                <span className="text-sm text-muted-foreground font-medium">{label}</span>
                                <span className="col-span-2">{value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Amount Box */}
                    <div className="bg-muted/50 rounded-lg border p-4 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">Jumlah yang diterima:</span>
                            <span className="text-2xl font-bold tabular-nums text-primary">{formatCurrency(receipt.amount)}</span>
                        </div>
                    </div>

                    {/* Notes */}
                    {receipt.notes && (
                        <div className="mb-6">
                            <span className="text-sm text-muted-foreground">Catatan: </span>
                            <span className="text-sm">{receipt.notes}</span>
                        </div>
                    )}

                    {/* Ref */}
                    {receipt.referenceNo && (
                        <div className="mb-6">
                            <span className="text-sm text-muted-foreground">No. Referensi: </span>
                            <span className="text-sm font-mono">{receipt.referenceNo}</span>
                        </div>
                    )}

                    <Separator className="my-6" />

                    {/* Signature */}
                    <div className="flex justify-end">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">Hormat kami,</p>
                            <div className="h-16" />
                            <p className="font-medium border-t pt-1">{receipt.createdBy?.name || "-"}</p>
                            <p className="text-xs text-muted-foreground">Petugas</p>
                        </div>
                    </div>

                    {/* Print info */}
                    {receipt.printedAt && (
                        <p className="text-xs text-muted-foreground mt-6 text-center">
                            Dicetak pada: {new Date(receipt.printedAt).toLocaleString("id-ID")}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
