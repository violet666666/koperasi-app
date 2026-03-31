import * as xlsx from 'xlsx';

function analyzeExcel(filePath: string) {
    console.log(`\n\n=== Analyzing file: ${filePath.split('\\').pop()} ===`);
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Output as 2D array
        const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        console.log(`Total Rows: ${data.length}`);
        
        for (let i = 9; i < 15; i++) {
            if (data[i]) {
                console.log(`Row ${i + 1}:`, data[i]);
            }
        }
    } catch (e: any) {
        console.error(`Error reading ${filePath}:`, e.message);
    }
}

const file1 = "c:\\Users\\Acer\\Downloads\\koperasi-app\\integrasi-akun-asli\\Contoh_Data_Import\\dokumen_baru\\RINCIAN PIUTANG SIMPAN PINJAM PRIMKOPPOL.xlsx";
const file2 = "c:\\Users\\Acer\\Downloads\\koperasi-app\\integrasi-akun-asli\\Contoh_Data_Import\\dokumen_baru\\RINCIAN SP PIUTANG SIMPAN PINJAM PRIMKOPPOL.xlsx";

analyzeExcel(file1);
analyzeExcel(file2);
