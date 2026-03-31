const XLSX = require('xlsx');
const path = require('path');

// Analyze Book2.xlsx (the new file)
const file2 = path.join(__dirname, 'integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/Book2.xlsx');
const wb2 = XLSX.readFile(file2);

console.log('=== Book2.xlsx ===');
console.log('Sheets:', wb2.SheetNames);

for (const sheetName of wb2.SheetNames) {
    const ws = wb2.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    console.log(`\n--- Sheet: "${sheetName}" --- (${rows.length} rows)`);
    
    // Print first 25 rows to understand structure
    for (let i = 0; i < Math.min(25, rows.length); i++) {
        const row = rows[i];
        const cells = row.map((c, j) => `[${j}]${String(c).substring(0, 20)}`).join(' | ');
        console.log(`Row ${i}: ${cells}`);
    }
    
    // Find header rows
    for (let i = 0; i < Math.min(30, rows.length); i++) {
        const rowText = rows[i].map(c => String(c).toUpperCase().trim()).join('|');
        if (rowText.includes('NRP') || rowText.includes('ANGSURAN') || rowText.includes('BS') || rowText.includes('SISA')) {
            console.log(`\n** HEADER/SUBHEADER at row ${i}: ${rowText}`);
        }
    }
    
    // Count data rows (col0 is numeric)
    let dataCount = 0;
    let blankNrpCount = 0;
    let bsNonZeroCount = 0;
    const names = [];
    const nrpNames = new Map(); // NRP -> [names]
    const nameToRows = new Map(); // cleanName -> [rowIdx]
    
    // Find first header
    let headerIdx = -1;
    for (let i = 0; i < 20; i++) {
        const rowText = rows[i].map(c => String(c).toUpperCase().trim()).join('|');
        if (rowText.includes('NRP') && rowText.includes('PINJAM')) {
            headerIdx = i;
            break;
        }
    }
    
    if (headerIdx === -1) continue;
    
    const headers = rows[headerIdx].map(h => String(h).toUpperCase().trim());
    const subHeaders = (rows[headerIdx + 1] || []).map(h => String(h).toUpperCase().trim());
    
    console.log(`\nHeaders (row ${headerIdx}):`, headers);
    console.log(`SubHeaders (row ${headerIdx + 1}):`, subHeaders);
    
    // Find column indices
    const nrpIdx = headers.findIndex(h => h.includes('NRP'));
    const namaIdx = headers.findIndex(h => h.includes('NAMA'));
    const pinjamIdx = headers.findIndex(h => h === 'PINJAM' || h === 'PINJAMAN');
    const selamaIdx = headers.findIndex(h => h === 'SELAMA' || h === 'TENOR');
    
    let angsuranIdx = -1;
    for (let j = 7; j < subHeaders.length; j++) {
        if (subHeaders[j] === 'ANGSURAN') { angsuranIdx = j; break; }
    }
    let bsIdx = -1;
    for (let j = 7; j < subHeaders.length; j++) {
        if (subHeaders[j] === 'BS') { bsIdx = j; break; }
    }
    let saldoIdx = -1;
    for (let j = 0; j < Math.max(headers.length, subHeaders.length); j++) {
        const h = (headers[j] || '').toUpperCase();
        const sh = (subHeaders[j] || '').toUpperCase();
        if (h.includes('SISA') || sh.includes('SISA')) saldoIdx = j;
    }
    
    console.log(`\nColumn indices: NAMA=${namaIdx}, NRP=${nrpIdx}, PINJAM=${pinjamIdx}, SELAMA=${selamaIdx}, ANGSURAN=${angsuranIdx}, BS=${bsIdx}, SISA=${saldoIdx}`);
    
    // Scan all data rows
    for (let i = headerIdx + 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const col0 = String(row[0] || '').trim().toUpperCase();
        if (!col0 || col0 === 'JUMLAH' || col0 === 'NO' || isNaN(Number(col0))) continue;
        
        dataCount++;
        const nama = String(row[namaIdx] || '').trim();
        const nrp = String(row[nrpIdx] || '').trim().replace(/['".0]/g, '');
        const bs = bsIdx >= 0 ? String(row[bsIdx] || '').trim() : '';
        const pinjam = String(row[pinjamIdx] || '').trim();
        const saldo = saldoIdx >= 0 ? String(row[saldoIdx] || '').trim() : '';
        
        if (!nrp) blankNrpCount++;
        if (bs && bs !== '0' && bs !== '') bsNonZeroCount++;
        
        const cleanName = nama.toUpperCase().replace(/[.,]/g, '').trim();
        if (!nameToRows.has(cleanName)) nameToRows.set(cleanName, []);
        nameToRows.get(cleanName).push({ rowIdx: i, nrp, nama, bs, pinjam, saldo });
    }
    
    console.log(`\n=== STATS ===`);
    console.log(`Total data rows: ${dataCount}`);
    console.log(`Rows with blank NRP: ${blankNrpCount}`);
    console.log(`Rows with non-zero BS: ${bsNonZeroCount}`);
    
    // Find duplicates (same name appears multiple times)
    let dupCount = 0;
    console.log(`\n=== DUPLICATE NAMES (multiple loans) ===`);
    for (const [name, entries] of nameToRows) {
        if (entries.length > 1) {
            dupCount++;
            console.log(`  "${name}" appears ${entries.length}x:`);
            for (const e of entries) {
                console.log(`    Row ${e.rowIdx + 1}: NRP="${e.nrp}" PINJAM=${e.pinjam} SALDO=${e.saldo} BS=${e.bs}`);
            }
        }
    }
    console.log(`Total names with duplicates: ${dupCount}`);
    
    // Find rows with blank NRP AND no matching name in NRP map
    const namesWithNrp = new Set();
    for (const [name, entries] of nameToRows) {
        if (entries.some(e => e.nrp)) namesWithNrp.add(name);
    }
    
    console.log(`\n=== BLANK NRP WITH NO MATCH (truly new members) ===`);
    let trulyNewCount = 0;
    for (const [name, entries] of nameToRows) {
        if (!namesWithNrp.has(name)) {
            // All entries for this name have blank NRP
            trulyNewCount++;
            console.log(`  "${entries[0].nama}" (Row ${entries[0].rowIdx + 1}) - PINJAM=${entries[0].pinjam} SALDO=${entries[0].saldo}`);
        }
    }
    console.log(`Total truly new (no NRP at all): ${trulyNewCount}`);
    
    // Show some BS examples
    console.log(`\n=== BS (Bayar Sendiri) EXAMPLES ===`);
    let bsShown = 0;
    for (let i = headerIdx + 2; i < rows.length && bsShown < 10; i++) {
        const row = rows[i];
        if (!row) continue;
        const col0 = String(row[0] || '').trim();
        if (!col0 || isNaN(Number(col0))) continue;
        const bs = bsIdx >= 0 ? String(row[bsIdx] || '').trim() : '';
        if (bs && bs !== '0' && bs !== '') {
            const nama = String(row[namaIdx] || '').trim();
            const pinjam = String(row[pinjamIdx] || '').trim();
            const saldo = saldoIdx >= 0 ? String(row[saldoIdx] || '').trim() : '';
            const angsuran = angsuranIdx >= 0 ? String(row[angsuranIdx] || '').trim() : '';
            console.log(`  Row ${i+1}: ${nama} - PINJAM=${pinjam}, ANGSURAN=${angsuran}, BS=${bs}, SALDO=${saldo}`);
            bsShown++;
        }
    }
}
