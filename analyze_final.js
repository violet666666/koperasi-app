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

function cleanName(name) {
    if (!name) return '';
    let clean = String(name).replace(/['\"]/g, '').trim().toUpperCase();
    clean = clean.split(',')[0].trim();
    const titles = [' S.I.K.', ' SIK', ' S.H.', ' SH', ' S.PD.', ' S.PD', ' S.T.K.', ' STK', ' S.SOS.', ' S.SOS', ' S.E.', ' SE', ' S.IP.', ' SIP', ' M.H.', ' MH', ' M.SC.', ' MSC', ' M.M.', ' MM', ' S.T.', ' ST', ' S.PT.', ' SPT', ' S.OR.'];
    let changed = true;
    while (changed) {
        changed = false;
        for (const t of titles) {
            if (clean.endsWith(t) || clean.endsWith(t.replace(/\./g, ''))) {
                clean = clean.substring(0, clean.length - t.length).trim();
                changed = true;
            }
        }
    }
    return clean.replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

// Extract all data rows in order
const dataRows = [];
for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim();
    if (!col0 || col0.toUpperCase() === 'JUMLAH' || col0.toUpperCase() === 'NO' || isNaN(Number(col0))) continue;
    
    const nrp = String(row[3] || '').trim().replace(/['\"]/g, '').replace(/\.0$/, '').trim();
    const nama = String(row[1] || '').trim();
    const cleanNama = cleanName(nama);
    const tglPinjam = String(row[4] || '').trim(); // Col E = tanggal pinjaman
    const pinjamLama = cleanNumber(row[5]);
    const selama = cleanNumber(row[6]);
    const angsuran = cleanNumber(row[7]);
    const xAngsuran = cleanNumber(row[8]);
    const bs = cleanNumber(row[9]);
    const jmlDes = cleanNumber(row[10]);
    const sisaDes = cleanNumber(row[11]);
    const pinjamJan = cleanNumber(row[12]);
    const pinjamFeb = cleanNumber(row[15]);
    const pinjamMrt = cleanNumber(row[18]);
    const angsuranKe = cleanNumber(row[21]);
    const jmlTerbayar = cleanNumber(row[22]);
    const sisaMaret = cleanNumber(row[23]);
    
    dataRows.push({
        rowIdx: i,
        no: col0,
        nrp,
        nama,
        cleanNama,
        tglPinjam,
        pinjamLama,
        selama,
        angsuran,
        xAngsuran,
        bs,
        sisaDes,
        pinjamJan,
        pinjamFeb,
        pinjamMrt,
        angsuranKe,
        jmlTerbayar,
        sisaMaret,
        totalPinjam: pinjamLama + pinjamJan + pinjamFeb + pinjamMrt,
    });
}

// DETECT ADJACENT DUPLICATE NAMES (same person, 2nd loan)
// Logic: if row[i] name matches row[i-1] OR row[i+1] name (cleaned),
// AND one has NRP and the other doesn't → it's a 2nd loan
console.log('=== ADJACENT ROW ANALYSIS: 2nd Loans ===');
const adjacentPairs = [];

for (let i = 0; i < dataRows.length; i++) {
    const curr = dataRows[i];
    const prev = i > 0 ? dataRows[i - 1] : null;
    
    if (prev && !curr.nrp && prev.nrp) {
        // Current has no NRP, previous does — check if same person
        if (curr.cleanNama === prev.cleanNama || 
            curr.cleanNama.includes(prev.cleanNama) || 
            prev.cleanNama.includes(curr.cleanNama)) {
            adjacentPairs.push({ first: prev, second: curr, type: 'ADJACENT_NO_NRP' });
        }
    }
}

console.log(`Found ${adjacentPairs.length} adjacent pairs (blank NRP after NRP row with same name):`);
for (const pair of adjacentPairs) {
    console.log(`\n  "${pair.first.nama}" (Row ${pair.first.rowIdx + 1}) NRP=${pair.first.nrp}`);
    console.log(`    Pinjam=${pair.first.pinjamLama} Selama=${pair.first.selama} Angsuran=${pair.first.angsuran} SisaMaret=${pair.first.sisaMaret}`);
    console.log(`  "${pair.second.nama}" (Row ${pair.second.rowIdx + 1}) NRP=<blank> ← 2nd loan`);
    console.log(`    Pinjam=${pair.second.pinjamLama} PinjamJan=${pair.second.pinjamJan} PinjamFeb=${pair.second.pinjamFeb} PinjamMrt=${pair.second.pinjamMrt} SisaMaret=${pair.second.sisaMaret}`);
}

// Also check: blank NRP rows that are NEAR (within 3 rows) a row with same name
console.log('\n\n=== NEAR-ADJACENT ANALYSIS (within 3 rows) ===');
const nrpNameMap = new Map(); // cleanName -> { nrp, rowIdx }
const nearPairs = [];

for (const dr of dataRows) {
    if (dr.nrp) {
        nrpNameMap.set(dr.cleanNama, { nrp: dr.nrp, rowIdx: dr.rowIdx });
    }
}

for (const dr of dataRows) {
    if (!dr.nrp && dr.sisaMaret > 0) {
        const match = nrpNameMap.get(dr.cleanNama);
        if (match && Math.abs(dr.rowIdx - match.rowIdx) <= 5) {
            nearPairs.push({ original: match, second: dr });
        }
    }
}

console.log(`Found ${nearPairs.length} near-adjacent 2nd loan candidates:`);
for (const pair of nearPairs) {
    console.log(`  "${pair.second.nama}" Row ${pair.second.rowIdx + 1} (NRP from Row ${pair.original.rowIdx + 1}: ${pair.original.nrp}) SisaMaret=${pair.second.sisaMaret}`);
}

// FINAL COUNT: How many valid loan records should be imported?
console.log('\n\n=== FINAL IMPORT SUMMARY ===');
let validWithSaldo = 0;
let validNoNrpNew = 0; // truly new members
let validNoNrpNearMatch = 0; // 2nd loans (near-adjacent)
let lunas = 0;
let noPinjam = 0;

for (const dr of dataRows) {
    if (dr.sisaMaret <= 0 && dr.sisaDes <= 0) {
        if (dr.totalPinjam > 0) lunas++;
        else noPinjam++;
        continue;
    }
    
    const effectiveSaldo = dr.sisaMaret > 0 ? dr.sisaMaret : dr.sisaDes;
    if (effectiveSaldo <= 0) { noPinjam++; continue; }
    
    validWithSaldo++;
    
    if (!dr.nrp) {
        const match = nrpNameMap.get(dr.cleanNama);
        if (match) {
            validNoNrpNearMatch++;
        } else {
            validNoNrpNew++;
        }
    }
}

console.log(`Valid loan rows (saldo > 0): ${validWithSaldo}`);
console.log(`  - Has NRP: ${validWithSaldo - validNoNrpNew - validNoNrpNearMatch}`);
console.log(`  - 2nd loan (same name, near row): ${validNoNrpNearMatch}`);
console.log(`  - Truly new members (no NRP anywhere): ${validNoNrpNew}`);
console.log(`Lunas (saldo = 0): ${lunas}`);
console.log(`No loan data: ${noPinjam}`);

// List truly new members with loans
console.log('\n=== NEW MEMBERS TO REGISTER (with active loans) ===');
for (const dr of dataRows) {
    if (dr.nrp) continue;
    const effectiveSaldo = dr.sisaMaret > 0 ? dr.sisaMaret : dr.sisaDes;
    if (effectiveSaldo <= 0) continue;
    const match = nrpNameMap.get(dr.cleanNama);
    if (match) continue;
    
    const email = dr.nama.toLowerCase().replace(/[^a-z0-9]/g, '') + '@koperasi.com';
    console.log(`  ${dr.nama} | Row ${dr.rowIdx + 1} | Pinjam=${dr.totalPinjam} | Saldo=${effectiveSaldo} | Email: ${email}`);
}
