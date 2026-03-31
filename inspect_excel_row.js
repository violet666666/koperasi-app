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

function cleanNumber(raw) {
    if (raw === undefined || raw === null || raw === "") return 0;
    if (typeof raw === 'number') return raw;
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

const targetNrp = "73040054";
for (let i = firstHeaderIdx + 1; i < rows.length; i++) {
    const nrp = String(rows[i][3]).trim();
    if (nrp.includes(targetNrp)) {
        console.log("ROW", i+1, "NRP:", nrp, "NAMA:", rows[i][1]);
        console.log("Col 5 (PINJAM):", rows[i][5], "=> clean:", cleanNumber(rows[i][5]));
        console.log("Col 22 (JML TERBAYAR):", rows[i][22], "=> clean:", cleanNumber(rows[i][22]));
        console.log("Col 23 (SISA SALDO):", rows[i][23], "=> clean:", cleanNumber(rows[i][23]));
    }
}
