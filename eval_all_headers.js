const XLSX = require("xlsx");
const workbook = XLSX.readFile("integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/RINCIAN PIUTANG SP 26 (2).xlsx");
const sheetName = workbook.SheetNames.find(sn => sn.toUpperCase().includes("SHEET1 (2)") || sn.toUpperCase().includes("RINCIAN")) || workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });

for (let i = 0; i < rows.length - 1; i++) {
    const rowText = rows[i].map(c => String(c).toUpperCase().trim()).join('|');
    if (rowText.includes("NRP") && rowText.includes("PINJAM")) {
        const headers = rows[i];
        const subHeaders = rows[i + 1];
        let saldoIdx = -1;
        let pIdx = -1;
        let jIdx = -1;
        for (let j = 0; j < Math.max(headers.length, subHeaders.length); j++) {
            const h = (headers[j] || '').toUpperCase();
            const sh = (subHeaders[j] || '').toUpperCase();
            if (h.includes("SISA") || sh.includes("SISA SALDO") || sh.includes("SISA")) saldoIdx = j; 
            if (h === "PINJAM" || h === "PINJAMAN") pIdx = j;
            if (sh.includes("TERBAYAR")) jIdx = j;
        }
        console.log(`Row ${i} headers: PINJAM=${pIdx}, TERBAYAR=${jIdx}, SISA = ${saldoIdx}`);
    }
}
