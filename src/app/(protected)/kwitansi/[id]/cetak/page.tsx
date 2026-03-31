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
import { generateReceiptPDF, generateThermalReceiptPDF, type ReceiptData } from "@/lib/export-utils";
import { terbilang, getPaymentMethodLabel, PAYMENT_METHODS } from "@/lib/terbilang";
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

    const handlePrint = async (isThermal: boolean = false) => {
        if (!receipt) return;

        setIsPrinting(true);
        try {
            const pdfData: ReceiptData = {
                receiptNo: receipt.receiptNo,
                receiptDate: receipt.receiptDate,
                receivedFrom: receipt.receivedFrom,
                memberNo: receipt.member?.memberNo || "-",
                nrp: receipt.member?.nrp || "-",
                type: receipt.type,
                description: receipt.description,
                amount: receipt.amount,
                paymentMethod: receipt.paymentMethod,
                notes: receipt.notes,
                referenceNo: receipt.referenceNo,
                createdBy: receipt.createdBy?.name || "-",
            };

            if (isThermal) {
                generateThermalReceiptPDF(pdfData);
            } else {
                generateReceiptPDF(pdfData);
            }

            // Mark as printed
            if (receipt.status === "draft") {
                await receiptsApi.update(receipt.id, { status: "printed" });
                setReceipt((prev) => prev ? { ...prev, status: "printed", printedAt: new Date().toISOString() } : null);
            }

            toast.success(isThermal ? "Struk berhasil dicetak" : "Kwitansi berhasil dicetak");
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

    const receiptDate = new Date(receipt.receiptDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const needsMaterai = receipt.amount >= 5_000_000;

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
                        <Button variant="outline" onClick={() => handlePrint(true)} disabled={isPrinting || receipt.status === "void"}>
                            {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                            Cetak Struk Thermal
                        </Button>
                        <Button onClick={() => handlePrint(false)} disabled={isPrinting || receipt.status === "void"}>
                            {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                            {receipt.status === "draft" ? "Cetak A4 & Finalisasi" : "Cetak Ulang A4"}
                        </Button>
                    </div>
                }
            />

            {/* ============= RECEIPT PREVIEW (Format Resmi Koperasi) ============= */}
            <Card className="max-w-2xl mx-auto print:shadow-none print:border-2 print:border-black">
                <CardContent className="p-8">

                    {/* ---- KOP SURAT / HEADER ---- */}
                    <div className="text-center mb-1">
                        <h2 className="text-2xl font-bold tracking-tight uppercase">KOPERASI PRIMKOPPOL RESOR LUMAJANG</h2>
                        <p className="text-xs text-muted-foreground">Badan Hukum No: ....../BH/M.KUKM/........</p>
                        <p className="text-xs text-muted-foreground">Alamat: Jl. Alun-alun Timur No. 1, Lumajang, Jawa Timur</p>
                    </div>
                    <div className="border-b-4 border-double border-foreground my-3" />

                    {/* ---- JUDUL KWITANSI + NOMOR ---- */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-xl font-bold tracking-widest">KWITANSI</h3>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">No. Kwitansi</p>
                            <p className="font-mono font-bold text-sm">{receipt.receiptNo}</p>
                        </div>
                    </div>

                    {/* ---- STATUS BADGE ---- */}
                    <div className="flex justify-end mb-4">
                        <Badge variant={sc.variant} className="text-xs">{sc.label}</Badge>
                    </div>

                    {/* ---- DETAIL IDENTITAS ---- */}
                    <div className="space-y-2.5 mb-5">
                        {[
                            ["Sudah Terima Dari", receipt.receivedFrom],
                            ["Nomor Anggota", receipt.member?.memberNo || "-"],
                            ["NRP / NIP", receipt.member?.nrp || "-"],
                        ].map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[160px_16px_1fr] text-sm">
                                <span className="font-medium text-muted-foreground">{label}</span>
                                <span>:</span>
                                <span className="font-semibold">{value}</span>
                            </div>
                        ))}
                    </div>

                    {/* ---- JUMLAH UANG (ANGKA) ---- */}
                    <div className="bg-slate-50 border-2 border-slate-300 rounded-lg p-4 mb-1">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-sm">Banyaknya Uang</span>
                            <span className="text-2xl font-bold tabular-nums text-primary">{formatCurrency(receipt.amount)}</span>
                        </div>
                    </div>

                    {/* ---- TERBILANG (HURUF) ---- */}
                    <div className="border border-dashed border-slate-300 rounded-md px-4 py-2 mb-5 bg-slate-50/50">
                        <p className="text-xs text-muted-foreground italic">
                            Terbilang: <span className="font-semibold text-foreground not-italic capitalize">{terbilang(receipt.amount)}</span>
                        </p>
                    </div>

                    {/* ---- UNTUK PEMBAYARAN ---- */}
                    <div className="space-y-2.5 mb-5">
                        {[
                            ["Untuk Pembayaran", typeLabels[receipt.type] || receipt.type],
                            ["Keterangan", receipt.description],
                        ].map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[160px_16px_1fr] text-sm">
                                <span className="font-medium text-muted-foreground">{label}</span>
                                <span>:</span>
                                <span>{value}</span>
                            </div>
                        ))}
                    </div>

                    {/* ---- METODE PEMBAYARAN (CHECKBOX STYLE) ---- */}
                    <div className="mb-5">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Metode Pembayaran:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1.5 gap-x-4">
                            {PAYMENT_METHODS.map((method) => {
                                const isChecked = receipt.paymentMethod === method.value;
                                return (
                                    <label key={method.value} className="flex items-center gap-2 text-sm">
                                        <span className={`inline-flex items-center justify-center w-4 h-4 border rounded text-xs
                                            ${isChecked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                                            {isChecked && "✓"}
                                        </span>
                                        <span className={isChecked ? "font-semibold" : ""}>
                                            {method.label}
                                            {isChecked && method.value === "bank_transfer" && receipt.referenceNo && (
                                                <span className="text-xs text-muted-foreground ml-1">(Ref: {receipt.referenceNo})</span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* ---- NO REFERENSI ---- */}
                    {receipt.referenceNo && (
                        <div className="grid grid-cols-[160px_16px_1fr] text-sm mb-3">
                            <span className="font-medium text-muted-foreground">No. Referensi</span>
                            <span>:</span>
                            <span className="font-mono font-medium">{receipt.referenceNo}</span>
                        </div>
                    )}

                    {/* ---- CATATAN ---- */}
                    {receipt.notes && (
                        <div className="grid grid-cols-[160px_16px_1fr] text-sm mb-3">
                            <span className="font-medium text-muted-foreground">Catatan</span>
                            <span>:</span>
                            <span>{receipt.notes}</span>
                        </div>
                    )}

                    {/* ---- MATERAI NOTICE ---- */}
                    {needsMaterai && (
                        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-5 text-xs text-amber-800">
                            ⚠ Transaksi di atas Rp 5.000.000 — Harap menempelkan <strong>Materai Rp 10.000</strong> sesuai ketentuan yang berlaku.
                        </div>
                    )}

                    <Separator className="my-5" />

                    {/* ---- TANDA TANGAN ---- */}
                    <div className="flex justify-between items-start">
                        {/* Tempat & Tanggal */}
                        <div className="text-sm text-muted-foreground">
                            <p>Lumajang, {receiptDate}</p>
                        </div>

                        {/* Area TTD */}
                        <div className="flex gap-8">
                            {/* Yang Menerima */}
                            <div className="text-center min-w-[140px]">
                                <p className="text-xs text-muted-foreground mb-1">Yang Menerima,</p>
                                <div className="h-16 border-b border-dashed border-muted-foreground/30" />
                                <p className="font-medium text-sm mt-1">{receipt.receivedFrom}</p>
                                <p className="text-[10px] text-muted-foreground">Anggota</p>
                            </div>

                            {/* Kasir / Bendahara */}
                            <div className="text-center min-w-[140px]">
                                <p className="text-xs text-muted-foreground mb-1">Kasir / Bendahara,</p>
                                <div className="h-16 border-b border-dashed border-muted-foreground/30 flex items-end justify-center">
                                    {/* Placeholder area cap stempel */}
                                    <span className="text-[9px] text-muted-foreground/30 mb-1">(Cap & Stempel)</span>
                                </div>
                                <p className="font-medium text-sm mt-1">{receipt.createdBy?.name || "-"}</p>
                                <p className="text-[10px] text-muted-foreground">Petugas</p>
                            </div>
                        </div>
                    </div>

                    {/* ---- WARNA KERTAS GUIDE (untuk informasi internal) ---- */}
                    <div className="mt-6 border-t border-dashed pt-3 print:hidden">
                        <p className="text-[10px] text-muted-foreground italic text-center">
                            Putih = Anggota &nbsp;|&nbsp; Kuning = Arsip Bendahara &nbsp;|&nbsp; Merah = Arsip Pengawas
                        </p>
                    </div>

                    {/* ---- FOOTER ---- */}
                    <div className="text-center mt-4">
                        <p className="text-[10px] text-muted-foreground">
                            Kwitansi ini sah dan merupakan bukti pembayaran resmi yang diterbitkan oleh Koperasi PRIMKOPPOL Resor Lumajang.
                        </p>
                    </div>

                    {/* Print info */}
                    {receipt.printedAt && (
                        <p className="text-xs text-muted-foreground mt-4 text-center print:hidden">
                            Dicetak pada: {new Date(receipt.printedAt).toLocaleString("id-ID")}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
