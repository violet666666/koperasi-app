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
    items?: Array<{ name: string; qty: number; price: number; subtotal: number }>;
}

interface ReceiptPrimkopolProps {
    data: ReceiptData;
    onClose?: () => void;
    autoprint?: boolean; // Otomatis mencetak ketika komponen mount
    paperSize?: "58mm" | "80mm"; // Opsi ukuran kertas thermal
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
    paperSize = "58mm",
}: ReceiptPrimkopolProps) {
    const printRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (autoprint && data && printRef.current) {
            handlePrint();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoprint, data]);

    const handlePrint = () => {
        const printContents = printRef.current?.innerHTML;
        if (!printContents) return;
        const pw = paperSize === "58mm" ? "58mm" : "80mm";
        const w = window.open("", "_blank", "width=300,height=800");
        if (!w) {
            // Pop-up diblokir browser (umum di tablet) — beri feedback ke user
            alert("Pop-up diblokir oleh browser. Mohon izinkan pop-up untuk mencetak struk, lalu coba lagi.");
            return;
        }
        w.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Struk - ${data.notaNo}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: ${paperSize === "58mm" ? "11px" : "13px"};
                        width: ${paperSize};
                        padding: 1mm;
                        color: #000;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed #000; margin: 2px 0; }
                    .row { display: flex; justify-content: space-between; margin: 0; }
                    .label { min-width: ${paperSize === "58mm" ? "70px" : "100px"}; }
                    .value-right { text-align: right; word-break: break-all; }
                    .void-mark {
                        text-align: center;
                        font-size: 14px;
                        font-weight: bold;
                        border: 2px solid #000;
                        padding: 2px;
                        margin: 2px 0;
                        letter-spacing: 2px;
                    }
                    .item-name { font-size: 11px; }
                    .item-detail { font-size: 10px; }
                    @media print {
                        @page { size: ${pw} auto; margin: 0; }
                        html, body {
                            height: auto !important;
                            min-height: 0 !important;
                            max-height: none !important;
                            overflow: visible !important;
                        }
                        body {
                            margin: 0 !important;
                            width: 100% !important;
                            max-width: ${pw};
                            padding: 0.5mm !important;
                        }
                        .divider { margin: 1px 0; }
                        .row { margin: 0; }
                    }
                </style>
            </head>
            <body>${printContents}
                <script>
                    // Gunakan onload + buffer agar print() dipanggil setelah DOM siap
                    // Penting untuk tablet/perangkat lambat
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            // Jangan auto-close — biarkan user menutup sendiri setelah print selesai
                            // Auto-close terlalu cepat bisa membatalkan dialog print di tablet
                        }, 400);
                    };
                </script>
            </body>
            </html>
        `);
        w.document.close();
    };

    return (
        <div className="space-y-3">
            {/* Preview Area */}
            <div
                ref={printRef}
                className={`font-mono text-xs bg-white text-black p-2 rounded border border-dashed mx-auto ${
                    paperSize === "58mm" ? "max-w-[220px]" : "max-w-[320px]"
                }`}
            >
                {/* Header */}
                <div className="center bold text-sm leading-snug">
                    PRIMKOPPOL RESOR LUMAJANG
                </div>
                <div className="center text-[10px] mt-0.5">
                    Polres Lumajang
                </div>
                {data.unitType && (
                    <div className="center bold text-[11px] mt-1">
                        {({ toko: "TOKO RETAIL", resto: "RESTO & CAFE", cuci_mobil: "CUCI MOBIL", fotocopy: "FOTOCOPY & ATK", laundry: "LAUNDRY", barbershop: "BARBERSHOP", fitness: "FITNESS CENTER", playstation: "PLAYSTATION", simpan_pinjam: "SIMPAN PINJAM" } as Record<string, string>)[data.unitType] || data.unitType.toUpperCase()}
                    </div>
                )}

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

                {/* Info Pelanggan */}
                <div className="row">
                    <span className="label">Pelanggan</span>
                    <span>: {data.namaAnggota || "Umum"}</span>
                </div>
                {data.nrpNip && data.nrpNip !== "-" && (
                    <div className="row">
                        <span className="label">NRP/NIP</span>
                        <span>: {data.nrpNip}</span>
                    </div>
                )}

                <div className="divider" />

                {/* Item Detail */}
                {data.items && data.items.length > 0 ? (
                    <>
                        <div className="bold text-[10px]" style={{ marginBottom: '1px' }}>Rincian:</div>
                        {data.items.map((item, i) => (
                            <div key={i} style={{ marginBottom: '2px' }}>
                                <div style={{ fontSize: '11px' }}>{item.name}</div>
                                <div className="row" style={{ fontSize: '10px' }}>
                                    <span>&nbsp; {item.qty} x {formatRupiah(item.price)}</span>
                                    <span>{formatRupiah(item.subtotal)}</span>
                                </div>
                            </div>
                        ))}
                    </>
                ) : (
                    <div className="row">
                        <span className="label">Keterangan</span>
                        <span className="text-right max-w-[160px] break-words">
                            : {data.keterangan}
                        </span>
                    </div>
                )}

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
                <div className="center mt-1 text-[10px]">
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
 * Secara pintar menghitung margin padding dan length line untuk 58mm/80mm.
 */
export function generateRawText(data: ReceiptData, paperSize: "58mm" | "80mm" = "58mm"): string {
    const charsPerLine = paperSize === "58mm" ? 32 : 48; // Standard chars width for ESC/POS
    const sep = "-".repeat(charsPerLine);
    
    // helper to pad center
    const center = (text: string) => {
        if (text.length >= charsPerLine) return text.substring(0, charsPerLine);
        const pad = Math.floor((charsPerLine - text.length) / 2);
        return " ".repeat(pad) + text + " ".repeat(charsPerLine - text.length - pad);
    };

    const line = (label: string, value: string) => {
        const remaining = charsPerLine - label.length - 2; // " :"
        return `${label}: ${value.substring(0, remaining).padStart(remaining, " ")}`;
    };

    const unitNames: Record<string, string> = { toko: "TOKO RETAIL", resto: "RESTO & CAFE", cuci_mobil: "CUCI MOBIL", fotocopy: "FOTOCOPY & ATK", laundry: "LAUNDRY", barbershop: "BARBERSHOP", fitness: "FITNESS CENTER", playstation: "PLAYSTATION", simpan_pinjam: "SIMPAN PINJAM" };
    const unitName = data.unitType ? unitNames[data.unitType] : undefined;

    const itemLines = data.items && data.items.length > 0
        ? data.items.flatMap(item => [
            `  ${item.name}`,
            `  ${item.qty} x ${formatRupiah(item.price)}${formatRupiah(item.subtotal).padStart(charsPerLine - 6 - `${item.qty} x ${formatRupiah(item.price)}`.length)}`,
        ])
        : [line("Ket", data.keterangan || "-")];

    return [
        center("PRIMKOPPOL RESOR LUMAJANG"),
        center("Polres Lumajang"),
        ...(unitName ? [center(unitName)] : []),
        sep,
        line("No. Nota", data.notaNo),
        line("Tanggal ", data.tanggal),
        sep,
        line("Pelanggan", data.namaAnggota || "Umum"),
        ...(data.nrpNip && data.nrpNip !== "-" ? [line("NRP/NIP ", data.nrpNip)] : []),
        sep,
        ...itemLines,
        sep,
        `TOTAL     : ${formatRupiah(data.total).padStart(charsPerLine - 12, " ")}`,
        line("Metode  ", data.metode),
        line("Kasir   ", data.kasir),
        sep,
        center("Terima kasih atas transaksi"),
        center("primkoppol.online"),
        "",
        "",
    ].join("\n");
}
