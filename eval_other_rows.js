const XLSX = require("xlsx");
const workbook = XLSX.readFile("integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/RINCIAN PIUTANG SP 26 (2).xlsx");
const sheetName = workbook.SheetNames.find(sn => sn.toUpperCase().includes("SHEET1 (2)") || sn.toUpperCase().includes("RINCIAN")) || workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });

let firstHeaderIdx = 9;
for (let i = firstHeaderIdx + 1; i < Math.min(60, rows.length); i++) {
    const nrp = String(rows[i][3]).trim();
    if (nrp.length > 3) {
        console.log(`ROW ${i+1}: NAME=${rows[i][1]} PINJAM=${rows[i][5]} TERBAYAR=${rows[i][22]} SISA=${rows[i][23]}`);
    }
}
