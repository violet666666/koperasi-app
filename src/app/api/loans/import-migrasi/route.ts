import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

function generateLoanNo() {
    return 'SP-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

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

        // ====================================================================
        // ACTUAL FILE FORMAT (RINCIAN PIUTANG SP):
        //
        // SP 25 format (14 cols):
        //   Row 9:  NO | NAMA | PANGKAT | NRP | TGL PINJAM | PINJAM | SELAMA | PER DESEMBER 2025 | ... 
        //   Row 10: "" | ""   | ""      | ""  | ""         | ""     | ""     | ANGSURAN | X ANGSURAN | BS | JUMLAH | SISA SALDO | ...
        //   Col index: 0   1      2       3        4           5       6        7          8         9     10        11
        //
        // SP 26 format (27 cols, extends SP 25):
        //   Same as above + extra monthly columns:
        //   Col 12: PINJAM JAN | 13: X ANGSURAN | 14: (jan label)
        //   Col 15: PINJAM FEB | 16: X ANGSURAN | 17: (feb label) 
        //   Col 18: PINJAM MRT | 19: X ANGSURAN | 20: (maret label)
        //   Col 21: total x per maret | 22: JUMLAH PER MARET | 23: SISA SALDO PER MARET 26
        //
        // IMPORTANT: Data is grouped per SATKER (unit kerja). Headers repeat multiple times!
        //   Row 17: "SIWAS"
        //   Row 19: NO | NAMA | PANGKAT | NRP | ...  <-- HEADER REPEATS
        //   Row 20: "" | "" | "" | ... | ANGSURAN | X ANGSURAN | ...  <-- SUB-HEADER
        //   Row 15: "JUMLAH" | ... <-- SUBTOTAL ROW
        //
        // Must skip: "JUMLAH" rows, satker label rows, repeated headers, empty rows
        // ====================================================================

        // Try to find the best sheet — prefer "Sheet1 (2)" for SP 26, or "rincian SP"
        let sheetName = workbook.SheetNames[0];
        for (const sn of workbook.SheetNames) {
            const snUpper = sn.toUpperCase();
            if (snUpper.includes("SHEET1 (2)") || snUpper === "SHEET1 (2)") {
                sheetName = sn; break;
            }
        }
        // Fallback: prefer "rincian SP"
        if (sheetName === workbook.SheetNames[0]) {
            for (const sn of workbook.SheetNames) {
                if (sn.toLowerCase().includes("rincian")) {
                    sheetName = sn; break;
                }
            }
        }

        const worksheet = workbook.Sheets[sheetName];
        let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];

        if (rows.length < 10) {
            return NextResponse.json({ message: "File kosong atau format tidak valid" }, { status: 400 });
        }

        // Find FIRST header row to determine column structure
        let firstHeaderIdx = -1;
        for (let i = 0; i < Math.min(15, rows.length); i++) {
            const rowText = rows[i].map(c => String(c).toUpperCase().trim()).join('|');
            if (rowText.includes("NRP") && rowText.includes("PINJAM") && rowText.includes("SELAMA")) {
                firstHeaderIdx = i;
                break;
            }
        }

        if (firstHeaderIdx === -1) {
            return NextResponse.json({ message: "Format header tidak dikenali. Pastikan kolom NRP, PINJAM, dan SELAMA tersedia." }, { status: 400 });
        }

        // Map column indices from the first header row
        const headers = rows[firstHeaderIdx].map(h => String(h).toUpperCase().trim());
        const subHeaders = rows[firstHeaderIdx + 1]?.map(h => String(h).toUpperCase().trim()) || [];

        const nrpIdx = headers.findIndex(h => h.includes("NRP") || h === "NIP");
        const namaIdx = headers.findIndex(h => h.includes("NAMA"));
        const pinjamIdx = headers.findIndex(h => h === "PINJAM" || h === "PINJAMAN");
        const selamaIdx = headers.findIndex(h => h === "SELAMA" || h === "TENOR");

        // ANGSURAN is in sub-header row (row 10)
        let angsuranIdx = -1;
        for (let j = 7; j < subHeaders.length; j++) {
            if (subHeaders[j] === "ANGSURAN") { angsuranIdx = j; break; }
        }

        // Find the LAST column with "SISA" or "SALDO" in the sub-headers — this is the most up-to-date balance
        let saldoIdx = -1;
        for (let j = 0; j < Math.max(headers.length, subHeaders.length); j++) {
            const h = (headers[j] || '').toUpperCase();
            const sh = (subHeaders[j] || '').toUpperCase();
            if (h.includes("SISA") || sh.includes("SISA SALDO") || sh.includes("SISA")) {
                saldoIdx = j; // Keep updating — last one wins (most recent period)
            }
        }

        // Find BS (Bayar Sendiri) column in sub-headers
        let bsIdx = -1;
        for (let j = 7; j < subHeaders.length; j++) {
            if (subHeaders[j] === "BS") { bsIdx = j; break; }
        }

        console.log(`SP Import: sheet="${sheetName}", headerRow=${firstHeaderIdx}, NRP=${nrpIdx}, NAMA=${namaIdx}, PINJAM=${pinjamIdx}, SELAMA=${selamaIdx}, ANGSURAN=${angsuranIdx}, BS=${bsIdx}, SISA_SALDO=${saldoIdx}`);

        if (nrpIdx === -1 || pinjamIdx === -1 || saldoIdx === -1) {
            return NextResponse.json({ 
                message: `Gagal mendeteksi kolom penting (NRP: col${nrpIdx}, PINJAM: col${pinjamIdx}, SISA: col${saldoIdx}). Sheet: "${sheetName}".` 
            }, { status: 400 });
        }

        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true }
        });

        const defaultProduct = await prisma.loanProduct.findFirst();
        const defaultBranch = await prisma.branch.findFirst();

        // ====================================================================
        // 2-PASS SCANNING: Forward-fill blank NRPs for second loans
        // ====================================================================
        // Pass 1: Build Name -> NRP lookup from rows that have both
        const nameToNrpMap = new Map<string, string>();
        const dataRows: { rowIdx: number; row: string[] }[] = [];

        for (let i = firstHeaderIdx + 2; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            const col0 = String(row[0] || '').trim().toUpperCase();
            if (!col0 || col0 === "JUMLAH" || col0 === "NO" || isNaN(Number(col0))) continue;

            const nrpRaw = cleanNrp(String(row[nrpIdx] || ''));
            const nama = String(row[namaIdx] || '').trim();
            if (!nama) continue;

            dataRows.push({ rowIdx: i, row });

            if (nrpRaw) {
                const nameKey = cleanNameForMatch(nama);
                if (!nameToNrpMap.has(nameKey)) {
                    nameToNrpMap.set(nameKey, nrpRaw);
                }
            }
        }

        // Pass 2: Process all data rows, forward-filling blank NRPs
        let successCount = 0;
        let failCount = 0;
        const results: any[] = [];
        const commitData: any[] = [];

        for (const { rowIdx, row } of dataRows) {
            let nrp = cleanNrp(String(row[nrpIdx] || ''));
            const nama = String(row[namaIdx] || '').trim();

            // Forward-fill: if NRP is blank, resolve from Name->NRP map
            if (!nrp && nama) {
                const nameKey = cleanNameForMatch(nama);
                nrp = nameToNrpMap.get(nameKey) || '';
            }

            if (!nrp && !nama) continue;

            // Match member
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
                results.push({
                    row: rowIdx + 1, nrp, nama, gaji: 0,
                    status: 'error', reason: 'Anggota tidak ditemukan di sistem'
                });
                failCount++;
                continue;
            }

            // Read loan data
            const pinjam = cleanNumber(row[pinjamIdx]);
            const selama = cleanNumber(row[selamaIdx]);
            const angsuran = angsuranIdx >= 0 ? cleanNumber(row[angsuranIdx]) : 0;
            const bs = bsIdx >= 0 ? cleanNumber(row[bsIdx]) : 0;
            const sisaSaldo = cleanNumber(row[saldoIdx]);

            // Skip members with no active loan (PINJAM empty or SISA empty/0)
            if (pinjam <= 0 && sisaSaldo <= 0) continue;
            
            if (pinjam <= 0) {
                results.push({
                    row: rowIdx + 1, nrp: match.nrp || nrp, nama: match.name, gaji: 0,
                    status: 'error', reason: `Ada sisa saldo (${sisaSaldo.toLocaleString('id-ID')}) tapi kolom PINJAM kosong`
                });
                failCount++;
                continue;
            }

            if (sisaSaldo <= 0) {
                results.push({
                    row: rowIdx + 1, nrp: match.nrp || nrp, nama: match.name, gaji: pinjam,
                    status: 'error', reason: 'Sudah lunas (sisa Rp 0)'
                });
                failCount++;
                continue;
            }

            const principalOutstanding = sisaSaldo;
            const principalPaid = pinjam > principalOutstanding ? pinjam - principalOutstanding : 0;
            const computedInstallment = angsuran > 0 ? angsuran : (selama > 0 ? Math.ceil(pinjam / selama) : 0);

            const bsText = bs > 0 ? `, BS Rp ${bs.toLocaleString('id-ID')}` : '';
            results.push({
                row: rowIdx + 1,
                nrp: match.nrp || match.memberNo || nrp,
                nama: match.name,
                gaji: pinjam,           // UI: "Pokok Pinjaman"
                currentGaji: sisaSaldo, // UI: "Sisa Pokok" 
                status: 'valid',
                reason: `Tenor ${selama || '?'} bln, Angsuran ${computedInstallment.toLocaleString('id-ID')}/bln${bsText}, Dibayar Rp ${principalPaid.toLocaleString('id-ID')}`
            });

            commitData.push({
                memberId: match.id,
                principalAmount: pinjam,
                tenorMonths: selama || 60,
                monthlyInstallment: computedInstallment,
                principalOutstanding,
                principalPaid,
                bs
            });
            successCount++;
        }

        if (mode === "commit" && commitData.length > 0 && defaultProduct && defaultBranch) {
            const session = await auth();
            const userInfo = extractUserFromSession(session);
            const adminId = userInfo.userId || 1;

            // Process in batches of 20 to avoid transaction timeout
            const BATCH_SIZE = 20;
            for (let batchStart = 0; batchStart < commitData.length; batchStart += BATCH_SIZE) {
                const batch = commitData.slice(batchStart, batchStart + BATCH_SIZE);
                
                await prisma.$transaction(async (tx) => {
                    for (const data of batch) {
                        const today = new Date();

                        const applicationNo = generateLoanNo();
                        const app = await tx.loanApplication.create({
                            data: {
                                applicationNo,
                                memberId: data.memberId,
                                branchId: defaultBranch.id,
                                productId: defaultProduct.id,
                                amount: data.principalAmount,
                                tenorMonths: data.tenorMonths,
                                purpose: "Migrasi Pinjaman SP Lama",
                                status: "disbursed",
                                deductionSource: "gaji",
                                createdById: adminId,
                                approvedAt: today,
                                approvedById: adminId,
                            }
                        });

                        await tx.loan.create({
                            data: {
                                loanNo: 'LN-' + applicationNo,
                                applicationId: app.id,
                                memberId: data.memberId,
                                branchId: defaultBranch.id,
                                productSnapshot: JSON.parse(JSON.stringify(defaultProduct)),
                                principalAmount: data.principalAmount,
                                interestAmount: 0,
                                totalAmount: data.principalAmount,
                                adminFee: 0,
                                disbursedAmount: data.principalAmount,
                                tenorMonths: data.tenorMonths,
                                interestRate: 0,
                                interestMethod: defaultProduct.interestMethod,
                                monthlyInstallment: data.monthlyInstallment,
                                principalPaid: data.principalPaid,
                                interestPaid: 0,
                                lateFeePaid: 0,
                                principalOutstanding: data.principalOutstanding,
                                interestOutstanding: 0,
                                disbursementDate: today,
                                firstDueDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
                                lastDueDate: new Date(today.getFullYear(), today.getMonth() + data.tenorMonths, 1),
                                status: "active",
                                disbursedById: adminId,
                                // NO disbursementJournalId = no journal = no cash impact
                            }
                        });
                    }
                }, { timeout: 60000 }); // 60 second timeout per batch
            }

            try {
                const reqInfo = extractRequestInfo(request);
                await logAudit({
                    ...userInfo, ...reqInfo, action: "IMPORT", module: "Loan_Migrasi",
                    description: `Migrasi ${successCount} pinjaman aktif dari Excel SP.`,
                    newData: { successCount, sheet: sheetName },
                });
            } catch (e) {}
        }

        return NextResponse.json({
            data: {
                totalRows: results.length,
                success: successCount,
                failed: failCount,
                preview: results.map(r => ({
                    row: r.row,
                    nrp: r.nrp,
                    nama: r.nama,
                    status: r.status,
                    reason: r.reason,
                    gaji: r.gaji,
                    currentGaji: r.currentGaji
                }))
            }
        });

    } catch (err: any) {
        console.error("POST /api/loans/import-migrasi error:", err);
        return NextResponse.json({ message: "Gagal memproses file: " + err.message }, { status: 500 });
    }
}

// Clean helpers
function cleanNrp(raw: string | undefined): string {
    if (!raw) return "";
    return String(raw).replace(/['"]/g, '').replace(/\.0$/, '').trim();
}

function cleanNumber(raw: string | number | undefined): number {
    if (raw === undefined || raw === null || raw === "") return 0;
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
