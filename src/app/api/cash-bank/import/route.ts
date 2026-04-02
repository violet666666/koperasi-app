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

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }
        
        let accountId: number | undefined;
        if (mode === "commit") {
             if (!accountIdStr) {
                 return NextResponse.json({ message: "Akun Kas/Bank tujuan wajib dipilih" }, { status: 400 });
             }
             accountId = parseInt(accountIdStr, 10);
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

            // Find header
            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(20, rows.length); i++) {
                const rowStr = rows[i].map(c => String(c).toLowerCase()).join(" ");
                if (rowStr.includes("tanggal") && rowStr.includes("uraian") && rowStr.includes("debet") && rowStr.includes("kredit")) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex === -1) {
                // Skip sheet if no header found
                continue;
            }

            const headers = rows[headerRowIndex].map(h => String(h).toLowerCase().trim());
            const dataRows = rows.slice(headerRowIndex + 1);
            
            const tglIdx = headers.findIndex(h => h.includes("tanggal"));
            const uraianIdx = headers.findIndex(h => h.includes("uraian"));
            const debetIdx = headers.findIndex(h => h.includes("debet"));
            const kreditIdx = headers.findIndex(h => h.includes("kredit"));

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
            const yearMatch = sheetName.match(/\b(20\d{2})\b/);
            if (yearMatch) {
                sheetYear = parseInt(yearMatch[1], 10);
            } else {
                // Try finding it in the first few rows
                for (let r = 0; r < Math.min(50, dataRows.length); r++) {
                    const rowStr = dataRows[r].join(" ");
                    const yM = rowStr.match(/\b(20\d{2})\b/);
                    if (yM) {
                        sheetYear = parseInt(yM[1], 10);
                        break;
                    }
                }
            }

            let currentValDate = new Date(sheetYear, sheetMonth, 1);

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                if (row.length === 0) continue;

                let rawTgl = row[tglIdx];
                let uraian = String(row[uraianIdx] || "").trim();
                let debet = cleanNumber(row[debetIdx]);
                let kredit = cleanNumber(row[kreditIdx]);

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
                const isSaldoAwal = checkString.includes("saldo bulan") || checkString === "saldo" || checkString.includes("saldo awal");

                // Determine type and category using Regex
                let txType = "in";
                let txAmount = debet;
                if (kredit > 0 && debet === 0) {
                    txType = "out";
                    txAmount = kredit;
                }

                if (isSaldoAwal) {
                    // Set to the end of the previous month so it acts as opening balance
                    // e.g. for January (month 0), day 0 gives December 31 of prior year
                    const dt = new Date(sheetYear, sheetMonth, 0);
                    
                    results.push({
                        sheet: sheetName,
                        row: i + headerRowIndex + 2,
                        transactionDate: dt.toISOString(),
                        description: uraian,
                        type: txType,
                        amount: txAmount,
                        category: "lainnya",
                        status: 'valid'
                    });
                    successCount++;
                    continue;
                }

                // Filtering: Skip completely empty DEBET/KREDIT
                if (debet === 0 && kredit === 0) {
                    continue;
                }

                let category = "lainnya";
                
                if (checkString.includes("angsur")) {
                     category = "angsuran_pokok";
                } else if (checkString.includes("simpan") || checkString.includes("tabung")) {
                     if (checkString.includes("pokok")) category = "simpanan_pokok";
                     else if (checkString.includes("wajib")) category = "simpanan_wajib";
                     else category = "simpanan_sukarela";
                     if (txType === "out") category = "lainnya";
                } else if (checkString.includes("pinjam") || checkString.includes("pencairan")) {
                     if (txType === "out") category = "pencairan_pinjaman";
                } else if (checkString.includes("gaji") || checkString.includes("pengurus") || checkString.includes("karyawan")) {
                     if (txType === "out") category = "biaya_operasional";
                }
                
                results.push({
                    sheet: sheetName,
                    row: i + headerRowIndex + 2,
                    transactionDate: new Date(currentValDate).toISOString(),
                    description: uraian,
                    type: txType,
                    amount: txAmount,
                    category: category,
                    status: 'valid'
                });
                successCount++;
            }
        }
        
        if (mode === "commit" && accountId) {
             const session = await auth();
             const userId = session?.user?.id ? parseInt(session.user.id) : 1; // Fallback to 1

             // Start Transaction execution
             try {
                 await prisma.$transaction(async (tx) => {
                     const account = await tx.cashBankAccount.findUnique({
                         where: { id: accountId }
                     });
                     
                     if (!account) throw new Error("Akun gagal ditemukan");
                     
                     let currentBalance = Number(account.currentBalance);
                     const txDataList = [];

                     for (const res of results) {
                         const balanceAfter = res.type === "in" 
                            ? currentBalance + res.amount 
                            : currentBalance - res.amount;

                         txDataList.push({
                             transactionNo: generateTransactionNo(res.type),
                             accountId: accountId,
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
                     
                     if (txDataList.length > 0) {
                         await tx.cashBankTransaction.createMany({
                             data: txDataList
                         });
                     }
                     
                     await tx.cashBankAccount.update({
                         where: { id: accountId },
                         data: { currentBalance }
                     });
                 }, {
                     maxWait: 10000,
                     timeout: 60000 // 60 seconds timeout specifically for large excel files
                 });
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
