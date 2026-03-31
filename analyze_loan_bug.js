const XLSX = require('xlsx');
const path = require('path');

const file2 = path.join(__dirname, 'integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/Book2.xlsx');
const wb2 = XLSX.readFile(file2);
const ws = wb2.Sheets['Sheet1 (2)'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

function cleanNrp(raw) {
    return String(raw).replace(/['\"]/g, '').replace(/\.0$/, '').trim();
}
function cleanName(n) {
    return String(n).trim().toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Find all active loans and check which names appear more than once
let activeLoansByName = {};

for (let i = 12; i <= 726; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    const nama = String(row[1] || '').trim();
    const nrp = cleanNrp(String(row[3] || ''));
    const tgl = String(row[4] || '').trim();
    const pinjam = String(row[5] || '').trim();
    const sisa = parseFloat(String(row[23] || '0').replace(/[^0-9.\-]/g, '')) || 0;
    
    if (!nama) continue;
    if (col0.toUpperCase() === 'JUMLAH' || col0.toUpperCase() === 'NO') continue;
    if (sisa <= 0) continue;
    
    const key = cleanName(nama);
    if (!activeLoansByName[key]) activeLoansByName[key] = [];
    activeLoansByName[key].push({
        row: i+1, no: col0, nrp, nama, tgl, pinjam, sisa
    });
}

// Find names with >1 active loan (true duplicates in Excel)
console.log("=== Names with MULTIPLE active loans in Excel ===");
let trueDupes = 0;
for (const [name, entries] of Object.entries(activeLoansByName)) {
    if (entries.length > 1) {
        trueDupes++;
        console.log(`\n"${name}" — ${entries.length} loans:`);
        for (const e of entries) {
            console.log(`  Row ${e.row}: NO="${e.no}" NRP="${e.nrp}" TGL="${e.tgl}" PINJAM="${e.pinjam}" SISA=${e.sisa}`);
        }
    }
}
console.log(`\nTotal members with multiple active loans: ${trueDupes}`);
console.log(`Total unique members: ${Object.keys(activeLoansByName).length}`);
console.log(`Total active loan records: ${Object.values(activeLoansByName).flat().length}`);

// Now check: for rows without NO, are they truly extension rows of the previous?
console.log("\n\n=== Rows WITHOUT 'NO' column (potential extension rows) ===");
let prevName = '';
for (let i = 12; i <= 726; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    const nama = String(row[1] || '').trim();
    const sisa = parseFloat(String(row[23] || '0').replace(/[^0-9.\-]/g, '')) || 0;
    
    if (!nama) continue;
    if (col0.toUpperCase() === 'JUMLAH' || col0.toUpperCase() === 'NO') continue;

    const hasNo = col0 && !isNaN(Number(col0));
    
    if (!hasNo) {
        const sameName = cleanName(nama) === cleanName(prevName);
        console.log(`Row ${i+1}: "${nama}" | PrevName: "${prevName}" | SameAsPrev: ${sameName} | Sisa: ${sisa}`);
    }
    
    prevName = nama;
}
