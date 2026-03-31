const XLSX = require('xlsx');
const path = require('path');

const file2 = path.join(__dirname, 'integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/Book2.xlsx');
const wb2 = XLSX.readFile(file2);
const ws = wb2.Sheets['Sheet1 (2)'];

// Check the cell refs to confirm column X mapping
const ref = ws['!ref'];
console.log('Sheet ref:', ref);

// Print headers using Excel column letters
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

const headerRow = rows[9];
const subHeaderRow = rows[10];

console.log('\n=== COLUMN MAPPING (Excel letter → Index → Header → SubHeader) ===');
for (let j = 0; j < 30; j++) {
    const letter = j < 26 ? String.fromCharCode(65 + j) : 'A' + String.fromCharCode(65 + j - 26);
    const h = String(headerRow[j] || '').trim().substring(0, 30);
    const sh = String(subHeaderRow[j] || '').trim().substring(0, 30);
    if (h || sh) {
        console.log(`Col ${letter} [${j}]: Header="${h}" SubHeader="${sh}"`);
    }
}

// Also check: how many with sisaMaret > 0 but NOT sisaDes > 0 (rows that only show up in Maret saldo)
let onlyMaretCount = 0, onlyDesCount = 0, bothCount = 0;
for (let i = 11; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    function cleanNumber(raw) {
        if (raw === undefined || raw === null || raw === '' || raw === '-') return 0;
        const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }
    
    const sisaDes = cleanNumber(row[11]);
    const sisaMaret = cleanNumber(row[23]);
    
    if (sisaDes > 0 && sisaMaret > 0) bothCount++;
    else if (sisaDes > 0) onlyDesCount++;
    else if (sisaMaret > 0) onlyMaretCount++;
}

console.log(`\n=== SALDO ANALYSIS ===`);
console.log(`Both DES + MARET > 0: ${bothCount}`);
console.log(`Only DES > 0 (not in Maret): ${onlyDesCount}`);
console.log(`Only MARET > 0 (new in 2026): ${onlyMaretCount}`);

// The rows that have ONLY sisaDes > 0 = already lunas by March
// Let's check some
console.log(`\n=== ROWS WITH ONLY DES SALDO (lunas by March?) ===`);
let shown = 0;
for (let i = 11; i < rows.length && shown < 5; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    function cn(raw) {
        if (raw === undefined || raw === null || raw === '' || raw === '-') return 0;
        const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
        return parseFloat(cleaned) || 0;
    }
    
    const sisaDes = cn(row[11]);
    const sisaMaret = cn(row[23]);
    
    if (sisaDes > 0 && sisaMaret <= 0) {
        const nama = String(row[1] || '').trim();
        const nrp = String(row[3] || '').trim();
        console.log(`  Row ${i+1}: ${nama} NRP=${nrp} SisaDes=${sisaDes} SisaMaret=${sisaMaret} (lunas by March)`);
        shown++;
    }
}
