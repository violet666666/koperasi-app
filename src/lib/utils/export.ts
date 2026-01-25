/**
 * Export utilities for Excel and PDF generation
 * Provides consistent export functionality across the application
 */

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Types
export interface ExportColumn {
    key: string;
    header: string;
    width?: number;
    format?: (value: any) => string;
}

export interface ExportOptions {
    filename: string;
    title?: string;
    subtitle?: string;
    columns: ExportColumn[];
    data: Record<string, any>[];
    orientation?: "portrait" | "landscape";
}

/**
 * Export data to Excel (.xlsx)
 */
export function exportToExcel(options: ExportOptions): void {
    const { filename, title, columns, data } = options;

    // Prepare header row
    const headers = columns.map(col => col.header);

    // Prepare data rows
    const rows = data.map(row =>
        columns.map(col => {
            const value = row[col.key];
            return col.format ? col.format(value) : value;
        })
    );

    // Create worksheet data
    const wsData = [
        ...(title ? [[title], []] : []),
        headers,
        ...rows,
    ];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = columns.map(col => ({ wch: col.width || 15 }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    // Download
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export data to PDF
 */
export function exportToPDF(options: ExportOptions): void {
    const { filename, title, subtitle, columns, data, orientation = "portrait" } = options;

    // Create PDF document
    const doc = new jsPDF({
        orientation,
        unit: "mm",
        format: "a4",
    });

    // Add title
    let yPos = 20;
    if (title) {
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(title, doc.internal.pageSize.getWidth() / 2, yPos, { align: "center" });
        yPos += 8;
    }

    // Add subtitle
    if (subtitle) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(subtitle, doc.internal.pageSize.getWidth() / 2, yPos, { align: "center" });
        yPos += 10;
    }

    // Add timestamp
    doc.setFontSize(8);
    doc.text(
        `Dicetak: ${new Date().toLocaleString("id-ID")}`,
        doc.internal.pageSize.getWidth() - 15,
        10,
        { align: "right" }
    );

    // Prepare table data
    const headers = columns.map(col => col.header);
    const rows = data.map(row =>
        columns.map(col => {
            const value = row[col.key];
            return col.format ? col.format(value) : String(value ?? "");
        })
    );

    // Add table
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: yPos,
        theme: "grid",
        styles: {
            fontSize: 9,
            cellPadding: 2,
        },
        headStyles: {
            fillColor: [59, 130, 246], // blue-500
            textColor: 255,
            fontStyle: "bold",
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252], // slate-50
        },
    });

    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
            `Halaman ${i} dari ${pageCount}`,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: "center" }
        );
    }

    // Download
    doc.save(`${filename}.pdf`);
}

/**
 * Format currency for export
 */
export function formatCurrencyExport(value: number): string {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);
}

/**
 * Format date for export
 */
export function formatDateExport(value: string | Date): string {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * Format number for export
 */
export function formatNumberExport(value: number): string {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("id-ID").format(value);
}
