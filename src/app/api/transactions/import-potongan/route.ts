import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// ====================================================================
// BARANG PRIMKOPPOL.XLSX FORMAT:
// 3 Sheets: Januari, feb, maret (each = 1 month)
// Row 0 = Header: ["", "TAJIB", "BARANG", "SP", "JUMLAH", "NAMA"]
// Row 1+: Data:
//   col 0: NRP (e.g. "84041976" or long NIP "198601062025212008")
//   col 1: TAJIB — Tabungan Wajib (usually 100,000)
//   col 2: BARANG — Potongan pembelian toko koperasi
//   col 3: SP — Angsuran Simpan Pinjam
//   col 4: JUMLAH — Total (TAJIB + BARANG + SP)
//   col 5: NAMA — Nama anggota
// ====================================================================

export async function POST(request: Request) {
    try {
        const formData: any = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview";

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        if (workbook.SheetNames.length === 0) {
            return NextResponse.json({ message: "File kosong" }, { status: 400 });
        }

        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true, tabunganWajib: true }
        });

        let totalSuccess = 0;
        let totalFail = 0;
        const allResults: any[] = [];
        const commitUpdates: { memberId: number; tajibTotal: number; months: number }[] = [];
        const memberTajibMap = new Map<number, { tajib: number; months: number }>();

        // Process each sheet (each sheet = 1 month)
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

        for (let sheetIdx = 0; sheetIdx < workbook.SheetNames.length; sheetIdx++) {
            const sheetName = workbook.SheetNames[sheetIdx];
            const ws = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

            if (rows.length < 2) continue;

            // Detect if row 0 is header (col 0 empty, col 1 contains "TAJIB")
            const isHeader = String(rows[0][1] || '').toUpperCase().includes("TAJIB");
            const startRow = isHeader ? 1 : 0;

            for (let i = startRow; i < rows.length; i++) {
                const row = rows[i];
                const nrpRaw = String(row[0] || '').trim();
                if (!nrpRaw) continue;

                const nrp = cleanNrp(nrpRaw);
                const tajib = cleanNumber(row[1]);
                const barang = cleanNumber(row[2]);
                const sp = cleanNumber(row[3]);
                const jumlah = cleanNumber(row[4]);
                const nama = String(row[5] || '').trim();

                // Skip rows with no meaningful data
                if (tajib <= 0 && barang <= 0 && sp <= 0) continue;

                // Match member by NRP
                let match = allMembers.find(m => m.nrp === nrp || m.memberNo === nrp);
                if (!match && nama) {
                    const cleanNama = cleanNameForMatch(nama);
                    const matches = allMembers.filter(m => {
                        const mClean = cleanNameForMatch(m.name);
                        return mClean === cleanNama || mClean.includes(cleanNama) || cleanNama.includes(mClean);
                    });
                    if (matches.length === 1) match = matches[0];
                }

                if (!match) {
                    allResults.push({
                        row: i + 1, nrp, nama, sheet: sheetName,
                        tajib, barang, sp, jumlah,
                        status: 'error', reason: `Anggota tidak ditemukan`
                    });
                    totalFail++;
                    continue;
                }

                // Accumulate TAJIB for this member across sheets
                const existing = memberTajibMap.get(match.id);
                if (existing) {
                    existing.tajib += tajib;
                    existing.months += 1;
                } else {
                    memberTajibMap.set(match.id, { tajib, months: 1 });
                }

                allResults.push({
                    row: i + 1,
                    nrp: match.nrp || match.memberNo || nrp,
                    nama: match.name,
                    sheet: sheetName,
                    tajib, barang, sp, jumlah,
                    status: 'valid',
                    reason: `${sheetName}: Tajib ${tajib.toLocaleString('id-ID')}` +
                        (barang > 0 ? ` + Barang ${barang.toLocaleString('id-ID')}` : '') +
                        (sp > 0 ? ` + SP ${sp.toLocaleString('id-ID')}` : '')
                });
                totalSuccess++;
            }
        }

        // Build summary per member for preview
        const memberSummary: any[] = [];
        const processedMembers = new Set<number>();
        for (const r of allResults) {
            if (r.status !== 'valid') continue;
            const member = allMembers.find(m => (m.nrp || m.memberNo) === r.nrp);
            if (!member || processedMembers.has(member.id)) continue;
            processedMembers.add(member.id);

            const accumulated = memberTajibMap.get(member.id);
            memberSummary.push({
                row: r.row,
                nrp: r.nrp,
                nama: r.nama,
                memberName: r.nama,
                status: 'valid',
                gaji: accumulated?.tajib || 0, // Total TAJIB across all months (for UI)
                currentGaji: Number(member.tabunganWajib || 0), // Current tabunganWajib in DB
                reason: `${accumulated?.months || 0} bulan data, TAJIB total: Rp ${(accumulated?.tajib || 0).toLocaleString('id-ID')}`,
                mutasiCount: accumulated?.months || 0,
            });
        }

        // Also include errors in the preview
        const errorResults = allResults.filter(r => r.status === 'error');
        // Deduplicate errors by NRP
        const seenErrorNrps = new Set<string>();
        const uniqueErrors = errorResults.filter(r => {
            if (seenErrorNrps.has(r.nrp)) return false;
            seenErrorNrps.add(r.nrp);
            return true;
        });

        if (mode === "commit" && memberTajibMap.size > 0) {
            await prisma.$transaction(async (tx) => {
                for (const [memberId, data] of memberTajibMap.entries()) {
                    // Add TAJIB to existing tabunganWajib
                    await tx.member.update({
                        where: { id: memberId },
                        data: {
                            tabunganWajib: {
                                increment: data.tajib
                            }
                        }
                    });
                }
            });

            // Audit log
            try {
                const session = await auth();
                const reqInfo = extractRequestInfo(request);
                const userInfo = extractUserFromSession(session);
                await logAudit({
                    ...userInfo, ...reqInfo,
                    action: "IMPORT",
                    module: "Anggota",
                    description: `Import potongan gaji (Barang Primkoppol): ${memberTajibMap.size} anggota, ${workbook.SheetNames.length} bulan. TAJIB diakumulasi ke tabunganWajib.`,
                    newData: { memberCount: memberTajibMap.size, sheets: workbook.SheetNames },
                });
            } catch (e) { }
        }

        return NextResponse.json({
            data: {
                totalRows: memberSummary.length + uniqueErrors.length,
                success: memberSummary.length,
                failed: uniqueErrors.length,
                sheetsProcessed: workbook.SheetNames,
                preview: [...memberSummary, ...uniqueErrors.map(e => ({
                    row: e.row, nrp: e.nrp, nama: e.nama,
                    status: 'error', reason: e.reason,
                    gaji: 0, currentGaji: 0
                }))]
            }
        });

    } catch (err: any) {
        console.error("POST /api/transactions/import-potongan error:", err);
        return NextResponse.json({ message: "Gagal memproses file: " + err.message }, { status: 500 });
    }
}

function cleanNrp(raw: string): string {
    return String(raw).replace(/['"]/g, '').replace(/\.0$/, '').trim();
}

function cleanNumber(raw: string | number | undefined): number {
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === 'number') return raw;
    const s = String(raw).trim();
    if (s === '-' || s === '') return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function cleanNameForMatch(name: string): string {
    if (!name) return "";
    let clean = String(name).replace(/['"]/g, '').trim().toUpperCase();
    clean = clean.split(',')[0].trim();
    const titles = [' S.I.K.', ' SIK', ' S.H.', ' SH', ' S.PD.', ' S.PD', ' S.T.K.', ' STK', ' S.SOS.', ' S.SOS', ' S.E.', ' SE', ' S.IP.', ' SIP', ' M.H.', ' MH', ' M.SC.', ' MSC', ' M.M.', ' MM', ' S.T.', ' ST', ' S.PT.', ' SPT', ' S.OR.'];
    let changed = true;
    while (changed) {
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
