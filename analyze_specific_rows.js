const XLSX = require('xlsx');
const path = require('path');

const file2 = path.join(__dirname, 'integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/Book2.xlsx');
const wb2 = XLSX.readFile(file2);
const ws = wb2.Sheets['Sheet1 (2)'];

// Read rows directly as array of arrays to see raw Excel exactly
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

function cleanNum(raw) {
    if (raw === undefined || raw === null || raw === '' || raw === '-') return 0;
    const s = String(raw).replace(/[()]/g, '-').replace(/[^0-9.\-]/g, '');
    return parseFloat(s) || 0;
}

console.log('=== CHECKING SPECIFIC EXCEL ROWS ===\n');

// The user is talking about Excel rows (which are 1-indexed)
// So Excel row 186 is array index 185
const targets = [
    [185, 186], // Excel rows 186-187
    [319, 320], // Excel rows 320-321
    [399, 400], // Excel rows 400-401
    [412, 413], // Excel rows 413-414
    [442, 443]  // Excel rows 443-444
];

for (const pair of targets) {
    console.log(`--- Checking Excel Rows ${pair[0]+1} and ${pair[1]+1} ---`);
    for (const idx of pair) {
        const row = rows[idx];
        if (!row) {
            console.log(`Row ${idx+1} is empty/undefined`);
            continue;
        }
        
        const no = String(row[0]).trim();
        const nama = String(row[1]).trim();
        const pangkat = String(row[2]).trim();
        const nrp = String(row[3]).trim();
        const pinjam = cleanNum(row[5]);
        const sisaMaret = cleanNum(row[23]);
        
        console.log(`Row ${idx+1}: NO="${no}" NAMA="${nama}" NRP="${nrp}" Pangkat="${pangkat}"`);
        console.log(`        PinjamLama=${pinjam} SisaMaret=${sisaMaret}`);
    }
    console.log('');
}

// Let's do a more robust visual scan for "empty NO" rows right below a valid row
console.log('=== SCANNING FOR ALL "EMPTY NO" ROWS BELOW VALID ROWS ===');
let foundBlanks = 0;
for (let i = 11; i < rows.length; i++) {
    const curr = rows[i];
    const prev = rows[i-1];
    
    if (!curr || !prev) continue;
    
    const currNo = String(curr[0]).trim();
    const prevNo = String(prev[0]).trim();
    
    // If previous row has a valid number, but current row has empty number
    // AND current row has some data (like loan amounts)
    if (prevNo && !isNaN(Number(prevNo)) && currNo === '') {
        const currPinjamJan = cleanNum(curr[12]);
        const currSisa = cleanNum(curr[23]);
        const prevNama = String(prev[1]).trim();
        const currNama = String(curr[1]).trim();
        
        if (currSisa > 0 || currPinjamJan > 0) {
            foundBlanks++;
            console.log(`Found extension row at Excel Row ${i+1}:`);
            console.log(`  Prev Row ${i}: NO="${prevNo}" NAMA="${prevNama}" NRP="${String(prev[3]).trim()}"`);
            console.log(`  Curr Row ${i+1}: NO="${currNo}" NAMA="${currNama}" (SisaMaret=${currSisa})`);
        }
    }
}

console.log(`\nTotal empty-NO extension rows with saldo: ${foundBlanks}`);
