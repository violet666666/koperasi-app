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

// Count how many rows have loans in ONLY the new columns (Jan/Feb/Mar) but NOT in the old PINJAM column
console.log('=== ROWS WITH 2026-ONLY LOANS (no 2025 loan) ===');
let onlyNew = 0;
let bothOldAndNew = 0;
let onlyOld = 0;
let neither = 0;

for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const hasOld = cleanNumber(row[5]) > 0;
    const hasJan = cleanNumber(row[12]) > 0;
    const hasFeb = cleanNumber(row[15]) > 0;
    const hasMrt = cleanNumber(row[18]) > 0;
    const hasNew = hasJan || hasFeb || hasMrt;
    
    if (hasOld && hasNew) bothOldAndNew++;
    else if (hasOld) onlyOld++;
    else if (hasNew) onlyNew++;
    else neither++;
}

console.log(`Only old loan (col 5): ${onlyOld}`);
console.log(`Only new 2026 loan (Jan/Feb/Mar): ${onlyNew}`);
console.log(`Both old + new: ${bothOldAndNew}`);
console.log(`Neither: ${neither} (no loan data at all -> skip these)`);

// Show the actual data structure for a row with 2026 only loan
console.log('\n=== SAMPLE: 2026-only loan rows ===');
let shown = 0;
for (let i = headerIdx + 2; i < rows.length && shown < 5; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const hasOld = cleanNumber(row[5]) > 0;
    const hasJan = cleanNumber(row[12]) > 0;
    const hasFeb = cleanNumber(row[15]) > 0;
    const hasMrt = cleanNumber(row[18]) > 0;
    const hasNew = hasJan || hasFeb || hasMrt;
    
    if (!hasOld && hasNew) {
        const nama = String(row[1] || '').trim();
        const nrp = String(row[3] || '').trim();
        console.log(`Row ${i+1}: ${nama} NRP=${nrp}`);
        console.log(`  PINJAM(old)=${row[5]} SISA_DES=${row[11]}`);
        console.log(`  PINJAM_JAN=${row[12]} X_JAN=${row[13]} PINJAM_FEB=${row[15]} X_FEB=${row[16]} PINJAM_MRT=${row[18]} X_MRT=${row[19]}`);
        console.log(`  ANGSURAN_KE=${row[21]} JML_TERBAYAR=${row[22]} SISA_MARET=${row[23]}`);
        shown++;
    }
}

// Show a sample row with BOTH old and new loans
console.log('\n=== SAMPLE: Both old + new loan rows ===');
shown = 0;
for (let i = headerIdx + 2; i < rows.length && shown < 5; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const hasOld = cleanNumber(row[5]) > 0;
    const hasJan = cleanNumber(row[12]) > 0;
    const hasFeb = cleanNumber(row[15]) > 0;
    const hasMrt = cleanNumber(row[18]) > 0;
    const hasNew = hasJan || hasFeb || hasMrt;
    
    if (hasOld && hasNew) {
        const nama = String(row[1] || '').trim();
        const nrp = String(row[3] || '').trim();
        console.log(`Row ${i+1}: ${nama} NRP=${nrp}`);
        console.log(`  PINJAM(old)=${row[5]} SELAMA=${row[6]} ANGSURAN=${row[7]} X_ANGSURAN=${row[8]} BS=${row[9]} JML_DES=${row[10]} SISA_DES=${row[11]}`);
        console.log(`  PINJAM_JAN=${row[12]} X_JAN=${row[13]} PINJAM_FEB=${row[15]} X_FEB=${row[16]} PINJAM_MRT=${row[18]} X_MRT=${row[19]}`);
        console.log(`  ANGSURAN_KE=${row[21]} JML_TERBAYAR=${row[22]} SISA_MARET=${row[23]}`);
        shown++;
    }
}

// Find how many "truly new" members have an active loan
console.log('\n=== TRULY NEW MEMBERS WITH ACTIVE LOANS ===');
let newWithLoan = 0;
let newWithoutLoan = 0;
for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || isNaN(Number(col0))) continue;
    
    const nrp = String(row[3] || '').trim().replace(/['".0]/g, '');
    if (nrp) continue; // Has NRP, not new
    
    const pinjam = cleanNumber(row[5]);
    const jan = cleanNumber(row[12]);
    const feb = cleanNumber(row[15]);
    const mrt = cleanNumber(row[18]);
    const saldo = cleanNumber(row[23]);
    
    if (pinjam > 0 || jan > 0 || feb > 0 || mrt > 0 || saldo > 0) {
        newWithLoan++;
    } else {
        newWithoutLoan++;
    }
}
console.log(`New members WITH active loan: ${newWithLoan}`);
console.log(`New members WITHOUT active loan: ${newWithoutLoan}`);
