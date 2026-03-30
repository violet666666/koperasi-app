import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

export async function POST(request: Request) {
    try {
        const formData: any = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview"; // preview, commit
        const year = parseInt(formData.get("year") as string) || new Date().getFullYear();

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        let sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];

        if (rows.length < 3) {
            return NextResponse.json({ message: "File kosong atau format tidak valid" }, { status: 400 });
        }

        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true }
        });

        // ====================================================================
        // ACTUAL FILE FORMAT (TAB.SEJAHTERA 2025):
        // Row 0: "TABUNGAN SEJAHTERA PER 31 DESEMBER 2025"
        // Row 1: (empty)
        // Row 2: NO | NAMA | (empty) | SALDO | JANUARI | (empty) | SALDO  | PEBRUARI | ...
        // Row 3: REG |      |        | AWAL  | KK      | KM     | AKHIR  | KK       | KM | AKHIR | ...
        // Row 4: (empty)
        // Row 5: 0001 | NGATEMAN | | 634,700 | | | 634,700 | | | 634,700 | ...
        //
        // Column mapping:
        //   col 0: NO REG (NOT NRP! e.g. "0001", "0008")
        //   col 1: NAMA
        //   col 2: Alias/keterangan (sometimes blank, sometimes "FAISOL", "TAB KANTOR")
        //   col 3: SALDO AWAL
        //   col 4: JAN KK
        //   col 5: JAN KM
        //   col 6: SALDO AKHIR JAN
        //   col 7: FEB KK
        //   col 8: FEB KM
        //   col 9: SALDO AKHIR FEB
        //   ... pattern repeats every 3 cols per month
        //
        // File may only have 4 months (18 cols) or up to 12 months
        // ====================================================================

        // Find the data start row: look for a row where col[0] looks like a reg number
        let startIndex = -1;
        for (let i = 0; i < Math.min(15, rows.length); i++) {
            const col0 = String(rows[i][0]).trim();
            // NO REG values are like "0001", "0008" — padded numbers
            if (col0 && /^\d{2,}$/.test(col0) && !isNaN(Number(col0))) {
                startIndex = i;
                break;
            }
        }

        if (startIndex === -1) {
            return NextResponse.json({ message: "Gagal menemukan baris data. Pastikan format file Tab Sejahtera benar (NO REG di kolom pertama)." }, { status: 400 });
        }

        // Detect how many months are in the file based on column count
        // Formula: 4 base cols (NO_REG, NAMA, ALIAS, SALDO_AWAL) + (3 cols per month)
        const maxCols = rows[startIndex]?.length || 18;
        const availableMonths = Math.min(12, Math.floor((maxCols - 4) / 3));
        
        console.log(`Sejahtera import: startIndex=${startIndex}, maxCols=${maxCols}, availableMonths=${availableMonths}`);

        const dataRows = rows.slice(startIndex);

        let successCount = 0;
        let failCount = 0;
        const results: any[] = [];
        const commitData: any[] = [];

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            
            const regNo = String(row[0] || '').trim();
            if (!regNo || isNaN(Number(regNo))) continue; // Skip empty/header rows
            
            // col 1 = NAMA (primary identifier)
            const nama = String(row[1] || '').trim();
            // col 2 = alias (sometimes alternate name)
            const alias = String(row[2] || '').trim();
            
            if (!nama) continue;
            
            // Match by NAMA (since this file uses NO REG, not NRP)
            const cleanNama = cleanNameForMatch(nama);
            let match = allMembers.find(m => cleanNameForMatch(m.name) === cleanNama);
            
            // Try partial match
            if (!match) {
                const matches = allMembers.filter(m => {
                    const mClean = cleanNameForMatch(m.name);
                    return mClean.includes(cleanNama) || cleanNama.includes(mClean);
                });
                if (matches.length === 1) match = matches[0];
            }
            
            // Try with alias
            if (!match && alias) {
                const cleanAlias = cleanNameForMatch(alias);
                const matches = allMembers.filter(m => {
                    const mClean = cleanNameForMatch(m.name);
                    return mClean === cleanAlias || mClean.includes(cleanAlias) || cleanAlias.includes(mClean);
                });
                if (matches.length === 1) match = matches[0];
            }

            if (!match) {
                results.push({
                    row: i + startIndex + 1, nrp: regNo, nama,
                    status: 'error', reason: `Anggota "${nama}" tidak ditemukan di sistem`
                });
                failCount++;
                continue;
            }

            // Loop through available months only (not hardcoded 12)
            const memberMutations = [];
            let rowHasData = false;

            for (let month = 1; month <= availableMonths; month++) {
                // Month 1 (Jan): KK=col4, KM=col5, SALDO=col6
                // Month 2 (Feb): KK=col7, KM=col8, SALDO=col9
                // Formula: baseIdx = 4 + ((month - 1) * 3)
                const baseIdx = 4 + ((month - 1) * 3);
                
                const kk = cleanNumber(row[baseIdx]);     // Kas Keluar
                const km = cleanNumber(row[baseIdx + 1]);  // Kas Masuk
                const saldo = cleanNumber(row[baseIdx + 2]); // Saldo Akhir
                
                if (kk > 0 || km > 0 || saldo > 0) {
                    rowHasData = true;
                    memberMutations.push({
                        memberId: match.id,
                        tahun: year,
                        bulan: month,
                        kasMasuk: km,
                        kasKeluar: kk,
                        saldoAkhir: saldo
                    });
                }
            }

            results.push({
                row: i + startIndex + 1,
                nrp: match.nrp || match.memberNo || regNo,
                nama: match.name,
                status: 'valid',
                reason: rowHasData ? `Valid (${memberMutations.length} bulan data)` : 'Tidak ada mutasi',
                mutasiCount: memberMutations.length
            });

            if (rowHasData) {
                commitData.push(...memberMutations);
            }
            successCount++;
        }

        if (mode === "commit" && commitData.length > 0) {
            await prisma.$transaction(async (tx) => {
                // Delete existing records for the same year to prevent duplicates
                const memberIds = [...new Set(commitData.map(d => d.memberId))];
                await tx.tabunganSejahteraHistory.deleteMany({
                    where: {
                        tahun: year,
                        memberId: { in: memberIds }
                    }
                });
                
                // insert many
                await tx.tabunganSejahteraHistory.createMany({
                    data: commitData
                });
            });
            
            // log
            try {
                const session = await auth();
                const reqInfo = extractRequestInfo(request);
                const userInfo = extractUserFromSession(session);
                await logAudit({
                    ...userInfo, ...reqInfo, action: "IMPORT", module: "Tabungan_Sejahtera",
                    description: `Import data sejahtera tahun ${year}: ${successCount} anggota valid, total mutasi ${commitData.length}.`,
                    newData: { year, successCount, mutasiCount: commitData.length },
                });
            } catch (e) {}
        }

        return NextResponse.json({
            data: {
                totalRows: results.length,
                success: successCount,
                failed: failCount,
                preview: results
            }
        });

    } catch (err: any) {
        console.error("POST /api/sejahtera/import error:", err);
        return NextResponse.json({ message: "Gagal memproses file: " + err.message }, { status: 500 });
    }
}

// Clean helpers
function cleanNumber(raw: string | number | undefined): number {
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === 'number') return raw;
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function cleanNameForMatch(name: string): string {
    if (!name) return "";
    let clean = String(name).replace(/['"]/g, '').trim().toUpperCase();
    clean = clean.split(',')[0].trim(); 
    
    const titles = [' S.I.K.', ' SIK', ' S.H.', ' SH', ' S.PD.', ' S.PD', ' S.T.K.', ' STK', ' S.SOS.', ' S.SOS', ' S.E.', ' SE', ' S.IP.', ' SIP', ' M.H.', ' MH', ' M.SC.', ' MSC', ' M.M.', ' MM', ' S.T.', ' ST', ' S.PT.', ' SPT', ' S.OR.'];
    
    let changed = true;
    while(changed) {
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
