import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";
import { generateDocNumber } from "@/lib/utils"; // Assume this or something similar exists, otherwise default.

// Provide basic ID generator if standard one is missing
function generateLoanNo() {
    return 'SP-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

export async function POST(request: Request) {
    try {
        const formData: any = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview"; // preview, commit

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        let sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];

        if (rows.length < 2) {
            return NextResponse.json({ message: "File kosong atau format tidak valid" }, { status: 400 });
        }

        // 1. Identify header row
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
            const rowText = rows[i].map(c => String(c).toUpperCase()).join('|');
            if (rowText.includes("PINJAM") && rowText.includes("SELAMA") && rowText.includes("NRP")) {
                headerRowIdx = i;
                break;
            }
        }

        if (headerRowIdx === -1) {
            return NextResponse.json({ message: "Format header tidak dikenali. Pastikan kolom PINJAM, SELAMA, dan NRP tersedia." }, { status: 400 });
        }

        const headers = rows[headerRowIdx].map(h => String(h).toUpperCase().trim());
        const nrpIdx = headers.findIndex(h => h === "NRP" || h === "NIP");
        const namaIdx = headers.findIndex(h => h === "NAMA");
        const pinjamIdx = headers.findIndex(h => h === "PINJAM" || h === "PINJAMAN");
        const selamaIdx = headers.findIndex(h => h === "SELAMA" || h === "TENOR");
        const angsuranIdx = headers.findIndex(h => h === "ANGSURAN");
        
        // Sisa Saldo bisa bervariasi "SISA SALDO PER MARET", "SISA", "SALDO" dll. Cari yang paling ujung kalau banyak.
        let saldoIdx = -1;
        for (let j = headers.length - 1; j >= 0; j--) {
            if (headers[j].includes("SISA") || headers[j].includes("SALDO")) {
                saldoIdx = j;
                break;
            }
        }

        if (nrpIdx === -1 || pinjamIdx === -1 || selamaIdx === -1 || saldoIdx === -1) {
            return NextResponse.json({ message: `Gagal mendeteksi satu atau lebih kolom penting (NRP: ${nrpIdx}, PINJAM: ${pinjamIdx}, SELAMA: ${selamaIdx}, SISA: ${saldoIdx})` }, { status: 400 });
        }

        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true }
        });
        
        const defaultProduct = await prisma.loanProduct.findFirst();
        const defaultBranch = await prisma.branch.findFirst();

        const dataRows = rows.slice(headerRowIdx + 1);

        let successCount = 0;
        let failCount = 0;
        const results: any[] = [];
        const commitData: any[] = [];

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            
            // Kolom NO untuk cek baris kosong di kiri
            const no = String(row[0]).trim();
            if (!no || isNaN(Number(no))) continue;

            const nrpRaw = row[nrpIdx];
            let nrp = cleanNrp(nrpRaw);
            const nama = row[namaIdx];
            
            if (!nrp && !nama) continue;
            
            let match = allMembers.find(m => m.nrp === nrp || m.memberNo === nrp);
            if (!match && nama) {
                const cleanNama = cleanNameForMatch(nama);
                const matches = allMembers.filter(m => cleanNameForMatch(m.name) === cleanNama || cleanNameForMatch(m.name).includes(cleanNama));
                if (matches.length === 1) match = matches[0];
            }

            if (!match) {
                results.push({
                    row: i + headerRowIdx + 2, nrp, nama, gaji: 0, sisa: 0,
                    status: 'error', reason: 'Anggota tidak sinkron (NRP/Nama tdk ditemukan)'
                });
                failCount++;
                continue;
            }

            const pinjamStr = cleanNumber(row[pinjamIdx]);
            const selamaStr = cleanNumber(row[selamaIdx]);
            const angsuranStr = cleanNumber(row[angsuranIdx] || "0");
            const saldoStr = cleanNumber(row[saldoIdx]);

            if (pinjamStr <= 0 || selamaStr <= 0) {
                results.push({
                    row: i + headerRowIdx + 2, nrp, nama, gaji: pinjamStr, sisa: saldoStr,
                    status: 'error', reason: 'Jumlah pinjam atau tenor tidak valid / Rp 0'
                });
                failCount++;
                continue;
            }
            
            // if Saldo = 0, no migration needed or it's a paid off loan
            if (saldoStr <= 0) {
                 results.push({
                    row: i + headerRowIdx + 2, nrp, nama, gaji: pinjamStr, sisa: saldoStr,
                    status: 'error', reason: 'Sisa saldo Rp 0 (sudah lunas)'
                });
                failCount++;
                continue;
            }

            const principalOutstanding = saldoStr;
            const principalPaid = pinjamStr > principalOutstanding ? pinjamStr - principalOutstanding : 0;

            results.push({
                row: i + headerRowIdx + 2,
                nrp: match.nrp || match.memberNo,
                nama: match.name,
                gaji: pinjamStr,     // mapped to "gaji" prop for UI display hack
                currentGaji: saldoStr, // mapped to "currentGaji" prop for UI table display 
                status: 'valid',
                reason: `Selama ${selamaStr} bln, Selesai bayar: Rp ${(principalPaid).toLocaleString('id-ID')}`
            });

            if (mode === "commit") {
                commitData.push({
                    memberId: match.id,
                    principalAmount: pinjamStr,
                    tenorMonths: selamaStr,
                    monthlyInstallment: angsuranStr || (pinjamStr / selamaStr),
                    principalOutstanding,
                    principalPaid
                });
            }
            successCount++;
        }

        if (mode === "commit" && commitData.length > 0 && defaultProduct && defaultBranch) {
            
            const session = await auth();
            const userInfo = extractUserFromSession(session);
            const adminId = parseInt(userInfo.id || "1");

            await prisma.$transaction(async (tx) => {
                for(const data of commitData) {
                    const today = new Date();
                    
                    // 1. Create Application (Approved)
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

                    // 2. Create Active Loan WITHOUT trigering cash bank transaction equivalent
                    await tx.loan.create({
                        data: {
                            loanNo: 'LN-' + applicationNo,
                            applicationId: app.id,
                            memberId: data.memberId,
                            branchId: defaultBranch.id,
                            productSnapshot: JSON.parse(JSON.stringify(defaultProduct)),
                            principalAmount: data.principalAmount,
                            interestAmount: 0, // Assume 0% initially for migrated Primkoppol loans
                            totalAmount: data.principalAmount,
                            adminFee: 0,
                            disbursedAmount: data.principalAmount,
                            tenorMonths: data.tenorMonths,
                            interestRate: defaultProduct.interestRate,
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
                            // Notice we DO NOT provide disbursementJournalId, hence no Journal records are made for cash out
                        }
                    });
                }
            });
            
            // log
            try {
                 const reqInfo = extractRequestInfo(request);
                 await logAudit({
                     ...userInfo, ...reqInfo, action: "IMPORT", module: "Loan_Migrasi",
                     description: `Migrasi ${successCount} data Piutang SP (Active Loans).`,
                     newData: { successCount },
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
                    // we hijack gaji & currentGaji for UI
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
    if(!raw) return "";
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
    
    // ... [Basic title cleaning logic] ...
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
