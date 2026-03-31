const XLSX = require('xlsx');
const path = require('path');

const file2 = path.join(__dirname, 'integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/Book2.xlsx');
const wb2 = XLSX.readFile(file2);
const ws = wb2.Sheets['Sheet1 (2)'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

// Replicate current import logic to understand the 332 issue
const headerIdx = 9;
const headers = rows[headerIdx].map(h => String(h).toUpperCase().trim());
const subHeaders = (rows[headerIdx + 1] || []).map(h => String(h).toUpperCase().trim());

// Breakdown: why are 697 rows becoming 332?
let totalDataRows = 0;
let skippedNoCol0 = 0;
let skippedJumlahOrNo = 0;
let skippedNonNumeric = 0;
let skippedNoNrpNoNama = 0;
let skippedNoPinjamNoSaldo = 0;
let skippedNoSaldo = 0;  // sisa saldo = 0 → lunas
let skippedNoPinjam = 0;
let validRows = 0;
let negSaldoCount = 0;
let dashSaldoCount = 0;

for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) { skippedNoCol0++; continue; }
    
    const col0 = String(row[0] || '').trim().toUpperCase();
    
    if (!col0) { skippedNoCol0++; continue; }
    if (col0 === 'JUMLAH' || col0 === 'NO') { skippedJumlahOrNo++; continue; }
    if (isNaN(Number(col0))) { skippedNonNumeric++; continue; }
    
    totalDataRows++;
    
    const nama = String(row[1] || '').trim();
    const nrp = String(row[3] || '').trim();
    
    if (!nrp && !nama) { skippedNoNrpNoNama++; continue; }
    
    // Parse amounts
    function cleanNumber(raw) {
        if (raw === undefined || raw === null || raw === '' || raw === '-') return 0;
        const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }
    
    const pinjam = cleanNumber(row[5]);
    const saldoRaw = String(row[23] || '').trim();
    const sisaSaldo = cleanNumber(row[23]);
    
    if (pinjam <= 0 && sisaSaldo <= 0) { 
        skippedNoPinjamNoSaldo++; 
        if (saldoRaw === '-' || saldoRaw === '') dashSaldoCount++;
        continue; 
    }
    
    if (pinjam <= 0) { skippedNoPinjam++; continue; }
    
    if (sisaSaldo <= 0) { 
        skippedNoSaldo++;
        if (sisaSaldo < 0) negSaldoCount++;
        continue; 
    }
    
    validRows++;
}

console.log('=== ROW BREAKDOWN ===');
console.log(`Total raw rows: ${rows.length}`);
console.log(`Skipped empty/no col0: ${skippedNoCol0}`);
console.log(`Skipped JUMLAH/NO: ${skippedJumlahOrNo}`);
console.log(`Skipped non-numeric (satker labels): ${skippedNonNumeric}`);
console.log(`Data rows (numeric col0): ${totalDataRows}`);
console.log('---');
console.log(`Skipped no NRP + no Nama: ${skippedNoNrpNoNama}`);
console.log(`Skipped no PINJAM + no SALDO: ${skippedNoPinjamNoSaldo} (of which dash/empty saldo: ${dashSaldoCount})`);
console.log(`Skipped PINJAM=0 but has SALDO: ${skippedNoPinjam}`);
console.log(`Skipped SALDO=0/lunas: ${skippedNoSaldo} (of which negative: ${negSaldoCount})`);
console.log('---');
console.log(`VALID rows (would import): ${validRows}`);

// Also check: how many have PINJAM in columns 12 (JAN), 15 (FEB), 18 (MRT)?
// These are NEW loans taken in 2026
console.log('\n=== ROWS WITH NEW LOANS IN 2026 ===');
let jan = 0, feb = 0, mrt = 0;
for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const pinjamJan = cleanNumber(row[12]);
    const pinjamFeb = cleanNumber(row[15]);
    const pinjamMrt = cleanNumber(row[18]);
    
    if (pinjamJan > 0) jan++;
    if (pinjamFeb > 0) feb++;
    if (pinjamMrt > 0) mrt++;
}
console.log(`Rows with PINJAM JAN: ${jan}`);
console.log(`Rows with PINJAM FEB: ${feb}`);
console.log(`Rows with PINJAM MRT: ${mrt}`);

// The SISA SALDO column is at index 23 (SISA SALDO PER MARET 26)
// But there's also index 11 (SISA SALDO PER DES'26)
// Let's check which one has more data
console.log('\n=== SALDO COLUMN COMPARISON ===');
let saldo11count = 0, saldo23count = 0;
for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const s11 = cleanNumber(row[11]);
    const s23 = cleanNumber(row[23]);
    if (s11 > 0) saldo11count++;
    if (s23 > 0) saldo23count++;
}
console.log(`Rows with SISA SALDO DES'25 (col 11) > 0: ${saldo11count}`);
console.log(`Rows with SISA SALDO MARET'26 (col 23) > 0: ${saldo23count}`);

function cleanNumber(raw) {
    if (raw === undefined || raw === null || raw === '' || raw === '-') return 0;
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}
