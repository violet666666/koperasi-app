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

if (firstHeaderIdx !== -1) {
    const headers = rows[firstHeaderIdx];
    const subHeaders = rows[firstHeaderIdx + 1];
    
    headers.forEach((h, j) => {
        console.log(`Col ${j}: Header= "${h}", SubHeader= "${subHeaders?.[j] || ''}"`);
    });
} else {
    console.log("Could not find first header index based on NRP, PINJAM, SELAMA");
}
