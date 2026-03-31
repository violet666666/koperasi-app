const XLSX = require("xlsx");
const workbook = XLSX.readFile("integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/RINCIAN PIUTANG SP 26 (2).xlsx");
const sheetName = workbook.SheetNames.find(sn => sn.toUpperCase().includes("SHEET1 (2)") || sn.toUpperCase().includes("RINCIAN")) || workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });

let firstHeaderIdx = -1;
for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowText = rows[i].map(c => String(c).toUpperCase().trim()).join('|');
    if (rowText.includes("NRP") && rowText.includes("PINJAM") && rowText.includes("SELAMA")) {
        firstHeaderIdx = i;
        break;
    }
}

const headers = rows[firstHeaderIdx] || [];
const subHeaders = rows[firstHeaderIdx + 1] || [];

let saldoIdx = -1;
let pinjamIdx = -1;
let angsuranIdx = -1;
for (let j = 0; j < Math.max(headers.length, subHeaders.length); j++) {
    const h = (headers[j] || '').toUpperCase();
    const sh = (subHeaders[j] || '').toUpperCase();
    if (h.includes("SISA") || sh.includes("SISA SALDO") || sh.includes("SISA")) {
        console.log("Found SISA at col", j, "H=", h, "SH=", sh);
        saldoIdx = j; 
    }
    if (h === "PINJAM" || h === "PINJAMAN") pinjamIdx = j;
    if (sh === "ANGSURAN") angsuranIdx = j;
}

console.log(`Computed: PINJAM=${pinjamIdx}, SISA=${saldoIdx}`);

