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
        // Row 2: NO | NAMA | (empty) | SALDO | JANUARI | ... | SALDO  | ...
        // Row 3: REG |      |        | AWAL  | KK      | KM | AKHIR  | ...
        // Row 5+: 0001 | NGATEMAN | | 634,700 | | | 634,700 | ...
        //
        // col 0: NO REG (NOT NRP! e.g. "0001")
        // col 1: NAMA
        // col 2: Alias/keterangan (sometimes blank/other name)
        // col 3: SALDO AWAL
        // col 4+: KK, KM, SALDO per month (3 cols each)
        // ====================================================================

        // Find the data start row
        let startIndex = -1;
        for (let i = 0; i < Math.min(15, rows.length); i++) {
            const col0 = String(rows[i][0]).trim();
            if (col0 && /^\d{2,}$/.test(col0) && !isNaN(Number(col0))) {
                startIndex = i;
                break;
            }
        }

        if (startIndex === -1) {
            return NextResponse.json({ message: "Gagal menemukan baris data. Pastikan format file Tab Sejahtera benar (NO REG di kolom pertama)." }, { status: 400 });
        }

        // Detect how many months based on column count
        const maxCols = rows[startIndex]?.length || 18;
        const availableMonths = Math.min(12, Math.floor((maxCols - 4) / 3));
        
        console.log(`Sejahtera import: startIndex=${startIndex}, maxCols=${maxCols}, availableMonths=${availableMonths}`);

        const dataRows = rows.slice(startIndex);

        let successCount = 0;
        let failCount = 0;
        const results: any[] = [];
        const commitData: any[] = [];
        
        // Track which memberIds have already been matched to prevent duplicates
        const matchedMemberIds = new Set<number>();
        // Track commitData keys to prevent duplicate month entries
        const commitKeys = new Set<string>();

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            
            const regNo = String(row[0] || '').trim();
            if (!regNo || isNaN(Number(regNo))) continue;
            
            const nama = String(row[1] || '').trim();
            const aliasOrNrp = String(row[2] || '').trim();
            
            if (!nama) continue;
            
            // 1. Try matching by NRP first (if user updated the file to include NRP in col 0 or col 2)
            let match = allMembers.find(m => m.nrp === regNo || m.memberNo === regNo);
            if (!match && aliasOrNrp && /\d{4,}/.test(aliasOrNrp)) {
                match = allMembers.find(m => m.nrp === aliasOrNrp || m.memberNo === aliasOrNrp);
            }
            
            // 2. Match by NAMA — STRICT exact match
            if (!match) {
                const cleanNama = cleanNameForMatch(nama);
                match = allMembers.find(m => cleanNameForMatch(m.name) === cleanNama);
                
                // 3. Try partial name match if no exact match (min 4 chars)
                if (!match && cleanNama.length >= 4) {
                    const matches = allMembers.filter(m => {
                        const mClean = cleanNameForMatch(m.name);
                        return (mClean.startsWith(cleanNama) || cleanNama.startsWith(mClean)) 
                            && !matchedMemberIds.has(m.id);
                    });
                    if (matches.length === 1) match = matches[0];
                }
            }
            
            // 4. Try with alias if not matched by name/NRP (exact match only)
            if (!match && aliasOrNrp && aliasOrNrp.length >= 3 && !/\d/.test(aliasOrNrp)) {
                const cleanAlias = cleanNameForMatch(aliasOrNrp);
                const matches = allMembers.filter(m => {
                    const mClean = cleanNameForMatch(m.name);
                    return (mClean === cleanAlias || mClean.startsWith(cleanAlias) || cleanAlias.startsWith(mClean))
                        && !matchedMemberIds.has(m.id);
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
            
            // Prevent same member being matched twice
            if (matchedMemberIds.has(match.id)) {
                results.push({
                    row: i + startIndex + 1, nrp: regNo, nama,
                    status: 'error', reason: `Anggota "${match.name}" sudah di-match oleh baris lain (duplikat)`
                });
                failCount++;
                continue;
            }
            matchedMemberIds.add(match.id);

            // Loop through available months
            const memberMutations = [];
            let rowHasData = false;

            for (let month = 1; month <= availableMonths; month++) {
                const baseIdx = 4 + ((month - 1) * 3);
                
                const kk = cleanNumber(row[baseIdx]);
                const km = cleanNumber(row[baseIdx + 1]);
                const saldo = cleanNumber(row[baseIdx + 2]);
                
                if (kk > 0 || km > 0 || saldo > 0) {
                    const key = `${match.id}-${year}-${month}`;
                    if (!commitKeys.has(key)) {
                        commitKeys.add(key);
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
            // Delete existing records first (outside the insert transaction)
            const memberIds = [...new Set(commitData.map(d => d.memberId))];
            await prisma.tabunganSejahteraHistory.deleteMany({
                where: {
                    tahun: year,
                    memberId: { in: memberIds }
                }
            });
            
            // Insert in batches of 100 to avoid timeout
            const BATCH_SIZE = 100;
            for (let batchStart = 0; batchStart < commitData.length; batchStart += BATCH_SIZE) {
                const batch = commitData.slice(batchStart, batchStart + BATCH_SIZE);
                await prisma.tabunganSejahteraHistory.createMany({
                    data: batch,
                    skipDuplicates: true, // Safety net to skip any remaining duplicates
                });
            }
            
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
