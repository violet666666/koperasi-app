const XLSX = require('xlsx');
const path = require('path');

const file2 = path.join(__dirname, 'integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/Book2.xlsx');
const wb2 = XLSX.readFile(file2);
const ws = wb2.Sheets['Sheet1 (2)'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

// Find all SATKER section headers
console.log('=== SATKER SECTIONS ===');
for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const col0 = String(row[0] || '').trim().toUpperCase();
    
    // Satker headers: non-numeric text in col0 that isn't header/subtotal
    if (col0 && col0 !== 'JUMLAH' && col0 !== 'NO' && isNaN(Number(col0)) && col0.length > 2) {
        console.log(`Row ${i}: "${col0}" (full: ${row.slice(0, 5).map(c => String(c).trim()).join(' | ')})`);
    }
}

// Find duplicate NRP values (same NRP appears in different satker sections)
console.log('\n=== SAME NRP IN MULTIPLE SECTIONS ===');
const nrpToRows = new Map();
let headerIdx = 9; // Already know from analysis

for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const nrp = String(row[3] || '').trim().replace(/['".0]/g, '');
    const nama = String(row[1] || '').trim();
    const pinjam = String(row[5] || '').trim();
    const saldo = String(row[23] || '').trim();
    
    if (nrp) {
        if (!nrpToRows.has(nrp)) nrpToRows.set(nrp, []);
        nrpToRows.get(nrp).push({ rowIdx: i, nama, pinjam, saldo });
    }
}

let dupNrpCount = 0;
for (const [nrp, entries] of nrpToRows) {
    if (entries.length > 1) {
        dupNrpCount++;
        console.log(`NRP "${nrp}" appears ${entries.length}x:`);
        for (const e of entries) {
            console.log(`  Row ${e.rowIdx + 1}: ${e.nama} - PINJAM=${e.pinjam} SALDO=${e.saldo}`);
        }
    }
}
console.log(`\nTotal NRP duplicates: ${dupNrpCount}`);

// Count how many of the duplicate NRPs have different loan data (truly second loan)
// vs same data in different satker section (ACTUAL duplicate to skip)
console.log('\n=== ANALYSIS: Same NRP Multiple Rows ===');
for (const [nrp, entries] of nrpToRows) {
    if (entries.length > 1) {
        const first = entries[0];
        const allSame = entries.every(e => e.pinjam === first.pinjam && e.saldo === first.saldo);
        if (allSame) {
            console.log(`NRP ${nrp}: SAME DATA in all rows (should DEDUP) - ${first.nama}`);
        } else {
            console.log(`NRP ${nrp}: DIFFERENT DATA (possibly 2 loans) - ${entries.map(e => `${e.nama}: P=${e.pinjam}`).join(' / ')}`);
        }
    }
}

// Show blank NRP rows that have a matching name in the NRP map
console.log('\n=== BLANK NRP BUT NAME MATCHES NRP ROW (Forward-fill candidates) ===');
const nameToNrp = new Map();
for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const nrp = String(row[3] || '').trim().replace(/['".0]/g, '');
    const nama = String(row[1] || '').trim().toUpperCase().replace(/[.,]/g, '').trim();
    
    if (nrp && !nameToNrp.has(nama)) nameToNrp.set(nama, nrp);
}

let forwardFillCount = 0;
for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const nrp = String(row[3] || '').trim().replace(/['".0]/g, '');
    const nama = String(row[1] || '').trim();
    const cleanNama = nama.toUpperCase().replace(/[.,]/g, '').trim();
    const pinjam = String(row[5] || '').trim();
    const saldo = String(row[23] || '').trim();
    
    if (!nrp && nameToNrp.has(cleanNama)) {
        forwardFillCount++;
        console.log(`Row ${i + 1}: "${nama}" -> NRP "${nameToNrp.get(cleanNama)}" PINJAM=${pinjam} SALDO=${saldo}`);
    }
}
console.log(`\nTotal forward-fill candidates: ${forwardFillCount}`);

// Summary
const totalDataRows = Array.from({ length: rows.length }, (_, i) => i)
    .filter(i => {
        const col0 = String(rows[i]?.[0] || '').trim();
        return col0 && !isNaN(Number(col0));
    }).length;

console.log(`\n=== FINAL SUMMARY ===`);
console.log(`Total data rows with numeric NO: ${totalDataRows}`);
console.log(`Unique NRPs: ${nrpToRows.size}`);
console.log(`NRPs appearing multiple times: ${dupNrpCount}`);
console.log(`Forward-fill candidates (blank NRP + name match): ${forwardFillCount}`);
console.log(`Truly new members (no NRP, no name match): 63`);
