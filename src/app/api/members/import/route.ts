import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// POST /api/members/import - Import CSV/XLSX data to update members
export async function POST(request: Request) {
    try {
        const formData: any = await request.formData();
        const file = formData.get("file") as File | null;
        const importType = (formData.get("type") as string) || "tunkin"; // tunkin, gaji
        const mode = (formData.get("mode") as string) || "preview"; // preview, commit

        if (!file) {
            return NextResponse.json(
                { message: "File wajib diupload" },
                { status: 400 }
            );
        }

        // Read file ArrayBuffer and parse with XLSX
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        let sheetName = workbook.SheetNames[0];
        
        // Handle specific sheet names commonly found in Police Salary files (tolerate spaces/case)
        const potGajiSheet = workbook.SheetNames.find(s => s.toUpperCase().includes('POT GAJI'));
        if (importType === 'gaji' && potGajiSheet) {
             sheetName = potGajiSheet;
        }
        
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays
        let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];

        // Filter out empty rows
        rows = rows.filter(row => row.some(cell => cell && String(cell).trim() !== ""));

        if (rows.length === 0) {
            return NextResponse.json(
                { message: "File kosong atau format tidak valid" },
                { status: 400 }
            );
        }

        // Find the header row (it's not always row 0, some police files have big headers)
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(20, rows.length); i++) {
            const rowStr = rows[i].join(" ").toLowerCase();
            if (rowStr.includes("nama") || rowStr.includes("nrp") || rowStr.includes("nip") || rowStr.includes("gaji") || rowStr.includes("tunkin") || rowStr.includes("bersih") || rowStr.includes("diterima")) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = rows[headerRowIndex].map(h => String(h).toLowerCase().trim());
        const dataRows = rows.slice(headerRowIndex + 1);

        let result;
        switch (importType) {
            case "tunkin":
                result = await processTunkinImport(headers, dataRows, mode);
                break;
            case "gaji":
                result = await processGajiImport(headers, dataRows, mode);
                break;
            case "tajib":
                result = await processTajibImport(headers, dataRows, mode);
                break;
            case "akun_anggota":
                result = await processAkunAnggotaImport(headers, dataRows, mode);
                break;
            default:
                return NextResponse.json(
                    { message: `Tipe import '${importType}' tidak didukung` },
                    { status: 400 }
                );
        }

        // Audit log for import activity
        try {
            const session = await auth();
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "IMPORT", module: "Anggota",
                description: `Import data '${importType}': ${(result as any).success || 0} berhasil, ${(result as any).failed || 0} gagal dari total ${dataRows.length} baris`,
                newData: { importType, mode, totalRows: dataRows.length, success: (result as any).success, failed: (result as any).failed },
            });
        } catch (e) { /* audit log failure must not break response */ }

        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("POST /api/members/import error:", error);
        return NextResponse.json(
            { message: "Gagal memproses import data. Pastikan format file benar." },
            { status: 500 }
        );
    }
}

// ==========================================
// Clean helpers
// ==========================================
function cleanNrp(raw: string): string {
    return String(raw).replace(/['"]/g, '').replace(/\.0$/, '').trim();
}

function cleanNumber(raw: string | number | undefined): number {
    if (raw === undefined || raw === null || raw === "") return 0;
    if (typeof raw === 'number') return raw;
    const isNegative = String(raw).includes('(') && String(raw).includes(')');
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    let num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    if (isNegative) num = -Math.abs(num);
    return num;
}

// Name matching cleaner (strips common titles and normalizes)
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

// ==========================================
// Auto-register member helper
// ==========================================
async function autoRegisterMember(nrp: string, nama: string, tx: any, salary?: number) {
    // Find default branch (head office or first available)
    let branch = await tx.branch.findFirst({ where: { isHeadOffice: true, isActive: true } });
    if (!branch) {
        branch = await tx.branch.findFirst({ where: { isActive: true } });
    }
    if (!branch) {
        throw new Error("Tidak ada cabang aktif di sistem");
    }

    // Use NRP as memberNo — only generate MBR fallback if NRP is missing
    const memberNo = nrp ? nrp.trim() : `MBR${new Date().toISOString().slice(0,10).replace(/-/g,'')}${Math.floor(1000+Math.random()*9000)}`;

    // Check if NRP already in use (edge case)
    const existingNrp = await tx.member.findUnique({ where: { nrp } });
    if (existingNrp) {
        // If member exists but salary provided, update it
        if (salary && salary > 0) {
            await tx.member.update({ where: { id: existingNrp.id }, data: { salary } });
        }
        return existingNrp;
    }

    // Create member (with salary if provided)
    const memberData: any = {
        memberNo,
        nrp,
        name: nama,
        branchId: branch.id,
        joinDate: new Date(),
        status: "active",
    };
    if (salary && salary > 0) {
        memberData.salary = salary;
    }
    const member = await tx.member.create({ data: memberData });

    // Create user account for login
    const anggotaRole = await tx.role.findUnique({ where: { name: "anggota" } });
    if (anggotaRole) {
        const hashedPassword = await bcrypt.hash(nrp, 10);
        const email = `${nrp}@koperasi.local`;
        const existingUser = await tx.user.findUnique({ where: { email } });
        if (!existingUser) {
            await tx.user.create({
                data: {
                    name: nama, email, password: hashedPassword,
                    roleId: anggotaRole.id, branchId: branch.id,
                    memberId: member.id, isActive: true,
                },
            });
        }
    }

    return member;
}

// ==========================================
// Tunkin Import
// ==========================================
async function processTunkinImport(headers: string[], dataRows: string[][], mode: string) {
    const nrpIdx = headers.findIndex(h => h.includes("nrp") || h.includes("nip") || h === "nrp/nip");
    const namaIdx = headers.findIndex(h => h.includes("nama") || h.includes("nmpeg"));
    
    let tunkinIdx = headers.findIndex(h => h.includes("sisa_tunkin") || h.includes("sisa tunkin") || h.includes("sisa"));
    if (tunkinIdx === -1) {
        tunkinIdx = headers.findIndex(h => h.includes("tunkin") || h.includes("tunjangan") || h.includes("tunles") || h.includes("bersih"));
    }

    if (namaIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom NAMA atau NMPEG tidak ditemukan di header file.",
            preview: [],
        };
    }

    if (tunkinIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom Tunkin ('SISA_TUNKIN', 'BERSIH', dsb) tidak ditemukan di header file.",
            preview: [],
        };
    }

    const allMembers = await prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, nrp: true, memberNo: true, tunlesKinerja: true }
    });

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length === 0) continue;

        const nrp = nrpIdx >= 0 ? cleanNrp(row[nrpIdx] || '') : '';
        const rawNama = String(row[namaIdx] || '').trim();
        
        if (!rawNama || rawNama.toUpperCase() === 'NAMA' || rawNama === '0') continue;
        if (/^\d+(\.\d+)?$/.test(rawNama)) continue; // skip numeric nama
        
        const tunkin = cleanNumber(row[tunkinIdx] || 0);
        const csvCleanName = cleanNameForMatch(rawNama);

        let matches: any[] = [];
        
        // 1. Matched by NRP
        if (nrp) {
            matches = allMembers.filter(m => m.nrp === nrp || m.memberNo === nrp);
        }
        
        // 2. Exact match on cleaned string
        if (matches.length === 0) {
            matches = allMembers.filter(m => cleanNameForMatch(m.name) === csvCleanName);
        }
        
        // 3. Partial/Fuzzy match
        if (matches.length === 0) {
            matches = allMembers.filter(m => {
                const dbName = cleanNameForMatch(m.name);
                return (dbName.includes(csvCleanName) || csvCleanName.includes(dbName)) && csvCleanName.length >= 5;
            });
        }

        if (matches.length === 0) {
            results.push({
                row: i + 2, nrp, nama: rawNama, tunkin,
                status: 'error', reason: 'Anggota tdk ditemukan (daftarkan dulu via Import Akun Anggota)',
            });
            failCount++;
            continue;
        }

        if (matches.length > 1) {
            results.push({
                row: i + 2, nrp, nama: rawNama, tunkin,
                status: 'error', reason: 'Ada 2+ kembaran nama, NRP dibutuhkan'
            });
            failCount++;
            continue;
        }

        const member = matches[0];

        if (mode === "commit") {
            await prisma.member.update({
                where: { id: member.id },
                data: { tunlesKinerja: tunkin },
            });
            member.tunlesKinerja = tunkin as any;
        }

        results.push({
            row: i + 2, nrp: member.nrp || nrp, nama: rawNama, tunkin,
            memberId: member.id, memberName: member.name,
            status: 'valid', reason: null,
            currentTunkin: member.tunlesKinerja ? Number(member.tunlesKinerja) : null,
        });
        successCount++;
    }

    return {
        mode, type: "tunkin",
        totalRows: results.length,
        success: successCount, failed: failCount,
        preview: results,
        allResults: mode === "commit" ? results : undefined,
    };
}

// ==========================================
// Tajib Import (Simpanan Wajib)
// ==========================================
async function processTajibImport(headers: string[], dataRows: string[][], mode: string) {
    const nrpIdx = headers.findIndex(h => h.includes("nrp") || h.includes("nip") || h === "nrp/nip");
    const namaIdx = headers.findIndex(h => h.includes("nama") || h.includes("nmpeg"));
    // Use the LAST column matching jml/jumlah (the total column, not an intermediate one)
    let tajibIdx = -1;
    for (let i = headers.length - 1; i >= 0; i--) {
        const h = headers[i];
        if (h.includes("jml") || h.includes("jumlah") || h.includes("tajib") || h.includes("Simpanan Wajib") || h.includes("tajip")) {
            tajibIdx = i;
            break;
        }
    }

    if (namaIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom NAMA atau NMPEG tidak ditemukan di header file.",
            preview: [],
        };
    }

    if (tajibIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom Jumlah ('JML', 'JUMLAH', 'TAJIB') tidak ditemukan di header file.",
            preview: [],
        };
    }

    const allMembers = await prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, nrp: true, memberNo: true, tabunganWajib: true }
    });

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length === 0) continue;

        const nrp = nrpIdx >= 0 ? cleanNrp(row[nrpIdx] || '') : '';
        const rawNama = String(row[namaIdx] || '').trim();
        
        if (!rawNama || rawNama.toUpperCase() === 'NAMA' || rawNama === '0') continue;
        if (/^\d+(\.\d+)?$/.test(rawNama)) continue;

        const tajib = cleanNumber(row[tajibIdx] || 0);
        const csvCleanName = cleanNameForMatch(rawNama);

        let matches: any[] = [];
        
        if (nrp) matches = allMembers.filter(m => m.nrp === nrp || m.memberNo === nrp);
        if (matches.length === 0) matches = allMembers.filter(m => cleanNameForMatch(m.name) === csvCleanName);
        if (matches.length === 0) {
            matches = allMembers.filter(m => {
                const dbName = cleanNameForMatch(m.name);
                return (dbName.includes(csvCleanName) || csvCleanName.includes(dbName)) && csvCleanName.length >= 5;
            });
        }

        if (matches.length === 0) {
            results.push({
                row: i + 2, nrp, nama: rawNama, tajib,
                status: 'error', reason: 'Anggota tdk ditemukan',
            });
            failCount++;
            continue;
        }

        if (matches.length > 1) {
            results.push({
                row: i + 2, nrp, nama: rawNama, tajib,
                status: 'error', reason: 'Ada 2+ kembaran nama, NRP dibutuhkan'
            });
            failCount++;
            continue;
        }

        const member = matches[0];

        if (mode === "commit") {
            await prisma.member.update({
                where: { id: member.id },
                data: { tabunganWajib: tajib },
            });
            member.tabunganWajib = tajib as any;
        }

        results.push({
            row: i + 2, nrp: member.nrp || nrp, nama: rawNama, tajib,
            memberId: member.id, memberName: member.name,
            status: 'valid', reason: null,
            currentTajib: member.tabunganWajib ? Number(member.tabunganWajib) : null,
        });
        successCount++;
    }

    return {
        mode, type: "tajib",
        totalRows: results.length,
        success: successCount, failed: failCount,
        preview: results,
        allResults: mode === "commit" ? results : undefined,
    };
}

// ==========================================
// Gaji Import
// ==========================================
async function processGajiImport(headers: string[], dataRows: string[][], mode: string) {
    const nrpIdx = headers.findIndex(h => h.includes("nrp") || h.includes("nip"));
    const namaIdx = headers.findIndex(h => h.includes("nama") || h.includes("nmpeg"));
    const gajiIdx = headers.findIndex(h => h.includes("gaji") || h.includes("bersih") || h.includes("salary") || h.includes("diterima"));

    if (namaIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom NAMA tidak ditemukan di header file.",
            preview: [],
        };
    }

    if (gajiIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom Gaji (cth: DITERIMA / BERSIH) tidak ditemukan di header file.",
            preview: [],
        };
    }

    const allMembers = await prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, nrp: true, memberNo: true, salary: true }
    });

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length === 0) continue;

        const nrp = nrpIdx >= 0 ? cleanNrp(row[nrpIdx] || '') : '';
        const rawNama = String(row[namaIdx] || '').trim();
        
        if (!rawNama || rawNama.toUpperCase() === 'NAMA' || rawNama === '0') continue;
        if (/^\d+(\.\d+)?$/.test(rawNama)) continue; // skip numeric nama

        const gaji = cleanNumber(row[gajiIdx] || 0);
        const csvCleanName = cleanNameForMatch(rawNama);

        let matches: any[] = [];
        
        // 1. Matched by NRP
        if (nrp) {
            matches = allMembers.filter(m => m.nrp === nrp || m.memberNo === nrp);
        }
        
        // 2. Exact match on cleaned string
        if (matches.length === 0) {
            matches = allMembers.filter(m => cleanNameForMatch(m.name) === csvCleanName);
        }
        
        // 3. Partial/Fuzzy match
        if (matches.length === 0) {
            matches = allMembers.filter(m => {
                const dbName = cleanNameForMatch(m.name);
                // Simple inclusion check if string length > 5
                return (dbName.includes(csvCleanName) || csvCleanName.includes(dbName)) && csvCleanName.length >= 5;
            });
        }

        if (matches.length === 0) {
            results.push({
                row: i + 2, nrp, nama: rawNama, gaji,
                status: 'error', reason: 'Anggota tdk ditemukan (daftarkan dulu via Import Akun Anggota)',
            });
            failCount++;
            continue;
        }

        if (matches.length > 1) {
            results.push({
                row: i + 2, nrp, nama: rawNama, gaji,
                status: 'error', reason: 'Ada 2+ kembaran nama, NRP dibutuhkan'
            });
            failCount++;
            continue;
        }

        const member = matches[0];

        if (mode === "commit") {
            await prisma.member.update({
                where: { id: member.id },
                data: { salary: gaji },
            });
            member.salary = gaji as any;
        }

        results.push({
            row: i + 2, nrp: member.nrp || nrp, nama: rawNama, gaji,
            memberId: member.id, memberName: member.name,
            status: 'valid', reason: null,
            currentGaji: member.salary ? Number(member.salary) : null,
        });
        successCount++;
    }

    return {
        mode, type: "gaji",
        totalRows: results.length,
        success: successCount, failed: failCount,
        preview: results,
        allResults: mode === "commit" ? results : undefined,
    };
}

// ==========================================
// Akun Anggota Import (NRP + Nama + optional Gaji)
// ==========================================
async function processAkunAnggotaImport(headers: string[], dataRows: string[][], mode: string) {
    const nrpIdx = headers.findIndex(h => h.includes("nrp") || h.includes("nip") || h === "nrp/nip");
    const namaIdx = headers.findIndex(h => h.includes("nama") || h.includes("nmpeg"));
    const gajiIdx = headers.findIndex(h => h.includes("jumlah gaji") || h.includes("gaji diterima") || h.includes("gaji") || h.includes("diterima") || h.includes("bersih") || h.includes("salary"));

    if (nrpIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom NRP/NIP tidak ditemukan di header file. Wajib ada untuk import akun anggota.",
            preview: [],
        };
    }

    if (namaIdx === -1) {
        return {
            success: 0, failed: 0,
            error: "Kolom NAMA tidak ditemukan di header file.",
            preview: [],
        };
    }

    const allMembers = await prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, nrp: true, memberNo: true, salary: true }
    });

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length === 0) continue;

        const nrp = cleanNrp(row[nrpIdx] || '');
        const rawNama = String(row[namaIdx] || '').trim();
        const gaji = gajiIdx >= 0 ? cleanNumber(row[gajiIdx] || 0) : 0;

        if (!rawNama || rawNama.toUpperCase() === 'NAMA' || rawNama === '0') continue;
        if (/^\d+(\.\d+)?$/.test(rawNama)) continue;
        if (!nrp) {
            results.push({
                row: i + 2, nrp: '', nama: rawNama, gaji,
                status: 'error', reason: 'NRP/NIP kosong, tidak bisa membuat akun',
            });
            failCount++;
            continue;
        }

        // Check if member already exists — SKIP, do NOT modify existing data
        const existing = allMembers.find(m => m.nrp === nrp || m.memberNo === nrp);
        if (existing) {
            results.push({
                row: i + 2, nrp, nama: rawNama,
                memberId: existing.id, memberName: existing.name,
                status: 'valid', reason: 'Sudah terdaftar (dilewati)',
                isNewMember: false,
                currentGaji: existing.salary ? Number(existing.salary) : null,
            });
            successCount++;
            continue;
        }

        // New member to register
        if (mode === "commit") {
            try {
                const newMember = await prisma.$transaction(async (tx) => {
                    return await autoRegisterMember(nrp, rawNama, tx, gaji > 0 ? gaji : undefined);
                });

                allMembers.push({ id: newMember.id, name: newMember.name, nrp: newMember.nrp, memberNo: newMember.memberNo, salary: newMember.salary });

                results.push({
                    row: i + 2, nrp, nama: rawNama, gaji: gaji || undefined,
                    memberId: newMember.id, memberName: newMember.name,
                    status: 'valid', reason: null,
                    isNewMember: true,
                });
                successCount++;
            } catch (err) {
                console.error("Auto-register error:", err);
                results.push({
                    row: i + 2, nrp, nama: rawNama, gaji: gaji || undefined,
                    status: 'error', reason: 'Gagal mendaftarkan: ' + (err instanceof Error ? err.message : 'Unknown'),
                });
                failCount++;
            }
        } else {
            // Preview mode
            results.push({
                row: i + 2, nrp, nama: rawNama, gaji: gaji || undefined,
                memberId: null, memberName: `[BARU] ${rawNama}`,
                status: 'valid', reason: null,
                isNewMember: true,
            });
            successCount++;
        }
    }

    return {
        mode, type: "akun_anggota",
        totalRows: results.length,
        success: successCount, failed: failCount,
        preview: results,
        hasGaji: gajiIdx >= 0,
    };
}
