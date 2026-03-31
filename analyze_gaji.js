const XLSX = require('xlsx');
const path = require('path');

const files = [
    'integrasi-akun-asli/Contoh_Data_Import/4. GAJI APRIL 2026 POLRES.xls',
    'integrasi-akun-asli/Contoh_Data_Import/D. GAJI APRIL 2026 POLSEK.xls'
];

for (const f of files) {
    console.log(`\n=== ${path.basename(f)} ===`);
    const filePath = path.join(__dirname, f);
    try {
        const wb = XLSX.readFile(filePath);
        const ws = wb.Sheets[wb.SheetNames[0]]; 
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        
        let headerRowIdx = -1;
        for(let i = 0; i < Math.min(10, rows.length); i++) {
            const hasNama = rows[i].some(c => String(c).toUpperCase().trim() === 'NAMA');
            if(hasNama) {
                headerRowIdx = i;
                break;
            }
        }
        
        if (headerRowIdx >= 0) {
            console.log(`Headers found at row ${headerRowIdx+1}`);
            const headers = rows[headerRowIdx];
            // Just print index and header value
            headers.forEach((h, idx) => {
                const text = String(h).trim();
                if (text) {
                    console.log(`Col ${idx} (${String.fromCharCode(65+idx)}): "${text}"`);
                }
            });
        }
    } catch(err) {
        console.error("Error:", err.message);
    }
}
