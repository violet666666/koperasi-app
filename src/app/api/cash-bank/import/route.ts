import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";

// Helper to generate transaction number
function generateTransactionNo(type: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const prefix = type === "in" ? "CBM" : "CBK"; // Masuk / Keluar
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `${prefix}-${year}-${random}`;
}

function cleanNumber(raw: string | number | undefined | null): number {
    if (raw === undefined || raw === null || raw === "") return 0;
    if (typeof raw === 'number') return raw;
    const isNegative = String(raw).includes('(') && String(raw).includes(')');
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    let num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    if (isNegative) num = -Math.abs(num);
    return num;
}

// POST /api/cash-bank/import
export async function POST(request: Request) {
    try {
        const formData: any = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview"; // preview, commit
        const accountIdStr = formData.get("accountId") as string;

        const format = (formData.get("format") as string) || "standard";
        const koppolColumn = (formData.get("koppolColumn") as string) || "tunai";
        const tunaiAccountIdStr = formData.get("tunaiAccountId") as string;
        const briAccountIdStr = formData.get("briAccountId") as string;
        const jatimAccountIdStr = formData.get("jatimAccountId") as string;

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }
        
        let accountId: number | undefined;
        if (mode === "commit") {
             if (!accountIdStr && format !== "koppol_consolidated_auto") {
                 return NextResponse.json({ message: "Akun Kas/Bank tujuan wajib dipilih" }, { status: 400 });
             }
             if (accountIdStr) accountId = parseInt(accountIdStr, 10);
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        const results: any[] = [];
        let successCount = 0;
        let failCount = 0;
        
        // Loop through all sheets
        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as any[][];
            
            // Filter non-empty rows
            rows = rows.filter(row => row.some(cell => cell && String(cell).trim() !== ""));
            if (rows.length === 0) continue;

            let headerRowIndex = -1;
            let headers: string[] = [];
            let dataRows: any[][] = [];
            let tglIdx = -1, uraianIdx = -1, debetIdx = -1, kreditIdx = -1;

            if (format === "koppol_consolidated" || format === "koppol_consolidated_auto") {
                // For KOPPOL format, data starts around row 13 (index 12 or so).
                // Let's just find the row that has NO and TANGGAL.
                for (let i = 0; i < Math.min(20, rows.length); i++) {
                    const rowStr = rows[i].map(c => String(c).toLowerCase()).join(" ");
                    if (rowStr.includes("nomor buku") && rowStr.includes("atas nama")) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                if (headerRowIndex === -1) continue;
                dataRows = rows.slice(headerRowIndex + 1);

                // Hardcoded index based on KOPPOL Consolidated structure
                tglIdx = 2; // TANGGAL
                uraianIdx = 4; // ATAS NAMA
                if (koppolColumn === "tunai") {
                    debetIdx = 7; kreditIdx = 8;
                } else if (koppolColumn === "bri") {
                    debetIdx = 9; kreditIdx = 10;
                } else if (koppolColumn === "jatim") {
                    debetIdx = 11; kreditIdx = 12;
                }
            } else {
                // Standard mode
                for (let i = 0; i < Math.min(20, rows.length); i++) {
                    const rowStr = rows[i].map(c => String(c).toLowerCase()).join(" ");
                    if (rowStr.includes("tanggal") && rowStr.includes("uraian") && rowStr.includes("debet") && rowStr.includes("kredit")) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) continue;
                
                headers = rows[headerRowIndex].map(h => String(h).toLowerCase().trim());
                dataRows = rows.slice(headerRowIndex + 1);
                
                tglIdx = headers.findIndex(h => h.includes("tanggal"));
                uraianIdx = headers.findIndex(h => h.includes("uraian"));
                debetIdx = headers.findIndex(h => h.includes("debet"));
                kreditIdx = headers.findIndex(h => h.includes("kredit"));
            }

            // Determine Year and Month from Sheet Name or data
            let sheetMonth = new Date().getMonth();
            const monthNames = ["JAN", "FEB", "PEB", "MAR", "MRT", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOP", "NOV", "DES"];
            const monthIndexes = [0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11];
            
            for (let m = 0; m < monthNames.length; m++) {
                 if (sheetName.toUpperCase().includes(monthNames[m])) {
                     sheetMonth = monthIndexes[m];
                     break;
                 }
            }
            
            let sheetYear = new Date().getFullYear();
            const currentYear = new Date().getFullYear();
            const yearMatch = sheetName.match(/\b(20\d{2})\b/);
            if (yearMatch && Math.abs(parseInt(yearMatch[1], 10) - currentYear) <= 2) {
                sheetYear = parseInt(yearMatch[1], 10);
            } else {
                // Try extracting year from file name
                const fileYearMatch = file.name.match(/\b(20\d{2})\b/);
                if (fileYearMatch && Math.abs(parseInt(fileYearMatch[1], 10) - currentYear) <= 2) {
                    sheetYear = parseInt(fileYearMatch[1], 10);
                } else {
                    // Try finding a recent year in the first few rows of data
                    let foundYear = false;
                    for (let r = 0; r < Math.min(50, dataRows.length); r++) {
                        const rowStr = dataRows[r].join(" ");
                        // Match all year candidates and pick only recent ones
                        const allYears = rowStr.match(/\b(20\d{2})\b/g);
                        if (allYears) {
                            for (const ym of allYears) {
                                const candidate = parseInt(ym, 10);
                                if (Math.abs(candidate - currentYear) <= 2) {
                                    sheetYear = candidate;
                                    foundYear = true;
                                    break;
                                }
                            }
                            if (foundYear) break;
                        }
                    }
                    // If still not found, default to current year
                }
            }

            let currentValDate = new Date(sheetYear, sheetMonth, 1);

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                if (!row || row.length === 0) continue;

                let rawTgl = row[tglIdx];
                let uraian = String(row[uraianIdx] || "").trim();
                let firstCol = String(row[0] || "").toLowerCase();
                let secondCol = String(row[1] || "").toLowerCase();
                let fifthCol = String(row[4] || "").toLowerCase();

                // Stop safely if we hit the bottom summary rows
                if (
                    secondCol.includes("jumlah bulan ini") || 
                    secondCol.includes("jumlah s.d bulan") ||
                    firstCol.includes("jumlah bulan ini") ||
                    firstCol.includes("jumlah s.d bulan") ||
                    secondCol === "sisa" ||
                    secondCol === "sisa akhir"
                ) {
                    break;
                }

                // Update floating date
                if (rawTgl && String(rawTgl).trim() !== "") {
                     const dateStr = String(rawTgl).trim();
                     if (!isNaN(Number(dateStr)) && Number(dateStr) >= 1 && Number(dateStr) <= 31) {
                         // Day of the month
                         currentValDate = new Date(sheetYear, sheetMonth, Number(dateStr));
                     } else {
                         // Try to parse full date
                         const d = new Date(dateStr);
                         if (!isNaN(d.getTime())) {
                             currentValDate = d;
                         }
                     }
                }

                const checkString = uraian.toLowerCase();
                const isSaldoAwal = checkString.includes("saldo bulan") || 
                                    checkString === "saldo" || 
                                    checkString.includes("saldo awal") || 
                                    checkString.includes("sisa awal") ||
                                    checkString.includes("sisa setelah serah terima");

                const determineCategory = (txType: string) => {
                    let category = "lainnya";
                    
                    // 1. ANGSURAN (IN)
                    if (checkString.includes("angsur") || checkString.includes("cicil") || checkString.includes("pelunas") || checkString.includes("pembayaran sp")) {
                        if (txType === "in") category = "angsuran_pokok";
                    } 
                    // 2. SIMPANAN (IN) - Termasuk Tabungan Sejahtera
                    else if (checkString.includes("simpan") || checkString.includes("tabung")) {
                        if (checkString.includes("pokok")) {
                            category = "simpanan_pokok";
                        } else if (checkString.includes("wajib")) {
                            category = "simpanan_wajib";
                        } else {
                            // Jatuh ke Sini: "Tabungan Sejahtera" -> Simpanan Sukarela
                            category = "simpanan_sukarela";
                        }
                        if (txType === "out") category = "lainnya"; // Safety fallback
                    } 
                    // 3. PINJAMAN / PENCAIRAN
                    else if (checkString.includes("pinjam") || checkString.includes("pencairan")) {
                        // Jika Uang Keluar (OUT) -> Pencairan Pinjaman
                        if (txType === "out") {
                            category = "pencairan_pinjaman";
                        } 
                        // Jika Uang Masuk (IN) tapi memuat kata Pinjaman -> Ditebak sbg Cicilan/Angsuran
                        else if (txType === "in") {
                            category = "angsuran_pokok";
                        }
                    } 
                    // 4. BIAYA / OPERASIONAL (OUT)
                    else if (
                        checkString.includes("gaji") || checkString.includes("pengurus") || checkString.includes("karyawan") || 
                        checkString.includes("honor") || checkString.includes("listrik") || checkString.includes("pdam") ||
                        checkString.includes("belanja") || checkString.includes("pembayaran barang") || checkString.includes("kebutuhan kantor") ||
                        checkString.includes("operasional") || checkString.includes("atk")
                    ) {
                        if (txType === "out") category = "biaya_operasional";
                    }

                    return category;
                };

                const timeOffset = i * 1000;
                const txDate = isSaldoAwal 
                    ? new Date(new Date(sheetYear, sheetMonth, 0).getTime() + timeOffset) 
                    : new Date(currentValDate.getTime() + timeOffset);

                const baseInfo = {
                    sheet: sheetName,
                    row: i + headerRowIndex + 2,
                    transactionDate: txDate.toISOString(),
                    description: uraian,
                    status: 'valid'
                };

                // MULTI-ACCOUNT KOPPOL AUTO MODE
                if (format === "koppol_consolidated_auto") {
                    const columns = [
                        { dIdx: 7, kIdx: 8, accId: Number(tunaiAccountIdStr), name: "KAS TUNAI" },
                        { dIdx: 9, kIdx: 10, accId: Number(briAccountIdStr), name: "BANK BRI" },
                        { dIdx: 11, kIdx: 12, accId: Number(jatimAccountIdStr), name: "BANK JATIM" }
                    ];

                    for (const col of columns) {
                        let debet = cleanNumber(row[col.dIdx]);
                        let kredit = cleanNumber(row[col.kIdx]);
                        
                        // Ignore extremely small numbers below 10 (artifact garbage)
                        if (debet < 10) debet = 0;
                        if (kredit < 10) kredit = 0;
                        
                        if (debet === 0 && kredit === 0 && !isSaldoAwal) continue;
                        // For saldo_awal, skip if amount is 0 too, unless we want a 0 starting balance? 
                        if (isSaldoAwal && debet === 0 && kredit === 0) continue;
                        
                        let txType = "in"; let txAmount = debet;
                        if (kredit > 0 && debet === 0) { txType = "out"; txAmount = kredit; }
                        
                        results.push({
                            ...baseInfo,
                            type: txType,
                            amount: txAmount,
                            category: isSaldoAwal ? "lainnya" : determineCategory(txType),
                            targetAccountId: col.accId,
                            targetAccountName: col.name
                        });
                        successCount++;
                    }
                    continue;
                }

                // SINGLE ACCOUNT MODE
                let debet = cleanNumber(row[debetIdx]);
                let kredit = cleanNumber(row[kreditIdx]);
                
                // Ignore extremely small numbers below 10
                if (debet < 10) debet = 0;
                if (kredit < 10) kredit = 0;
                
                if (debet === 0 && kredit === 0 && !isSaldoAwal) continue;
                if (isSaldoAwal && debet === 0 && kredit === 0) continue;

                let txType = "in"; let txAmount = debet;
                if (kredit > 0 && debet === 0) { txType = "out"; txAmount = kredit; }

                results.push({
                    ...baseInfo,
                    type: txType,
                    amount: txAmount,
                    category: isSaldoAwal ? "lainnya" : determineCategory(txType)
                });
                successCount++;
            }
        }
        
        if (mode === "commit") {
             const session = await auth();
             const userId = session?.user?.id ? parseInt(session.user.id) : 1; 

             const groupedResults: Record<string, any[]> = {};

             for (const res of results) {
                 const tId = res.targetAccountId || accountId;
                 if (!tId || isNaN(tId)) throw new Error("Terdeteksi baris tanpa ID Akun tujuan. Pastikan semua akun terpilih pada mode Konsolidasi Penuh.");
                 const tIdStr = tId.toString();
                 if (!groupedResults[tIdStr]) groupedResults[tIdStr] = [];
                 groupedResults[tIdStr].push(res);
             }

             try {
                 await prisma.$transaction(async (tx) => {
                     for (const accIdStr of Object.keys(groupedResults)) {
                         const accId = Number(accIdStr);
                         const account = await tx.cashBankAccount.findUnique({ where: { id: accId } });
                         if (!account) throw new Error(`Akun Kas/Bank ID ${accId} gagal ditemukan`);
                         
                         let currentBalance = Number(account.currentBalance);
                         const txDataList = [];

                         for (const res of groupedResults[accIdStr]) {
                             const balanceAfter = res.type === "in" ? currentBalance + res.amount : currentBalance - res.amount;
                             txDataList.push({
                                 transactionNo: generateTransactionNo(res.type),
                                 accountId: accId,
                                 branchId: account.branchId,
                                 type: res.type,
                                 category: res.category,
                                 amount: res.amount,
                                 description: `[IMPORT EXCEL - ${res.sheet}] ${res.description}`,
                                 balanceBefore: currentBalance,
                                 balanceAfter: balanceAfter,
                                 transactionDate: new Date(res.transactionDate),
                                 createdById: userId
                             });
                             currentBalance = balanceAfter;
                         }
                         
                         if (txDataList.length > 0) await tx.cashBankTransaction.createMany({ data: txDataList });
                         await tx.cashBankAccount.update({ where: { id: accId }, data: { currentBalance } });
                     }
                 }, { maxWait: 10000, timeout: 60000 });
             } catch (err: any) {
                 return NextResponse.json({ message: err.message || "Gagal import transaksi" }, { status: 400 });
             }
             
             return NextResponse.json({
                 data: {
                     mode: "commit",
                     success: successCount,
                     failed: failCount,
                     totalRows: results.length
                 }
             });
        }

        // Return preview data
        return NextResponse.json({
             data: {
                  mode: "preview",
                  success: successCount,
                  failed: failCount,
                  totalRows: results.length,
                  preview: results.slice(0, 100) // max 100 for preview
             }
        });

    } catch (error) {
        console.error("POST /api/cash-bank/import error:", error);
        return NextResponse.json(
            { message: "Gagal memproses import data Excel." },
            { status: 500 }
        );
    }
}
