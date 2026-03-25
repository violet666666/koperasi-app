import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

function parseCSV(filePath: string): string[][] {
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    return lines.slice(1).map(line => {
        const values: string[] = [];
        let curVal = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(curVal.trim());
                curVal = '';
            } else {
                curVal += char;
            }
        }
        values.push(curVal.trim());
        return values;
    });
}

function cleanNrp(raw: string): string {
    // Remove leading apostrophe, trailing .0, and whitespace
    return raw.replace(/^'/, '').replace(/\.0$/, '').trim();
}

function cleanNumber(raw: string): number {
    // Parse number, removing trailing .0 if present
    const num = parseFloat(raw);
    return isNaN(num) ? 0 : num;
}

async function main() {
    console.log("🔄 Importing Tunjangan Kinerja (Tunkin) data...\n");

    // CSV columns: NO,NAMA,NRP/NIP,NO_REKENING,TUNKIN_MARET,MASS_DEBET,SISA_TUNKIN
    const csvPath = path.join(process.cwd(), 'integrasi-akun-asli', 'NO,NAMA,NRPNIP,NO_REKENING,TUNKIN_M.csv');

    if (!fs.existsSync(csvPath)) {
        console.error("❌ CSV file not found:", csvPath);
        process.exit(1);
    }

    const rows = parseCSV(csvPath);
    console.log(`📋 Found ${rows.length} rows in CSV\n`);

    let successCount = 0;
    let failCount = 0;
    const failures: { row: number; nrp: string; name: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 5) {
            failures.push({ row: i + 2, nrp: '-', name: '-', reason: 'Kolom tidak lengkap' });
            failCount++;
            continue;
        }

        const name = row[1];
        const nrp = cleanNrp(row[2]);
        const tunkinAmount = cleanNumber(row[4]); // TUNKIN_MARET column

        if (!nrp) {
            failures.push({ row: i + 2, nrp: '', name, reason: 'NRP/NIP kosong' });
            failCount++;
            continue;
        }

        // Try to find member by NRP
        const member = await prisma.member.findFirst({
            where: {
                OR: [
                    { nrp: nrp },
                    { memberNo: nrp },
                ],
            },
        });

        if (!member) {
            failures.push({ row: i + 2, nrp, name, reason: 'Anggota tidak ditemukan' });
            failCount++;
            continue;
        }

        // Update tunkin
        await prisma.member.update({
            where: { id: member.id },
            data: { tunlesKinerja: tunkinAmount },
        });

        successCount++;
        if (successCount % 50 === 0) {
            console.log(`  Processed ${successCount}/${rows.length}...`);
        }
    }

    console.log(`\n✅ Import selesai!`);
    console.log(`   Sukses: ${successCount}`);
    console.log(`   Gagal:  ${failCount}`);

    if (failures.length > 0) {
        console.log(`\n❌ Detail kegagalan (${failures.length} baris):`);
        failures.slice(0, 20).forEach(f => {
            console.log(`   Baris ${f.row}: [${f.nrp}] ${f.name} → ${f.reason}`);
        });
        if (failures.length > 20) {
            console.log(`   ... dan ${failures.length - 20} lainnya`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
