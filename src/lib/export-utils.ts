// Generic Export Utilities for PDF and Excel
// Uses jsPDF + jspdf-autotable for PDF and xlsx for Excel

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ============================================================
// Types
// ============================================================

export interface ExportColumn {
    header: string;
    key: string;
    width?: number;
    format?: (value: unknown) => string;
}

// ============================================================
// Excel Export
// ============================================================

export function exportToExcel(
    data: Record<string, unknown>[],
    columns: ExportColumn[],
    filename: string,
    sheetName: string = "Data"
) {
    // Map data to rows using column definitions
    const headers = columns.map((col) => col.header);
    const rows = data.map((item) =>
        columns.map((col) => {
            const value = getNestedValue(item, col.key);
            return col.format ? col.format(value) : value;
        })
    );

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set column widths
    ws["!cols"] = columns.map((col) => ({
        wch: col.width || 18,
    }));

    // Create workbook and download
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ============================================================
// PDF Export
// ============================================================

export function exportToPDF(
    data: Record<string, unknown>[],
    columns: ExportColumn[],
    title: string,
    filename: string,
    options?: {
        orientation?: "portrait" | "landscape";
        subtitle?: string;
        footerText?: string;
    }
) {
    const orientation = options?.orientation || "landscape";
    const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

    // Header
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(title, pageWidth / 2, 15, { align: "center" });

    if (options?.subtitle) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(options.subtitle, pageWidth / 2, 22, { align: "center" });
    }

    // Date
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    const now = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
    doc.text(`Dicetak: ${now}`, pageWidth - 15, 15, { align: "right" });

    // Table headers and body
    const headers = columns.map((col) => col.header);
    const body = data.map((item) =>
        columns.map((col) => {
            const value = getNestedValue(item, col.key);
            return col.format ? col.format(value) : String(value ?? "-");
        })
    );

    // Auto table
    autoTable(doc, {
        head: [headers],
        body: body,
        startY: options?.subtitle ? 28 : 22,
        styles: {
            fontSize: 8,
            cellPadding: 2,
        },
        headStyles: {
            fillColor: [41, 65, 148],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8,
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250],
        },
        margin: { left: 10, right: 10 },
        didDrawPage: (hookData) => {
            // Footer
            const pageCount = doc.getNumberOfPages();
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.text(
                `Halaman ${hookData.pageNumber} dari ${pageCount}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: "center" }
            );
            if (options?.footerText) {
                doc.text(
                    options.footerText,
                    15,
                    doc.internal.pageSize.getHeight() - 10
                );
            }
        },
    });

    // Save
    doc.save(`${filename}.pdf`);
}

// ============================================================
// Receipt PDF Generator
// ============================================================

export interface ReceiptData {
    receiptNo: string;
    receiptDate: string;
    receivedFrom: string;
    memberNo: string;
    nrp?: string;
    type: string;
    description: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
    referenceNo?: string;
    createdBy: string;
}

export function generateReceiptPDF(receipt: ReceiptData) {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Border box
    doc.setDrawColor(41, 65, 148);
    doc.setLineWidth(0.7);
    doc.rect(margin - 5, y - 5, contentWidth + 10, 220);

    // ---- KOP SURAT ----
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("KOPERASI PRIMKOPPOL RESOR LUMAJANG", pageWidth / 2, y + 5, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Badan Hukum No: ....../BH/M.KUKM/........", pageWidth / 2, y + 11, { align: "center" });
    doc.text("Alamat: Jl. Alun-alun Timur No. 1, Lumajang, Jawa Timur", pageWidth / 2, y + 16, { align: "center" });

    y += 22;
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 1;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ---- JUDUL + NO KWITANSI ----
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("KWITANSI", margin, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`No: ${receipt.receiptNo}`, pageWidth - margin, y, { align: "right" });

    y += 5;
    doc.setFontSize(9);
    doc.text(
        `Tanggal: ${new Date(receipt.receiptDate).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric",
        })}`,
        pageWidth - margin, y, { align: "right" }
    );

    y += 10;

    // ---- IDENTITAS ----
    const labelX = margin;
    const colonX = margin + 42;
    const valX = margin + 46;
    const detailsIdentity = [
        ["Sudah Terima Dari", receipt.receivedFrom],
        ["Nomor Anggota", receipt.memberNo],
        ["NRP / NIP", receipt.nrp || "-"],
    ];

    doc.setFontSize(10);
    for (const [label, value] of detailsIdentity) {
        doc.setFont("helvetica", "normal");
        doc.text(label, labelX, y);
        doc.text(":", colonX, y);
        doc.setFont("helvetica", "bold");
        doc.text(value, valX, y);
        y += 7;
    }

    y += 3;

    // ---- JUMLAH UANG (BOX) ----
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, y, contentWidth, 18, "F");
    doc.setDrawColor(41, 65, 148);
    doc.rect(margin, y, contentWidth, 18, "S");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Banyaknya Uang:", margin + 5, y + 8);

    doc.setFontSize(14);
    doc.text(formatRupiah(receipt.amount), pageWidth - margin - 5, y + 12, { align: "right" });

    y += 22;

    // ---- TERBILANG ----
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    const terbilangText = `Terbilang: ${amountToWords(receipt.amount)} rupiah`;
    const splitTerbilang = doc.splitTextToSize(terbilangText, contentWidth);
    doc.text(splitTerbilang, margin, y);
    y += splitTerbilang.length * 5 + 3;

    // ---- UNTUK PEMBAYARAN ----
    const detailsPayment = [
        ["Untuk Pembayaran", getReceiptTypeLabel(receipt.type)],
        ["Keterangan", receipt.description],
    ];

    doc.setFontSize(10);
    for (const [label, value] of detailsPayment) {
        doc.setFont("helvetica", "normal");
        doc.text(label, labelX, y);
        doc.text(":", colonX, y);
        doc.setFont("helvetica", "normal");
        const splitVal = doc.splitTextToSize(value, contentWidth - 48);
        doc.text(splitVal, valX, y);
        y += (splitVal.length * 5) + 2;
    }

    y += 3;

    // ---- METODE PEMBAYARAN (CHECKBOX STYLE) ----
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Metode Pembayaran:", labelX, y);
    y += 6;

    const paymentOptions = [
        { value: "cash", label: "Tunai" },
        { value: "bank_transfer", label: "Transfer Bank" },
        { value: "potong_gaji", label: "Potong Gaji" },
        { value: "debet_simpanan", label: "Debet Simpanan" },
        { value: "qris", label: "QRIS / E-Wallet" },
    ];

    const colWidth = contentWidth / 3;
    paymentOptions.forEach((opt, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const px = margin + col * colWidth;
        const py = y + row * 6;

        const isChecked = receipt.paymentMethod === opt.value;

        // Checkbox
        doc.setDrawColor(100);
        doc.setLineWidth(0.3);
        doc.rect(px, py - 3, 3.5, 3.5, "S");

        if (isChecked) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text("✓", px + 0.5, py - 0.2);
        }

        doc.setFont("helvetica", isChecked ? "bold" : "normal");
        doc.setFontSize(9);
        doc.text(opt.label, px + 5, py);
    });

    y += Math.ceil(paymentOptions.length / 3) * 6 + 5;

    // ---- NO REFERENSI ----
    if (receipt.referenceNo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("No. Referensi", labelX, y);
        doc.text(":", colonX, y);
        doc.setFont("helvetica", "bold");
        doc.text(receipt.referenceNo, valX, y);
        y += 6;
    }

    // ---- CATATAN ----
    if (receipt.notes) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Catatan", labelX, y);
        doc.text(":", colonX, y);
        const splitNotes = doc.splitTextToSize(receipt.notes, contentWidth - 48);
        doc.text(splitNotes, valX, y);
        y += splitNotes.length * 5 + 2;
    }

    // ---- MATERAI NOTICE ----
    if (receipt.amount >= 5_000_000) {
        y += 3;
        doc.setFillColor(255, 249, 230);
        doc.rect(margin, y - 3, contentWidth, 8, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150, 100, 0);
        doc.text("⚠ Transaksi ≥ Rp 5.000.000 — Harap tempelkan Materai Rp 10.000 sesuai ketentuan.", margin + 3, y + 1);
        doc.setTextColor(0);
        y += 10;
    }

    // ---- TANDA TANGAN ----
    y = 205;
    const dateStr = new Date(receipt.receiptDate).toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
    });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Lumajang, ${dateStr}`, margin, y);

    // Yang menerima
    const sig1X = pageWidth / 2 - 15;
    doc.text("Yang Menerima,", sig1X, y);
    y += 24;
    doc.line(sig1X, y, sig1X + 40, y);
    doc.setFont("helvetica", "bold");
    doc.text(`(${receipt.receivedFrom})`, sig1X, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Anggota", sig1X, y + 10);

    // Kasir / Bendahara
    y = 205;
    const sig2X = pageWidth - margin - 45;
    doc.setFontSize(9);
    doc.text("Kasir / Bendahara,", sig2X, y);
    y += 24;
    doc.line(sig2X, y, sig2X + 45, y);
    doc.setFont("helvetica", "bold");
    doc.text(`(${receipt.createdBy})`, sig2X, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Petugas", sig2X, y + 10);

    // ---- FOOTER ----
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150);
    doc.text(
        "Kwitansi ini sah dan merupakan bukti pembayaran resmi yang diterbitkan oleh Koperasi PRIMKOPPOL Resor Lumajang.",
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 15,
        { align: "center" }
    );
    doc.setTextColor(0);

    // ---- PANDUAN WARNA KERTAS ----
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180);
    doc.text(
        "Putih = Anggota  |  Kuning = Arsip Bendahara  |  Merah = Arsip Pengawas",
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
    );
    doc.setTextColor(0);

    doc.save(`Kwitansi_${receipt.receiptNo}.pdf`);
}

// ============================================================
// Thermal Receipt PDF Generator
// ============================================================

export function generateThermalReceiptPDF(receipt: ReceiptData) {
    // 80mm generic thermal format
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [80, 200] });
    const pageWidth = 80;
    const margin = 5;
    let y = 10;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("KOPERASI PRIMKOPPOL", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFontSize(10);
    doc.text("RESOR LUMAJANG", pageWidth / 2, y, { align: "center" });
    
    y += 8;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);

    y += 5;
    
    // Receipt Info
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`No: ${receipt.receiptNo}`, margin, y);
    y += 4;
    doc.text(`Tgl: ${new Date(receipt.receiptDate).toLocaleDateString("id-ID")}`, margin, y);
    y += 4;
    doc.text(`Kasir: ${receipt.createdBy}`, margin, y);
    
    y += 6;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);

    y += 6;

    // Details
    const paymentLabel = getReceiptPaymentLabel(receipt.paymentMethod);
    const details = [
        ["Terima Dari", receipt.receivedFrom],
        ["No. Anggota", receipt.memberNo],
        ["NRP", receipt.nrp || "-"],
        ["Transaksi", getReceiptTypeLabel(receipt.type)],
        ["Keterangan", receipt.description],
        ["Metode", paymentLabel],
    ];

    details.forEach(([label, value]) => {
        doc.text(`${label}`, margin, y);
        const splitVal = doc.splitTextToSize(`: ${value}`, pageWidth - margin - 22);
        doc.text(splitVal, margin + 20, y);
        y += splitVal.length * 4 + 1;
    });

    y += 3;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);

    y += 8;
    
    // Amount
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", margin, y);
    doc.text(formatRupiah(receipt.amount), pageWidth - margin, y, { align: "right" });

    y += 5;
    // Terbilang  
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    const splitTerbilang = doc.splitTextToSize(`(${amountToWords(receipt.amount)} rupiah)`, pageWidth - margin * 2);
    doc.text(splitTerbilang, margin, y);
    y += splitTerbilang.length * 3 + 3;
    
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);

    y += 6;

    // Notes
    if (receipt.notes) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const splitNotes = doc.splitTextToSize(`Catatan: ${receipt.notes}`, pageWidth - margin * 2);
        doc.text(splitNotes, margin, y);
        y += (splitNotes.length * 4) + 4;
    }

    // Footer
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text("Terima kasih atas kepercayaan Anda", pageWidth / 2, y, { align: "center" });
    y += 4;
    doc.text("Simpan struk ini sebagai bukti pembayaran", pageWidth / 2, y, { align: "center" });

    doc.save(`Struk_${receipt.receiptNo}.pdf`);
}

// ============================================================
// Helper Functions
// ============================================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((acc: unknown, part: string) => {
        if (acc && typeof acc === "object" && part in acc) {
            return (acc as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

function getReceiptTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        simpanan: "Setoran Simpanan",
        pinjaman: "Pencairan Pinjaman",
        angsuran: "Pembayaran Angsuran",
        unit_transaction: "Transaksi Unit",
    };
    return labels[type] || type;
}

function getReceiptPaymentLabel(method: string): string {
    const labels: Record<string, string> = {
        cash: "Tunai",
        bank_transfer: "Transfer Bank",
        potong_gaji: "Potong Gaji",
        debet_simpanan: "Debet Simpanan",
        qris: "QRIS / E-Wallet",
    };
    return labels[method] || method;
}

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function amountToWords(amount: number): string {
    if (amount === 0) return "nol";

    const units = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
    const teens = ["sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas", "enam belas", "tujuh belas", "delapan belas", "sembilan belas"];

    function convert(n: number): string {
        if (n === 0) return "";
        if (n < 10) return units[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) return units[Math.floor(n / 10)] + " puluh" + (n % 10 ? " " + units[n % 10] : "");
        if (n < 200) return "seratus" + (n % 100 ? " " + convert(n % 100) : "");
        if (n < 1000) return units[Math.floor(n / 100)] + " ratus" + (n % 100 ? " " + convert(n % 100) : "");
        if (n < 2000) return "seribu" + (n % 1000 ? " " + convert(n % 1000) : "");
        if (n < 1000000) return convert(Math.floor(n / 1000)) + " ribu" + (n % 1000 ? " " + convert(n % 1000) : "");
        if (n < 1000000000) return convert(Math.floor(n / 1000000)) + " juta" + (n % 1000000 ? " " + convert(n % 1000000) : "");
        if (n < 1000000000000) return convert(Math.floor(n / 1000000000)) + " miliar" + (n % 1000000000 ? " " + convert(n % 1000000000) : "");
        return convert(Math.floor(n / 1000000000000)) + " triliun" + (n % 1000000000000 ? " " + convert(n % 1000000000000) : "");
    }

    return convert(Math.floor(amount));
}
