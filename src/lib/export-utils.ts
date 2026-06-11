/**
 * export-utils.ts
 * Universal Excel & PDF export utility for Koperasi Primkoppol reports.
 * Uses SheetJS (xlsx) for Excel and jsPDF for PDF.
 */

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

export async function exportToExcel(
    data: Record<string, unknown>[],
    columns: ExportColumn[],
    fileName: string,
    sheetName: string = "Data"
) {
    if (!data || data.length === 0) {
        console.warn("Tidak ada data untuk diekspor.");
        return;
    }

    const XLSX = await import("xlsx");

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

// ─── Faktur Piutang PDF ────────────────────────────────────────────────────

export interface FakturPiutangMember {
    name: string;
    nrp: string | null;
    unitBreakdown: { unitType: string; amount: number; count: number }[];
    totalAmount: number;
}

export interface FakturPiutangData {
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    status: "draft" | "processed";
    processedByName: string | null;
    processedAt: string | null;
    members: FakturPiutangMember[];
    totalAmount: number;
    totalMembers: number;
    totalTransactions: number;
    unitSummary: { unitType: string; amount: number; count: number }[];
}

const FAKTUR_UNIT_LABELS: Record<string, string> = {
    toko: "Toko",
    carwash: "Cuci Mobil",
    resto: "Resto",
    coffe_latar: "Cafe Latar",
    cafe_lsp: "Cafe LSP",
    barbershop: "Barbershop",
    fitness: "Fitness",
    play_station: "PlayStation",
    properti: "Properti",
    simpan_pinjam: "Simpan Pinjam",
};

export function generateFakturPiutangPDF(data: FakturPiutangData) {
    const printDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const startDate = new Date(data.periodStart).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const endDate = new Date(data.periodEnd).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const statusLabel = data.status === "processed" ? "DIKONFIRMASI" : "DRAFT";

    // Member rows
    const memberRows = data.members.map((m, i) => {
        const unitDetail = m.unitBreakdown
            .map((u) => `${FAKTUR_UNIT_LABELS[u.unitType] || u.unitType} ${formatCurrencyExport(u.amount)}`)
            .join("; ");
        return `<tr>
            <td style="padding:6px 10px;border:1px solid #d1d5db;text-align:center;font-size:11px;">${i + 1}</td>
            <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:11px;">${escapeHtml(m.name)}</td>
            <td style="padding:6px 10px;border:1px solid #d1d5db;text-align:center;font-size:11px;">${escapeHtml(m.nrp || "-")}</td>
            <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:10px;color:#4b5563;">${escapeHtml(unitDetail)}</td>
            <td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;font-size:11px;font-weight:600;white-space:nowrap;">Rp ${m.totalAmount.toLocaleString("id-ID")}</td>
        </tr>`;
    }).join("");

    // Unit summary
    const unitSummaryRows = data.unitSummary.map((u) => {
        return `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border:1px solid #e5e7eb;border-radius:4px;margin:2px 4px 2px 0;font-size:10px;">
            <span style="font-weight:600;">${escapeHtml(FAKTUR_UNIT_LABELS[u.unitType] || u.unitType)}</span>
            <span>Rp ${u.amount.toLocaleString("id-ID")}</span>
            <span style="color:#9ca3af;">(${u.count} tx)</span>
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Faktur Piutang - ${escapeHtml(data.periodLabel)}</title>
<style>
  @page { size: A4; margin: 15mm 18mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; color: #111; font-size: 12px; }
  .header { display: flex; align-items: center; gap: 14px; margin-bottom: 4px; }
  .logo-box { background: #1a1a2e; border-radius: 10px; padding: 6px; line-height: 0; }
  .org-name { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .org-sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .divider { border-top: 3px double #1a1a2e; border-bottom: 1px solid #1a1a2e; padding: 1px 0; margin: 10px 0 20px; }
  .doc-title-area { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .doc-title { font-size: 18px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #1a1a2e; }
  .doc-badge { padding: 4px 14px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
  .badge-confirmed { background: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7; }
  .badge-draft { background: #fffbeb; color: #92400e; border: 1px solid #fcd34d; }
  .info-grid { display: grid; grid-template-columns: 120px 8px 1fr; row-gap: 4px; margin-bottom: 16px; font-size: 11px; }
  .info-label { color: #6b7280; }
  .info-value { font-weight: 500; }
  .section-title { font-size: 12px; font-weight: 700; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 1px; color: #374151; }
  table { width: 100%; border-collapse: collapse; }
  thead th { padding: 8px 10px; background: #1a1a2e; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  thead th:last-child { text-align: right; }
  thead th:first-child { text-align: center; width: 36px; }
  thead th:nth-child(3) { text-align: center; }
  tbody tr:nth-child(even) td { background: #f9fafb; }
  tfoot td { padding: 10px; border: 1px solid #d1d5db; font-weight: 700; background: #f3f4f6; }
  tfoot .total-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  tfoot .total-amount { text-align: right; font-size: 14px; white-space: nowrap; }
  .unit-summary { margin: 12px 0; }
  .ttd-area { display: flex; justify-content: space-between; margin-top: 48px; }
  .ttd-box { text-align: center; min-width: 160px; }
  .ttd-line { height: 60px; border-bottom: 1px dashed #9ca3af; }
  .ttd-name { margin-top: 4px; font-weight: 600; font-size: 11px; }
  .ttd-role { font-size: 10px; color: #6b7280; }
  .footer { margin-top: 32px; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  @media print {
    button { display: none; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- Kop Surat -->
<div class="header">
  <div class="logo-box">
    <img src="/LogoPrimkoppol.png" width="48" height="48" style="object-fit:contain;display:block;" />
  </div>
  <div>
    <div class="org-name">PRIMKOPPOL Resor Lumajang</div>
    <div class="org-sub">Jl. Alun-Alun Utara No. 11, Rogotrunan, Kec. Lumajang, Kabupaten Lumajang, Jawa Timur 67316 &middot; Telp. (0334) 881110</div>
  </div>
</div>
<div class="divider"></div>

<!-- Document Title -->
<div class="doc-title-area">
  <div class="doc-title">Faktur Piutang</div>
  <div class="doc-badge ${data.status === "processed" ? "badge-confirmed" : "badge-draft"}">${statusLabel}</div>
</div>

// Document Info
<div class="info-grid">
  <span class="info-label">Periode</span><span>:</span><span class="info-value">${escapeHtml(data.periodLabel)}</span>
  <span class="info-label">Rentang Tanggal</span><span>:</span><span class="info-value">${startDate} s/d ${endDate}</span>
  <span class="info-label">Jumlah Anggota</span><span>:</span><span class="info-value">${data.totalMembers} orang &middot; ${data.totalTransactions} transaksi</span>
  ${data.processedByName ? `<span class="info-label">Diproses Oleh</span><span>:</span><span class="info-value">${escapeHtml(data.processedByName)}${data.processedAt ? " &mdash; " + new Date(data.processedAt).toLocaleString("id-ID") : ""}</span>` : ""}
  <span class="info-label">Dicetak</span><span>:</span><span class="info-value">${printDate}</span>
</div>

// Unit Summary
<div class="unit-summary">
  <div style="font-size:10px;font-weight:600;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Ringkasan per Unit</div>
  ${unitSummaryRows}
</div>

// Detail Table
<table>
  <thead>
    <tr>
      <th>No</th>
      <th>Nama Anggota</th>
      <th>NRP</th>
      <th>Detail Unit</th>
      <th>Total Piutang</th>
    </tr>
  </thead>
  <tbody>
    ${memberRows}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="4" class="total-label">Total Piutang</td>
      <td class="total-amount">Rp ${data.totalAmount.toLocaleString("id-ID")}</td>
    </tr>
  </tfoot>
</table>

// Signature Area
<div class="ttd-area">
  <div class="ttd-box">
    <p style="font-size:11px;margin-bottom:4px;color:#6b7280;">Mengetahui,</p>
    <p style="font-size:11px;font-weight:600;">Kepala Unit Simpan Pinjam</p>
    <div class="ttd-line"></div>
    <div class="ttd-name">(........................................)</div>
  </div>
  <div class="ttd-box">
    <p style="font-size:11px;margin-bottom:4px;color:#6b7280;">Lumajang, ${printDate}</p>
    <p style="font-size:11px;font-weight:600;">Operator</p>
    <div class="ttd-line"></div>
    <div class="ttd-name">${escapeHtml(data.processedByName || "........................................")}</div>
  </div>
</div>

// Footer
<div class="footer">
  Dokumen ini dicetak secara otomatis oleh Sistem Informasi PRIMKOPPOL Resor Lumajang &middot; Sah dan berlaku sebagai bukti tagihan piutang resmi.
</div>

<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 400);
  };
</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
        win.document.write(html);
        win.document.close();
    }
}

function formatCurrencyExport(n: number): string {
    return "Rp " + n.toLocaleString("id-ID");
}

// ─── Faktur Piutang Excel Export ───────────────────────────────────────────

export async function exportFakturPiutangExcel(data: FakturPiutangData) {
    if (!data.members || data.members.length === 0) {
        console.warn("Tidak ada data untuk diekspor.");
        return;
    }

    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Detail per Anggota ──────────────────────────────────────
    const detailRows: Record<string, unknown>[] = [];
    let no = 1;
    for (const m of data.members) {
        // One row per unit breakdown, with member info repeated
        for (const u of m.unitBreakdown) {
            detailRows.push({
                "No": no++,
                "Nama Anggota": m.name,
                "NRP": m.nrp || "-",
                "Unit": FAKTUR_UNIT_LABELS[u.unitType] || u.unitType,
                "Jumlah Transaksi": u.count,
                "Piutang per Unit": u.amount,
            });
        }
    }

    // Summary row
    detailRows.push({});
    detailRows.push({
        "No": "",
        "Nama Anggota": "TOTAL",
        "NRP": "",
        "Unit": `${data.totalMembers} anggota · ${data.totalTransactions} transaksi`,
        "Jumlah Transaksi": "",
        "Piutang per Unit": data.totalAmount,
    });

    const ws1 = XLSX.utils.json_to_sheet(detailRows);

    // Column widths
    ws1["!cols"] = [
        { wch: 5 },   // No
        { wch: 28 },  // Nama Anggota
        { wch: 14 },  // NRP
        { wch: 18 },  // Unit
        { wch: 12 },  // Jumlah Transaksi
        { wch: 20 },  // Piutang per Unit
    ];

    // Format currency column (F) as number
    const range = XLSX.utils.decode_range(ws1["!ref"] || "A1");
    for (let R = range.s.r; R <= range.e.r; R++) {
        const cell = ws1[XLSX.utils.encode_cell({ r: R, c: 5 })]; // Column F
        if (cell && typeof cell.v === "number") {
            cell.z = '#,##0';
        }
    }

    XLSX.utils.book_append_sheet(wb, ws1, "Detail Anggota");

    // ── Sheet 2: Ringkasan per Unit ──────────────────────────────────────
    const unitRows = data.unitSummary.map((u) => ({
        "Unit": FAKTUR_UNIT_LABELS[u.unitType] || u.unitType,
        "Jumlah Transaksi": u.count,
        "Total Piutang": u.amount,
    }));

    unitRows.push({});
    unitRows.push({
        "Unit": "TOTAL",
        "Jumlah Transaksi": data.unitSummary.reduce((s, u) => s + u.count, 0),
        "Total Piutang": data.totalAmount,
    });

    const ws2 = XLSX.utils.json_to_sheet(unitRows);
    ws2["!cols"] = [
        { wch: 20 },  // Unit
        { wch: 18 },  // Jumlah Transaksi
        { wch: 22 },  // Total Piutang
    ];

    XLSX.utils.book_append_sheet(wb, ws2, "Ringkasan Unit");

    // ── Sheet 3: Rekap per Anggota (one row per member with total) ──────
    const rekapRows = data.members.map((m, i) => {
        const unitDetail = m.unitBreakdown
            .map((u) => `${FAKTUR_UNIT_LABELS[u.unitType] || u.unitType}: Rp ${u.amount.toLocaleString("id-ID")}`)
            .join("; ");
        return {
            "No": i + 1,
            "Nama Anggota": m.name,
            "NRP": m.nrp || "-",
            "Jumlah Unit": m.unitBreakdown.length,
            "Detail Unit": unitDetail,
            "Total Piutang": m.totalAmount,
        };
    });

    rekapRows.push({});
    rekapRows.push({
        "No": "",
        "Nama Anggota": "TOTAL",
        "NRP": "",
        "Jumlah Unit": "",
        "Detail Unit": "",
        "Total Piutang": data.totalAmount,
    });

    const ws3 = XLSX.utils.json_to_sheet(rekapRows);
    ws3["!cols"] = [
        { wch: 5 },   // No
        { wch: 28 },  // Nama Anggota
        { wch: 14 },  // NRP
        { wch: 12 },  // Jumlah Unit
        { wch: 45 },  // Detail Unit
        { wch: 20 },  // Total Piutang
    ];

    XLSX.utils.book_append_sheet(wb, ws3, "Rekap Anggota");

    // ── Save ─────────────────────────────────────────────────────────────
    const startDate = new Date(data.periodStart);
    const periodSuffix = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, "0")}`;
    XLSX.writeFile(wb, `Faktur_Piutang_${data.periodLabel.replace(/\s+/g, "_")}_${periodSuffix}.xlsx`);
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
    <div style="font-size:10px;color:#666;">Jl. Alun-Alun Utara No. 11, Rogotrunan, Kec. Lumajang, Kabupaten Lumajang, Jawa Timur 67316</div>
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
  <div style="display:flex;justify-content:flex-end;">
    <div class="ttd-box"><p style="margin-bottom:4px;font-size:11px;color:#666;">Yang Menerima,</p><p style="margin-bottom:4px;font-size:10px;font-weight:600;color:#666;">Operator PRIMKOPPOL</p><div class="ttd-line"></div><p style="margin-top:4px;font-weight:600;">${escapeHtml(data.createdBy || "Operator")}</p><p style="font-size:10px;color:#888;">Petugas</p></div>
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
  body { font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; color: #000; letter-spacing: 0.3px; line-height: 1.4; width: 280px; margin: auto; padding: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .label { color: #000; }
  .amount-row { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 6px 0; display: flex; justify-content: space-between; font-weight: bold; }
  .footer { text-align: center; margin-top: 8px; font-size: 11px; color: #000; }
  @media print {
    @page { size: 80mm auto; margin: 0; }
    html, body {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
    }
    body {
      margin: 0 !important;
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
</body></html>`;
    const win = window.open("", "_blank", "width=320,height=800");
    if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => {
            if (!win.closed) {
                win.print();
                setTimeout(() => { if (!win.closed) win.close(); }, 1000);
            }
        }, 500);
    }
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
    unitLabel?: string;
    takeawaySurcharge?: number;
    takeawaySurchargeQty?: number;
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
    const fontSize = paperSize === "58mm" ? "12px" : "13px";
    const headerFontSize = paperSize === "58mm" ? "14px" : "16px";
    const smallFontSize = paperSize === "58mm" ? "11px" : "12px";
    const windowWidth = paperSize === "58mm" ? "260" : "340";
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
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { font-family: 'Courier New', monospace; font-size: ${fontSize}; font-weight: bold; color: #000; letter-spacing: 0.3px; line-height: 1.4; width: ${bodyWidth}; margin: 0 auto; padding: 4px 6px; }
  .header { text-align: center; margin-bottom: 3px; border-bottom: 1px dashed #000; padding-bottom: 3px; }
  .header h2 { font-size: ${headerFontSize}; font-weight: bold; line-height: 1.3; }
  .header p { font-size: ${smallFontSize}; color: #000; line-height: 1.3; }
  table { width: 100%; border-collapse: collapse; }
  th { border-bottom: 1px solid #000; padding: 1px 0; font-size: ${smallFontSize}; font-weight: bold; }
  td { padding: 1px 0; line-height: 1.4; }
  .total-row td { border-top: 1px dashed #000; padding-top: 3px; font-weight: bold; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; font-size: ${smallFontSize}; color: #000; line-height: 1.4; }
  @media print {
    @page { size: ${pageWidth} auto; margin: 0; }
    html, body {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
    }
    body {
      margin: 0 !important;
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
  <p style="margin-top:2px;font-size:${fontSize};font-weight:bold;">${escapeHtml(data.unitLabel || "STRUK PENJUALAN TOKO")}</p>
</div>
<table><tbody>
  <tr><td>No Transaksi</td><td colspan="3" style="text-align:right;">${escapeHtml(data.saleNo)}</td></tr>
  <tr><td>Tanggal</td><td colspan="3" style="text-align:right;">${saleDate}</td></tr>
  ${data.customerName ? `<tr><td>Pelanggan</td><td colspan="3" style="text-align:right;">${escapeHtml(data.customerName)}</td></tr>` : ""}
</tbody></table>
<table style="margin-top:3px;"><thead><tr>
  <th style="text-align:left;">Produk</th><th>Qty</th><th style="text-align:right;">@Hrg</th><th style="text-align:right;">Sub</th>
</tr></thead><tbody>${itemRows}</tbody>
${data.takeawaySurcharge && data.takeawaySurchargeQty ? `<tbody><tr><td colspan="3" style="padding:1px 0;">Biaya Takeaway (${data.takeawaySurchargeQty})</td><td style="text-align:right;">${formatRp(data.takeawaySurcharge)}</td></tr></tbody>` : ""}
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
</body></html>`;

    const win = window.open("", "_blank", `width=${windowWidth},height=800`);
    if (win) {
        win.document.write(html);
        win.document.close();
        // Auto-print setelah DOM siap, tapi JANGAN auto-close.
        // Auto-close terlalu cepat bisa membatalkan dialog print di tablet/perangkat lambat.
        // (Match behavior with ReceiptPrimkopol component)
        win.onload = () => {
            setTimeout(() => {
                if (!win.closed) win.print();
            }, 400);
        };
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
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { font-family: 'Courier New', monospace; font-size: ${fontSize}; font-weight: bold; color: #000; letter-spacing: 0.3px; line-height: 1.4; width: ${bodyWidth}; margin: 0 auto; padding: 4px 6px; }
  .header { text-align: center; margin-bottom: 3px; border-bottom: 1px dashed #000; padding-bottom: 3px; }
  .header h2 { font-size: ${paperSize === "58mm" ? "14px" : "16px"}; font-weight: bold; line-height: 1.3; }
  .header p { font-size: ${paperSize === "58mm" ? "11px" : "12px"}; line-height: 1.3; }
  .row { display: flex; justify-content: space-between; margin: 1px 0; }
  .divider { border-top: 1px dashed #000; margin: 3px 0; }
  .bold { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  th { border-bottom: 1px solid #000; padding: 1px 0; font-size: 11px; text-align: left; font-weight: bold; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; font-size: 11px; color: #000; line-height: 1.4; }
  @media print {
    @page { size: ${paperSize} auto; margin: 0; }
    html, body {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
    }
    body {
      margin: 0 !important;
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
${data.voidedSales > 0 ? `<div class="row" style="color:#000;"><span>Dibatalkan (Void)</span><span>${data.voidedSales} trx</span></div>` : ""}

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
</body></html>`;

    const win = window.open("", "_blank", `width=${windowWidth},height=800`);
    if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => {
            if (!win.closed) {
                win.print();
                setTimeout(() => { if (!win.closed) win.close(); }, 1000);
            }
        }, 500);
    }
}
