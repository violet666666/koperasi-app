import * as xlsx from 'xlsx';

function analyzeBS(filePath: string) {
    console.log(`\n=== Analyzing BS (Bayar Sendiri) in ${filePath.split('\\').pop()} ===`);
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Output as 2D array
        const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        // Find column indexes based on row 10 and 11
        // Row 10: NO, NAMA, PANGKAT, NRP, TGL PINJAM, PINJAM, SELAMA, PER DESEMBER 2025
        // Row 11: ANGSURAN, X ANGSURAN, BS, JUMLAH, SISA SALDO
        
        let headerRow10 = data[9];
        let headerRow11 = data[10];
        
        console.log("Headers 10:", headerRow10);
        console.log("Headers 11:", headerRow11);
        
        // The arrays are likely jagged or padded.
        // Let's print out the first few valid rows where BS > 0
        let bsFound = 0;
        
        for (let i = 12; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            // Assuming: 
            // row[0] = NO
            // row[1] = NAMA
            // row[4] = TGL PINJAM / PANGKAT ?
            // Let's just print the whole row if we detect a number in the "BS" general area (indexes around 9-11)
            
            // Check all columns for anything > 100000 that might be BS.
            // Wait, looking at previous output, row 11 had:
            // [<7 empty>, 'ANGSURAN', 'X ANGSURAN', 'BS', 'JUMLAH', 'SISA SALDO']
            // which means 'ANGSURAN' is at index 7.
            // So: 
            // 7 = ANGSURAN
            // 8 = X ANGSURAN
            // 9 = BS
            // 10 = JUMLAH
            // 11 = SISA SALDO
            
            const bsValue = Number(row[9]) || 0;
            if (bsValue > 0) {
                console.log(`\nRow ${i + 1}: NAMA=${row[1]}, PINJAM=${row[5]}`);
                console.log(`ANGSURAN=${row[7]}, X ANGSURAN=${row[8]}, BS=${row[9]}, JUMLAH=${row[10]}, SISA SALDO=${row[11]}`);
                bsFound++;
            }
            if (bsFound >= 5) break; 
        }
        
        if (bsFound === 0) {
            console.log("No BS values > 0 found in the first pass. Printing some regular rows.");
            for (let i = 12; i < 15; i++) {
                if (data[i] && data[i].length > 3) console.log(data[i]);
            }
        }
        
    } catch (e: any) {
        console.error(`Error reading ${filePath}:`, e.message);
    }
}

const file = "c:\\Users\\Acer\\Downloads\\koperasi-app\\integrasi-akun-asli\\Contoh_Data_Import\\dokumen_baru\\RINCIAN SP PIUTANG SIMPAN PINJAM PRIMKOPPOL.xlsx";
analyzeBS(file);
