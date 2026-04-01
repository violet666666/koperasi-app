const xlsx = require('xlsx');

function analyzeFile(filePath) {
    console.log(`Analyzing: ${filePath}`);
    const workbook = xlsx.readFile(filePath);
    
    workbook.SheetNames.forEach(sheetName => {
        console.log(`\n=== Sheet: ${sheetName} ===`);
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
        
        console.log(`Total Rows: ${rows.length}`);
        
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            const stringCount = row.filter(cell => typeof cell === 'string').length;
            if (stringCount > 3) {
                headerRowIdx = i;
                break;
            }
        }
        
        if (headerRowIdx !== -1) {
            console.log(`Probable Headers (Row ${headerRowIdx + 1}):`);
            console.log(rows[headerRowIdx]);
            
            console.log('\nSample Data (First 10 rows after header):');
            for (let i = headerRowIdx + 1; i < Math.min(headerRowIdx + 11, rows.length); i++) {
                if (rows[i].some(v => v !== null && v !== '')) {
                   console.log(rows[i]);
                }
            }
        } else {
            console.log("First 5 rows:");
            rows.slice(0, 5).forEach(r => console.log(r));
        }
    });
}

analyzeFile('integrasi-akun-asli/Contoh_Data_Import/dokumen_baru/BUKU KAS JANUARI - MARET (1).xlsx');
