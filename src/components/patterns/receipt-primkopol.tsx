"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export interface ReceiptData {
    notaNo: string;
    tanggal: string; // dd/mm/yyyy hh:mm
    nrpNip: string;
    namaAnggota: string;
    kesatuan: string;
    keterangan: string; // contoh: "Barbershop - Potong Rambut"
    total: number;
    metode: "Tunai" | "Potong Gaji" | "QRIS" | string;
    kasir: string;
    unitType?: string;
    isVoid?: boolean;
}

interface ReceiptPrimkopolProps {
    data: ReceiptData;
    onClose?: () => void;
    autoprint?: boolean; // Otomatis mencetak ketika komponen mount
}

function formatRupiah(amount: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

/**
 * ReceiptPrimkopol
 * Komponen struk/nota cetak seragam untuk semua unit usaha Primkoppol.
 * Mendukung window.print() (Desktop) dan dapat dikonversi menjadi raw text
 * untuk Bluetooth Thermal Printer di Mobile.
 */
export function ReceiptPrimkopol({
    data,
    onClose,
    autoprint = false,
}: ReceiptPrimkopolProps) {
    const printRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (autoprint) handlePrint();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoprint]);

    const handlePrint = () => {
        const printContents = printRef.current?.innerHTML;
        if (!printContents) return;
        const w = window.open("", "_blank", "width=400,height=600");
        if (!w) return;
        w.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Struk - ${data.notaNo}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                        width: 80mm;
                        padding: 4mm;
                        color: #000;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed #000; margin: 6px 0; }
                    .row { display: flex; justify-content: space-between; margin: 2px 0; }
                    .label { min-width: 100px; }
                    .void-mark {
                        text-align: center;
                        font-size: 16px;
                        font-weight: bold;
                        border: 2px solid #000;
                        padding: 4px;
                        margin: 8px 0;
                        letter-spacing: 2px;
                    }
                    @media print {
                        body { width: 80mm; }
                    }
                </style>
            </head>
            <body>${printContents}</body>
            </html>
        `);
        w.document.close();
        w.focus();
        setTimeout(() => {
            w.print();
        }, 300);
    };

    return (
        <div className="space-y-4">
            {/* Preview Area */}
            <div
                ref={printRef}
                className="font-mono text-xs bg-white text-black p-4 rounded border border-dashed max-w-[320px] mx-auto"
            >
                {/* Header */}
                <div className="center bold text-sm leading-snug">
                    PRIMKOPPOL RESOR LUMAJANG
                </div>
                <div className="center text-[10px] mt-1">
                    Koperasi Kepolisian Resort Lumajang
                </div>

                {data.isVoid && (
                    <div className="void-mark mt-2">** VOID / BATAL **</div>
                )}

                <div className="divider" />

                {/* Nota & Tanggal */}
                <div className="row">
                    <span className="label">no. nota</span>
                    <span>: {data.notaNo}</span>
                </div>
                <div className="row">
                    <span className="label">tanggal</span>
                    <span>: {data.tanggal}</span>
                </div>

                <div className="divider" />

                {/* Info Anggota */}
                <div className="row">
                    <span className="label">NRP/NIP</span>
                    <span>: {data.nrpNip || "-"}</span>
                </div>
                <div className="row">
                    <span className="label">Nama Anggota</span>
                    <span className="text-right max-w-[160px] break-words">
                        : {data.namaAnggota || "Umum"}
                    </span>
                </div>
                <div className="row">
                    <span className="label">Kesatuan</span>
                    <span>: {data.kesatuan || "-"}</span>
                </div>
                <div className="row">
                    <span className="label">Keterangan</span>
                    <span className="text-right max-w-[160px] break-words">
                        : {data.keterangan}
                    </span>
                </div>

                <div className="divider" />

                {/* Total */}
                <div className="row bold">
                    <span>TOTAL</span>
                    <span>{formatRupiah(data.total)}</span>
                </div>
                <div className="row">
                    <span className="label">Metode</span>
                    <span>: {data.metode}</span>
                </div>

                <div className="divider" />

                {/* Footer */}
                <div className="row">
                    <span className="label">Kasir</span>
                    <span>: {data.kasir}</span>
                </div>
                <div className="center mt-2 text-[10px]">
                    Terima kasih atas transaksi Anda
                </div>
                <div className="center text-[10px]">primkoppol.online</div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-2">
                <Button onClick={handlePrint} size="sm" className="gap-2">
                    <Printer className="h-4 w-4" />
                    Cetak Struk
                </Button>
                {onClose && (
                    <Button onClick={onClose} size="sm" variant="outline">
                        Tutup
                    </Button>
                )}
            </div>
        </div>
    );
}

/**
 * generateRawText
 * Menghasilkan Plain Text struk untuk Mobile Bluetooth Thermal Printer.
 * Bisa dikirimkan via Web Bluetooth API atau BLE Plugin.
 */
export function generateRawText(data: ReceiptData): string {
    const sep = "--------------------------------";
    const line = (label: string, value: string) => {
        const pad = 16;
        const l = label.padEnd(pad, " ");
        return `${l}: ${value}`;
    };

    return [
        "  PRIMKOPPOL RESOR LUMAJANG  ",
        " Koperasi Kepolisian Lumajang ",
        sep,
        line("no. nota", data.notaNo),
        line("tanggal", data.tanggal),
        sep,
        line("NRP/NIP", data.nrpNip || "-"),
        line("Nama Anggota", data.namaAnggota || "Umum"),
        line("Kesatuan", data.kesatuan || "-"),
        line("Keterangan", data.keterangan),
        sep,
        `TOTAL           : ${formatRupiah(data.total)}`,
        line("Metode", data.metode),
        sep,
        line("Kasir", data.kasir),
        "  Terima kasih atas transaksi  ",
        "       primkoppol.online       ",
        "",
    ].join("\n");
}
