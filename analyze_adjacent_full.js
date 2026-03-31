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
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
}

// Extract all data rows in sequence (preserving order)
const dataRows = [];
for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0) continue;
    const upper = col0.toUpperCase();
    if (upper === 'JUMLAH' || upper === 'NO') continue;
    if (isNaN(Number(col0))) continue;
    
    const nrp = String(row[3] || '').trim().replace(/['"]/g, '').replace(/\.0$/, '').trim();
    const nama = String(row[1] || '').trim();
    const pinjam = cleanNumber(row[5]);
    const pinjamJan = cleanNumber(row[12]);
    const pinjamFeb = cleanNumber(row[15]);
    const pinjamMrt = cleanNumber(row[18]);
    const sisaMaret = cleanNumber(row[23]);
    const sisaDes = cleanNumber(row[11]);
    const bs = cleanNumber(row[9]);
    const angsuran = cleanNumber(row[7]);
    const selama = cleanNumber(row[6]);
    const tglPinjam = String(row[4] || '').trim();
    const angsuranKe = cleanNumber(row[21]);
    const jmlTerbayar = cleanNumber(row[22]);
    
    dataRows.push({
        excelRow: i + 1, // 1-indexed for human reading
        no: col0,
        nrp,
        nama,
        tglPinjam,
        pinjam,
        selama,
        angsuran,
        bs,
        sisaDes,
        pinjamJan,
        pinjamFeb,
        pinjamMrt,
        angsuranKe,
        jmlTerbayar,
        sisaMaret,
        totalPinjam: pinjam + pinjamJan + pinjamFeb + pinjamMrt,
        effectiveSaldo: sisaMaret > 0 ? sisaMaret : sisaDes,
    });
}

// ================================================================
// DETECT ADJACENT PAIRS: row[i] and row[i+1] form a pair if:
//   - exactly ONE of them has an NRP and the other doesn't
//   - their sequential "NO" values are consecutive (e.g., row 3, row 3b same section)
//     OR their names are similar
// ================================================================

console.log('=== ALL ADJACENT PAIRS (one has NRP, next doesn\'t, or vice versa) ===\n');

const adjacentPairs = [];

for (let i = 0; i < dataRows.length - 1; i++) {
    const curr = dataRows[i];
    const next = dataRows[i + 1];
    
    // Check if one has NRP and the other doesn't
    const currHasNrp = !!curr.nrp;
    const nextHasNrp = !!next.nrp;
    
    if (currHasNrp === nextHasNrp) continue; // both have or both don't
    
    // Check if they're truly adjacent in the Excel (no gap rows between them)
    if (next.excelRow - curr.excelRow > 2) continue; // too far apart
    
    // Determine which is the "original" (has NRP) and which is the "second"
    const original = currHasNrp ? curr : next;
    const second = currHasNrp ? next : curr;
    
    adjacentPairs.push({ original, second, idx: i });
}

console.log(`Found ${adjacentPairs.length} adjacent pairs where one row has NRP, next doesn't:\n`);

let pairWithSaldo = 0;
let pairBothSaldo = 0;
let pairOnlySaldo = 0;

for (const pair of adjacentPairs) {
    const o = pair.original;
    const s = pair.second;
    
    const oHasSaldo = o.effectiveSaldo > 0;
    const sHasSaldo = s.effectiveSaldo > 0;
    
    let status;
    if (oHasSaldo && sHasSaldo) { status = '✅ BOTH ACTIVE'; pairBothSaldo++; }
    else if (oHasSaldo) { status = '🟡 ONLY ORIGINAL ACTIVE'; pairOnlySaldo++; }
    else if (sHasSaldo) { status = '🟡 ONLY 2ND ACTIVE'; pairOnlySaldo++; }
    else { status = '⚫ BOTH LUNAS'; }
    if (oHasSaldo || sHasSaldo) pairWithSaldo++;
    
    console.log(`${status}`);
    console.log(`  Row ${o.excelRow}: "${o.nama}" NRP=${o.nrp}`);
    console.log(`    Pinjam=${o.pinjam} PinjamJan=${o.pinjamJan} PinjamFeb=${o.pinjamFeb} PinjamMrt=${o.pinjamMrt} BS=${o.bs} SisaMaret=${o.sisaMaret}`);
    console.log(`  Row ${s.excelRow}: "${s.nama}" NRP=<blank> ← 2nd loan`);
    console.log(`    Pinjam=${s.pinjam} PinjamJan=${s.pinjamJan} PinjamFeb=${s.pinjamFeb} PinjamMrt=${s.pinjamMrt} BS=${s.bs} SisaMaret=${s.sisaMaret}`);
    console.log('');
}

console.log(`\n=== PAIR SUMMARY ===`);
console.log(`Total adjacent pairs: ${adjacentPairs.length}`);
console.log(`Pairs with at least 1 active saldo: ${pairWithSaldo}`);
console.log(`Pairs where BOTH have active saldo (2 loans to import): ${pairBothSaldo}`);
console.log(`Pairs where only 1 is active: ${pairOnlySaldo}`);

// Now recalculate GRAND TOTAL
console.log('\n\n=== RECALCULATED GRAND TOTAL ===');

// Build set of "second loan" row indices (rows that are the blank-NRP half of an adjacent pair)
const secondLoanRows = new Set(adjacentPairs.map(p => p.second.excelRow));

let withNrpActive = 0;
let secondLoanActive = 0;
let newMemberActive = 0;
let skipRows = 0;

// Build name→NRP map from adjacent pairs
const pairNrpMap = new Map();
for (const pair of adjacentPairs) {
    pairNrpMap.set(pair.second.excelRow, pair.original.nrp);
}

for (const dr of dataRows) {
    if (dr.effectiveSaldo <= 0) {
        skipRows++;
        continue;
    }
    
    if (dr.nrp) {
        withNrpActive++;
    } else if (pairNrpMap.has(dr.excelRow)) {
        secondLoanActive++;
    } else {
        newMemberActive++;
    }
}

console.log(`Active loans with NRP: ${withNrpActive}`);
console.log(`Active 2nd loans (adjacent pair, NRP inherited): ${secondLoanActive}`);
console.log(`Active loans for NEW members (no NRP anywhere): ${newMemberActive}`);
console.log(`TOTAL RECORDS TO IMPORT: ${withNrpActive + secondLoanActive + newMemberActive}`);
console.log(`Skipped (saldo ≤ 0): ${skipRows}`);

// List new members
console.log(`\n=== NEW MEMBERS (no NRP, not adjacent pair) ===`);
for (const dr of dataRows) {
    if (dr.nrp || dr.effectiveSaldo <= 0 || pairNrpMap.has(dr.excelRow)) continue;
    const email = dr.nama.toLowerCase().replace(/[^a-z0-9]/g, '') + '@koperasi.com';
    console.log(`  ${dr.nama} | Row ${dr.excelRow} | TotalPinjam=${dr.totalPinjam} | Sisa=${dr.effectiveSaldo} | Email: ${email}`);
}
