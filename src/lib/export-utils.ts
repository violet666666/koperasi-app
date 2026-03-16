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
    type: string;
    description: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
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
    doc.setLineWidth(0.5);
    doc.rect(margin - 5, y - 5, contentWidth + 10, 155);

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("KWITANSI", pageWidth / 2, y + 5, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("KOPERASI PRIMKOPPOL POLDA RIAU", pageWidth / 2, y + 12, { align: "center" });

    y += 20;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Receipt No and Date
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`No. Kwitansi: ${receipt.receiptNo}`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(
        `Tanggal: ${new Date(receipt.receiptDate).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
        })}`,
        pageWidth - margin,
        y,
        { align: "right" }
    );

    y += 12;

    // Details table
    const details = [
        ["Diterima dari", receipt.receivedFrom],
        ["NRP", receipt.memberNo],
        ["Jenis Transaksi", getReceiptTypeLabel(receipt.type)],
        ["Keterangan", receipt.description],
        ["Metode Pembayaran", receipt.paymentMethod === "cash" ? "Tunai" : "Transfer Bank"],
    ];

    for (const [label, value] of details) {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}`, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(`: ${value}`, margin + 45, y);
        y += 7;
    }

    y += 3;

    // Amount box
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, y, contentWidth, 18, "F");
    doc.setDrawColor(41, 65, 148);
    doc.rect(margin, y, contentWidth, 18, "S");

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Jumlah yang diterima:", margin + 5, y + 8);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(
        formatRupiah(receipt.amount),
        pageWidth - margin - 5,
        y + 12,
        { align: "right" }
    );

    y += 25;

    // Terbilang
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(`Terbilang: ${amountToWords(receipt.amount)} rupiah`, margin, y);

    y += 15;

    // Notes
    if (receipt.notes) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Catatan: ${receipt.notes}`, margin, y);
        y += 10;
    }

    // Signature
    y = 155;
    const sigX = pageWidth - margin - 50;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Hormat kami,", sigX, y);

    y += 25;
    doc.line(sigX, y, sigX + 50, y);
    doc.text(`(${receipt.createdBy})`, sigX, y + 5);
    doc.text("Petugas", sigX, y + 10);

    // Footer
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150);
    doc.text(
        "Kwitansi ini sah dan merupakan bukti pembayaran yang dikeluarkan oleh Koperasi Primkoppol.",
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 15,
        { align: "center" }
    );

    doc.save(`Kwitansi_${receipt.receiptNo}.pdf`);
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
