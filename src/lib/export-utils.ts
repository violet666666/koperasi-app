/**
 * export-utils.ts
 * Universal Excel & PDF export utility for Koperasi Primkoppol reports.
 * Uses SheetJS (xlsx) for Excel and jsPDF for PDF.
 */

import * as XLSX from "xlsx";
import { terbilang } from "./terbilang";

function escapeHtml(str: string | number | undefined | null): string {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface ExportColumn {
    header: string;
    key: string;
    width?: number;
    format?: (value: unknown) => string;
}

/** Resolve a dot-notation key (e.g. "loan.product.name") from a flat/nested object. */
function resolveKey(obj: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((acc, part) => {
        if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
        return undefined;
    }, obj);
}

// ─── Excel Export ────────────────────────────────────────────────────────────

export function exportToExcel(
    data: Record<string, unknown>[],
    columns: ExportColumn[],
    fileName: string,
    sheetName: string = "Data"
) {
    if (!data || data.length === 0) {
        console.warn("Tidak ada data untuk diekspor.");
        return;
    }

    // Build header row
    const headers = columns.map((c) => c.header);

    // Build data rows
    const rows = data.map((row) =>
        columns.map((col) => {
            const raw = resolveKey(row, col.key);
            return col.format ? col.format(raw) : (raw ?? "");
        })
    );

    // Combine header + data
    const wsData = [headers, ...rows];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 18 }));

    // Style header row (bold) — xlsx-js-style not needed, basic XLSX doesn't support rich styles
    // We'll use a workaround via cell metadata
    headers.forEach((_, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
        if (!ws[cellRef]) return;
        ws[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "4C1D95" } },
            fontColor: { rgb: "FFFFFF" },
        };
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

    // Write & trigger download
    XLSX.writeFile(wb, `${fileName}_${formatDateForFile()}.xlsx`);
}

// ─── PDF Export (using browser print) ────────────────────────────────────────
// We use a lightweight print-to-PDF approach without adding heavy jsPDF dependency.
// Opens a new window with the table formatted for printing.

export function exportToPDF(
    data: Record<string, unknown>[],
    columns: ExportColumn[],
    title: string,
    fileName: string,
    options?: { subtitle?: string }
) {
    if (!data || data.length === 0) {
        console.warn("Tidak ada data untuk diekspor.");
        return;
    }

    const rows = data.map((row) =>
        columns.map((col) => {
            const raw = resolveKey(row, col.key);
            return col.format ? col.format(raw) : String(raw ?? "");
        })
    );

    const tableRows = rows
        .map(
            (row) =>
                `<tr>${row.map((cell) => `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;">${escapeHtml(cell)}</td>`).join("")}</tr>`
        )
        .join("");

    const headers = columns
        .map(
            (c) =>
                `<th style="padding:8px;background:#4C1D95;color:#fff;text-align:left;font-size:11px;border:1px solid #7C3AED;">${escapeHtml(c.header)}</th>`
        )
        .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
    h2 { color: #4C1D95; margin-bottom: 4px; font-size: 16px; }
    p.sub { color: #666; font-size: 11px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    tr:nth-child(even) td { background: #F9FAFB; }
    @media print {
      button { display: none; }
    }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    <h2>${escapeHtml(title)}</h2>
  </div>
  ${options?.subtitle ? `<p style="color:#666;font-size:12px;margin-bottom:8px;">${escapeHtml(options.subtitle)}</p>` : ""}
  <p class="sub">Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
        win.document.write(html);
        win.document.close();
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateForFile(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Kwitansi A4 Official Receipt ───────────────────────────────────────────────

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
    createdBy?: string;
    category?: string;
}

/** Generate A4 Official Kwitansi PDF (new print window) */
export function generateReceiptPDF(data: ReceiptData) {
    const receiptDate = new Date(data.receiptDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const typeLabels: Record<string, string> = {
        simpanan: "Setoran Simpanan",
        pinjaman: "Pencairan Pinjaman",
        angsuran: "Pembayaran Angsuran",
        unit_transaction: "Transaksi Unit",
    };

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Kwitansi ${escapeHtml(data.receiptNo)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; font-size: 12px; color: #111; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
  .org-name { font-size: 18px; font-weight: bold; text-transform: uppercase; }
  .divider { border-top: 4px double #000; margin: 8px 0 24px; }
  .title { font-size: 20px; font-weight: bold; letter-spacing: 4px; }
  .field-row { display: grid; grid-template-columns: 160px 12px 1fr; margin-bottom: 6px; }
  .amount-box { border: 2px solid #333; padding: 12px 16px; border-radius: 4px; display: flex; justify-content: space-between; margin: 16px 0 4px; }
  .amount-big { font-size: 22px; font-weight: bold; }
  .terbilang { border: 1px dashed #999; padding: 6px 12px; border-radius: 4px; margin-bottom: 16px; font-size: 11px; }
  .ttd-area { display: flex; justify-content: space-between; margin-top: 32px; }
  .ttd-box { text-align: center; min-width: 140px; }
  .ttd-line { border-bottom: 1px dashed #999; height: 60px; }
  .footer { text-align: center; margin-top: 20px; font-size: 9px; color: #888; }
  @media print { @page { size: A4; margin: 20mm; } }
</style>
</head><body>
<div class="header">
  <div style="background:#111;border-radius:8px;padding:6px;">
    <img src="/LogoPrimkoppol.png" width="50" height="50" style="object-fit:contain;display:block;" />
  </div>
  <div>
    <div class="org-name">PRIMKOPPOL Resor Lumajang</div>
    <div style="font-size:10px;color:#666;">Jl. Jend Panjaitan 46, Lumajang, Jawa Timur</div>
  </div>
</div>
<div class="divider"></div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
  <span class="title">KWITANSI</span>
  <div style="text-align:right;"><div style="font-size:10px;color:#666;">No. Kwitansi</div><div style="font-family:monospace;font-weight:bold;">${escapeHtml(data.receiptNo)}</div></div>
</div>
<div class="field-row"><span style="color:#666;">Sudah Terima Dari</span><span>:</span><strong>${escapeHtml(data.receivedFrom)}</strong></div>
<div class="field-row"><span style="color:#666;">Kategori</span><span>:</span><span>${escapeHtml(data.category || "-")}</span></div>
<div class="field-row"><span style="color:#666;">NRP / NIP Anggota</span><span>:</span><span>${escapeHtml(data.nrp || data.memberNo || "-")}</span></div>
<div class="amount-box"><span>Banyaknya Uang</span><span class="amount-big">Rp ${Number(data.amount).toLocaleString("id-ID")}</span></div>
<div class="terbilang">Terbilang: <strong style="font-style: italic; text-transform: capitalize;">${numberToWords(data.amount)}</strong></div>
<div class="field-row"><span style="color:#666;">Untuk Pembayaran</span><span>:</span><span>${escapeHtml(typeLabels[data.type] || data.type)}</span></div>
<div class="field-row"><span style="color:#666;">Keterangan</span><span>:</span><span>${escapeHtml(data.description)}</span></div>
<div class="field-row" style="margin-top:8px;"><span style="color:#666;">Metode Bayar</span><span>:</span><span>${escapeHtml(data.paymentMethod)}</span></div>
${data.referenceNo ? `<div class="field-row"><span style="color:#666;">No. Referensi</span><span>:</span><span style="font-family:monospace;">${escapeHtml(data.referenceNo)}</span></div>` : ""}
${data.notes ? `<div class="field-row"><span style="color:#666;">Catatan</span><span>:</span><span>${escapeHtml(data.notes)}</span></div>` : ""}
<div class="ttd-area">
  <div style="font-size:11px;color:#666;">Lumajang, ${receiptDate}</div>
  <div style="display:flex;gap:40px;">
    <div class="ttd-box"><p style="margin-bottom:4px;font-size:11px;color:#666;">Yang Menerima,</p><div class="ttd-line"></div><p style="margin-top:4px;font-weight:600;">${escapeHtml(data.receivedFrom)}</p><p style="font-size:10px;color:#888;">Anggota</p></div>
    <div class="ttd-box"><p style="margin-bottom:4px;font-size:11px;color:#666;">Operator</p><div class="ttd-line"></div><p style="margin-top:4px;font-weight:600;">Operator PRIMKOPPOL</p><p style="font-size:10px;color:#888;">Petugas</p></div>
  </div>
</div>
<div class="footer">Kwitansi ini sah sebagai bukti pembayaran resmi PRIMKOPPOL Resor Lumajang.</div>
<script>window.onload = () => window.print();</script>
</body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
}

/** Generate Thermal 80mm Kwitansi (compact format for POS printer) */
export function generateThermalReceiptPDF(data: ReceiptData) {
    const receiptDate = new Date(data.receiptDate).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const typeLabels: Record<string, string> = {
        simpanan: "Simpanan", pinjaman: "Pinjaman", angsuran: "Angsuran", unit_transaction: "Transaksi Unit",
    };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(data.receiptNo)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 280px; margin: auto; padding: 8px; }
  .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .label { color: #666; }
  .amount-row { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 6px 0; display: flex; justify-content: space-between; font-weight: bold; }
  .footer { text-align: center; margin-top: 8px; font-size: 10px; color: #666; }
  @media print {
    @page { size: 80mm auto; margin: 0; }
    html, body {
      height: auto !important;
      overflow: visible !important;
      margin: 0 !important;
    }
    body {
      width: 100% !important;
      max-width: 80mm;
      padding: 1mm !important;
    }
  }
</style>
</head><body>
<div class="header"><strong>PRIMKOPPOL RESOR LUMAJANG</strong><br/><span style="font-size:10px;">Polres Lumajang</span></div>
<div class="row"><span class="label">No</span><span>${escapeHtml(data.receiptNo)}</span></div>
<div class="row"><span class="label">Tgl</span><span>${receiptDate}</span></div>
<div class="row"><span class="label">Dari</span><span>${escapeHtml(data.receivedFrom)}</span></div>
<div class="row"><span class="label">NRP</span><span>${escapeHtml(data.nrp || "-")}</span></div>
<div class="row"><span class="label">Jenis</span><span>${escapeHtml(typeLabels[data.type] || data.type)}</span></div>
<div class="row"><span class="label">Ket</span><span>${escapeHtml(data.description)}</span></div>
<div class="amount-row"><span>TOTAL</span><span>Rp ${data.amount.toLocaleString("id-ID")}</span></div>
<div class="row"><span class="label">Pembayaran</span><span>${escapeHtml(data.paymentMethod)}</span></div>
${data.referenceNo ? `<div class="row"><span class="label">Ref</span><span>${escapeHtml(data.referenceNo)}</span></div>` : ""}
<div class="footer">Terima kasih<br/>PRIMKOPPOL Resor Lumajang</div>
<script>window.onload = () => window.print();</script>
</body></html>`;
    const win = window.open("", "_blank", "width=320,height=600");
    if (win) { win.document.write(html); win.document.close(); }
}

/** Simple number-to-words (Indonesian terbilang) — fallback */
function numberToWords(n: number): string {
    try {
        return terbilang(Number(n));
    } catch { return String(n); }
}

// ─── Kasir POS Thermal Receipt ───────────────────────────────────────────────

export interface KasirReceiptData {
    saleNo: string;
    saleDate: string;
    customerName?: string;
    cashierName?: string;
    items: Array<{
        name: string;
        quantity: number;
        price: number;
        subtotal: number;
    }>;
    totalAmount: number;
    paymentMethod: string;
    cashReceived?: number;
    changeAmount?: number;
}

/**
 * Generates a thermal-style receipt in a new print window.
 * Supports both 58mm and 80mm receipt printers.
 */
export function generateKasirReceiptPDF(data: KasirReceiptData, paperSize: "58mm" | "80mm" = "58mm") {
    const methodLabel =
        data.paymentMethod === "cash" ? "Tunai" :
        data.paymentMethod === "qris" ? "QRIS" :
        "Kredit / Potong Gaji";

    // Adaptif sizing berdasarkan paperSize
    const bodyWidth = paperSize === "58mm" ? "200px" : "280px";
    const fontSize = paperSize === "58mm" ? "10px" : "11px";
    const headerFontSize = paperSize === "58mm" ? "12px" : "14px";
    const windowWidth = paperSize === "58mm" ? "240" : "320";
    const pageWidth = paperSize;

    const itemRows = data.items
        .map(
            (item) =>
                `<tr>
                    <td style="padding:1px 0;font-size:${fontSize};">${escapeHtml(item.name)}</td>
                    <td style="text-align:center;padding:1px 2px;">${item.quantity}</td>
                    <td style="text-align:right;padding:1px 0;">${formatRp(item.price)}</td>
                    <td style="text-align:right;padding:1px 0;">${formatRp(item.subtotal)}</td>
                </tr>`
        )
        .join("");

    const changeRow =
        data.paymentMethod === "cash" && data.cashReceived !== undefined
            ? `<tr><td colspan="3" style="padding-top:2px;">Uang Diterima</td><td style="text-align:right;">${formatRp(data.cashReceived)}</td></tr>
               <tr><td colspan="3"><b>Kembalian</b></td><td style="text-align:right;"><b>${formatRp(data.changeAmount || 0)}</b></td></tr>`
            : "";

    const saleDate = new Date(data.saleDate).toLocaleString("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Struk ${escapeHtml(data.saleNo)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: ${fontSize}; width: ${bodyWidth}; margin: 0 auto; padding: 4px 6px; }
  .header { text-align: center; margin-bottom: 3px; border-bottom: 1px dashed #000; padding-bottom: 3px; }
  .header h2 { font-size: ${headerFontSize}; font-weight: bold; line-height: 1.2; }
  .header p { font-size: ${paperSize === "58mm" ? "9px" : "10px"}; color: #444; line-height: 1.2; }
  table { width: 100%; border-collapse: collapse; }
  th { border-bottom: 1px solid #000; padding: 1px 0; font-size: ${paperSize === "58mm" ? "9px" : "10px"}; }
  td { padding: 1px 0; line-height: 1.3; }
  .total-row td { border-top: 1px dashed #000; padding-top: 3px; font-weight: bold; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; font-size: ${paperSize === "58mm" ? "9px" : "10px"}; color: #666; line-height: 1.3; }
  @media print {
    @page { size: ${pageWidth} auto; margin: 0; }
    html, body {
      height: auto !important;
      overflow: visible !important;
      margin: 0 !important;
    }
    body {
      width: 100% !important;
      max-width: ${pageWidth};
      padding: 1mm !important;
    }
    .no-print { display: none !important; }
  }
</style>
</head><body>
<div class="header">
  <h2>PRIMKOPPOL RESOR LUMAJANG</h2>
  <p>Polres Lumajang</p>
  <p style="margin-top:2px;font-size:${fontSize};font-weight:bold;">STRUK PENJUALAN TOKO</p>
</div>
<table><tbody>
  <tr><td>No Transaksi</td><td colspan="3" style="text-align:right;">${escapeHtml(data.saleNo)}</td></tr>
  <tr><td>Tanggal</td><td colspan="3" style="text-align:right;">${saleDate}</td></tr>
  ${data.customerName ? `<tr><td>Pelanggan</td><td colspan="3" style="text-align:right;">${escapeHtml(data.customerName)}</td></tr>` : ""}
</tbody></table>
<table style="margin-top:3px;"><thead><tr>
  <th style="text-align:left;">Produk</th><th>Qty</th><th style="text-align:right;">@Hrg</th><th style="text-align:right;">Sub</th>
</tr></thead><tbody>${itemRows}</tbody>
<tfoot><tr class="total-row">
  <td colspan="3">TOTAL</td>
  <td style="text-align:right;">${formatRp(data.totalAmount)}</td>
</tr>
<tr><td colspan="3">Pembayaran</td><td style="text-align:right;">${methodLabel}</td></tr>
${changeRow}
${data.cashierName ? `<tr><td colspan="3">Kasir</td><td style="text-align:right;">${escapeHtml(data.cashierName)}</td></tr>` : ""}
</tfoot></table>
<div class="footer">
  <p>Terima kasih telah berbelanja!</p>
  <p>PRIMKOPPOL Resor Lumajang</p>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;

    const win = window.open("", "_blank", `width=${windowWidth},height=500`);
    if (win) {
        win.document.write(html);
        win.document.close();
        win.addEventListener("afterprint", () => {
            setTimeout(() => { if (!win.closed) win.close(); }, 300);
        });
        setTimeout(() => { if (!win.closed) win.close(); }, 10000);
    }
}

function formatRp(n: number): string {
    return "Rp " + n.toLocaleString("id-ID");
}

// ─── Shift Recap Thermal Print ──────────────────────────────────────────────

export interface ShiftRecapData {
    shiftName: string;
    cashierName: string;
    unitType: string;
    startedAt: string;
    endedAt: string | null;
    status: string;
    openingCash: number;
    totalCash: number;
    totalQris: number;
    totalCredit: number;
    totalRevenue: number;
    activeSales: number;
    voidedSales: number;
    expectedCash: number | null;
    closingCash: number | null;
    cashDifference: number | null;
    notes: string | null;
    sales: Array<{
        saleNo: string;
        createdAt: string;
        customer: string;
        cashier: string;
        items: number;
        method: string;
        total: number;
        isVoided: boolean;
    }>;
    topProducts: Array<{ name: string; qty: number; revenue: number }>;
}

export function generateShiftRecapPDF(data: ShiftRecapData, paperSize: "58mm" | "80mm" = "80mm") {
    const bodyWidth = paperSize === "58mm" ? "200px" : "280px";
    const fontSize = paperSize === "58mm" ? "10px" : "11px";
    const windowWidth = paperSize === "58mm" ? "240" : "320";

    const fmtDt = (iso: string) =>
        new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const methodLabel = (m: string) =>
        m === "cash" ? "Tunai" : m === "qris" ? "QRIS" : "Potong Gaji";

    const saleRows = data.sales.map(s =>
        `<tr style="${s.isVoided ? 'opacity:0.4;' : ''}">
            <td style="padding:1px 0;font-size:9px;">${escapeHtml(s.saleNo)}</td>
            <td style="text-align:center;font-size:9px;">${s.createdAt ? new Date(s.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
            <td style="font-size:9px;">${escapeHtml(s.customer || "Umum")}</td>
            <td style="text-align:center;font-size:9px;">${methodLabel(s.method)}</td>
            <td style="text-align:right;font-size:9px;">${formatRp(s.total)}</td>
        </tr>`
    ).join("");

    const topProductLines = data.topProducts.slice(0, 5).map(p =>
        `<tr><td style="font-size:9px;">${escapeHtml(p.name)}</td><td style="text-align:center;font-size:9px;">${p.qty}</td><td style="text-align:right;font-size:9px;">${formatRp(p.revenue)}</td></tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Rekap Shift ${escapeHtml(data.shiftName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: ${fontSize}; width: ${bodyWidth}; margin: 0 auto; padding: 4px 6px; }
  .header { text-align: center; margin-bottom: 3px; border-bottom: 1px dashed #000; padding-bottom: 3px; }
  .header h2 { font-size: ${paperSize === "58mm" ? "12px" : "14px"}; font-weight: bold; line-height: 1.2; }
  .header p { font-size: ${paperSize === "58mm" ? "9px" : "10px"}; line-height: 1.2; }
  .row { display: flex; justify-content: space-between; margin: 1px 0; }
  .divider { border-top: 1px dashed #000; margin: 3px 0; }
  .bold { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  th { border-bottom: 1px solid #000; padding: 1px 0; font-size: 9px; text-align: left; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; font-size: 9px; color: #666; line-height: 1.3; }
  @media print {
    @page { size: ${paperSize} auto; margin: 0; }
    html, body {
      height: auto !important;
      overflow: visible !important;
      margin: 0 !important;
    }
    body {
      width: 100% !important;
      max-width: ${paperSize};
      padding: 1mm !important;
    }
  }
</style>
</head><body>
<div class="header">
  <h2>PRIMKOPPOL RESOR LUMAJANG</h2>
  <p>REKAP SHIFT ${escapeHtml(data.shiftName.toUpperCase())}</p>
  <p style="margin-top:2px;">${fmtDt(data.startedAt)} ${data.endedAt ? ' → ' + fmtDt(data.endedAt) : '(Masih Berlangsung)'}</p>
</div>

<div class="row"><span>Kasir</span><span>: ${escapeHtml(data.cashierName)}</span></div>
<div class="row"><span>Status</span><span>: ${data.status === "open" ? "AKTIF" : "DITUTUP"}</span></div>

<div class="divider"></div>
<div class="bold" style="margin-bottom:2px;">RINGKASAN</div>
<div class="row"><span>Modal Awal</span><span>${formatRp(data.openingCash)}</span></div>
<div class="row"><span>Tunai (${data.activeSales} trx)</span><span>${formatRp(data.totalCash)}</span></div>
<div class="row"><span>QRIS</span><span>${formatRp(data.totalQris)}</span></div>
<div class="row"><span>Potong Gaji</span><span>${formatRp(data.totalCredit)}</span></div>
<div class="divider"></div>
<div class="row bold"><span>TOTAL PENDAPATAN</span><span>${formatRp(data.totalRevenue)}</span></div>
${data.voidedSales > 0 ? `<div class="row" style="color:#999;"><span>Dibatalkan (Void)</span><span>${data.voidedSales} trx</span></div>` : ""}

${data.expectedCash != null ? `
<div class="divider"></div>
<div class="bold" style="margin-bottom:2px;">REKONSILIASI KAS</div>
<div class="row"><span>Kas Seharusnya</span><span>${formatRp(data.expectedCash)}</span></div>
${data.closingCash != null ? `<div class="row"><span>Kas Fisik</span><span>${formatRp(data.closingCash)}</span></div>` : ""}
${data.cashDifference != null ? `<div class="row bold"><span>Selisih</span><span>${data.cashDifference === 0 ? "Rp 0 (Seimbang)" : formatRp(data.cashDifference)}</span></div>` : ""}
` : ""}

${data.notes ? `<div class="divider"></div><div class="row"><span>Catatan</span><span>: ${escapeHtml(data.notes)}</span></div>` : ""}

<div class="divider"></div>
<div class="bold" style="margin-bottom:2px;">DAFTAR TRANSAKSI</div>
<table><thead><tr>
  <th>No. Trx</th><th style="text-align:center;">Jam</th><th>Pelanggan</th><th style="text-align:center;">Metode</th><th style="text-align:right;">Total</th>
</tr></thead><tbody>${saleRows}</tbody></table>

${topProductLines ? `
<div class="divider"></div>
<div class="bold" style="margin-bottom:2px;">PRODUK TERLARIS</div>
<table><thead><tr><th>Produk</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Pendapatan</th></tr></thead>
<tbody>${topProductLines}</tbody></table>
` : ""}

<div class="footer">
  <p>Dicetak: ${new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
  <p>Rekap Shift — PRIMKOPPOL Resor Lumajang</p>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;

    const win = window.open("", "_blank", `width=${windowWidth},height=600`);
    if (win) {
        win.document.write(html);
        win.document.close();
        win.addEventListener("afterprint", () => {
            setTimeout(() => { if (!win.closed) win.close(); }, 300);
        });
        setTimeout(() => { if (!win.closed) win.close(); }, 15000);
    }
}
