const XLSX = require('xlsx');
const path = require('path');

const file2 = path.join(__dirname, 'integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/Book2.xlsx');
const wb2 = XLSX.readFile(file2);
const ws = wb2.Sheets['Sheet1 (2)'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

const headerIdx = 9;

function cleanNumber(raw) {
    if (raw === undefined || raw === null || raw === '' || raw === '-') return 0;
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// Check the 6 duplicate names + specifically INDRA SETIAWAN and FAJAR NUR ILHAMSYAH mentioned by user
const searchNames = ['INDRA SETIAWAN', 'FAJAR NUR ILHAMSYAH', 'BAMBANG SISWANTO', 'HARIYANTO', 'RUDI HARTONO', 'WINARTO', 'NANANG HANDOKO', 'SUHARTONO'];

console.log('=== SEARCHING FOR SPECIFIC NAMES ===\n');

for (const search of searchNames) {
    console.log(`--- "${search}" ---`);
    for (let i = headerIdx + 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const col0 = String(row[0] || '').trim();
        if (!col0 || isNaN(Number(col0))) continue;
        
        const nama = String(row[1] || '').trim().toUpperCase();
        if (nama.includes(search) || search.includes(nama)) {
            const nrp = String(row[3] || '').trim();
            const pinjam = cleanNumber(row[5]);
            const pinjamJan = cleanNumber(row[12]);
            const pinjamFeb = cleanNumber(row[15]);
            const pinjamMrt = cleanNumber(row[18]);
            const sisaMaret = cleanNumber(row[23]);
            const bs = cleanNumber(row[9]);
            const angsuran = cleanNumber(row[7]);
            const selama = cleanNumber(row[6]);
            const tglPinjam = String(row[4] || '').trim();
            
            console.log(`  Row ${i+1}: NO=${col0} NAMA="${nama}" NRP="${nrp}" TGL=${tglPinjam}`);
            console.log(`    PINJAM=${pinjam} SELAMA=${selama} ANGSURAN=${angsuran} BS=${bs}`);
            console.log(`    PINJAM_JAN=${pinjamJan} PINJAM_FEB=${pinjamFeb} PINJAM_MRT=${pinjamMrt}`);
            console.log(`    SISA_MARET=${sisaMaret}`);
            console.log('');
        }
    }
}

// Now specifically: find ALL rows where NRP is blank, row has saldo > 0,
// AND there exists another row with the same CLEANED name that has an NRP
console.log('\n=== ALL BLANK-NRP WITH SAME-NAME-HAS-NRP (2nd LOANS) ===');
const nameNrpMap = new Map();
const dataRows = [];

for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || col0.toUpperCase() === 'JUMLAH' || col0.toUpperCase() === 'NO' || isNaN(Number(col0))) continue;
    
    const nrp = String(row[3] || '').trim().replace(/['\"]/g, '').replace(/\.0$/, '').trim();
    const nama = String(row[1] || '').trim();
    const cleanNama = nama.toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();
    const sisaMaret = cleanNumber(row[23]);
    
    dataRows.push({ rowIdx: i, nrp, nama, cleanNama, sisaMaret });
    
    if (nrp && !nameNrpMap.has(cleanNama)) {
        nameNrpMap.set(cleanNama, { nrp, rowIdx: i, nama });
    }
}

let secondLoanCount = 0;
for (const dr of dataRows) {
    if (dr.nrp) continue; // has NRP, skip
    if (dr.sisaMaret <= 0) continue; // no active loan
    
    const match = nameNrpMap.get(dr.cleanNama);
    if (match) {
        secondLoanCount++;
        console.log(`  Row ${dr.rowIdx + 1}: "${dr.nama}" → matches NRP="${match.nrp}" from "${match.nama}" Row ${match.rowIdx + 1} | SisaMaret=${dr.sisaMaret}`);
    }
}
console.log(`\nTotal 2nd loans (blank NRP, name matches existing NRP row): ${secondLoanCount}`);

// Final grand total
const withNrp = dataRows.filter(d => d.nrp && d.sisaMaret > 0).length;
const noNrpWithMatch = secondLoanCount;
const noNrpNew = dataRows.filter(d => !d.nrp && d.sisaMaret > 0 && !nameNrpMap.has(d.cleanNama)).length;
const total = withNrp + noNrpWithMatch + noNrpNew;

console.log('\n=== GRAND TOTAL LOANS TO IMPORT ===');
console.log(`With NRP (matched to existing member): ${withNrp}`);
console.log(`2nd loan (blank NRP, name match): ${noNrpWithMatch}`);
console.log(`New members (blank NRP, no match): ${noNrpNew}`);
console.log(`TOTAL LOAN RECORDS: ${total}`);
