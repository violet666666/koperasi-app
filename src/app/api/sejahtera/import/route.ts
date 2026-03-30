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

        // Ensure we got rows
        if (rows.length < 3) {
            return NextResponse.json({ message: "File kosong atau format tidak valid" }, { status: 400 });
        }

        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true }
        });

        // Skip headers (assume headers take top 3 rows typically for this file)
        // Find where data actually starts by looking for purely numeric NO column
        let startIndex = 0;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
            const noVal = String(rows[i][0]).trim();
            if (noVal === "1" || noVal === "1.0") {
                startIndex = i;
                break;
            }
        }

        if (startIndex === 0) {
            return NextResponse.json({ message: "Gagal menemukan baris data (kolom NO harus berisi angka 1)" }, { status: 400 });
        }

        const dataRows = rows.slice(startIndex);

        let successCount = 0;
        let failCount = 0;
        const results: any[] = [];
        const commitData: any[] = [];

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            // Format of Excel:
            // 0: NO
            // 1: REG/NRP
            // 2: NAMA
            // 3: SALDO AWAL
            // 4: JAN KK
            // 5: JAN KM
            // 6: JAN SALDO
            // 7: FEB KK
            // ...
            
            const no = String(row[0]).trim();
            if (!no || isNaN(Number(no))) continue; // Skip empty rows

            const nrpRaw = String(row[1] || '').trim();
            let nrp = cleanNrp(nrpRaw);
            const nama = String(row[2] || '').trim();
            
            if (!nrp && !nama) continue;
            
            // For Tab. Sejahtera it might use memberNo instead of NRP
            let match = allMembers.find(m => m.nrp === nrp || m.memberNo === nrp);
            
            // Partial name match if NRP missing
            if (!match && nama) {
                const cleanNama = cleanNameForMatch(nama);
                const matches = allMembers.filter(m => cleanNameForMatch(m.name) === cleanNama || cleanNameForMatch(m.name).includes(cleanNama));
                if (matches.length === 1) match = matches[0];
            }

            if (!match) {
                results.push({
                    row: i + startIndex + 1, nrp, nama,
                    status: 'error', reason: 'Anggota tidak sinkron (NRP/Nama tdk ditemukan)'
                });
                failCount++;
                continue;
            }

            // Loop 12 months
            const memberMutations = [];
            let rowHasData = false;

            for (let month = 1; month <= 12; month++) {
                // Calculation:
                // Month 1 begins at index 4 (JAN KK), index 5 (JAN KM), 6 (JAN SALDO)
                const baseIdx = 4 + ((month - 1) * 3);
                
                const kk = cleanNumber(row[baseIdx]);
                const km = cleanNumber(row[baseIdx + 1]);
                const saldo = cleanNumber(row[baseIdx + 2]);
                
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
                nrp: match.nrp || match.memberNo,
                nama: match.name,
                status: 'valid',
                reason: rowHasData ? 'Valid' : 'Tidak ada mutasi',
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
function cleanNrp(raw: string): string {
    return String(raw).replace(/['"]/g, '').replace(/\.0$/, '').trim();
}

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
    
    const titles = [' S.H.', ' SH', ' S.PD.', ' S.PD', ' S.T.K.', ' STK', ' S.SOS.', ' S.SOS', ' S.E.', ' SE', ' S.IP.', ' SIP', ' M.H.', ' MH', ' M.SC.', ' MSC', ' M.M.', ' MM', ' S.T.', ' ST', ' S.PT.', ' SPT', ' S.OR.'];
    
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
