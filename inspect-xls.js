const XLSX = require('xlsx');

const file1 = 'c:\\Users\\Acer\\Downloads\\koperasi-app\\integrasi-akun-asli\\Contoh_Data_Import\\4. GAJI APRIL 2026 POLRES.xls';
const file2 = 'c:\\Users\\Acer\\Downloads\\koperasi-app\\integrasi-akun-asli\\Contoh_Data_Import\\D. GAJI APRIL 2026 POLSEK.xls';

function inspectFile(filePath) {
    console.log('--- Inspecting File:', filePath);
    try {
        const workbook = XLSX.readFile(filePath);
        console.log('Sheet Names:', workbook.SheetNames);
        
        // Check for fuzzy 'POT GAJI'
        const potGajiName = workbook.SheetNames.find(s => s.trim().toUpperCase().includes('POT GAJI'));
        console.log('Found POT GAJI sheet as:', potGajiName);
        
        let targetName = potGajiName || workbook.SheetNames[0];
        console.log('Target Sheet Name:', targetName);

        const worksheet = workbook.Sheets[targetName];
        let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });

        // filter empty
        rows = rows.filter(row => row.some(cell => cell && String(cell).trim() !== ""));

        // top 5 rows
        console.log('Top 15 rows:');
        rows.slice(0, 15).forEach(r => console.log(JSON.stringify(r)));

    } catch (err) {
        console.error('Error reading file:', err);
    }
}

inspectFile(file1);
console.log('\n\n');
inspectFile(file2);
