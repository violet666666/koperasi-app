const XLSX = require('xlsx');
const path = require('path');

const file2 = path.join(__dirname, 'integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/Book2.xlsx');
const wb2 = XLSX.readFile(file2);
const ws = wb2.Sheets['Sheet1 (2)'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

const headerIdx = 9;

function cleanNumber(raw) {
    if (raw === undefined || raw === null || raw === '' || raw === '-') return 0;
    const s = String(raw).replace(/[()]/g, '-').replace(/[^0-9.\-]/g, '');
    return parseFloat(s) || 0;
}

// Search for the specific names the user mentioned
const searchNames = [
    'TITIK FEBRIANTI', 'BINTI CHURIAH', 'AGUNG MARDIKO', 
    'SAIFUL HUDA', 'DODOT TRISULO', 'MADA ROMADIA', 'MURJITO'
];

console.log('=== SEARCHING USER-MENTIONED NAMES ===\n');
for (const search of searchNames) {
    console.log(`--- "${search}" ---`);
    for (let i = headerIdx + 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const col0 = String(row[0] || '').trim();
        if (!col0 || isNaN(Number(col0))) continue;
        
        const nama = String(row[1] || '').trim().toUpperCase();
        if (nama.includes(search.toUpperCase())) {
            const nrp = String(row[3] || '').trim();
            const pinjam = cleanNumber(row[5]);
            const pinjamJan = cleanNumber(row[12]);
            const pinjamFeb = cleanNumber(row[15]);
            const pinjamMrt = cleanNumber(row[18]);
            const sisaMaret = cleanNumber(row[23]);
            const sisaDes = cleanNumber(row[11]);
            const bs = cleanNumber(row[9]);
            const tglPinjam = String(row[4] || '').trim();
            const selama = cleanNumber(row[6]);
            const angsuran = cleanNumber(row[7]);
            
            console.log(`  Row ${i+1}: NO=${col0} "${nama}" NRP="${nrp}" TGL="${tglPinjam}"`);
            console.log(`    PINJAM=${pinjam} SELAMA=${selama} ANGSURAN=${angsuran} BS=${bs}`);
            console.log(`    PJan=${pinjamJan} PFeb=${pinjamFeb} PMrt=${pinjamMrt}`);
            console.log(`    SisaDes=${sisaDes} SisaMaret=${sisaMaret}`);
            console.log('');
        }
    }
}

// THE INSIGHT: These names appear TWICE but both rows have NRPs — they're DIFFERENT people!
// OR: one row has NRP, next row same-ish name has NRP too but it's the SAME NRP (2 loans)
// OR: both rows same name but different NRP = different people in different SATKER

// Let me check the actual pattern: find ALL names that appear more than once
console.log('\n=== ALL DUPLICATE NAMES IN FILE (exact match after cleaning) ===\n');

const nameMap = new Map(); // cleanName -> [{row, nrp, saldo}]

for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const nama = String(row[1] || '').trim();
    const cleanNama = nama.toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();
    const nrp = String(row[3] || '').trim().replace(/['"]/g, '');
    const sisaMaret = cleanNumber(row[23]);
    const pinjam = cleanNumber(row[5]);
    const pinjamJan = cleanNumber(row[12]);
    const pinjamFeb = cleanNumber(row[15]);
    const pinjamMrt = cleanNumber(row[18]);
    
    if (!nameMap.has(cleanNama)) nameMap.set(cleanNama, []);
    nameMap.get(cleanNama).push({ row: i + 1, nama, nrp, sisaMaret, pinjam, pinjamJan, pinjamFeb, pinjamMrt });
}

let dupCount = 0;
for (const [name, entries] of nameMap) {
    if (entries.length <= 1) continue;
    dupCount++;
    
    // Determine type: same NRP (2nd loan for same person) vs different NRP (different people)
    const nrps = entries.map(e => e.nrp).filter(n => n);
    const uniqueNrps = new Set(nrps);
    const hasBlankNrp = entries.some(e => !e.nrp);
    
    let type;
    if (uniqueNrps.size > 1) type = '🔵 DIFFERENT PEOPLE (different NRPs)';
    else if (uniqueNrps.size === 1 && hasBlankNrp) type = '🟡 2ND LOAN (1 NRP + 1 blank)';
    else if (uniqueNrps.size === 1) type = '🟢 SAME PERSON, SAME NRP (duplicate entry?)';
    else type = '⚪ NO NRP AT ALL';
    
    console.log(`${type} — "${name}" (${entries.length}x):`);
    for (const e of entries) {
        const hasSaldo = e.sisaMaret > 0 ? '✅' : '⚫';
        console.log(`  ${hasSaldo} Row ${e.row}: NRP="${e.nrp}" Pinjam=${e.pinjam} PJan=${e.pinjamJan} PFeb=${e.pinjamFeb} PMrt=${e.pinjamMrt} SisaMaret=${e.sisaMaret}`);
    }
    console.log('');
}

console.log(`\nTotal names with duplicates: ${dupCount}`);
